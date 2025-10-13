# SkillSwap

A marketplace API for trading skills — connect, chat, barter, and verify skills between users.

## Introduction

SkillSwap is a backend API that powers a skill-exchange marketplace. It helps users list skills they can teach, request skills they want to learn, find matches using fuzzy/similarity search and AI-assisted matching, negotiate barters, chat in real-time, exchange files, and leave reviews after skill exchanges. The server is written in modern Node.js using Express and Prisma.

Key features

- User authentication (email/password + Google OAuth)
- Skill matching (fuzzy search + HF-assisted matching)
- Barter proposals and skill exchanges with status tracking
- Real-time chat via Socket.IO
- File upload metadata storage and Supabase-backed files
- Notifications and Redis caching (Upstash)
- Reviews and skill verification workflow

## Tech Stack

- Node.js (ES modules)
- Express 5
- Prisma (PostgreSQL)
- Socket.IO (real-time chat)
- Upstash Redis
- Supabase (file storage)
- Passport.js (Google OAuth)
- Jest + Supertest (tests)

## Installation & Setup

Prerequisites

- Node.js 18+ and npm
- PostgreSQL database
- Upstash Redis account (or compatible Redis) – optional for local dev
- Supabase project (optional for file storage)

Quick start

1. Clone the repo

```powershell
git clone https://github.com/ispastro/skill-swap.git
cd skill-swap
```

2. Install dependencies

```powershell
npm install
```

3. Create a `.env` file in the repo root with the following variables (example values):

```env
DATABASE_URL=postgresql://user:password@localhost:5432/skillswap
PORT=8000
JWT_SECRET=your_jwt_secret
UPSTASH_REDIS_REST_URL=https://<your-upstash-url>
UPSTASH_REDIS_REST_TOKEN=<your-upstash-token>
SUPABASE_URL=https://<your-supabase>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
GOOGLE_CLIENT_ID=<google-client-id>
GOOGLE_CLIENT_SECRET=<google-client-secret>
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
HF_API_KEY=<huggingface-api-key>
```

4. Run Prisma migrations and seed (if needed)

```powershell
npx prisma migrate deploy
node prisma/seed.js
```

5. Start the server (development)

```powershell
npm start
```

The API will be available on http://localhost:8000 by default.

## Usage

Health check

```http
GET /
200 OK -> "SkillSwap API is running 🚀"
```

Authentication endpoints (base: `/api/auth`)

- POST `/api/auth/register` — register a new user (email, password, name)
- POST `/api/auth/login` — login and receive JWT

Google OAuth

- GET `/auth/google` — redirect to Google OAuth
- GET `/auth/google/callback` — Google OAuth callback (redirects to frontend with JWT)

Profile (protected: requires `Authorization: Bearer <token>`)

- GET `/api/profile` — get user profile
- PUT `/api/profile/:userId` — update profile (triggers match notifications)

Matching

- GET `/api/match/matches` — find matching users/skills
- POST `/api/match/verify-skill` — request verification of a skill

Chat (protected)

- POST `/api/chats` — initiate a chat
- GET `/api/chats/:userId` — list chats for a user
- GET `/api/chats/:chatId/messages` — list messages in a chat
- POST `/api/chats/:chatId/messages` — send a message
- Real-time: Socket.IO is set up and expects a `userId` in handshake query to auto-join the user's room.

Files (protected)

- POST `/api/files/upload` — log file metadata after upload to Supabase
- GET `/api/files` — list user's files
- GET `/api/files/:id/download` — download a file
- DELETE `/api/files/:id` — delete a file

Notifications

- Routes under `/api/notifications` for sending and fetching notifications (protected)

Reviews & Exchanges

- `/api/reviews` — create and list reviews for skill exchanges
- SkillExchange, BarterProposal, and Review models exist in Prisma schema and are used by controllers.

## Folder Structure

- `src/` — application source
  - `server.js` — app entry and WebSocket setup
  - `config/` — `db.js`, `redisClient.js`, `passport.js`
  - `controllers/` — route handlers (auth, profile, match, chat, file, review, notify, barter)
  - `routes/` — express route definitions
  - `middleware/` — auth and request validation
  - `validators/` — input validators
  - `utils/` — helper functions such as skill suggestion
- `prisma/` — Prisma schema and migrations
- `scripts/` — utility scripts (seed, helpers)
- `test/` — Jest tests (example: `matchController.test.js`)
- `generated/` — Prisma client (generated)

## Environment Variables

Key env vars used in codebase (set in `.env`):

- `DATABASE_URL` — PostgreSQL connection string (Prisma)
- `PORT` — server port
- `JWT_SECRET` — JWT signing key
- `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN` — Upstash Redis
- `SUPABASE_URL` & `SUPABASE_SERVICE_ROLE_KEY` — Supabase for file storage
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` — Google OAuth
- `HF_API_KEY` — HuggingFace API key used by match controller

## Scripts

- `npm start` — starts nodemon and runs `src/server.js`
- `npm test` — runs Jest tests

## Contributing

Contributions are welcome. Suggested workflow:

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Run tests and linters locally
4. Open a PR with a clear description and tests for new behavior

Please follow the existing code style (ES modules, modern JS). Add tests for new features when possible.

## License

This project is licensed under the ISC License. See the `package.json` license field.

## Notes & Next Steps

- The repository expects external services (Postgres, Upstash, Supabase). For local development you can run Postgres locally and mock Upstash/Supabase or use test credentials.
- The repo includes AI-assisted matching (HuggingFace) — set `HF_API_KEY` to enable.

If you'd like, I can open a follow-up PR to add a concise `.env.example`, API Postman collection, and a simple dev Docker Compose setup to make local startup easier.