// Cloudflare Workers 엔트리. 같은 Hono 앱을 그대로 export 한다.
// 키는 Worker 시크릿(CF_ACCOUNT_ID / CF_REALTIMEKIT_APP_ID / CF_API_TOKEN)으로
// 설정되어 c.env 로 주입된다 → 학생은 키 없이 링크만으로 입장 가능.
import app from './app.js';

export default app;
