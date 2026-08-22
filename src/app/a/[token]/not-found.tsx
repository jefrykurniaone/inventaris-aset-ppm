import { getTranslations } from "next-intl/server";

import { ScanPageShell } from "./ScanPageShell";

/**
 * What `notFound()` renders for `/a/<token>` (issue #11).
 *
 * The copy is deliberately incurious. It says the label does not match a
 * record and stops there — no "this asset was removed", no "that token has
 * expired", nothing that would let someone walking a token space learn which
 * guesses were once real. A withdrawn asset is a different state entirely and
 * never reaches this file (FR-2.5); the only thing that does is a token this
 * register has never issued or a mistyped one, and those two must be
 * indistinguishable.
 */
export default async function ScanNotFound() {
  const ts = await getTranslations("ScanPage");

  return (
    <ScanPageShell>
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {ts("notFoundTitle")}
        </h1>
        <p className="text-muted-foreground">{ts("notFoundDescription")}</p>
      </div>
    </ScanPageShell>
  );
}
