import { Hono } from 'hono';
import type { Context } from 'hono';
import { cors } from 'hono/cors';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { config } from './config.js';
import {
  createMeeting,
  addParticipant,
  countParticipants,
  RtkError,
  type CfCredentials,
} from './realtimekit.js';

// crypto.randomUUID 는 Node 19+ / Workers 양쪽에서 전역으로 제공된다.
const newId = () => globalThis.crypto.randomUUID();

const app = new Hono();
app.use('/api/*', cors());

/**
 * 자격증명 해석 우선순위:
 *  1) 브라우저가 보낸 BYO 키 헤더 (localStorage) — 호스트 본인 PC / 로컬 LAN
 *  2) 배포 환경 시크릿 (Worker env binding / .env) — 학생이 키 없이 링크로 접속
 */
// 배포 환경(Worker 시크릿 / .env)에 설정된 키. 운영자가 자체 강의 서비스를
// 돌릴 때 사용 — 학생은 키 없이 링크만으로 입장한다.
function envCreds(c: Context): CfCredentials | null {
  const env: any = (c.env as any) ?? {};
  const penv = (typeof process !== 'undefined' ? process.env : {}) as Record<
    string,
    string | undefined
  >;
  const accountId = env.CF_ACCOUNT_ID ?? penv.CF_ACCOUNT_ID;
  const appId = env.CF_REALTIMEKIT_APP_ID ?? penv.CF_REALTIMEKIT_APP_ID;
  const apiToken = env.CF_API_TOKEN ?? penv.CF_API_TOKEN;
  if (accountId && appId && apiToken) return { accountId, appId, apiToken };
  return null;
}

// 브라우저(localStorage)가 보낸 키. = "강사" 인증 신호.
function headerCreds(c: Context): CfCredentials | null {
  const a = c.req.header('x-cf-account-id')?.trim();
  const ap = c.req.header('x-cf-app-id')?.trim();
  const t = c.req.header('x-cf-api-token')?.trim();
  return a && ap && t ? { accountId: a, appId: ap, apiToken: t } : null;
}

// 일반 작업(참여/조회)용: 헤더 키 우선, 없으면 배포 시크릿(.env/Worker) 폴백.
function resolveCreds(c: Context): CfCredentials | null {
  return headerCreds(c) ?? envCreds(c);
}

function resolvePresets(c: Context): { host: string; participant: string } {
  const env: any = (c.env as any) ?? {};
  return {
    host:
      c.req.header('x-rtk-host-preset')?.trim() ||
      env.RTK_HOST_PRESET ||
      config.defaultHostPreset,
    participant:
      c.req.header('x-rtk-participant-preset')?.trim() ||
      env.RTK_PARTICIPANT_PRESET ||
      config.defaultParticipantPreset,
  };
}

function fail(c: Context, e: unknown) {
  if (e instanceof RtkError) {
    const status = e.status >= 400 && e.status <= 599 ? e.status : 502;
    return c.json({ error: e.message }, status as 400);
  }
  console.error(e);
  return c.json({ error: '서버 내부 오류' }, 500);
}

const NO_CREDS =
  'Cloudflare 자격증명이 없습니다. 설정에서 키를 입력하거나, 배포 환경에 시크릿을 설정하세요.';

// pnpm share(터널)가 기록한 현재 공개 주소를 읽는다. (Node 전용 — Workers/무파일시스템이면 null)
function tunnelPublicUrl(): string | null {
  // Node 전용 — Workers/무파일시스템 환경에선 건너뛴다.
  if (typeof process === 'undefined' || !process.versions?.node) return null;
  try {
    const f = join(tmpdir(), 'zomm-public-url.txt');
    if (existsSync(f)) return readFileSync(f, 'utf8').trim() || null;
  } catch {
    /* 무시 */
  }
  return null;
}

app.get('/api/health', (c) =>
  c.json({
    ok: true,
    maxParticipants: config.maxParticipants,
    serverConfigured: envCreds(c) !== null,
    // 터널 공개 주소(있으면). 프론트가 참여·초대 링크를 이 주소로 만든다.
    publicUrl: tunnelPublicUrl(),
  }),
);

// 강의 열기: 회의 생성 + 호스트를 host preset 으로 등록 → 호스트 authToken 반환
// 강의 개설은 "강사"만 가능 — 헤더 키(브라우저 localStorage)가 있어야 한다.
// (.env 시크릿으로는 개설 불가 → 공개 링크로 들어온 수강생이 강사가 되는 것을 차단)
app.post('/api/lectures', async (c) => {
  const creds = headerCreds(c);
  if (!creds) {
    return c.json({ error: '강의 개설은 강사 인증(설정의 Cloudflare 키)이 필요합니다.' }, 403);
  }

  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const hostName = String(body.hostName ?? '').trim();
  if (!hostName) return c.json({ error: 'hostName이 필요합니다.' }, 400);
  const title = String(body.title ?? '').trim() || `${hostName}님의 강의`;

  try {
    const meeting = await createMeeting(creds, { title, recordOnStart: Boolean(body.record) });
    const participantId = newId();
    const host = await addParticipant(creds, meeting.id, {
      name: hostName,
      presetName: resolvePresets(c).host,
      customParticipantId: participantId,
    });
    return c.json({
      meetingId: meeting.id,
      title: meeting.title ?? title,
      role: 'host',
      authToken: host.authToken,
      participantId,
    });
  } catch (e) {
    return fail(c, e);
  }
});

// 강의 참여: 정원 확인 후 수강생을 participant preset 으로 등록 → authToken 반환
app.post('/api/lectures/:id/join', async (c) => {
  const creds = resolveCreds(c);
  if (!creds) return c.json({ error: NO_CREDS }, 401);

  const meetingId = c.req.param('id');
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(body.name ?? '').trim();
  if (!name) return c.json({ error: '이름이 필요합니다.' }, 400);

  try {
    // 상한이 설정된 경우(>0)에만 정원 확인. 무제한이면 불필요한 API 호출을 건너뛴다.
    if (config.maxParticipants > 0) {
      const count = await countParticipants(creds, meetingId);
      if (count !== null && count >= config.maxParticipants) {
        return c.json({ error: `정원(${config.maxParticipants}명)이 가득 찼습니다.` }, 409);
      }
    }
    const participantId = newId();
    const p = await addParticipant(creds, meetingId, {
      name,
      presetName: resolvePresets(c).participant,
      customParticipantId: participantId,
    });
    return c.json({ meetingId, role: 'participant', authToken: p.authToken, participantId });
  } catch (e) {
    return fail(c, e);
  }
});

// 현재 인원 / 정원 조회 (강의 입장 화면에서 "N / 100" 표시용)
app.get('/api/lectures/:id/participants', async (c) => {
  const creds = resolveCreds(c);
  if (!creds) return c.json({ error: NO_CREDS }, 401);
  try {
    const count = await countParticipants(creds, c.req.param('id'));
    return c.json({ count, max: config.maxParticipants });
  } catch (e) {
    return fail(c, e);
  }
});

export default app;
