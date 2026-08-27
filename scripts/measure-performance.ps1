<#
.SYNOPSIS
    Scripted perf measurement against production (issue #89). Single-user,
    sequential, no load generation. Full method notes live in
    docs/performance-evidence.md; this header covers only what that doc
    does not already record.

.DESCRIPTION
    Measures "/" and "/assets" (authenticated) and "/a/<token>" (anonymous):
    a TTFB proxy from 5 sequential raw HTTP fetches (median reported), and
    LCP from one Lighthouse run per route. It also reports which element
    each route's LCP was measured against, read from whichever of
    Lighthouse's LCP audits the running version ships - see
    $LCP_ELEMENT_AUDIT_IDS.

    Signs in once with SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD (read from
    the environment, or from ../.env.local if present) - these values are
    never printed, logged, or written to any output file. The session
    cookie is reused for the two authenticated raw fetches and passed to
    Lighthouse via --extra-headers; the public route is measured with no
    cookie at all.

    Uses System.Net.Http.HttpClient rather than Invoke-WebRequest /
    WebRequestSession: on this host, Invoke-WebRequest throws a
    NullReferenceException from its internal ShouldContinue/
    PromptForChoice path because the host is non-interactive. HttpClient
    with an explicit CookieContainer gives the same reused-session
    behaviour without that code path.

.PARAMETER BaseUrl
    Root URL of the deployment to measure. Defaults to production.

.PARAMETER Token
    A public scan token to measure directly, skipping discovery.
    Any /a/<token> works; nothing about a specific asset is recorded.

.PARAMETER LighthouseVersion
    Exact lighthouse version to run via npx (pinned, not "latest").

.EXAMPLE
    ./scripts/measure-performance.ps1
#>

param(
    [string]$BaseUrl = "https://inventaris-aset-ppm.vercel.app",
    [string]$Token,
    [string]$LighthouseVersion = "13.4.1"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Net.Http
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# --- Named constants (no magic numbers) ---
$LCP_BUDGET_MS = 2500
$TTFB_BUDGET_MS = 800
$SAMPLE_COUNT = 5
$RETRY_ATTEMPTS = 3
$RETRY_DELAY_SECONDS = 3
$HTTP_OK = 200
$DASHBOARD_PATH = "/"
$ASSETS_PATH = "/assets"
$SESSION_COOKIE_NAME_HINT = "*session_token*"
$ASSET_ID_PATTERN = '/assets/([A-Za-z0-9_-]{8,})"'
$SCAN_TOKEN_PATTERN = '/a/([A-Za-z0-9_-]{6,})'
# An LCP element snippet is a whole opening tag with every attribute on it, so
# it is truncated for the console rather than wrapped over several lines.
$LCP_ELEMENT_SNIPPET_MAX_CHARS = 160

# --- Environment ---
function Import-DevEnv {
    $envFile = Join-Path (Split-Path $PSScriptRoot -Parent) ".env.local"
    if (-not (Test-Path $envFile)) {
        Write-Host "measure-performance: .env.local not found; using the ambient environment."
        return
    }
    foreach ($line in Get-Content $envFile) {
        if ($line -match '^([A-Z_]+)="(.*)"$' -and -not (Test-Path "env:$($matches[1])")) {
            [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
        }
    }
}

function Get-RequiredEnvValue([string]$name) {
    $value = [Environment]::GetEnvironmentVariable($name)
    if ([string]::IsNullOrEmpty($value)) {
        throw "measure-performance: required environment variable $name is not set (checked ambient environment and .env.local)."
    }
    return $value
}

# --- Retry wrapper: DNS to *.vercel.app flaps intermittently on this machine ---
function Invoke-WithRetry([scriptblock]$action, [string]$label) {
    $attempt = 0
    while ($true) {
        $attempt += 1
        try {
            return & $action
        } catch {
            if ($attempt -ge $RETRY_ATTEMPTS) {
                throw "measure-performance: $label failed after $RETRY_ATTEMPTS attempts: $($_.Exception.Message)"
            }
            Write-Host "measure-performance: $label attempt $attempt failed ($($_.Exception.Message)); retrying in ${RETRY_DELAY_SECONDS}s."
            Start-Sleep -Seconds $RETRY_DELAY_SECONDS
        }
    }
}

# --- Authenticated session ---
function New-AuthenticatedClient([string]$baseUrl) {
    $email = Get-RequiredEnvValue "SEED_ADMIN_EMAIL"
    $password = Get-RequiredEnvValue "SEED_ADMIN_PASSWORD"

    $cookieContainer = New-Object System.Net.CookieContainer
    $handler = New-Object System.Net.Http.HttpClientHandler
    $handler.CookieContainer = $cookieContainer
    $handler.AllowAutoRedirect = $true
    $client = New-Object System.Net.Http.HttpClient($handler)

    $body = @{ email = $email; password = $password; rememberMe = $true } | ConvertTo-Json
    $content = New-Object System.Net.Http.StringContent($body, [System.Text.Encoding]::UTF8, "application/json")

    $response = Invoke-WithRetry { $client.PostAsync("$baseUrl/api/auth/sign-in/email", $content).GetAwaiter().GetResult() } "sign-in"
    if ([int]$response.StatusCode -ne $HTTP_OK) {
        throw "measure-performance: sign-in returned HTTP $([int]$response.StatusCode); check SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are still valid for $baseUrl. (Credential values are never printed.)"
    }

    $sessionCookie = $cookieContainer.GetCookies([Uri]$baseUrl) |
        Where-Object { $_.Name -like $SESSION_COOKIE_NAME_HINT } |
        Select-Object -First 1
    if (-not $sessionCookie) {
        throw "measure-performance: sign-in succeeded but no session cookie was set; the auth flow may have changed."
    }

    return [pscustomobject]@{
        Client       = $client
        CookieHeader = "$($sessionCookie.Name)=$($sessionCookie.Value)"
    }
}

# --- Public scan token discovery ---
function Find-ScanToken([System.Net.Http.HttpClient]$authedClient, [string]$baseUrl) {
    $assetsBody = Invoke-WithRetry {
        $resp = $authedClient.GetAsync("$baseUrl$ASSETS_PATH").GetAwaiter().GetResult()
        $resp.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    } "asset list fetch"

    $idMatch = [regex]::Match($assetsBody, $ASSET_ID_PATTERN)
    if (-not $idMatch.Success) {
        throw "measure-performance: no asset found on $ASSETS_PATH to discover a scan token from. Seed at least one asset, or pass -Token explicitly."
    }

    $detailBody = Invoke-WithRetry {
        $resp = $authedClient.GetAsync("$baseUrl/assets/$($idMatch.Groups[1].Value)").GetAwaiter().GetResult()
        $resp.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    } "asset detail fetch"

    $tokenMatch = [regex]::Match($detailBody, $SCAN_TOKEN_PATTERN)
    if (-not $tokenMatch.Success) {
        throw "measure-performance: asset detail page did not contain a /a/<token> link."
    }
    return $tokenMatch.Groups[1].Value
}

# --- Raw fetch medians (TTFB proxy) ---
function Get-Median([double[]]$samples) {
    $sorted = $samples | Sort-Object
    return $sorted[[math]::Floor($sorted.Count / 2)]
}

function Measure-RouteFetch([System.Net.Http.HttpClient]$client, [string]$url, [string]$label) {
    $samples = @()
    for ($i = 1; $i -le $SAMPLE_COUNT; $i++) {
        $elapsedMs = Invoke-WithRetry {
            $sw = [System.Diagnostics.Stopwatch]::StartNew()
            $resp = $client.GetAsync($url).GetAwaiter().GetResult()
            $null = $resp.Content.ReadAsStringAsync().GetAwaiter().GetResult()
            $sw.Stop()
            if (-not $resp.IsSuccessStatusCode) {
                throw "HTTP $([int]$resp.StatusCode)"
            }
            $sw.Elapsed.TotalMilliseconds
        } "$label sample $i"
        $samples += $elapsedMs
        Write-Host ("  sample {0}: {1} ms" -f $i, [math]::Round($elapsedMs))
    }
    return [pscustomobject]@{
        Label   = $label
        Samples = $samples | ForEach-Object { [math]::Round($_) }
        Median  = [math]::Round((Get-Median $samples))
    }
}

# --- Lighthouse (LCP) ---

# Naming the element LCP was measured against: a number that moved is only
# evidence once it is clear which element it belongs to, and issue #110 had to
# infer that from the source because this script read only the timing.
#
# The first attempt read `largest-contentful-paint-element` and printed
# "unknown" for all three routes. That audit does not exist in the pinned
# lighthouse@13.4.1 - version 13 replaced it with the "insight" audits, and
# `$result.audits.'largest-contentful-paint-element'` is simply $null there.
# `lcp-discovery-insight` is asked first because it is scored rather than
# merely informative; `lcp-breakdown-insight` carries the same node; the
# removed id stays last so an older lighthouse still reports.
$LCP_ELEMENT_AUDIT_IDS = @(
    "lcp-discovery-insight",
    "lcp-breakdown-insight",
    "largest-contentful-paint-element"
)

# Inside an insight audit, `details.items` is a heterogeneous list and the
# element is a direct member of it - `type: "node"`, with `snippet` on the item
# itself. The old audit nested it one level deeper, as `node.snippet` on a
# table row, which is why walking only rows found nothing. Both shapes are
# tried; a checklist item's `items` is an object rather than an array, and
# falls out of the row walk without matching.
function Get-LcpNodeSnippet($details) {
    if (-not $details) {
        return $null
    }
    foreach ($item in @($details.items)) {
        if ($item.type -eq "node" -and $item.snippet) {
            return $item.snippet
        }
        foreach ($row in @($item.items)) {
            if ($row.node -and $row.node.snippet) {
                return $row.node.snippet
            }
        }
    }
    return $null
}

function Get-LcpElementSnippet($audits) {
    foreach ($auditId in $LCP_ELEMENT_AUDIT_IDS) {
        $snippet = Get-LcpNodeSnippet $audits.$auditId.details
        if ($snippet) {
            return $snippet
        }
    }
    return "unknown"
}

function Invoke-LighthouseLcp([string]$url, [string]$cookieHeader, [string]$label, [string]$workDir, [string]$lighthouseVersion) {
    $outFile = Join-Path $workDir ("lh-" + [System.IO.Path]::GetRandomFileName() + ".json")
    $lighthouseArgs = @(
        "lighthouse@$lighthouseVersion",
        $url,
        "--output=json",
        "--output-path=$outFile",
        "--only-categories=performance",
        "--chrome-flags=--headless=new",
        "--quiet"
    )

    $headersFile = $null
    if ($cookieHeader) {
        $headersFile = Join-Path $workDir ("headers-" + [System.IO.Path]::GetRandomFileName() + ".json")
        $headersJson = '{"Cookie":"' + $cookieHeader + '"}'
        # No-BOM UTF-8: -Encoding utf8 adds a BOM that breaks lighthouse's JSON.parse.
        [System.IO.File]::WriteAllText($headersFile, $headersJson, (New-Object System.Text.UTF8Encoding($false)))
        $lighthouseArgs += "--extra-headers=$headersFile"
    }

    # chrome-launcher throws EPERM cleaning its own temp dir after every run on
    # this machine - non-fatal, the JSON is already written by then, so a
    # missing output file (not a non-zero exit code) is the real failure
    # signal. $ErrorActionPreference drops to Continue for the call only:
    # left at Stop, that stderr line gets promoted to a terminating error
    # even with output redirected to null below.
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & npx @lighthouseArgs *>$null
    $ErrorActionPreference = $previousErrorActionPreference

    if (-not (Test-Path $outFile)) {
        throw "measure-performance: lighthouse produced no output for $label ($url) - this is a real failure, not the known EPERM cleanup trap."
    }

    $result = Get-Content $outFile -Raw | ConvertFrom-Json
    Remove-Item $outFile -Force
    if ($headersFile -and (Test-Path $headersFile)) {
        Remove-Item $headersFile -Force
    }

    if ($result.runtimeError) {
        throw "measure-performance: lighthouse reported a runtime error for $label ($url): $($result.runtimeError.message)"
    }

    return [pscustomobject]@{
        Label            = $label
        LcpMs            = [math]::Round($result.audits.'largest-contentful-paint'.numericValue)
        LcpElement       = Get-LcpElementSnippet $result.audits
        LighthouseVer    = $result.lighthouseVersion
        ChromeUserAgent  = $result.environment.hostUserAgent
    }
}

# --- Verdict formatting ---
function Get-Verdict([double]$value, [double]$budget) {
    if ($value -le $budget) { return "PASS" }
    return "FAIL"
}

# --- Main ---
Import-DevEnv

$workDir = Join-Path $env:TEMP ("measure-performance-" + [System.IO.Path]::GetRandomFileName())
New-Item -ItemType Directory -Path $workDir -Force | Out-Null

try {
    Write-Host "measure-performance: signing in against $BaseUrl ..."
    $auth = New-AuthenticatedClient $BaseUrl

    if ($Token) {
        $scanToken = $Token
        Write-Host "measure-performance: using provided scan token."
    } else {
        Write-Host "measure-performance: discovering a scan token from a real asset ..."
        $scanToken = Find-ScanToken $auth.Client $BaseUrl
        Write-Host "measure-performance: discovered a scan token."
    }
    $scanUrl = "$BaseUrl/a/$scanToken"

    $anonymousClient = New-Object System.Net.Http.HttpClient

    Write-Host "`n=== Raw fetch samples (TTFB proxy), $SAMPLE_COUNT sequential per route ==="
    Write-Host "`n-- dashboard ($DASHBOARD_PATH), authenticated --"
    $dashboardFetch = Measure-RouteFetch $auth.Client "$BaseUrl$DASHBOARD_PATH" "dashboard"
    Write-Host "`n-- asset list ($ASSETS_PATH), authenticated --"
    $assetsFetch = Measure-RouteFetch $auth.Client "$BaseUrl$ASSETS_PATH" "asset list"
    Write-Host "`n-- public scan page (/a/<token>), anonymous --"
    $scanFetch = Measure-RouteFetch $anonymousClient $scanUrl "public scan"

    Write-Host "`n=== Lighthouse (LCP), one run per route, lighthouse@$LighthouseVersion ==="
    $dashboardLh = Invoke-LighthouseLcp "$BaseUrl$DASHBOARD_PATH" $auth.CookieHeader "dashboard" $workDir $LighthouseVersion
    $assetsLh = Invoke-LighthouseLcp "$BaseUrl$ASSETS_PATH" $auth.CookieHeader "asset list" $workDir $LighthouseVersion
    $scanLh = Invoke-LighthouseLcp $scanUrl $null "public scan" $workDir $LighthouseVersion

    Write-Host "`n=== Results ==="
    Write-Host ("Lighthouse {0}, Chrome UA: {1}" -f $dashboardLh.LighthouseVer, $dashboardLh.ChromeUserAgent)
    Write-Host ""
    $rows = @(
        [pscustomobject]@{
            Route       = "/ (dashboard)"
            TtfbMedian  = $dashboardFetch.Median
            TtfbVerdict = Get-Verdict $dashboardFetch.Median $TTFB_BUDGET_MS
            LcpMs       = $dashboardLh.LcpMs
            LcpVerdict  = Get-Verdict $dashboardLh.LcpMs $LCP_BUDGET_MS
        },
        [pscustomobject]@{
            Route       = "/assets (asset list)"
            TtfbMedian  = $assetsFetch.Median
            TtfbVerdict = Get-Verdict $assetsFetch.Median $TTFB_BUDGET_MS
            LcpMs       = $assetsLh.LcpMs
            LcpVerdict  = Get-Verdict $assetsLh.LcpMs $LCP_BUDGET_MS
        },
        [pscustomobject]@{
            Route       = "/a/<token> (public scan)"
            TtfbMedian  = $scanFetch.Median
            TtfbVerdict = Get-Verdict $scanFetch.Median $TTFB_BUDGET_MS
            LcpMs       = $scanLh.LcpMs
            LcpVerdict  = Get-Verdict $scanLh.LcpMs $LCP_BUDGET_MS
        }
    )
    $rows | Format-Table -AutoSize | Out-String | Write-Host

    Write-Host "=== LCP element per route ==="
    foreach ($lighthouseRun in @($dashboardLh, $assetsLh, $scanLh)) {
        $snippet = $lighthouseRun.LcpElement
        if ($snippet.Length -gt $LCP_ELEMENT_SNIPPET_MAX_CHARS) {
            $snippet = $snippet.Substring(0, $LCP_ELEMENT_SNIPPET_MAX_CHARS) + " ..."
        }
        Write-Host ("  {0}: {1}" -f $lighthouseRun.Label, $snippet)
    }
    Write-Host ""

    $anyFail = $rows | Where-Object { $_.TtfbVerdict -eq "FAIL" -or $_.LcpVerdict -eq "FAIL" }
    if ($anyFail) {
        Write-Host "measure-performance: at least one route failed its budget (TTFB <= $TTFB_BUDGET_MS ms, LCP <= $LCP_BUDGET_MS ms)."
        exit 1
    }
    Write-Host "measure-performance: all routes passed both budgets."
    exit 0
} finally {
    if (Test-Path $workDir) {
        Remove-Item $workDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
