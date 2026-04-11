# ⚡ YUMMY Backend

AI-powered Multi-Agent SDLC Platform — FastAPI Backend

---

## 🗂️ Cấu trúc dự án

```
yummy-backend/
├── main.py                    # Entry point
├── config.py                  # Global store & constants
├── models.py                  # Pydantic models
├── dependencies.py            # Shared helpers
├── services/
│   ├── ai_service.py          # Gemini + Ollama calls
│   ├── github_service.py      # GitHub API wrapper
│   └── scan_service.py        # Background scan task
├── routers/
│   ├── config_router.py       # /config/*
│   ├── sessions_router.py     # /sessions/*
│   ├── kb_router.py           # /kb/*
│   ├── ask_router.py          # /ask
│   ├── sdlc_router.py         # /sdlc/* (BA→SA→DevLead→DEV→SEC→QA→SRE)
│   ├── metrics_router.py      # /metrics
│   └── utils_router.py        # /, /help, /health
├── requirements.txt
└── .env.example
```

---

## 🚀 Cài đặt & Chạy local

### 1. Clone & cài dependencies

```bash
git clone <your-repo>
cd yummy-backend

python -m venv venv
source venv/bin/activate        # Linux/Mac
# venv\Scripts\activate         # Windows

pip install -r requirements.txt
```

### 2. Cấu hình .env

```bash
cp .env.example .env
# Điền GEMINI_API_KEY (hoặc để dùng Ollama)
```

### 3. Chạy server

```bash
uvicorn main:app --reload --port 8000
```

Swagger UI: http://localhost:8000/docs

---

## 🤖 Cấu hình Ollama (Local AI — MIỄN PHÍ)

Ollama cho phép chạy AI model ngay trên máy, không cần API key, không tốn tiền.

### Bước 1: Cài Ollama

```bash
# Mac
brew install ollama

# Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Windows: tải tại https://ollama.ai/download
```

### Bước 2: Khởi động Ollama server

```bash
ollama serve
# Server chạy tại http://localhost:11434
```

### Bước 3: Pull model

```bash
# Chọn 1 trong các model phù hợp:
ollama pull codellama      # Tốt nhất cho code (13B, ~8GB)
ollama pull llama3         # General purpose (8B, ~5GB)
ollama pull deepseek-coder # Code specialist (6.7B, ~4GB)
ollama pull mistral        # Cân bằng speed/quality (7B, ~4GB)
ollama pull phi3           # Nhẹ nhất, chạy được trên máy yếu (3.8B, ~2GB)
```

### Bước 4: Config trong YUMMY API

```bash
# Set Ollama config
curl -X POST http://localhost:8000/config/ollama \
  -H "Content-Type: application/json" \
  -d '{"base_url": "http://localhost:11434", "model": "codellama"}'

# Switch sang Ollama provider
curl -X POST http://localhost:8000/config/provider \
  -H "Content-Type: application/json" \
  -d '{"provider": "ollama"}'
```

> ⚠️ **Lưu ý:** Ollama chậm hơn Gemini (đặc biệt với SDLC pipeline nhiều agent). 
> Khuyến nghị dùng `codellama` hoặc `deepseek-coder` cho code tasks.

---

## 🔑 Lấy GitHub Token

GitHub token cần thiết để:
- Truy cập **private repos**
- Tránh GitHub API rate limit (60 req/h → 5000 req/h với token)

### Bước 1: Vào GitHub Settings

https://github.com/settings/tokens

### Bước 2: Tạo Fine-grained Personal Access Token (khuyến nghị)

1. Click **"Generate new token"** → **"Fine-grained token"**
2. Đặt tên: `yummy-backend`
3. **Expiration**: 90 days (hoặc tùy)
4. **Repository access**: 
   - "Only select repositories" → chọn repo cần scan
   - Hoặc "All repositories"
5. **Permissions**:
   - `Contents`: **Read-only**
   - `Metadata`: **Read-only** (bắt buộc)
6. Click **"Generate token"** → Copy token (dạng `github_pat_xxx`)

### Bước 3: Truyền token vào API

```bash
curl -X POST http://localhost:8000/config/setup \
  -H "Content-Type: application/json" \
  -d '{
    "github_url": "https://github.com/owner/repo",
    "token": "github_pat_xxxxxxxxxx",
    "max_scan_limit": 100
  }'
```

> ✅ **Bảo mật:** Token chỉ lưu in-memory, không ghi ra file. Restart server = mất token.

---

## 🧪 Hướng dẫn Test luồng đầy đủ

Dùng cURL hoặc mở http://localhost:8000/docs (Swagger UI, tiện hơn).

