#!/usr/bin/env bash
# ============================================================
# YUMMY — Start cả Frontend + Backend bằng 1 lệnh
# Usage: ./start.sh
# ============================================================

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

# ── Load .env ──────────────────────────────────────────────
if [ -f "$ROOT_DIR/.env" ]; then
  export $(grep -v '^#' "$ROOT_DIR/.env" | grep -v '^$' | xargs)
  echo "✅ Loaded .env"
else
  echo "⚠️  Không tìm thấy .env — copy từ .env.example:"
  echo "   cp .env.example .env"
  echo "   Sau đó điền GEMINI_API_KEY rồi chạy lại ./start.sh"
  exit 1
fi

BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"

# ── Colors ─────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

echo ""
echo -e "${CYAN}⚡ YUMMY — AI SDLC Platform${NC}"
echo "=================================="

# ── Backend setup ──────────────────────────────────────────
echo -e "\n${YELLOW}[Backend] Chuẩn bị Python venv...${NC}"
cd "$BACKEND_DIR"

if [ ! -d "venv" ]; then
  python3 -m venv venv
  echo -e "${GREEN}[Backend] Tạo venv xong${NC}"
fi

source venv/bin/activate
pip install -r requirements.txt -q
echo -e "${GREEN}[Backend] Dependencies OK${NC}"

# Copy env vars backend cần
export GEMINI_API_KEY="$GEMINI_API_KEY"
export AI_PROVIDER="$AI_PROVIDER"
export OLLAMA_BASE_URL="$OLLAMA_BASE_URL"
export OLLAMA_MODEL="$OLLAMA_MODEL"

# Start backend in background
echo -e "${YELLOW}[Backend] Khởi động tại http://localhost:$BACKEND_PORT ...${NC}"
uvicorn main:app --reload --port "$BACKEND_PORT" --log-level warning &
BACKEND_PID=$!

# ── Frontend setup ─────────────────────────────────────────
echo -e "\n${YELLOW}[Frontend] Chuẩn bị Node.js...${NC}"
cd "$FRONTEND_DIR"

# Write .env.local for Next.js
echo "NEXT_PUBLIC_API_URL=http://localhost:$BACKEND_PORT" > .env.local

if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}[Frontend] Cài npm packages (lần đầu chạy)...${NC}"
  npm install --silent
fi

echo -e "${GREEN}[Frontend] Dependencies OK${NC}"
echo -e "${YELLOW}[Frontend] Khởi động tại http://localhost:$FRONTEND_PORT ...${NC}"

# Start frontend in background
npm run dev -- --port "$FRONTEND_PORT" &
FRONTEND_PID=$!

# ── Done ───────────────────────────────────────────────────
echo ""
echo -e "${GREEN}=================================="
echo -e "✅ YUMMY đang chạy!"
echo -e ""
echo -e "  🌐 App:     http://localhost:$FRONTEND_PORT"
echo -e "  🔌 API:     http://localhost:$BACKEND_PORT"
echo -e "  📖 Swagger: http://localhost:$BACKEND_PORT/docs"
echo -e "=================================="
echo -e "${NC}"
echo "Nhấn Ctrl+C để dừng cả hai..."

# ── Cleanup on exit ────────────────────────────────────────
cleanup() {
  echo -e "\n${YELLOW}Đang dừng...${NC}"
  kill $BACKEND_PID 2>/dev/null || true
  kill $FRONTEND_PID 2>/dev/null || true
  echo -e "${GREEN}Đã dừng. Tạm biệt!${NC}"
  exit 0
}
trap cleanup SIGINT SIGTERM

wait
