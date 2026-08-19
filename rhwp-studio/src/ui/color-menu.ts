/**
 * 색 고르기 메뉴 — 프리셋 + 직접 입력.
 *
 * 예전에는 두 색 고르기가 서로 반대로 잘못돼 있었다. 글자 색은 누르면 OS 색상환이
 * 바로 떠서 천육백만 색 중에 고르라고 했고, 형광펜은 스워치 마흔두 개를 깔았다.
 * 어느 쪽이든 "이 중에 뭘 골라야 하나" 를 묻게 만든다 — 원고를 쓰는 사람에게 필요한
 * 색은 열 개 남짓이다.
 *
 * 그래서 프리셋을 먼저 보이고, 그 밖의 색이 필요하면 값을 직접 적게 한다. 색상환을
 * 없앴다고 고를 수 있는 색이 줄어드는 것이 아니다 — `#RRGGBB` 는 어차피 전부를
 * 담는다. 줄어드는 것은 고르는 데 드는 품이다.
 */

export interface ColorPreset {
  value: string;
  label: string;
}

/**
 * 문서 색 프리셋 — 글자색과 배경색이 같은 열두 개를 나눠 쓴다.
 *
 * 오피스가 「글꼴 색」과 「음영」에 같은 색판을 내미는 방식이다. 값도 오피스의 표준
 * 색 띠에서 왔다. 첫 줄은 무채색, 둘째 줄은 원고 교정에서 실제로 쓰는 색이다 —
 * 빨강은 고칠 곳, 파랑은 더할 곳, 초록은 확인한 곳.
 *
 * **한 벌을 두 역할에 쓰는 것이 요점이다.** 예전에는 배경색만 따로 밝은 색 여섯을
 * 갖고 있었는데, 그러면 어두운 배경이 하나도 없어 "배경을 깔고 흰 글자를 얹는" 짜임을
 * 아예 만들 수 없었다. 열둘을 그대로 배경으로 열면 어두운 다섯(검정·진회색·진빨강·
 * 파랑·보라)이 생기고, 외울 색은 늘지 않는다.
 *
 * 열둘 모두 검은 글자든 흰 글자든 한쪽과는 대비 4.5:1 이상으로 짝이 맞는다 —
 * 어긋나는 조합이 없다는 것을 tests/color-menu.test.ts 가 지킨다.
 */
export const DOCUMENT_COLOR_PRESETS: readonly ColorPreset[] = [
  { value: '#000000', label: '검정' },
  { value: '#404040', label: '진회색' },
  { value: '#808080', label: '회색' },
  { value: '#bfbfbf', label: '연회색' },
  { value: '#ffffff', label: '흰색' },
  { value: '#c00000', label: '진빨강' },
  { value: '#ff0000', label: '빨강' },
  { value: '#ed7d31', label: '주황' },
  { value: '#ffc000', label: '노랑' },
  { value: '#00b050', label: '초록' },
  { value: '#0070c0', label: '파랑' },
  { value: '#7030a0', label: '보라' },
];

/**
 * 배경(음영) 색 프리셋 — 글자색과 같은 열두 개다.
 *
 * "형광펜은 밝아야 한다" 는 규칙을 두고 밝은 색 여섯만 두었던 적이 있다. 그 규칙은
 * **검은 글자를 전제**한 것이라, 흰 글자를 쓰는 순간 틀린다. 그래서 어두운 배경이
 * 하나도 없었고 「배경을 깔고 흰 글자」 라는 흔한 짜임을 만들 수 없었다.
 */
export const HIGHLIGHT_COLOR_PRESETS = DOCUMENT_COLOR_PRESETS;

/** 예전 이름. 글자색과 배경색이 같은 표를 쓴다는 것을 이름으로도 남겨 둔다. */
export const TEXT_COLOR_PRESETS = DOCUMENT_COLOR_PRESETS;

/** `#RGB`·`#RRGGBB`·`12,34,56` 을 `#rrggbb` 로 바꾼다. 못 읽으면 null. */
export function parseColorInput(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;

  const hex = text.replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    const [r, g, b] = hex;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(hex)) return `#${hex.toLowerCase()}`;

  // "255, 0, 0" 또는 "255 0 0" — 색을 값으로 말하는 사람은 보통 이 꼴로 적는다.
  const parts = text.split(/[\s,]+/).filter(Boolean);
  if (parts.length === 3 && parts.every((p) => /^\d{1,3}$/.test(p))) {
    const nums = parts.map(Number);
    if (nums.every((n) => n <= 255)) {
      return `#${nums.map((n) => n.toString(16).padStart(2, '0')).join('')}`;
    }
  }
  return null;
}

export interface ColorMenuOptions {
  presets: readonly ColorPreset[];
  /** 있으면 맨 위에 이 이름의 단추를 둔다 (형광펜의 「색 없음」) */
  clear?: { label: string; value: string };
  onPick: (color: string) => void;
  /** 고른 뒤 메뉴를 닫는다 */
  onClose: () => void;
}

/** 메뉴 몸통을 그린다. 호출한 쪽이 열고 닫는 것을 맡는다. */
export function buildColorMenu(host: HTMLElement, options: ColorMenuOptions): void {
  host.replaceChildren();
  host.classList.add('cm-menu');

  const pick = (color: string) => {
    options.onPick(color);
    options.onClose();
  };

  if (options.clear) {
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'cm-clear';
    clear.textContent = options.clear.label;
    clear.addEventListener('mousedown', (e) => {
      e.preventDefault();
      pick(options.clear!.value);
    });
    host.appendChild(clear);
  }

  const grid = document.createElement('div');
  grid.className = 'cm-grid';
  for (const preset of options.presets) {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'cm-swatch';
    swatch.style.background = preset.value;
    // 색만으로 알리면 색을 구별하기 어려운 사람에게는 알 길이 없다.
    swatch.title = `${preset.label} ${preset.value}`;
    swatch.setAttribute('aria-label', preset.label);
    swatch.addEventListener('mousedown', (e) => {
      e.preventDefault();
      pick(preset.value);
    });
    grid.appendChild(swatch);
  }
  host.appendChild(grid);

  // ── 직접 입력 ──
  const custom = document.createElement('div');
  custom.className = 'cm-custom';

  const label = document.createElement('label');
  label.className = 'cm-custom-label';
  label.textContent = '직접 입력';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'cm-custom-input';
  input.placeholder = '#RRGGBB 또는 255,0,0';
  input.spellcheck = false;
  input.autocomplete = 'off';
  label.htmlFor = input.id = `cm-input-${Math.random().toString(36).slice(2, 8)}`;

  const preview = document.createElement('span');
  preview.className = 'cm-custom-preview';

  const apply = document.createElement('button');
  apply.type = 'button';
  apply.className = 'cm-custom-apply';
  apply.textContent = '적용';
  apply.disabled = true;

  let parsed: string | null = null;
  const refresh = () => {
    parsed = parseColorInput(input.value);
    apply.disabled = parsed === null;
    // 값이 색이 되기 전에는 미리보기를 비워 둔다 — 아무 색이나 보이면 그것이 적용될
    // 색이라고 오해한다.
    preview.style.background = parsed ?? 'transparent';
    input.classList.toggle('cm-custom-input-bad', input.value.trim() !== '' && parsed === null);
  };
  input.addEventListener('input', refresh);
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (parsed) pick(parsed);
  });
  apply.addEventListener('mousedown', (e) => {
    e.preventDefault();
    if (parsed) pick(parsed);
  });

  custom.append(label, input, preview, apply);
  host.appendChild(custom);
}
