# YUMMY - AI-powered SDLC Platform

```
yummy/
├── frontend/     - Next.js app (port 3000)
├── backend/      - FastAPI app (port 8000)
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

---

## Configuration (.env)

| Variable | Description | Default |
|----------|-------------|---------|
| `GEMINI_API_KEY` | Your Gemini API key | required |
| `AI_PROVIDER` | `gemini` or `ollama` | `gemini` |
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

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```
