# YUMMY - AI-powered SDLC Platform

```
yummy/
├── frontend/     - Next.js app (port 3000)
├── backend-ts/   - Hono / TypeScript app (port 8000)  ← active
├── backend/      - FastAPI app (legacy, kept as fallback)
├── start.bat     - One-command start (Windows CMD / PowerShell)
├── start.sh      - One-command start (Linux / Mac / Git Bash)
└── .env.example  - Config template
```

---

## Quick Start

### Windows - CMD or PowerShell (recommended)
```
start.bat
```

### Windows - Git Bash / Linux / Mac
```bash
bash start.sh
```

On first run the script auto-creates `.env` and asks you to fill in your API key.
Get a free Gemini key at: https://aistudio.google.com/app/apikey

Run the same command again after filling in the key — everything else is automatic.

Requirements:
- **Node.js 20+** (https://nodejs.org)
- **pnpm** (auto-installed by the start scripts if missing)

---

## Configuration (.env)

| Variable | Description | Default |
|----------|-------------|---------|
| `GEMINI_API_KEY` | Your Gemini API key | required |
| `AI_PROVIDER` | `gemini`, `openai`, `bedrock`, `copilot`, or `ollama` | `gemini` |
| `OLLAMA_BASE_URL` | Ollama server URL | `http://localhost:11434` |
| `OLLAMA_MODEL` | Ollama model name | `codellama` |
| `GITHUB_TOKEN` | For private repo scanning | optional |
| `BACKEND_PORT` | Backend port | `8000` |
| `FRONTEND_PORT` | Frontend port | `3000` |

---

## URLs

| Service | URL |
|---------|-----|
| App | http://localhost:3000 |
| API | http://localhost:8000 |
| Swagger | http://localhost:8000/docs |

---

## Product Requirements Backlog

- Full user-story backlog (500 stories, epic/story/task/subtask + Gherkin): `requirements/README.md`
- Structure follows a template-style format with table of contents and story ranges (`US-001` to `US-500`).

---

## Manual Setup (for debugging)

**Backend (TypeScript / Hono — active):**
```bash
cd backend-ts
pnpm install
pnpm db:migrate
pnpm dev               # http://localhost:8000  (docs at /docs)
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Legacy Python backend (fallback only):**
The original FastAPI implementation lives in `backend/` and is kept for
reference / rollback. The TypeScript backend (`backend-ts/`) is API-compatible.
To verify parity between the two implementations:

```bash
# Terminal 1: Python on :8000
cd backend && python -m uvicorn main:app --port 8000

# Terminal 2: TypeScript on :8001
cd backend-ts && PORT=8001 pnpm dev

# Terminal 3:
bash backend-ts/scripts/parity-check.sh
```
