<#
.SYNOPSIS
    Scripted performance measurement against the production deployment
    (issue #89). Single-user, sequential, no load generation.

.DESCRIPTION
    Measures three routes on the production deployment:
      - "/"        the dashboard (authenticated)
      - "/assets"  the asset list (authenticated)
      - "/a/<token>" the public scan page (anonymous)

    Two kinds of evidence are collected per route:
      1. TTFB proxy: 5 sequential raw HTTP fetches, timed end-to-end
         (matches the method the orchestrator used for the baseline/
         post-fix numbers recorded on issue #89, so the three data
         points stay comparable). The median of the 5 samples is the
         reported figure.
      2. LCP: a Lighthouse run per route (performance category only).
         Lighthouse's own `server-response-time` audit is NOT used for
         TTFB here - on this deployment it reads the Vercel edge cache
         response, not the real database round trip, so it understates
         TTFB by roughly two orders of magnitude. LCP is unaffected by
         that and is read from Lighthouse's `largest-contentful-paint`
         audit.

    Authentication: signs in once with the credentials named
    SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD (read from the environment,
    falling back to ../.env.local if present - never printed, logged,
    or written to any output file). The resulting session cookie is
    reused for the two authenticated routes' raw fetches and passed to
    Lighthouse via --extra-headers for its two authenticated runs. The
    public scan page is fetched and audited with no cookie at all.

    Token discovery: the public route's token is discovered at runtime
    from a real asset detail page (the first asset returned by the
    asset list) unless -Token is passed explicitly. Nothing about a
    specific asset or its custodian is printed or recorded.

    Uses System.Net.Http.HttpClient rather than Invoke-WebRequest /
    WebRequestSession: in this environment Invoke-WebRequest throws a
    NullReferenceException from its internal ShouldContinue/
    PromptForChoice path on a non-interactive host. HttpClient with an
    explicit CookieContainer gives the same "one signed-in session,
    reused across requests" behaviour without going through that code
    path, and does not hit PowerShell's restricted-header handling for
    a hand-set Cookie header either.

.PARAMETER BaseUrl
    Root URL of the deployment to measure. Defaults to production.

.PARAMETER Token
    A public scan token to measure directly, skipping discovery.
    Any /a/<token> works; nothing about a specific asset is recorded.

.PARAMETER LighthouseVersion
    Exact lighthouse version to run via npx (pinned, not "latest").

.EXAMPLE
    ./scripts/measure-performance.ps1

.EXAMPLE
    ./scripts/measure-performance.ps1 -BaseUrl https://staging.example.com -Token abc123XYZ789
#>

param(
    [string]$BaseUrl = "https://inventaris-aset-ppm.vercel.app",
    [string]$Token,
    [string]$LighthouseVersion = "13.4.1"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Net.Http
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# --- Named constants (no magic numbers) --------------------------------

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

# --- Environment ---------------------------------------------------------

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

# --- Retry wrapper, for the DNS flakiness this machine sees against ------
# --- *.vercel.app: a failed sample is retried before being reported. -----

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

# --- Authenticated session ------------------------------------------------

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

# --- Public scan token discovery ------------------------------------------

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

# --- Raw fetch medians (TTFB proxy) ---------------------------------------

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

# --- Lighthouse (LCP) -------------------------------------------------------

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
        # No-BOM UTF-8: Set-Content -Encoding utf8 writes a BOM in Windows
        # PowerShell 5.1, and lighthouse's JSON.parse rejects a BOM'd file.
        [System.IO.File]::WriteAllText($headersFile, $headersJson, (New-Object System.Text.UTF8Encoding($false)))
        $lighthouseArgs += "--extra-headers=$headersFile"
    }

    # chrome-launcher throws EPERM cleaning its own temp dir after every run
    # on this machine (a known, non-fatal trap); the JSON result is already
    # written by the time that happens, so a non-zero exit code alone is not
    # a failed run - only a missing output file is. $ErrorActionPreference
    # is dropped to Continue for the call itself: with it left at Stop, a
    # native command writing to stderr (this EPERM message included) is
    # promoted from a non-terminating NativeCommandError into a terminating
    # one, even though the output stream is redirected to null below.
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
        LighthouseVer    = $result.lighthouseVersion
        ChromeUserAgent  = $result.environment.hostUserAgent
    }
}

# --- Verdict formatting -----------------------------------------------------

function Get-Verdict([double]$value, [double]$budget) {
    if ($value -le $budget) { return "PASS" }
    return "FAIL"
}

# --- Main --------------------------------------------------------------------

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
