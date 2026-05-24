// Cloudflare RealtimeKit REST API 얇은 클라이언트.
// 자격증명(creds)은 호출자가 매 요청마다 넘긴다 — 이 모듈은 상태를 갖지 않는다.

export interface CfCredentials {
  accountId: string;
  appId: string;
  apiToken: string;
}

export class RtkError extends Error {
  status: number;
  body?: unknown;
  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = 'RtkError';
    this.status = status;
    this.body = body;
  }
}

function baseUrl(c: CfCredentials): string {
  return `https://api.cloudflare.com/client/v4/accounts/${c.accountId}/realtime/kit/${c.appId}`;
}

async function rtkFetch(creds: CfCredentials, path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`${baseUrl(creds)}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${creds.apiToken}`,
      ...(init?.headers ?? {}),
    },
  });

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* 비-JSON 응답은 무시 */
  }

  if (!res.ok || (json && json.success === false)) {
    const msg =
      json?.errors?.[0]?.message ??
      json?.error?.message ?? // Cloudflare: { error: { code, message } }
      (typeof json?.error === 'string' ? json.error : undefined) ??
      json?.message ??
      `Cloudflare API 오류 (HTTP ${res.status})`;
    throw new RtkError(msg, res.status, json);
  }
  return json;
}

// Cloudflare client/v4 는 페이로드를 result 로 감싼다(구버전 Dyte는 data). 양쪽 모두 대응.
function unwrap<T>(json: any): T {
  return (json?.result ?? json?.data ?? json) as T;
}

export interface Meeting {
  id: string;
  title?: string;
}

export interface AddedParticipant {
  id: string;
  authToken: string;
}

export async function createMeeting(
  creds: CfCredentials,
  opts: { title: string; recordOnStart?: boolean },
): Promise<Meeting> {
  const json = await rtkFetch(creds, '/meetings', {
    method: 'POST',
    body: JSON.stringify({
      title: opts.title,
      ...(opts.recordOnStart ? { record_on_start: true } : {}),
    }),
  });
  return unwrap<Meeting>(json);
}

export async function addParticipant(
  creds: CfCredentials,
  meetingId: string,
  opts: { name: string; presetName: string; customParticipantId: string },
): Promise<AddedParticipant> {
  const json = await rtkFetch(creds, `/meetings/${meetingId}/participants`, {
    method: 'POST',
    body: JSON.stringify({
      name: opts.name,
      preset_name: opts.presetName,
      custom_participant_id: opts.customParticipantId,
    }),
  });
  const data = unwrap<any>(json);
  // 참가자 토큰 필드명은 버전에 따라 다르다: token(레거시 Dyte) / authToken / auth_token.
  const authToken = data?.token ?? data?.authToken ?? data?.auth_token;
  const id = data?.id ?? data?.participant_id ?? opts.customParticipantId;
  if (!authToken) {
    throw new RtkError(
      `참가자 토큰을 응답에서 찾지 못했습니다. 응답 키: [${Object.keys(data ?? {}).join(', ')}]`,
      502,
      json,
    );
  }
  return { id, authToken };
}

// 강의에 지금까지 등록된 참가자 수(best-effort).
// RealtimeKit list 엔드포인트는 "등록된 전원"을 돌려준다(현재 접속자 필터 없음).
// 강의는 보통 세션마다 새로 만들므로 이 값은 곧 "입장 허용 누계" ≈ 정원 게이지로 충분하다.
// 값을 판단할 수 없으면 null → 호출자는 fail-open(입장 허용)한다.
export async function countParticipants(
  creds: CfCredentials,
  meetingId: string,
): Promise<number | null> {
  const json = await rtkFetch(
    creds,
    `/meetings/${meetingId}/participants?per_page=1&page_no=1`,
  );
  const info = json?.result_info ?? json?.paging ?? null;
  if (info && typeof info.total_count === 'number') return info.total_count;
  if (info && typeof info.total === 'number') return info.total;
  const arr = json?.result ?? json?.data;
  if (Array.isArray(arr)) return arr.length; // 폴백: 현재 페이지 개수만
  return null;
}
