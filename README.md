## chat ai

Techstack:

- Next.js
- AI SDK
- Better Auth
- Neon Postgres x Drizzle
- Tailwind CSS x Shadcn
- Upstash

Database

`NEON_DB` in `.env.local` holds the Postgres URL.

- `bun run db:generate` writes a migration to `lib/db/migrations` after a schema change.
- `bun run db:migrate` applies pending migrations to `NEON_DB`. Run it before you merge a schema change, because pushing to `main` deploys.
- `scripts/convex-to-postgres.ts` and `scripts/verify-convex-migration.ts` copied the Convex data to Postgres. Each reads `DATABASE_URL`, not `NEON_DB`, and takes an unzipped export from `bunx convex export --prod --path snapshot.zip`. Pass `--since=<ms>` with the time of the first export to copy only later documents.

TO-DO

Client

- [x] Chat UI
- [x] Profile at the bottom left
- [x] Reactify app (3 stories deep)
- [x] Markdown design (AI response cleaned up)
- [x] Add model switcher
- [x] Fix Textarea on Height
- [x] Auth
- [x] On Scroll behaviour
- [x] Add a search button
- [ ] Add a effort toggle

Server
Basic

- [x] Use AI SDK
- [x] Add multiple models (OpenAI, Deepseek) (Note: check off when API Keys and functionality added)
- [ ] Bonus - check out groq

(Optional - Future Development)

- [x] Add file input (Use uploadthing - figure it out)
- [ ] Add functionality for thinking models

Advance (Optional - Future Development)

- [ ] Make it faster
- [x] Optimize

Database

- [x] Local DB
- [x] Neon
- [x] Add Schema
- [x] Add Queries
- [x] Save Messages to DB

Note:

- [ ] To add other users, set `disableSignUp: false` in `lib/auth.ts`

Able to save messages, however, the UUID regenerates after every key down "Enter"

- [x] Fixed (Read Notes)

Misc - (Not needed)

- [ ] Terms
- [ ] Privacy Policy

Note: never create an interface with undefined variables, will break code in future if you do that.

Add Ultracite
