# Seed photo credits

Every image in this directory is a **generated placeholder**, not a
photograph. There is no third-party or scraped content here, and therefore
no external licence to attribute — this file exists anyway because issue #16
requires every seeded image's source and licence to be recorded, and "we
made it ourselves, here is how" is that record.

## What these are

Twenty JPEG files: one full image and one thumbnail, in two colour variants
(`a`, `b`), for each of the five demonstration categories (`LAB`, `IT`,
`FUR`, `OFC`, `OTH`). Each is a solid-colour rectangle with the category name
and a "Seed placeholder photo" label rendered as text — clearly a synthetic
image, not a real product photo, by design.

| File pattern | Purpose | Dimensions |
| --- | --- | --- |
| `<CODE>-a-full.jpg`, `<CODE>-b-full.jpg` | Full image | 1600×1200 |
| `<CODE>-a-thumb.jpg`, `<CODE>-b-thumb.jpg` | Thumbnail | 400×300 |

`prisma/seed-data/photo-writer.ts` picks which pair an asset's photo uses;
`src/lib/seed-photo-plan.ts` is the pure logic behind that choice.

## How they were made

Generated once, offline, with `sharp` (`^0.35.3` — already present as a
transitive dependency, pinned in this project's `package.json` `overrides`
block for a security fix; Apache-2.0 licensed, actively maintained). Each
file is an SVG (a coloured rectangle plus two lines of text) rasterised to
JPEG at quality 78. The generator itself was a throwaway script, run once
against this repository's own `node_modules`, and is not part of the
codebase — regenerating an equivalent set only requires drawing a coloured
rectangle with a label at the sizes in the table above.

## Why pre-sized rather than generated at seed time

Issue #16's amendment (2026-08-22) settles this: the application's resize
path (`browser-image-compression`) runs in the browser, and a seed script has
none. These files are committed already conforming to that pipeline's output
contract — within its dimension bounds, each under `MAX_PHOTO_BYTES`
(1,500,000 bytes), and in an accepted content type (`image/jpeg`) — so
`prisma/seed-data/photo-writer.ts` uploads them through
`src/lib/storage.ts`'s signed-upload path exactly as a real client would,
and `statObject`-verified size and type limits still apply to every object
it creates.

## Licence

Original work, created for this repository. No attribution is owed to
anyone else, because no one else's work is in these files.
