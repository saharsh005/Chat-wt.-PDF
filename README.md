# Radium

Radium is an AI-powered **research paper assistant** that lets users:

- create workspaces
- upload PDFs
- ask grounded questions over those PDFs (RAG chat)
- get citation-backed answers
- discover research gaps
- optionally use internet-augmented research mode

The stack is:

- **Frontend:** Next.js + React (Clerk auth)
- **Backend:** Node.js + Express
- **Vector DB:** Qdrant
- **Queue:** Redis + BullMQ
- **Storage/DB/Auth data:** Supabase + Clerk
- **LLM:** Groq API

---

## 1) Prerequisites

Install these first:

- Node.js 18+ (Node 20+ recommended)
- npm
- Docker Desktop (recommended for Redis + Qdrant)
- Supabase project (URL + service role key)
- Clerk project (publishable + secret key)
- Groq API key

---

## 2) Project Structure

```text
Radium/
  backend/
  frontend/
  docker-compose.yml
```

---

## 3) Environment Variables

### Backend: `backend/.env`

Create `backend/.env` with:

```env
# Server
PORT=5000
FRONTEND_URL=http://localhost:3000
NODE_ENV=development

# Supabase
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY

# Clerk
CLERK_SECRET_KEY=YOUR_CLERK_SECRET_KEY

# LLM
GROQ_API_KEY=YOUR_GROQ_API_KEY

# Optional web-paper API
SEMANTIC_SCHOLAR_KEY=

# Qdrant
QDRANT_URL=http://localhost:6333

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Frontend: `frontend/.env`

Create `frontend/.env` with:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=YOUR_CLERK_PUBLISHABLE_KEY
```

---

## 4) Supabase Basics Required

Your Supabase setup should include:

- storage bucket: `pdfs`
- tables used by backend:
  - `users`
  - `workspaces`
  - `user_pdfs`
  - `chats`
  - `messages`
  - `research_gaps`

Use your existing schema/migrations for exact columns and constraints.

---

## 5) Install Dependencies

From repo root:

```bash
cd backend
npm install

cd ../frontend
npm install
```

---

## 6) Start Infrastructure (Redis + Qdrant)

From repo root:

```bash
docker compose up -d redis qdrant
```

Check services:

- Redis: `localhost:6379`
- Qdrant: `http://localhost:6333`

---

## 7) Run the App (3 processes)

Open 3 terminals.

### Terminal A: Backend API

```bash
cd backend
npm start
```

Runs on: `http://localhost:5000`

### Terminal B: PDF Worker (important)

```bash
cd backend
node queue/worker.js
```

This processes uploaded PDFs into vectors.  
Without this worker, uploads won’t be indexed for chat.

### Terminal C: Frontend

```bash
cd frontend
npm run dev
```

Runs on: `http://localhost:3000`

---

## 8) How to Use

1. Open `http://localhost:3000`
2. Sign in with Clerk
3. Create a workspace
4. Upload one or more PDFs
5. Wait for worker logs to show indexing completion
6. Open a chat and ask document questions
7. Click source chips to jump to cited PDF pages

---

## 9) Optional: Run with Docker Compose

`docker-compose.yml` currently defines:

- `frontend`
- `backend`
- `redis`
- `qdrant`

If you use full compose for app services, you still need to ensure the worker is running (add it as a separate service or run it manually).

---

## 10) Troubleshooting

- **Upload works but chat finds no context**
  - worker not running, Redis not running, or Qdrant unavailable.
- **401 Unauthorized**
  - missing/invalid Clerk keys or token flow issue.
- **PDF not loading**
  - check Supabase bucket `pdfs` and signed URL generation.
- **CORS errors**
  - set `FRONTEND_URL` in `backend/.env` to your frontend origin.
- **No AI answers**
  - verify `GROQ_API_KEY`.

---

## 11) Health Check

Backend health endpoint:

```text
GET http://localhost:5000/health
```

Should return JSON with `status: "ok"`.

