/**
 * App composition — assembles the OpenAPIHono app with CORS, error handling,
 * all 7 routers, OpenAPI doc + Swagger UI.
 *
 * Mounted in the same order as backend/main.py:
 *   utils -> config -> sessions -> kb -> ask -> sdlc -> metrics
 */
import { OpenAPIHono } from '@hono/zod-openapi';
import { cors } from 'hono/cors';
import { swaggerUI } from '@hono/swagger-ui';

import { errorHandler } from './middleware/error-handler.js';
import { utilsRouter } from './routers/utils.router.js';
import { configRouter } from './routers/config.router.js';
import { sessionsRouter } from './routers/sessions.router.js';
import { kbRouter } from './routers/kb.router.js';
import { askRouter } from './routers/ask.router.js';
import { sdlcRouter } from './routers/sdlc.router.js';
import { metricsRouter } from './routers/metrics.router.js';

export function createApp(): OpenAPIHono {
  const app = new OpenAPIHono();

  // ── CORS — matches Python (allow all) ─────────────────
  app.use(
    '*',
    cors({
      origin: '*',
      credentials: true,
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['*'],
    }),
  );

  // ── Routers ───────────────────────────────────────────
  app.route('/', utilsRouter);
  app.route('/', configRouter);
  app.route('/', sessionsRouter);
  app.route('/', kbRouter);
  app.route('/', askRouter);
  app.route('/', sdlcRouter);
  app.route('/', metricsRouter);

  // ── OpenAPI document + Swagger UI ─────────────────────
  app.doc('/openapi.json', {
    openapi: '3.1.0',
    info: {
      title: 'YUMMY API',
      version: '2.0.0',
      description:
        '## YUMMY - AI-powered Multi-Agent SDLC Platform\n\n' +
        '**Agent Pipeline:** BA → SA → Dev Lead → DEV → Security → QA → SRE\n\n' +
        '**Providers:** Gemini | OpenAI | Ollama | Copilot | Bedrock\n\n' +
        'See `/help` for the full workflow.',
    },
  });
  app.get('/docs', swaggerUI({ url: '/openapi.json' }));

  // ── Global error handler — last, so it sees router errors ─
  app.onError(errorHandler);

  return app;
}
