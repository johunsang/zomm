// 로컬 dev 서버(https://localhost:5173)를 Cloudflare Tunnel로 공개 링크로 노출한다.
// 터널 도구(cloudflared) 바이너리는 없으면 자동 다운로드한다 — 별도 설치 불필요.
//
//   터미널 1:  pnpm dev      (프론트 + 백엔드)
//   터미널 2:  pnpm share    (공개 링크 생성)
//
// 주의: 수강생이 키 없이 링크로 입장하므로, 루트 .env 에 CF_* 키가 있어야
//       로컬 프록시가 수강생 토큰을 발급할 수 있다. (없으면 강사 본인만 입장 가능)
import { spawn } from 'node:child_process';
import net from 'node:net';
import { existsSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bin, install } from 'cloudflared';

// 백엔드(/api/health)가 읽어서 프론트에 공개 주소를 알려주는 파일.
// → 강의 참여/초대 링크가 매번 현재 터널 주소로 자동 생성된다.
const PUBLIC_URL_FILE = join(tmpdir(), 'zomm-public-url.txt');

const ORIGIN = process.env.SHARE_ORIGIN ?? 'https://localhost:5173';
const PORT = Number(new URL(ORIGIN).port || (ORIGIN.startsWith('https') ? 443 : 80));

function portOpen(port, host = 'localhost') {
  return new Promise((resolve) => {
    const sock = net.connect({ port, host });
    sock.on('connect', () => {
      sock.end();
      resolve(true);
    });
    sock.on('error', () => resolve(false));
    sock.setTimeout(800, () => {
      sock.destroy();
      resolve(false);
    });
  });
}

async function main() {
  // 1) 터널 도구 자동 설치 (최초 1회만 다운로드)
  if (!existsSync(bin)) {
    console.log('⬇  터널 도구(cloudflared) 설치 중... (최초 1회)');
    await install(bin);
    console.log('✓ cloudflared 설치 완료\n');
  }

  // 2) 로컬 dev 서버가 떠 있는지 대기
  process.stdout.write(`⏳ 로컬 서버(${ORIGIN}) 대기 중`);
  let up = false;
  for (let i = 0; i < 40; i++) {
    if (await portOpen(PORT)) {
      up = true;
      break;
    }
    process.stdout.write('.');
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (!up) {
    console.log('\n⚠ 로컬 서버가 안 떠 있습니다. 다른 터미널에서 먼저 `pnpm dev` 를 실행하세요.');
    process.exit(1);
  }
  process.stdout.write(' — 연결됨\n');

  // 3) Cloudflare Tunnel 시작
  //  - 빈 config 지정: 기존 ~/.cloudflared/config.yml 의 ingress 규칙이 --url 을 덮어써
  //    catch-all 404 를 내는 것을 막는다.
  //  - --no-tls-verify: mkcert 자체서명 origin(https://localhost:5173) 검증 생략.
  const emptyConfig = join(tmpdir(), 'zomm-tunnel-empty.yml');
  writeFileSync(emptyConfig, '');
  console.log('🌐 Cloudflare Tunnel 시작...\n');
  const child = spawn(
    bin,
    ['tunnel', '--config', emptyConfig, '--url', ORIGIN, '--no-tls-verify'],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );

  let printed = false;
  const scan = (buf) => {
    const text = buf.toString();
    const m = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (m && !printed) {
      printed = true;
      try {
        writeFileSync(PUBLIC_URL_FILE, m[0]); // 백엔드가 읽어 프론트 링크에 사용
      } catch {
        /* 무시 */
      }
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔗 공개 강의 링크:  ' + m[0]);
      console.log('   이 링크를 수강생에게 공유하세요.');
      console.log('   종료하려면 Ctrl+C.');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }
  };
  child.stdout.on('data', scan);
  child.stderr.on('data', scan);

  const shutdown = () => {
    try {
      rmSync(PUBLIC_URL_FILE, { force: true }); // 터널 종료 시 공개 주소 정리 → 다시 로컬 주소 사용
    } catch {
      /* 무시 */
    }
    child.kill('SIGINT');
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  child.on('exit', (code) => process.exit(code ?? 0));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
