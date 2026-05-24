# zomm

오픈소스 줌 대체 화상 강의 도구. [Cloudflare RealtimeKit](https://developers.cloudflare.com/realtime/realtimekit/) 기반. 자기 Cloudflare 키만 있으면 무료.

- **영상 · 음성 · 화면공유 · 채팅 · 참가자 목록 · 녹화 · 호스트 제어** — 전부 RealtimeKit의 `<RtkMeeting>` 컴포넌트가 제공 (직접 구현 X)
- **자기 Cloudflare 키만 있으면 무료** — 베타 동안 인원·시간 무관 전액 무료, 정식 출시 후 분당 소액. **인원 제한 기본 없음**(원하면 상한 지정 가능)
- **백엔드는 상태 비저장** — 토큰만 발급하고 아무것도 저장하지 않음. Node 로컬 / Cloudflare Workers 서버리스 양쪽 실행

## 어떻게 동작하나

```
[프론트엔드: Vite + React]         [백엔드: Hono (상태 비저장 프록시)]      [Cloudflare RealtimeKit]
  ⚙ 설정에서 키 입력(localStorage)  ──헤더로 키 전달──▶  POST /meetings           ──▶  회의(=강의방) 생성
  "강의 열기" / "강의 참여"                              POST .../participants     ──▶  참가자별 authToken 발급
  <RtkMeeting/> 한 줄 = 회의 UI 전부  ◀──authToken──────                          ◀──  영상/채팅/화면공유 SFU 중계
```

- 직접 짠 영상/채팅 코드는 **0줄** — 회의 UI는 Cloudflare 컴포넌트 한 줄(`<RtkMeeting meeting={meeting} />`).
- 직접 짠 건 **토큰 발급 엔드포인트(약 100줄)** + 홈/설정 화면뿐.
- Cloudflare API는 브라우저에서 직접 못 부르고(CORS) 비밀 키가 필요하므로, 그 한 부분만 백엔드가 중계한다.

## 키는 어디에 두나

Cloudflare 키를 두는 위치는 두 가지. 어느 쪽이든 **수강생은 키 없이 링크만으로 입장**한다.

- **브라우저 설정** — ⚙ 설정 화면에서 입력하면 `localStorage`에만 저장된다. 로컬 실행·개인 사용에 적합.
- **서버 시크릿** — `.env`(로컬) 또는 Worker 시크릿(배포)에 넣는다. 배포해서 강의를 운영할 때 적합 — 강사는 키 입력 없이 바로 강의를 연다.

> 백엔드는 요청 헤더에 키가 있으면 그걸, 없으면 서버 시크릿을 사용한다. 같은 코드로 둘 다 커버.

## 사전 준비: Cloudflare RealtimeKit 키

1. [Cloudflare 대시보드 → Realtime → RealtimeKit](https://dash.cloudflare.com/?to=/:account/realtime/kit) 에서 앱 생성
2. **Account ID**, **App ID**, **API Token** 발급
3. **preset 확인** (앱 생성 시 기본 preset이 자동 생성됨 — 강의는 웨비나 preset 사용):
   - 강사용 `webinar_presenter` — 발표: 카메라 · 마이크 · 화면공유 · 녹화 · 참가자 관리
   - 수강생용 `webinar_viewer` — **채팅만**: 카메라 · 마이크 없음(무대 밖 뷰어), 강의는 보고 들으며 채팅 · 폴 가능
   - 정확한 이름은 대시보드 Presets에서 확인하고 다르면 설정 화면/`.env`에서 맞춘다. 녹화하려면 강사 preset에 녹화 권한이 켜져 있어야 한다.

## 빠른 시작 (로컬 개발)

```bash
# 1) 의존성 설치 (pnpm 권장)
pnpm install

# 2) 실행 (프론트 5173 + 백엔드 8787 동시 실행)
pnpm dev
```

- 브라우저에서 http://localhost:5173 접속
- **⚙ 설정**에서 Account ID / App ID / API Token / preset 이름 입력 → 저장 (localStorage에만 저장됨)
- **강의 열기** → 강의방 생성 후 입장. 주소창의 `/lecture/<코드>` 링크를 학생에게 공유
- 학생은 링크 접속 → 이름 입력 → 입장

## 공개 링크로 공유 (로컬에서, 배포 없이)

자기 PC에서 그대로 돌리면서 인터넷 공개 링크를 만들 수 있다. 미디어는 Cloudflare SFU가, 공개 링크는 **Cloudflare Tunnel**이 담당한다 — 배포·관리 서버 불필요. 터널 도구는 자동 설치된다.

```bash
# 터미널 1
pnpm dev

# 터미널 2 — cloudflared 자동 설치 후 공개 링크 생성
pnpm share
```

출력되는 `https://xxxx.trycloudflare.com` 링크를 수강생에게 공유하면 끝. (강사 PC는 브라우저로 자기 화면만 Cloudflare에 올리고, Cloudflare가 수강생들에게 송출한다.)

> **중요**: 수강생은 키 없이 링크로 입장하므로, 로컬 프록시가 수강생 토큰을 발급하려면 루트 `.env`에 키가 있어야 한다. (없으면 강사 본인만 입장 가능)
>
> ```bash
> cp .env.example .env   # CF_ACCOUNT_ID / CF_REALTIMEKIT_APP_ID / CF_API_TOKEN 입력
> ```
>
> 이러면 설정 화면 없이도 "강의 열기"가 켜진다.

## 배포 (Cloudflare Workers — 서버리스, 무관리)

토큰 발급 백엔드를 Workers에 올리면 관리할 서버 없이 학생이 링크만으로 입장한다.

```bash
cd server
pnpm dlx wrangler login

# 키를 시크릿으로 등록 (브라우저·코드에 노출되지 않음)
pnpm dlx wrangler secret put CF_ACCOUNT_ID
pnpm dlx wrangler secret put CF_REALTIMEKIT_APP_ID
pnpm dlx wrangler secret put CF_API_TOKEN

pnpm dlx wrangler deploy
```

프론트엔드(`web`)는 `pnpm --filter @zomm/web build` 후 정적 호스팅(Cloudflare Pages 등)에 올리고, `/api/*` 요청을 위 Worker로 보내면 된다.

## 인원 제한 (선택)

기본은 **인원 제한 없음**. 강의 1개당 입장 인원을 제한하려면 `MAX_PARTICIPANTS`를 설정한다 (`0` = 무제한, 예: `300`).

- 로컬: 루트 `.env`의 `MAX_PARTICIPANTS`
- Workers: `server/wrangler.toml`의 `[vars]` → `MAX_PARTICIPANTS`

> 참고: 양방향 화상으로 수백 명 이상이 동시에 들어오면 브라우저 렌더링·대역폭 부담이 커진다. 대규모 일방향 송출은 RealtimeKit의 웨비나/라이브스트림 모드가 더 적합하다.

## 비용

- **베타(현재)**: 전부 **무료** — 인원·시간 무관.
- **정식 출시(GA) 후**: 영상+음성 **$0.002/분/명**, 음성만 $0.0005, 녹화 export $0.010/분.
  - 예) 100명 · 1시간 영상 강의 ≈ **$12**, 30명 · 1시간 ≈ $3.6. 안 열면 0원.
- 호스팅 인프라(Pages/Workers)는 무료 티어로 사실상 $0.
- 자세한 요금: [Cloudflare RealtimeKit Pricing](https://developers.cloudflare.com/realtime/realtimekit/pricing/)

## 구조

```
zomm/
├── server/                 Hono 백엔드 (상태 비저장 토큰 발급 프록시)
│   ├── src/
│   │   ├── app.ts          라우트 + 키 해석(헤더→시크릿) + 정원 cap
│   │   ├── realtimekit.ts  Cloudflare RealtimeKit REST 클라이언트
│   │   ├── config.ts       환경 설정
│   │   ├── index.ts        Node 로컬 실행 엔트리
│   │   └── worker.ts       Cloudflare Workers 엔트리
│   └── wrangler.toml
└── web/                    Vite + React 프론트엔드
    └── src/
        ├── pages/Home.tsx       강의 열기 / 참여
        ├── pages/Settings.tsx   Cloudflare 키 입력(localStorage)
        ├── pages/Lecture.tsx    <RtkMeeting/> 회의 화면
        ├── lib/credentials.ts   localStorage 키 관리
        └── api.ts               백엔드 호출
```

## 라이선스

MIT — [LICENSE](./LICENSE)