### Step 0: Kiểm tra server

```bash
curl http://localhost:8000/health
# → {"status": "ok"}

curl http://localhost:8000/config/status
# → xem toàn bộ trạng thái
```

### Step 1: Set AI Key

**Option A — Gemini:**
```bash
curl -X POST http://localhost:8000/config/api-key \
  -H "Content-Type: application/json" \
  -d '{"api_key": "YOUR_GEMINI_KEY"}'
```

**Option B — Ollama (đã chạy ollama serve + pull model):**
```bash
curl -X POST http://localhost:8000/config/ollama \
  -H "Content-Type: application/json" \
  -d '{"base_url": "http://localhost:11434", "model": "codellama"}'

curl -X POST http://localhost:8000/config/provider \
  -H "Content-Type: application/json" \
  -d '{"provider": "ollama"}'
```

### Step 2: Setup GitHub repo

```bash
curl -X POST http://localhost:8000/config/setup \
  -H "Content-Type: application/json" \
  -d '{
    "github_url": "https://github.com/microsoft/vscode",
    "token": "",
    "max_scan_limit": 50
  }'
```

> 💡 Để test nhanh, dùng `max_scan_limit: 20-50`. Scan toàn bộ repo lớn sẽ mất nhiều thời gian.

### Step 3: Tạo session

```bash
SESSION=$(curl -s -X POST http://localhost:8000/sessions \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Session"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

echo "Session ID: $SESSION"
```

### Step 4: Scan codebase

```bash
# Bắt đầu scan (background)
curl -X POST http://localhost:8000/kb/scan

# Poll đến khi xong
while true; do
  STATUS=$(curl -s http://localhost:8000/kb/scan/status)
  echo $STATUS | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"[{d.get('progress',0)}%] {d.get('text','')}\")"
  RUNNING=$(echo $STATUS | python3 -c "import sys,json; print(json.load(sys.stdin).get('running', False))")
  if [ "$RUNNING" = "False" ]; then break; fi
  sleep 3
done
```

### Step 5: Test RAG Chat

```bash
curl -X POST http://localhost:8000/ask \
  -H "Content-Type: application/json" \
  -d "{\"session_id\": \"$SESSION\", \"question\": \"Dự án này làm gì? Kiến trúc chính?\"}"
```

### Step 6: SDLC Workflow

```bash
# BA viết BRD
curl -X POST http://localhost:8000/sdlc/start \
  -H "Content-Type: application/json" \
  -d "{\"session_id\": \"$SESSION\", \"requirement\": \"Thêm tính năng 2FA cho màn hình đăng nhập\"}"

# Approve BA → SA + JIRA
curl -X POST http://localhost:8000/sdlc/approve-ba \
  -H "Content-Type: application/json" \
  -d "{\"session_id\": \"$SESSION\"}"

# Approve SA → Dev Lead review
curl -X POST http://localhost:8000/sdlc/approve-sa \
  -H "Content-Type: application/json" \
  -d "{\"session_id\": \"$SESSION\"}"

# Approve Dev Lead → DEV + SECURITY + QA + SRE
curl -X POST http://localhost:8000/sdlc/approve-dev-lead \
  -H "Content-Type: application/json" \
  -d "{\"session_id\": \"$SESSION\"}"

# Xem toàn bộ output
curl http://localhost:8000/sdlc/$SESSION/state
```

### Step 7: Xem metrics

```bash
curl http://localhost:8000/metrics
```

---

## 🏗️ Agent Pipeline

```
CR Input
   │
   ▼
[BA] Business Requirements Document (BRD)
   │ ← User Review & Approve
   ▼
[SA] System Architecture Document      [PM] JIRA Backlog JSON
   │ ← User Review & Approve               (song song với SA)
   ▼
[DEV LEAD] SA Review + Implementation Plan
   │ ← User Review & Approve
   ▼
[DEV] Code Structure / Pseudocode
   │
   ▼
[SECURITY] OWASP Review + Threat Model
   │
   ▼
[QA] Test Plan + Test Cases
   │
   ▼
[SRE] Deployment Plan + Rollback
   │
   ▼
🎉 Done
```

---

## 🔜 Roadmap / TODO

- [ ] Vector similarity search thay thế top-k retrieval (Chroma / pgvector)
- [ ] Persistent storage (Redis / PostgreSQL) thay in-memory
- [ ] WebSocket support cho real-time streaming agent output
- [ ] Authentication (API key per user)
- [ ] Docker Compose (Backend + Frontend + Ollama)
- [ ] GitHub webhook để auto-scan khi push
