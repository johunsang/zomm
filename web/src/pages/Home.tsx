import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, tokenStore } from '../api';
import { hasCredentials, loadShareBase } from '../lib/credentials';

export default function Home() {
  const navigate = useNavigate();
  // 강의 개설 화면은 (1) 브라우저에 CF 키가 있거나(강사) (2) 강사 코드가 설정된 경우에만 노출.
  // 서버에 키가 있다고(serverConfigured) 아무에게나 보이면 안 됨 → 학생에겐 안 보이게.
  const [connected, setConnected] = useState(hasCredentials());
  const [hostCodeRequired, setHostCodeRequired] = useState(false);
  const canCreate = connected || hostCodeRequired;
  // 현재 터널 공개 주소(서버가 알려줌). pnpm share 할 때마다 자동 갱신됨.
  const [publicUrl, setPublicUrl] = useState('');

  // 강의 참여 (수강생) — 코드만 받고, 이름은 참여 페이지에서 입력
  const [code, setCode] = useState('');

  const [busy, setBusy] = useState<null | 'create'>(null);
  const [error, setError] = useState('');

  // 생성된 강의
  const [created, setCreated] = useState<{ meetingId: string; title?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // 초대 링크(토큰 포함) 생성
  const [inviteUrl, setInviteUrl] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  useEffect(() => {
    setConnected(hasCredentials());
    api
      .health()
      .then((h) => {
        if (h.publicUrl) setPublicUrl(h.publicUrl);
        setHostCodeRequired(h.hostCodeRequired);
      })
      .catch(() => {});
  }, []);

  async function openLecture(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const hostName = String(fd.get('hostName') || '').trim();
    const title = String(fd.get('title') || '').trim();
    const record = fd.get('record') != null;
    const hostCode = String(fd.get('hostCode') || '').trim();
    setError('');
    setBusy('create');
    try {
      const r = await api.createLecture({ hostName, title, record, hostCode });
      tokenStore.save(r.meetingId, r.authToken, r.participantId);
      setCreated({ meetingId: r.meetingId, title: r.title });
    } catch (err) {
      setError(err instanceof Error ? err.message : '강의 생성에 실패했습니다.');
    } finally {
      setBusy(null);
    }
  }

  function goJoin(e: React.FormEvent) {
    e.preventDefault();
    const id = code.trim();
    if (id) navigate(`/join/${encodeURIComponent(id)}`);
  }

  // 공유 링크 기준 주소: 현재 터널 주소(자동) > 설정의 공개 주소 > 현재 접속 주소
  const shareBase = publicUrl || loadShareBase() || window.location.origin;
  const joinUrl = created ? `${shareBase}/join/${created.meetingId}` : '';

  async function copy(text: string, mark: (v: boolean) => void) {
    try {
      await navigator.clipboard.writeText(text);
      mark(true);
      setTimeout(() => mark(false), 1500);
    } catch {
      /* 권한 없으면 사용자가 직접 복사 */
    }
  }

  // 특정 수강생용 초대 링크(토큰 미리 발급 → 클릭 시 바로 입장)
  async function generateInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!created) return;
    const inviteName = String(new FormData(e.currentTarget).get('inviteName') || '').trim();
    setInviteBusy(true);
    try {
      const r = await api.joinLecture(created.meetingId, inviteName || '초대 손님');
      const url = `${shareBase}/lecture/${created.meetingId}?t=${encodeURIComponent(r.authToken)}`;
      setInviteUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : '초대 링크 생성에 실패했습니다.');
    } finally {
      setInviteBusy(false);
    }
  }

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          zomm <span className="brand-sub">무료 화상 강의</span>
        </div>
        <Link to="/settings" className="btn btn-ghost">
          ⚙ Cloudflare 설정 {connected ? <span className="dot dot-on" /> : <span className="dot dot-off" />}
        </Link>
      </header>

      <main className="home">
        {error && <div className="banner banner-error">{error}</div>}

        {created ? (
          /* ── 강의 생성 완료 ── */
          <div className="card card-wide">
            <h2>강의가 열렸습니다 🎉</h2>
            {created.title && <p className="muted">{created.title}</p>}

            <label>
              수강생 참여 링크 <span className="muted">(이름 입력 후 입장)</span>
              <input value={joinUrl} readOnly onFocus={(e) => e.currentTarget.select()} />
            </label>
            <div className="actions">
              <button className="btn" type="button" onClick={() => copy(joinUrl, setCopied)}>
                {copied ? '복사됨 ✓' : '참여 링크 복사'}
              </button>
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => navigate(`/lecture/${created.meetingId}`)}
              >
                강사로 입장
              </button>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => {
                  setCreated(null);
                  setInviteUrl('');
                }}
              >
                새 강의
              </button>
            </div>

            <hr />

            {/* 초대 링크(토큰 포함) — 클릭하면 바로 입장 */}
            <form onSubmit={generateInvite}>
              <label>
                초대 링크 생성 <span className="muted">(받는 사람 이름 → 토큰이 박힌 즉시 입장 링크)</span>
                <div className="row">
                  <input name="inviteName" placeholder="예: 이수강" />
                  <button className="btn" type="submit" disabled={inviteBusy}>
                    {inviteBusy ? '생성 중…' : '초대 링크 만들기'}
                  </button>
                </div>
              </label>
            </form>
            {inviteUrl && (
              <>
                <input value={inviteUrl} readOnly onFocus={(e) => e.currentTarget.select()} />
                <div className="actions">
                  <button className="btn" type="button" onClick={() => copy(inviteUrl, setInviteCopied)}>
                    {inviteCopied ? '복사됨 ✓' : '초대 링크 복사'}
                  </button>
                </div>
                <p className="muted">
                  이 링크엔 입장 토큰이 포함됩니다 — 받은 사람은 클릭만으로 <strong>채팅만 가능한 뷰어</strong>로 바로 입장합니다.
                  (링크를 받은 사람은 누구나 입장 가능하니 공유에 유의)
                </p>
              </>
            )}
          </div>
        ) : (
          <>
            {!canCreate && (
              <div className="banner">
                강의를 열려면 <Link to="/settings">설정에서 Cloudflare 키</Link>를 입력하세요. 참여만 할 거라면 아래에 코드를 넣으면 됩니다.
              </div>
            )}

            <div className="cards">
              {/* 강의 열기 (강사) — CF 키(BYO) 또는 서버 키+강사 코드(배포)면 노출 */}
              {canCreate && (
                <form className="card" onSubmit={openLecture}>
                  <h2>강의 열기</h2>
                  <p className="muted">강사로 새 강의를 만듭니다.</p>
                  <label>
                    내 이름 (강사)
                    <input name="hostName" placeholder="예: 김강사" required />
                  </label>
                  <label>
                    강의 제목 <span className="muted">(선택)</span>
                    <input name="title" placeholder="예: 5월 알고리즘 특강" />
                  </label>
                  {!connected && hostCodeRequired && (
                    <label>
                      강사 코드
                      <input name="hostCode" placeholder="강사용 코드(PIN)" required />
                    </label>
                  )}
                  <label className="checkbox">
                    <input type="checkbox" name="record" />
                    시작과 동시에 녹화 (preset에 녹화 권한 필요)
                  </label>
                  <button className="btn btn-primary" disabled={busy !== null}>
                    {busy === 'create' ? '여는 중…' : '강의 열기'}
                  </button>
                </form>
              )}

              {/* 강의 참여 (수강생) — 항상 노출 */}
              <form className="card" onSubmit={goJoin}>
                <h2>강의 참여</h2>
                <p className="muted">강의 코드로 참여 페이지에 들어갑니다. (키 없이도 가능)</p>
                <label>
                  강의 코드
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="강사에게 받은 코드/링크의 ID"
                    required
                  />
                </label>
                <button className="btn" type="submit">
                  참여하기
                </button>
              </form>
            </div>
          </>
        )}

        <footer className="home-foot muted">
          오픈소스 · Cloudflare RealtimeKit 기반 — 자기 키만 있으면 무료.
        </footer>
      </main>
    </div>
  );
}
