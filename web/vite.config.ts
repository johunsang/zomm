import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// 개발 중에는 /api 요청을 로컬 Hono 프록시(8787)로 보낸다 → CORS 회피.
// 브라우저가 http→https 업그레이드를 강제하는 환경 대비, mkcert로 발급한 신뢰
// 인증서가 있으면 HTTPS로 띄운다(없으면 평범한 HTTP). 인증서 발급:
//   mkcert -cert-file web/certs/cert.pem -key-file web/certs/key.pem localhost 127.0.0.1 ::1
const certDir = resolve(__dirname, 'certs');
const certPath = resolve(certDir, 'cert.pem');
const keyPath = resolve(certDir, 'key.pem');
const https =
  existsSync(certPath) && existsSync(keyPath)
    ? { cert: readFileSync(certPath), key: readFileSync(keyPath) }
    : undefined;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    https,
    // Cloudflare Tunnel(*.trycloudflare.com) 등 외부 호스트로 들어오는 요청 허용 (로컬+터널 공유용)
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
});
