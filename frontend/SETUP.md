# YUMMY Frontend — Setup Guide

## Cấu trúc monorepo

```
yummy/              ← NextJS app (folder này)
yummy-core/
└── yummy-backend/  ← FastAPI backend
```

## Cài đặt

```bash
cd yummy

# Cài dependencies (không cần cài thêm gì ngoài Next.js mặc định)
npm install

# Copy env
cp .env.local.example .env.local

# Chạy dev
npm run dev
# → http://localhost:3000
```

## tsconfig.json — đảm bảo có path alias @/*

Kiểm tra `tsconfig.json` của bạn có phần này:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

Nếu dùng `create-next-app` thì mặc định đã có rồi. Nếu không có, thêm vào.

## next.config.js — không cần thêm gì

Frontend chỉ dùng `fetch` tới backend, không cần proxy config đặc biệt.

## Chạy cả 2 cùng lúc

Terminal 1 (Backend):
```bash
cd yummy-core/yummy-backend
source venv/bin/activate
uvicorn main:app --reload --port 8000
```

Terminal 2 (Frontend):
```bash
cd yummy
npm run dev
```

Mở: http://localhost:3000

## Dependencies

Frontend chỉ dùng Next.js built-in + fetch API — **không cần cài thêm package nào**.

Nếu muốn thêm markdown rendering đẹp hơn:
```bash
npm install react-markdown remark-gfm
```
Và thay `mdToHtml()` bằng `<ReactMarkdown>` component.

## File structure trong yummy/

```
app/
  layout.tsx                 ← Root layout + global CSS
  page.tsx                   ← Landing (auto redirect)
  globals.css                ← Design system (terminal dark)
  workspace/
    [sessionId]/
      page.tsx               ← Main workspace (4-panel layout)
components/
  SessionsSidebar.tsx        ← Left sidebar: workspace list
  SetupPanel.tsx             ← Config: AI key + GitHub setup
  KBPanel.tsx                ← Knowledge base: scan + tree + summary
  ChatPanel.tsx              ← RAG Chat với AI
  SDLCWorkflow.tsx           ← SDLC pipeline: BA→SA→DevLead→DEV→SEC→QA→SRE
  JiraBoard.tsx              ← JIRA backlog board
  MetricsPanel.tsx           ← Cost + request logs
lib/
  api.ts                     ← API client (tất cả endpoints)
  types.ts                   ← TypeScript types
.env.local.example           ← Copy thành .env.local
SETUP.md                     ← File này
```
