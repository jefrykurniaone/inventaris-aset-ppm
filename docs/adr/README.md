# Architecture Decision Records

One file per decision, numbered sequentially: `NNNN-short-slug.md`. Use `template.md` as the
starting point.

A decision belongs here when reversing it later would be expensive, or when a future contributor
would otherwise reasonably ask "why on earth was it done this way".

| ADR | Title | Status |
|---|---|---|
| [0001](0001-stack-selection.md) | Stack selection for the PPM asset inventory prototype | Accepted, partially superseded by 0003 |
| [0002](0002-auth-persistence-layer.md) | Better Auth persistence layer on Prisma 7 | Proposed |
| [0003](0003-local-postgres-development-supabase-deployment.md) | Local Postgres for development, Supabase for deployment | Accepted |
