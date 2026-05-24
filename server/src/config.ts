// 환경 설정. 값은 getter로 지연 평가 → index.ts(Node)가 dotenv를 먼저 로드한 뒤
// serve() 시점에 읽히고, Workers에서는 process가 없어도 안전하게 기본값을 쓴다.
const penv = () =>
  (typeof process !== 'undefined' ? process.env : {}) as Record<string, string | undefined>;

export const config = {
  get port() {
    return Number(penv().PORT ?? 8787);
  },
  /** 강의 1개당 입장 가능한 최대 인원. 0(또는 미설정)이면 무제한. */
  get maxParticipants() {
    return Number(penv().MAX_PARTICIPANTS ?? 0); // 0 = 무제한
  },
  /** 강사(발표자)용 preset. 웨비나 호스트 = 카메라·마이크·화면공유·녹화·관리 권한. */
  get defaultHostPreset() {
    return penv().RTK_HOST_PRESET ?? 'webinar_presenter';
  },
  /** 수강생용 preset. 웨비나 뷰어 = 채팅만(카메라·마이크 송출 불가, 무대 밖). */
  get defaultParticipantPreset() {
    return penv().RTK_PARTICIPANT_PRESET ?? 'webinar_viewer';
  },
};
