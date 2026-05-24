// 전역 한글 IME 보정.
//
// 문제: RtkMeeting 채팅 같은 일부(특히 Stencil 웹컴포넌트) 입력칸은 한글 "조합 중"에도
//       매 키 입력마다 input 이벤트로 값을 갱신·재렌더하면서 마지막 글자가 중복된다.
//
// 해결: 조합(compositionstart~compositionend) 중에는 input 이벤트가 컴포넌트 핸들러로
//       전달되는 것을 캡처 단계에서 막는다. 조합이 끝나면 브라우저가 최종 input 이벤트를
//       한 번 더 발생시키므로(이때는 막지 않음) 완성된 글자만 한 번 전달된다.
//       조합이 없는 영문 등은 전혀 영향받지 않는다.
//
// 이벤트는 shadow DOM 경계를 넘을 때 target이 호스트로 리타겟되지만, composition*과 input
// 모두 같은 호스트로 리타겟되므로 비교가 일관된다.
export function installImeGuard(): void {
  if (typeof document === 'undefined') return;
  if ((window as any).__zommImeGuard) return;
  (window as any).__zommImeGuard = true;

  let composingTarget: EventTarget | null = null;

  document.addEventListener(
    'compositionstart',
    (e) => {
      composingTarget = e.target;
    },
    true,
  );

  document.addEventListener(
    'compositionend',
    () => {
      composingTarget = null;
    },
    true,
  );

  document.addEventListener(
    'input',
    (e) => {
      // 조합 중 발생한 input 은 컴포넌트로 전달하지 않는다.
      if (composingTarget && e.target === composingTarget) {
        e.stopImmediatePropagation();
      }
    },
    true,
  );
}
