/**
 * 켜고 끄는 명령의 「켜짐」 표시.
 *
 * `commands/view.ts` 안에 있던 것을 꺼냈다. 도구 상자 접기가 이것을 쓰는데,
 * view.ts 에 두면 view.ts 와 서로 부르는 고리가 생긴다.
 */

/**
 * 켜짐 표시를 맞춘다.
 *
 * 같은 `data-cmd` 가 메뉴 항목과 도구 모음 버튼 양쪽에 있으므로 둘 다 잡힌다.
 * 버튼에는 `aria-pressed` 도 붙인다 — 배경색만으로 알리면 색을 구별하기 어려운
 * 사람에게는 켜진 것인지 알 길이 없다.
 */
export function markToggleState(cmd: string, on: boolean): void {
  document.querySelectorAll(`[data-cmd="${cmd}"]`).forEach((el) => {
    el.classList.toggle('active', on);
    if (el.tagName === 'BUTTON') {
      el.setAttribute('aria-pressed', String(on));
    } else if (el.classList.contains('md-item')) {
      // 메뉴 항목은 button 이 아니라 div 다. 화면에는 왼쪽 칸의 체크로 켜짐이 보이지만
      // (menu-bar.css 의 `.md-item.active::before`) 그것만으로는 화면 낭독기에 아무
      // 소리도 나지 않는다. 켜고 끄는 항목이라는 것과 지금 켜졌는지를 함께 알린다.
      // 이미 역할이 적힌 항목(테마 고르기의 menuitemradio 등)은 건드리지 않는다.
      if (!el.hasAttribute('role')) el.setAttribute('role', 'menuitemcheckbox');
      el.setAttribute('aria-checked', String(on));
    }
  });
}
