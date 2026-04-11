# ⚡ YUMMY — AI-powered SDLC Platform

Monorepo gồm Frontend (Next.js) + Backend (FastAPI).

```
yummy/
├── frontend/     ← Next.js app (port 3000)
├── backend/      ← FastAPI app (port 8000)
├── start.sh      ← Chạy cả 2 cùng lúc (Linux/Mac)
├── start.bat     ← Chạy cả 2 cùng lúc (Windows)
└── .env          ← Cấu hình chung (copy từ .env.example)
```

## 🚀 Chạy nhanh (1 lệnh)

### Linux / Mac
```bash
cp .env.example .env
# Điền GEMINI_API_KEY vào .env
chmod +x start.sh
./start.sh
```

### Windows
```bat
copy .env.example .env
:: Điền GEMINI_API_KEY vào .env
start.bat
```

Mở: http://localhost:3000

---

## Cấu hình .env

| Biến | Mô tả | Bắt buộc |
|------|-------|---------|
| `GEMINI_API_KEY` | Lấy tại https://aistudio.google.com | ✅ (hoặc dùng Ollama) |
| `AI_PROVIDER` | `gemini` hoặc `ollama` | Mặc định: `gemini` |
| `GITHUB_TOKEN` | Token để scan private repo | Không bắt buộc |

---

## Chạy thủ công (nếu cần debug riêng)

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```
