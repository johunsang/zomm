// 사용자의 Cloudflare 자격증명을 브라우저 localStorage 에 보관한다.
// 백엔드는 상태를 갖지 않으므로 이 값이 유일한 출처다(호스트 본인 기기 기준).

export interface CfCredentials {
  accountId: string;
  appId: string;
  apiToken: string;
  hostPreset: string;
  participantPreset: string;
}

const KEY = 'zomm:cf-credentials';

export const DEFAULT_HOST_PRESET = 'webinar_presenter';
export const DEFAULT_PARTICIPANT_PRESET = 'webinar_viewer';

export function loadCredentials(): CfCredentials | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Partial<CfCredentials>;
    if (!c.accountId || !c.appId || !c.apiToken) return null;
    return {
      accountId: c.accountId,
      appId: c.appId,
      apiToken: c.apiToken,
      hostPreset: c.hostPreset || DEFAULT_HOST_PRESET,
      participantPreset: c.participantPreset || DEFAULT_PARTICIPANT_PRESET,
    };
  } catch {
    return null;
  }
}

export function saveCredentials(c: CfCredentials): void {
  localStorage.setItem(KEY, JSON.stringify(c));
}

export function clearCredentials(): void {
  localStorage.removeItem(KEY);
}

export function hasCredentials(): boolean {
  return loadCredentials() !== null;
}

// 공유 링크(참여·초대)에 쓸 공개 주소. localhost로 앱을 열어도 학생이 들어올 수 있도록
// pnpm share 의 공개 URL(https://xxxx.trycloudflare.com)을 넣어 둔다. 비우면 현재 주소 사용.
const SHARE_BASE_KEY = 'zomm:share-base';

export function loadShareBase(): string {
  try {
    return (localStorage.getItem(SHARE_BASE_KEY) || '').trim().replace(/\/+$/, '');
  } catch {
    return '';
  }
}

export function saveShareBase(url: string): void {
  const v = url.trim().replace(/\/+$/, '');
  if (v) localStorage.setItem(SHARE_BASE_KEY, v);
  else localStorage.removeItem(SHARE_BASE_KEY);
}
