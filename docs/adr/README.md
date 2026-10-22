# Architecture Decision Records

One file per decision, numbered sequentially: `NNNN-short-slug.md`. Use `template.md` as the
starting point.

A decision belongs here when reversing it later would be expensive, or when a future contributor
would otherwise reasonably ask "why on earth was it done this way".

| ADR | Title | Status |
|---|---|---|
| [0001](0001-stack-selection.md) | Stack selection for the PPM asset inventory prototype | Accepted, partially superseded by 0003 |
| [0002](0002-auth-persistence-layer.md) | Better Auth persistence layer on Prisma 7 | Proposed |
| [0003](0003-local-postgres-development-supabase-deployment.md) | Local Postgres for development, Supabase for deployment | Accepted, photo storage superseded by 0005; deployment half lapsed 2026-10-23 (see 0009) |
| [0004](0004-pinned-transitive-overrides-for-postcss-and-sharp.md) | Pinned transitive overrides for `postcss` and `sharp` | Accepted |
| [0005](0005-supabase-storage-in-all-environments.md) | Supabase Storage in all environments | Superseded by 0009 |
| [0006](0006-hand-rolled-xlsx-writer.md) | A hand-rolled XLSX writer instead of an npm spreadsheet library | Accepted |
| [0007](0007-prisma-7-10-upgrade.md) | Upgrade Prisma from 7.9.1 to 7.10.1 | Accepted |
| [0008](0008-dependency-vulnerability-checks.md) | Dependency vulnerability checks | Accepted |
| [0009](0009-photos-stored-in-postgresql.md) | Photos stored in PostgreSQL | Accepted |
