/**
 * Entry point — boots the HTTP server.
 *
 * Run: pnpm dev (watch) or pnpm start (once).
 * Default port 8000 (matches Python backend).
 */
import { serve } from '@hono/node-server';
import { env } from './config/env.js';
import { createApp } from './app.js';

const app = createApp();

serve(
  { fetch: app.fetch, port: env.PORT, hostname: env.HOST },
  (info) => {
    console.log(`✅ YUMMY backend listening on http://${env.HOST}:${info.port}`);
    console.log(`📖 Swagger UI: http://${env.HOST}:${info.port}/docs`);
    console.log(`📋 OpenAPI:    http://${env.HOST}:${info.port}/openapi.json`);
  },
);
