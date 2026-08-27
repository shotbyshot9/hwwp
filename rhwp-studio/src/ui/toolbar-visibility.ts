/**
 * 도구 상자·서식 바 접기.
 *
 * 노트북에서 쓰는 사람에게 받은 말에서 나왔다 — "놋북에서 열었을 때 툴바 압박이 쫌
 * 있습니다." 1366×768 화면에서 재 보면 메뉴바·도구 상자·서식 바·눈금자·상태 표시줄이
 * 세로 206px(화면의 27%)를 가져간다. 여기에 브라우저 주소창과 작업 표시줄까지 빼면
 * 글이 보이는 높이가 400px 남짓이다.
 *
 * 접는 기능은 예전에도 있었다(보기 → 도구 상자 → 기본 / 서식). 다만 세 겹 안에 있어
 * 못 찾고, 접어도 새로고침하면 되돌아왔다. 그래서 제목 줄 오른쪽 끝에 단추 하나와
 * Ctrl+F1 을 두고, 접었다는 사실을 저장한다.
 *
 * 접는 자리를 한 군데로 모은 까닭은, 단추·단축키·메뉴 셋이 같은 상태를 봐야 하기
 * 때문이다. 예전처럼 명령 안에 상태를 두면 단추로 접은 것을 메뉴가 모른다.
 */

import { userSettings } from '@/core/user-settings.ts';
import { markToggleState } from '@/command/toggle-state.ts';

/** 접을 수 있는 두 줄 */
export type ToolbarKind = 'basic' | 'format';

/** 각 줄의 요소 id 와, 그 줄을 켜고 끄는 메뉴 항목의 명령 id */
const TOOLBARS: Record<ToolbarKind, { elementId: string; commandId: string }> = {
  basic: { elementId: 'icon-toolbar', commandId: 'view:toolbox-basic' },
  format: { elementId: 'style-bar', commandId: 'view:toolbox-format' },
};

/** 지금 보이는가 — 저장된 설정이 정답이다 */
export function isToolbarVisible(kind: ToolbarKind): boolean {
  const view = userSettings.getViewSettings();
  return kind === 'basic' ? view.showBasicToolbar : view.showFormatToolbar;
}

/** 둘 중 하나라도 보이는가 */
export function anyToolbarVisible(): boolean {
  return isToolbarVisible('basic') || isToolbarVisible('format');
}

/** 저장된 설정을 화면에 반영한다. 시작할 때와 값이 바뀔 때마다 부른다. */
export function applyToolbarVisibility(): void {
  for (const kind of ['basic', 'format'] as const) {
    const { elementId, commandId } = TOOLBARS[kind];
    const visible = isToolbarVisible(kind);
    const el = document.getElementById(elementId);
    if (el) el.style.display = visible ? '' : 'none';
    markToggleState(commandId, visible);
  }
  syncToggleButton();
}

/** 한 줄만 켜고 끈다 — 보기 → 도구 상자 메뉴가 쓴다 */
export function toggleToolbar(kind: ToolbarKind): void {
  const basic = kind === 'basic' ? !isToolbarVisible('basic') : isToolbarVisible('basic');
  const format = kind === 'format' ? !isToolbarVisible('format') : isToolbarVisible('format');
  userSettings.setToolbarVisibility(basic, format);
  applyToolbarVisibility();
}

/**
 * 두 줄을 한꺼번에 접거나 편다 — 제목 줄 단추와 Ctrl+F1 이 쓴다.
 *
 * 하나만 보이는 어중간한 상태에서는 접는 쪽으로 간다. 접으려고 누른 사람이
 * 더 펴지는 것을 보면 단추가 고장 난 것으로 읽힌다.
 */
export function toggleAllToolbars(): void {
  const next = !anyToolbarVisible();
  userSettings.setToolbarVisibility(next, next);
  applyToolbarVisibility();
}

/** 제목 줄 단추의 방향·설명을 지금 상태에 맞춘다 */
function syncToggleButton(): void {
  const btn = document.getElementById('tbar-toolbar-toggle');
  if (!btn) return;
  const shown = anyToolbarVisible();
  // 펼쳐져 있으면 위로(접는다), 접혀 있으면 아래로(편다). 화살표는 CSS 가 돌린다.
  btn.classList.toggle('is-collapsed', !shown);
  const label = shown ? '툴바 감추기' : '툴바 보이기';
  btn.setAttribute('title', `${label} (Ctrl+F1)`);
  btn.setAttribute('aria-label', label);
  // 눌린 상태 = 접힘. 화면 낭독기에 "접는 단추가 켜져 있다" 로 들린다.
  btn.setAttribute('aria-pressed', String(!shown));
}
