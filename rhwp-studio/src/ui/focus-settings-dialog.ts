/**
 * 배명훈 모드 설정 대화상자
 *
 * 예전에는 이 설정 열넷이 `보기 → 배명훈 모드 설정` 아래 서브메뉴 스물다섯 줄로
 * 늘어서 있었다. 세로로 길어 큰 화면에서도 아래가 잘렸고, 1920×1080 노트북에서는
 * 목표 항목에 닿을 수가 없었다. 메뉴는 명령을 고르는 자리이지 설정판이 아니다.
 *
 * 고른 값은 누른 즉시 반영된다 — 확인 단추를 눌러야 적용되던 적이 없었고, 응원 소리나
 * 배율은 바로 겪어 봐야 고를 수 있는 종류의 설정이다. 그래서 아래 단추는 닫기 하나다.
 */
import { ModalDialog } from './dialog';
import { userSettings, type FocusCheerLevel, type FocusSettings } from '@/core/user-settings';
import { CHEER_RATES, charsPerCheer, strokesPerCheer, type FocusCheerRate } from '@/focus/cheer-rate';

/** 배속 한 단계의 설명 — 메뉴에 적혀 있던 "x2 — 30타마다" 를 그대로 옮긴다 */
function cheerRateLabel(rate: FocusCheerRate): string {
  if (rate === 'max') return 'MAX — 모든 타';
  return `x${rate} — ${strokesPerCheer(rate)}타마다 (${charsPerCheer(rate)}자)`;
}

export class FocusSettingsDialog extends ModalDialog {
  /** 설정이 바뀔 때마다 부른다 — 메뉴 표시와 배명훈 모드 화면을 함께 맞춘다 */
  constructor(private readonly onChanged: () => void) {
    super('배명훈 모드 설정', 460);
  }

  private update(patch: Partial<FocusSettings>): void {
    userSettings.updateFocusSettings(patch);
    this.onChanged();
  }

  private section(title: string): HTMLElement {
    const section = document.createElement('div');
    section.className = 'dialog-section';
    const heading = document.createElement('div');
    heading.className = 'dialog-section-title';
    heading.textContent = title;
    section.appendChild(heading);
    return section;
  }

  /** 라벨 + 선택 상자 한 줄 */
  private selectRow<T extends string | number>(
    parent: HTMLElement,
    label: string,
    options: { value: T; text: string }[],
    current: T,
    onPick: (value: T) => void,
    hint?: string,
  ): void {
    const row = document.createElement('div');
    row.className = 'dialog-row fs-row';

    const name = document.createElement('label');
    name.className = 'fs-label';
    name.textContent = label;
    row.appendChild(name);

    const select = document.createElement('select');
    select.className = 'dialog-select fs-select';
    for (const opt of options) {
      const el = document.createElement('option');
      el.value = String(opt.value);
      el.textContent = opt.text;
      if (opt.value === current) el.selected = true;
      select.appendChild(el);
    }
    select.addEventListener('change', () => {
      const picked = options.find((o) => String(o.value) === select.value);
      if (picked) onPick(picked.value);
    });
    name.htmlFor = select.id = `fs-${label.replace(/\s/g, '')}`;
    row.appendChild(select);
    parent.appendChild(row);

    if (hint) {
      const note = document.createElement('p');
      note.className = 'fs-hint';
      note.textContent = hint;
      parent.appendChild(note);
    }
  }

  /** 켜고 끄는 한 줄 */
  private checkRow(
    parent: HTMLElement,
    label: string,
    checked: boolean,
    onToggle: (next: boolean) => void,
    hint?: string,
  ): void {
    const row = document.createElement('div');
    row.className = 'dialog-row fs-check-row';

    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = checked;
    box.id = `fs-check-${label.replace(/\s/g, '')}`;
    box.addEventListener('change', () => onToggle(box.checked));

    const name = document.createElement('label');
    name.htmlFor = box.id;
    name.textContent = label;

    row.append(box, name);
    parent.appendChild(row);

    if (hint) {
      const note = document.createElement('p');
      note.className = 'fs-hint';
      note.textContent = hint;
      parent.appendChild(note);
    }
  }

