// Node 로컬 개발 엔트리. (배포는 worker.ts → Cloudflare Workers)
import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { serve } from '@hono/node-server';
import app from './app.js';
import { config } from './config.js';

// 저장소 루트의 .env 를 읽는다(없어도 무방 — 키는 보통 브라우저에서 헤더로 온다).
const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, '../../.env') });

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`▶ zomm 프록시 실행 중: http://localhost:${info.port}`);
  console.log('  상태 비저장 — 키는 브라우저 헤더(localStorage) 또는 .env 시크릿에서 읽어 중계만 합니다.');
});
