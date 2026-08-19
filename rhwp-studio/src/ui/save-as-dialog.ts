/**
 * 다른 이름으로 저장 대화상자
 *
 * 파일 이름·형식·선택 암호 설정을 한 자리에서 받는다.
 *
 * 예전에는 형식을 파일 메뉴가 갈랐다 — `다른 이름으로 저장`, `HWP 형식으로 저장`,
 * `HWPX 형식으로 저장` 이 나란히 있었다. 저장 하나에 항목이 셋이라 무엇이 무엇과
 * 다른지 묻게 되고, 정작 저장 대화상자에서는 형식을 고를 수 없었다. 워드프로세서의
 * 관례는 반대다 — 저장은 하나이고, 형식은 저장할 때 고른다.
 */
import { ModalDialog } from './dialog';
import { fileNameForFormat, type SaveFormat } from '@/command/save-target';

export interface SaveAsDialogResult {
  fileName: string;
  format: SaveFormat;
  configurePassword: boolean;
}

const FORMAT_LABELS: Record<SaveFormat, string> = {
  hwp: '한글 문서 (*.hwp)',
  hwpx: '한글 표준 문서 (*.hwpx)',
  hml: 'HWPML 2.x 문서 (*.hml)',
};

class SaveAsDialog extends ModalDialog {
  private defaultName: string;
  private input!: HTMLInputElement;
  private formatSelect!: HTMLSelectElement;
  private passwordButton: HTMLButtonElement | null = null;
  private resolve!: (value: SaveAsDialogResult | null) => void;

  constructor(
    defaultName: string,
    private readonly format: SaveFormat,
    private readonly formats: readonly SaveFormat[],
    private readonly allowPassword: boolean,
  ) {
    super('다른 이름으로 저장', 380);
    this.defaultName = defaultName;
  }

  private get selectedFormat(): SaveFormat {
    return (this.formatSelect?.value as SaveFormat) ?? this.format;
  }

  protected createBody(): HTMLElement {
    const body = document.createElement('div');
    body.style.padding = '16px 20px';

    const label = document.createElement('label');
    label.textContent = '파일 이름(N):';
    label.style.display = 'block';
    label.style.marginBottom = '6px';
    label.style.fontSize = '13px';
    body.appendChild(label);

    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.value = this.defaultName;
    this.input.style.width = '100%';
    this.input.style.boxSizing = 'border-box';
    this.input.style.height = '26px';
    this.input.style.padding = '2px 6px';
    this.input.style.border = '1px solid #b4b4b4';
    this.input.style.fontSize = '13px';
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (this.onConfirm()) this.hide();
      }
    });
    label.htmlFor = this.input.id = 'save-as-name';
    body.appendChild(this.input);

    // ── 파일 형식 ──
    const formatLabel = document.createElement('label');
    formatLabel.textContent = '파일 형식(T):';
    formatLabel.style.display = 'block';
    formatLabel.style.margin = '12px 0 6px';
    formatLabel.style.fontSize = '13px';
    body.appendChild(formatLabel);

    this.formatSelect = document.createElement('select');
    this.formatSelect.style.width = '100%';
    this.formatSelect.style.boxSizing = 'border-box';
    this.formatSelect.style.height = '26px';
    this.formatSelect.style.fontSize = '13px';
    for (const format of this.formats) {
      const option = document.createElement('option');
      option.value = format;
      option.textContent = FORMAT_LABELS[format];
      if (format === this.format) option.selected = true;
      this.formatSelect.appendChild(option);
    }
    // 형식을 바꾸면 이름의 확장자도 따라간다 — 고른 형식과 다른 확장자가 남아 있으면
    // 무엇으로 저장되는지 화면에서 어긋난다.
    this.formatSelect.addEventListener('change', () => {
      const name = this.input.value.trim();
      if (name) this.input.value = fileNameForFormat(name, this.selectedFormat);
      this.syncPasswordButton();
    });
    formatLabel.htmlFor = this.formatSelect.id = 'save-as-format';
    body.appendChild(this.formatSelect);

    if (this.allowPassword) {
      this.passwordButton = document.createElement('button');
      this.passwordButton.type = 'button';
      this.passwordButton.className = 'dialog-btn';
      this.passwordButton.textContent = '암호 설정...';
      this.passwordButton.style.marginTop = '12px';
      this.passwordButton.addEventListener('click', () => {
        const value = this.confirmValue();
        if (value === null) return;
        this.resolve({ fileName: value, format: this.selectedFormat, configurePassword: true });
        this.hide();
      });
      body.appendChild(this.passwordButton);
      this.syncPasswordButton();
    }

    return body;
  }

  /** 암호는 HWP·HWPX 에만 걸 수 있다. HML 을 고르면 단추를 잠근다. */
  private syncPasswordButton(): void {
    if (!this.passwordButton) return;
    const supported = this.selectedFormat !== 'hml';
    this.passwordButton.disabled = !supported;
    this.passwordButton.title = supported
      ? ''
      : 'HML 형식에는 암호를 걸 수 없습니다.';
  }

  private confirmValue(): string | null {
    const name = this.input.value.trim();
    if (!name) {
      this.input.focus();
      return null;
    }
    return fileNameForFormat(name, this.selectedFormat);
  }

  protected onConfirm(): boolean {
    const fileName = this.confirmValue();
    if (fileName === null) return false;
    this.resolve({ fileName, format: this.selectedFormat, configurePassword: false });
    return true;
  }

  override hide(): void {
    this.resolve(null);
    super.hide();
  }

  showAsync(): Promise<SaveAsDialogResult | null> {
    return new Promise((resolve) => {
      let resolved = false;
      this.resolve = (v: SaveAsDialogResult | null) => {
        if (!resolved) {
          resolved = true;
          resolve(v);
        }
      };
      super.show();
      requestAnimationFrame(() => {
        this.input.focus();
        this.input.select();
      });
    });
  }
}

/**
 * 파일 이름·형식 입력 대화상자를 표시한다.
 *
 * `formats` 는 고를 수 있는 형식이다. HML 은 내보내기가 가능할 때만 넣는다.
 * `allowPassword` 를 켜면 사용자가 `암호 설정...` 으로 다음 단계로 갈 수 있다.
 */
export function showSaveAs(
  defaultName: string,
  format: SaveFormat = 'hwp',
  options: { allowPassword?: boolean; formats?: readonly SaveFormat[] } = {},
): Promise<SaveAsDialogResult | null> {
  const formats = options.formats?.length ? options.formats : [format];
  return new SaveAsDialog(
    defaultName,
    format,
    formats,
    options.allowPassword === true,
  ).showAsync();
}