  protected createBody(): HTMLElement {
    const body = document.createElement('div');
    body.className = 'fs-body';
    const s = userSettings.getFocusSettings();

    // ── 화면 ──
    const screen = this.section('화면');
    this.selectRow<'dark' | 'light'>(
      screen,
      '테마',
      [{ value: 'dark', text: '어둡게' }, { value: 'light', text: '밝게' }],
      s.theme,
      (theme) => this.update({ theme }),
    );
    this.selectRow<number>(
      screen,
      '배율',
      [100, 130, 160, 200].map((v) => ({ value: v, text: `${v}%` })),
      s.zoomPercent,
      (zoomPercent) => this.update({ zoomPercent }),
      '일반 편집 화면의 테마·배율과 따로 기억합니다. 창보다 넓어지면 폭 맞춤에서 멈춥니다.',
    );
    body.appendChild(screen);

    // ── 응원 ──
    const cheer = this.section('응원');
    this.selectRow<FocusCheerLevel>(
      cheer,
      '강도',
      [
        { value: 'quiet', text: '조용히' },
        { value: 'normal', text: '기본' },
        { value: 'festival', text: '축제' },
      ],
      s.cheerLevel,
      (cheerLevel) => this.update({ cheerLevel }),
      '한 번의 응원이 얼마나 큰가.',
    );
    this.selectRow<string>(
      cheer,
      '배속',
      CHEER_RATES.map((r) => ({ value: String(r), text: cheerRateLabel(r) })),
      String(s.cheerRate),
      (value) => this.update({ cheerRate: (value === 'max' ? 'max' : Number(value)) as FocusCheerRate }),
      '얼마나 자주 터지는가. 문장부호 응원은 배속과 무관하게 그대로 남습니다.',
    );
    body.appendChild(cheer);

    // ── 효과 ──
    const effects = this.section('효과');
    this.checkRow(effects, '폭죽 효과', s.confetti, (confetti) => this.update({ confetti }));
    this.checkRow(effects, '박수 효과음', s.sound, (sound) => this.update({ sound }));
    this.checkRow(effects, '음성 칭찬', s.praise, (praise) => this.update({ praise }));
    this.checkRow(
      effects,
      '타자기 스크롤',
      s.typewriter,
      (typewriter) => this.update({ typewriter }),
      '캐럿이 화면 위쪽에 머물도록 스크롤을 따라 밀어 줍니다.',
    );
    body.appendChild(effects);

    // ── 세션 ──
    const session = this.section('세션');
    this.selectRow<number>(
      session,
      '목표',
      [
        { value: 0, text: '없음' },
        { value: 500, text: '500자' },
        { value: 1000, text: '1,000자' },
        { value: 2000, text: '2,000자' },
        { value: 5000, text: '5,000자' },
      ],
      s.goalChars,
      (goalChars) => this.update({ goalChars }),
      '정해 두면 바닥글에 진행바가 차오르고 달성 순간 축포가 터집니다.',
    );
    this.checkRow(
      session,
      '켤 때 배명훈 모드로 시작',
      s.startInFocusMode,
      (startInFocusMode) => this.update({ startInFocusMode }),
    );
    body.appendChild(session);

    return body;
  }

  protected onConfirm(): void {
    // 고른 즉시 반영되므로 확인 시점에 할 일이 없다.
  }

  override show(): void {
    super.show();
    const footer = this.dialog.querySelector('.dialog-footer');
    if (!footer) return;
    footer.replaceChildren();
    const close = document.createElement('button');
    close.className = 'dialog-btn dialog-btn-primary';
    close.textContent = '닫기';
    close.addEventListener('click', () => this.hide());
    footer.appendChild(close);
  }
}
