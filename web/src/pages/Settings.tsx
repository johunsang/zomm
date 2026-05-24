import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  loadCredentials,
  saveCredentials,
  clearCredentials,
  loadShareBase,
  saveShareBase,
  DEFAULT_HOST_PRESET,
  DEFAULT_PARTICIPANT_PRESET,
} from '../lib/credentials';

export default function Settings() {
  const navigate = useNavigate();
  const existing = loadCredentials();

  const [accountId, setAccountId] = useState(existing?.accountId ?? '');
  const [appId, setAppId] = useState(existing?.appId ?? '');
  const [apiToken, setApiToken] = useState(existing?.apiToken ?? '');
  const [hostPreset, setHostPreset] = useState(existing?.hostPreset ?? DEFAULT_HOST_PRESET);
  const [participantPreset, setParticipantPreset] = useState(
    existing?.participantPreset ?? DEFAULT_PARTICIPANT_PRESET,
  );
  const [shareBase, setShareBase] = useState(loadShareBase());
  const [saved, setSaved] = useState(false);

  function save(e: React.FormEvent) {
    e.preventDefault();
    saveCredentials({
      accountId: accountId.trim(),
      appId: appId.trim(),
      apiToken: apiToken.trim(),
      hostPreset: hostPreset.trim() || DEFAULT_HOST_PRESET,
      participantPreset: participantPreset.trim() || DEFAULT_PARTICIPANT_PRESET,
    });
    saveShareBase(shareBase);
    setSaved(true);
    setTimeout(() => navigate('/'), 600);
  }

  function reset() {
    clearCredentials();
    saveShareBase('');
    setAccountId('');
    setAppId('');
    setApiToken('');
    setHostPreset(DEFAULT_HOST_PRESET);
    setParticipantPreset(DEFAULT_PARTICIPANT_PRESET);
    setShareBase('');
    setSaved(false);
  }

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          zomm <span className="brand-sub">Cloudflare 설정</span>
        </div>
        <Link to="/" className="btn btn-ghost">← 홈으로</Link>
      </header>

      <main className="settings">
        <div className="banner">
          이 값들은 <strong>브라우저(localStorage)에만</strong> 저장됩니다 — 서버로 전송되어 저장되지 않습니다.
          키는 회의 생성·토큰 발급을 위해 매 요청마다 프록시로 중계만 됩니다.
        </div>

        <form className="card card-wide" onSubmit={save}>
          <h2>Cloudflare RealtimeKit 키</h2>
          <p className="muted">
            <a href="https://dash.cloudflare.com/?to=/:account/realtime/kit" target="_blank" rel="noreferrer">
              Cloudflare 대시보드 → Realtime → RealtimeKit
            </a>{' '}
            에서 앱을 만들고 Account ID / App ID / API Token 을 발급하세요.
          </p>

          <label>
            Account ID
            <input value={accountId} onChange={(e) => setAccountId(e.target.value)} required />
          </label>
          <label>
            App ID
            <input value={appId} onChange={(e) => setAppId(e.target.value)} required />
          </label>
          <label>
            API Token
            <input
              type="password"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              placeholder="대시보드에서 발급한 토큰"
              required
            />
          </label>

          <hr />
          <p className="muted">
            강의(웨비나) 역할입니다. <strong>강사</strong>는 발표(카메라·마이크·화면공유·녹화·관리),{' '}
            <strong>수강생</strong>은 <strong>채팅만</strong>(카메라·마이크 없음, 무대 밖 뷰어)인 preset을 씁니다.
            이름은 대시보드 Presets에서 확인하세요 (보통 webinar_presenter / webinar_viewer).
          </p>
          <div className="row">
            <label>
              강사 preset
              <input value={hostPreset} onChange={(e) => setHostPreset(e.target.value)} />
            </label>
            <label>
              수강생 preset
              <input
                value={participantPreset}
                onChange={(e) => setParticipantPreset(e.target.value)}
              />
            </label>
          </div>

          <hr />
          <label>
            공개 주소 <span className="muted">(선택 — 참여·초대 링크에 쓸 주소)</span>
            <input
              value={shareBase}
              onChange={(e) => setShareBase(e.target.value)}
              placeholder="예: https://xxxx.trycloudflare.com (pnpm share 주소)"
            />
          </label>
          <p className="muted">
            localhost로 앱을 열어도, 여기에 <code>pnpm share</code> 공개 주소를 넣으면 외부 학생이 들어올 수 있는
            공개 링크가 만들어집니다. (비우면 현재 접속 주소 사용)
          </p>

          <div className="actions">
            <button className="btn btn-primary" type="submit">
              {saved ? '저장됨 ✓' : '저장'}
            </button>
            <button className="btn btn-ghost" type="button" onClick={reset}>
              지우기
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
