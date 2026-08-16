/**
 * 눈금자 좌표 계산.
 *
 * DOM 없이 검증할 수 있도록 순수 함수로 떼어 둔다 — `ruler.ts` 는 생성자
 * 파라미터 프로퍼티를 써서 Node 의 타입 스트리핑으로 곧장 불러올 수 없다.
 */

/**
 * 용지 왼쪽의 화면 X 좌표를 구한다.
 * 좌표계는 눈금자 캔버스와 같다 (= `#scroll-container` 뷰포트 기준).
 *
 * `#scroll-content` 는 `margin: 0 auto` 라서 컨테이너보다 좁으면 CSS 가 가운데로
 * 밀어 준다. 이 이동량을 빼먹으면 눈금자가 실제 용지보다 왼쪽에 그려진다.
 * 콘텐츠가 컨테이너보다 넓으면 정렬이 일어나지 않고 scrollX 가 그 역할을 한다.
 *
 * @param pageLeftInContent `#scroll-content` 안에서의 용지 왼쪽 좌표
 * @param containerWidth    `#scroll-container` 의 표시 폭
 * @param contentWidth      `#scroll-content` 의 폭
 * @param scrollX           가로 스크롤 위치
 */
export function resolvePageScreenLeft(
  pageLeftInContent: number,
  containerWidth: number,
  contentWidth: number,
  scrollX: number,
): number {
  const centering = Math.max(0, (containerWidth - contentWidth) / 2);
  return pageLeftInContent + centering - scrollX;
}
