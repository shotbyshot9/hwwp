/**
 * 화면 보정 대화상자.
 *
 * 브라우저는 화면의 물리적 크기를 알 수 없다. 그래서 사용자가 한 번 재 준다 —
 * 화면에 그린 막대를 실물 신용카드 길이에 맞추면, 1mm 가 몇 px 인지 계산된다.
 * 그 값으로 배율 100% 가 용지 실물 크기와 맞게 된다.
 *
 * 신용카드를 자로 삼는 이유는 규격(ISO/IEC 7810 ID-1, 85.60mm)이 전 세계 공통이고
 * 누구나 가지고 있어서다.
 */

import { ModalDialog } from './dialog';
import {
  CREDIT_CARD_WIDTH_MM,
  CSS_PX_PER_MM,
  clampPxPerMm,
  estimatedDpi,
  getPxPerMm,
  setPxPerMm,
} from '@/core/display-calibration.ts';

export class DisplayCalibrationDialog extends ModalDialog {
  private pxPerMm: number;
  private bar!: HTMLElement;
  private readout!: HTMLElement;
  private slider!: HTMLInputElement;
  private onApply: () => void;

  constructor(onApply: () => void) {
    super('화면 보정', 460);
    this.pxPerMm = getPxPerMm();
    this.onApply = onApply;
  }

  protected createBody(): HTMLElement {
    const body = document.createElement('div');
    body.className = 'dcal-body';

    const hint = document.createElement('div');
    hint.className = 'dcal-hint';
    hint.textContent = '신용카드(또는 체크카드·주민등록증)를 화면에 대고, 아래 막대의 '
      + '길이를 카드의 긴 변과 똑같이 맞추세요. 맞추고 나면 배율 100% 가 실제 종이 크기와 같아집니다.';
    body.appendChild(hint);

    // 재는 대상 — 가로 막대. 카드 긴 변에 맞춘다.
    const rail = document.createElement('div');
    rail.className = 'dcal-rail';
    this.bar = document.createElement('div');
    this.bar.className = 'dcal-bar';
    this.bar.textContent = '85.6 mm';
    rail.appendChild(this.bar);
    body.appendChild(rail);

    this.slider = document.createElement('input');
    this.slider.type = 'range';
    this.slider.className = 'dcal-slider';
    // 화면 밀도 범위를 넉넉히 잡는다 (약 72~360dpi)
    this.slider.min = String(Math.round(CSS_PX_PER_MM * 0.75 * 100));
    this.slider.max = String(Math.round(CSS_PX_PER_MM * 3.75 * 100));
    this.slider.step = '1';
    this.slider.value = String(Math.round(this.pxPerMm * 100));
    this.slider.setAttribute('aria-label', '막대 길이 조절');
    this.slider.addEventListener('input', () => {
      this.pxPerMm = clampPxPerMm(Number(this.slider.value) / 100);
      this.render();
    });
    body.appendChild(this.slider);

    this.readout = document.createElement('div');
    this.readout.className = 'dcal-readout';
    body.appendChild(this.readout);

    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'dcal-reset';
    reset.textContent = '보정 지우기 (기본값으로)';
    reset.addEventListener('click', () => {
      this.pxPerMm = CSS_PX_PER_MM;
      this.slider.value = String(Math.round(this.pxPerMm * 100));
      this.render();
    });
    body.appendChild(reset);

    this.render();
    return body;
  }

  private render(): void {
    this.bar.style.width = `${CREDIT_CARD_WIDTH_MM * this.pxPerMm}px`;
    const ratio = this.pxPerMm / CSS_PX_PER_MM;
    this.readout.textContent =
      `화면 밀도 약 ${estimatedDpi(this.pxPerMm)}dpi · 기본값 대비 ${Math.round(ratio * 100)}%`;
  }

  protected onConfirm(): void {
    // 기본값과 같으면 보정을 지운다 — 저장해 둘 이유가 없다.
    const isDefault = Math.abs(this.pxPerMm - CSS_PX_PER_MM) < 0.01;
    setPxPerMm(isDefault ? null : this.pxPerMm);
    this.onApply();
  }
}
