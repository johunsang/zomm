import { loadCredentials } from './lib/credentials';

// localStorage 의 키를 헤더로 실어 백엔드(프록시)에 보낸다.
// 키가 없으면(예: 학생이 배포된 Worker에 접속) 헤더 없이 보내고,
// 그 경우 백엔드가 자기 시크릿으로 토큰을 발급한다.
function headers(): Record<string, string> {
  const base: Record<string, string> = { 'Content-Type': 'application/json' };
  const c = loadCredentials();
  if (!c) return base;
  return {
    ...base,
    'x-cf-account-id': c.accountId,
    'x-cf-app-id': c.appId,
    'x-cf-api-token': c.apiToken,
    'x-rtk-host-preset': c.hostPreset,
    'x-rtk-participant-preset': c.participantPreset,
  };
}

async function handle<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) throw new Error(data.error || `요청 실패 (HTTP ${res.status})`);
  return data as T;
}

export interface JoinResult {
  meetingId: string;
  role: 'host' | 'participant';
  authToken: string;
  participantId: string;
  title?: string;
}

export const api = {
  createLecture(input: { title?: string; hostName: string; record?: boolean }) {
    return fetch('/api/lectures', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(input),
    }).then((r) => handle<JoinResult>(r));
  },

  joinLecture(id: string, name: string) {
    return fetch(`/api/lectures/${encodeURIComponent(id)}/join`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ name }),
    }).then((r) => handle<JoinResult>(r));
  },

  participantCount(id: string) {
    return fetch(`/api/lectures/${encodeURIComponent(id)}/participants`, {
      headers: headers(),
    }).then((r) => handle<{ count: number | null; max: number }>(r));
  },
};

// 강의 입장 토큰은 세션 동안만 유지(새로고침 견딤, 탭 닫으면 소멸).
export const tokenStore = {
  save(meetingId: string, authToken: string, participantId: string) {
    sessionStorage.setItem(`zomm:token:${meetingId}`, authToken);
    sessionStorage.setItem(`zomm:pid:${meetingId}`, participantId);
  },
  token(meetingId: string) {
    return sessionStorage.getItem(`zomm:token:${meetingId}`);
  },
  clear(meetingId: string) {
    sessionStorage.removeItem(`zomm:token:${meetingId}`);
    sessionStorage.removeItem(`zomm:pid:${meetingId}`);
  },
};
