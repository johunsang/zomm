import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, tokenStore } from '../api';

// 수강생 참여 페이지. 이름(+필요 시 입장 코드)을 입력하면 서버가 webinar_viewer(채팅만) 토큰을 발급한다.
export default function Join() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [codeRequired, setCodeRequired] = useState(false);

  useEffect(() => {
    api
      .health()
      .then((h) => setCodeRequired(h.joinCodeRequired))
      .catch(() => {});
  }, []);

  async function join(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get('name') || '').trim();
    const code = String(fd.get('code') || '').trim();
    setError('');
    setJoining(true);
    try {
      const r = await api.joinLecture(id, name, code);
      tokenStore.save(r.meetingId, r.authToken, r.participantId);
      navigate(`/lecture/${r.meetingId}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : '입장에 실패했습니다.');
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          zomm <span className="brand-sub">강의 참여</span>
        </div>
      </header>
      <main className="join-gate">
        <form className="card" onSubmit={join}>
          <h2>강의 입장</h2>
          <p className="muted">
            강의 코드: <code>{id}</code>
          </p>
          {error && <div className="banner banner-error">{error}</div>}
          <label>
            내 이름
            <input name="name" placeholder="예: 이수강" required autoFocus />
          </label>
          {codeRequired && (
            <label>
              입장 코드
              <input name="code" placeholder="강사에게 받은 입장 코드" required />
            </label>
          )}
          <button className="btn btn-primary" disabled={joining}>
            {joining ? '입장 중…' : '입장하기'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/')}>
            취소
          </button>
        </form>
      </main>
    </div>
  );
}
