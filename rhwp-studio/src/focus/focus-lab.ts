/**
 * 집중 작업 모드 응원 레이어 개발용 확인 페이지 (`/focus-lab.html`).
 *
 * WASM 문서 엔진 없이 `CheerEngine`·`ConfettiLayer` 만 떼어 눈과 귀로 확인하려고 만든
 * 개발 전용 하네스다. 실제 편집기에서는 확정 입력이 eventBus 의 `text-inserted` 로
 * 오지만, 여기서는 textarea 의 `beforeinput` 을 대신 물린다.
 *
 * `vite build` 의 입력은 index.html 뿐이므로 배포물에는 포함되지 않는다.
 */

import { CheerEngine } from './cheer-engine';
import { userSettings, type FocusCheerLevel } from '@/core/user-settings';

const cheer = new CheerEngine();
const editor = document.getElementById('lab-editor') as HTMLTextAreaElement;
const streakEl = document.getElementById('lab-streak')!;
const charsEl = document.getElementById('lab-chars')!;

let chars = 0;

editor.addEventListener('focus', () => cheer.unlock(), { once: true });

// 실제 편집기의 "확정 입력"과 같은 조건: 조합 중이 아닌 삽입만 통지한다.
editor.addEventListener('beforeinput', (e) => {
  const ev = e as InputEvent;
  if (!ev.data || (ev.inputType && !ev.inputType.startsWith('insert'))) return;
  if (ev.isComposing) return;
  chars += ev.data.length;
  cheer.noteInserted(ev.data);
  render();
});

editor.addEventListener('compositionend', (e) => {
  const text = (e as CompositionEvent).data;
  if (!text) return;
  chars += text.length;
  cheer.noteInserted(text);
  render();
});

function render(): void {
  streakEl.textContent = String(cheer.getStreak());
  charsEl.textContent = String(chars);
}

document.getElementById('lab-celebrate')!.addEventListener('click', () => {
  cheer.unlock();
  cheer.celebrate();
});

document.querySelectorAll<HTMLInputElement>('[data-setting]').forEach((input) => {
  const key = input.dataset.setting as 'confetti' | 'sound' | 'praise';
  input.checked = userSettings.getFocusSettings()[key];
  input.addEventListener('change', () => {
    userSettings.updateFocusSettings({ [key]: input.checked });
  });
});

const levelSelect = document.getElementById('lab-level') as HTMLSelectElement;
levelSelect.value = userSettings.getFocusSettings().cheerLevel;
levelSelect.addEventListener('change', () => {
  userSettings.updateFocusSettings({ cheerLevel: levelSelect.value as FocusCheerLevel });
});

render();
