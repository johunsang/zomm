// Cloudflare Workers 엔트리 — 하나의 Worker가 프론트(정적 자산) + /api(토큰 발급)를 모두 서빙.
//
// - /api/*    → Hono 앱 (회의 생성·토큰 발급). 키는 Worker 시크릿(c.env)에서 읽음.
// - 그 외 경로 → 정적 자산(web/dist). 없는 경로는 SPA 폴백(index.html) → React Router 처리.
import app from './app.js';

interface Env {
  ASSETS: { fetch: (req: Request) => Promise<Response> };
}

export default {
  async fetch(request: Request, env: Env, ctx: unknown): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return app.fetch(request, env as any, ctx as any);
    }
    return env.ASSETS.fetch(request);
  },
};
