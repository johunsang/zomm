import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useRealtimeKitClient, RealtimeKitProvider } from '@cloudflare/realtimekit-react';
import { RtkMeeting } from '@cloudflare/realtimekit-react-ui';
import { defaultConfig } from '@cloudflare/realtimekit-ui';
import { tokenStore } from '../api';

// 조용히 입장/퇴장: 입퇴장 알림(팝업·소리)만 기본 config에서 제거. 그 외 UI는 그대로.
// (소리를 다시 켜고 싶은 사람은 회의 내 Settings → Notification sound 로 가능)
const isJoinLeave = (n: string) => /joined|left/i.test(n);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const quietConfig: any = (() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = { ...(defaultConfig as any) };
  if (Array.isArray(c.notifications)) c.notifications = c.notifications.filter((n: string) => !isJoinLeave(n));
  if (Array.isArray(c.notification_sounds))
    c.notification_sounds = c.notification_sounds.filter((n: string) => !isJoinLeave(n));
  return c;
})();

function Splash({ text }: { text: string }) {
  return (
    <div className="splash">
      <div className="spinner" />
      <p>{text}</p>
    </div>
  );
}

export default function Lecture() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // 토큰 출처: ?t=<초대토큰>(링크에 박힌 것) > 세션에 저장된 토큰
  const inviteToken = searchParams.get('t');
  const [token] = useState<string | null>(() => inviteToken || tokenStore.token(id));

  const [meeting, initMeeting] = useRealtimeKitClient();
  const initedRef = useRef(false);

  // 초대 토큰으로 들어왔으면 세션에 저장하고 URL에서 토큰을 제거(주소창/히스토리 노출 방지)
  useEffect(() => {
    if (inviteToken) {
      tokenStore.save(id, inviteToken, '');
      navigate(`/lecture/${id}`, { replace: true });
    }
  }, [inviteToken, id, navigate]);

  // 토큰이 전혀 없으면 참여 페이지로
  useEffect(() => {
    if (!token) navigate(`/join/${id}`, { replace: true });
  }, [token, id, navigate]);

  useEffect(() => {
    if (!token || initedRef.current) return;
    initedRef.current = true;
    initMeeting({ authToken: token, defaults: { audio: false, video: false } });
  }, [token, initMeeting]);

  useEffect(() => {
    if (!meeting) return;
    const onLeft = () => {
      tokenStore.clear(id);
      navigate('/');
    };
    meeting.self.on('roomLeft', onLeft);
    return () => {
      meeting.self.off('roomLeft', onLeft);
    };
  }, [meeting, id, navigate]);

  if (!token) return null;

  return (
    <div className="meeting-root">
      <RealtimeKitProvider value={meeting} fallback={<Splash text="연결 중…" />}>
        {meeting ? (
          <RtkMeeting meeting={meeting} config={quietConfig} mode="fill" />
        ) : (
          <Splash text="회의를 준비하는 중…" />
        )}
      </RealtimeKitProvider>
    </div>
  );
}
