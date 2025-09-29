## chat ai

Techstack:

- Next.js
- AI SDK
- Better Auth
- Neon (PostgreSQL)
- Tailwind CSS x Shadcn
- Upstash

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

- [ ] To add other users, check out @/components/auth/action.ts

Able to save messages, however, the UUID regenerates after every key down "Enter"

- [x] Fixed (Read Notes)

Misc - (Not needed)

- [ ] Terms
- [ ] Privacy Policy

Note: never create an interface with undefined variables, will break code in future if you do that.
