/**
 * 제품 정보 / 라이센스 다이얼로그
 *
 * HWP 공개 스펙(hwp_spec_5.0) 저작권 조항에 따른 필수 고지 문구를 포함한다.
 * 사용된 외부 크레이트의 오픈소스 라이선스 목록도 표시한다.
 */
import { ModalDialog } from './dialog';

/**
 * 외부 크레이트 라이선스 정보.
 *
 * WASM 번들에 실제 포함되는 핵심 Rust 크레이트만 표시한다.
 * native-skia(skia-safe/resvg/usvg) 등 optional feature 전용 크레이트는 WASM 빌드에
 * 포함되지 않으므로 제외한다. 전체 목록은 저장소 루트 THIRD_PARTY_LICENSES.md 참조.
 */
const THIRD_PARTY_LICENSES = [
  { name: 'wasm-bindgen', license: 'MIT / Apache-2.0' },
  { name: 'web-sys', license: 'MIT / Apache-2.0' },
  { name: 'js-sys', license: 'MIT / Apache-2.0' },
  { name: 'quick-xml', license: 'MIT' },
  { name: 'cfb', license: 'MIT' },
  { name: 'zip', license: 'MIT' },
  { name: 'flate2', license: 'MIT / Apache-2.0' },
  { name: 'encoding_rs', license: '(Apache-2.0 / MIT) AND BSD-3-Clause' },
  { name: 'image', license: 'MIT / Apache-2.0' },
  { name: 'serde / serde_json', license: 'MIT / Apache-2.0' },
  { name: 'unicode-segmentation', license: 'MIT / Apache-2.0' },
  { name: 'ttf-parser', license: 'MIT / Apache-2.0' },
  { name: 'subsetter', license: 'MIT / Apache-2.0' },
  { name: 'byteorder', license: 'MIT / Unlicense' },
  { name: 'base64', license: 'MIT / Apache-2.0' },
  { name: 'console_error_panic_hook', license: 'MIT / Apache-2.0' },
];

export class AboutDialog extends ModalDialog {
  constructor() {
    super('제품 정보', 460);
  }

  protected createBody(): HTMLElement {
    const body = document.createElement('div');
    body.className = 'about-body';

    // 제품 영문명
    const titleEn = document.createElement('div');
    titleEn.className = 'about-product-name';
    titleEn.textContent = "WHP — Writer's Homeground Processor";
    body.appendChild(titleEn);

    // 제품 한글명
    const titleKo = document.createElement('div');
    titleKo.className = 'about-product-name-ko';
    titleKo.textContent = '작가를 위한 HWP 오픈소스 편집기';
    body.appendChild(titleKo);

    // 버전
    const version = document.createElement('div');
    version.className = 'about-version';
    version.textContent = `Version ${__APP_VERSION__}`;
    body.appendChild(version);

    // 기술 스택
    const tech = document.createElement('div');
    tech.className = 'about-tech';
    tech.textContent = 'Rust + WebAssembly + TypeScript';
    body.appendChild(tech);

    // HWP 스펙 고지 문구 (필수)
    const notice = document.createElement('div');
    notice.className = 'about-notice';
    notice.textContent =
      '본 제품은 한글과컴퓨터의 한글 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다.';
    body.appendChild(notice);

    // 오픈소스 라이선스
    const licenseTitle = document.createElement('div');
    licenseTitle.className = 'about-license-title';
    licenseTitle.textContent = '오픈소스 라이선스';
    body.appendChild(licenseTitle);

    const licenseTable = document.createElement('table');
    licenseTable.className = 'about-license-table';
    for (const lib of THIRD_PARTY_LICENSES) {
      const tr = document.createElement('tr');
      const tdName = document.createElement('td');
      tdName.textContent = lib.name;
      const tdLicense = document.createElement('td');
      tdLicense.textContent = lib.license;
      tr.appendChild(tdName);
      tr.appendChild(tdLicense);
      licenseTable.appendChild(tr);
    }
    body.appendChild(licenseTable);

    // 전체 라이선스 목록 안내
    const licenseNote = document.createElement('div');
    licenseNote.className = 'about-license-note';
    licenseNote.textContent =
      'WASM 번들에 포함되는 핵심 크레이트만 표시합니다. 전체 목록은 THIRD_PARTY_LICENSES.md를 참조하세요.';
    body.appendChild(licenseNote);

    // 저작권
    const copyright = document.createElement('div');
    copyright.className = 'about-copyright';
    // WHP \uB294 rhwp(MIT) \uD30C\uC0DD\uBB3C\uC774\uB2E4. MIT \uB294 \uC800\uC791\uAD8C \uACE0\uC9C0\uC640 \uD5C8\uAC00 \uBB38\uAD6C\uB97C \uC0AC\uBCF8\uC5D0 \uD568\uAED8
    // \uB0A8\uAE38 \uAC83\uC744 \uC694\uAD6C\uD558\uB294\uB370, \uC6F9\uC571 \uC0AC\uC6A9\uC790\uB294 LICENSE \uD30C\uC77C\uC744 \uBC1B\uC9C0 \uC54A\uC73C\uBBC0\uB85C \uC5EC\uAE30\uC5D0 \uB454\uB2E4.
    copyright.textContent = '\u00A9 2026 WHP \u00B7 based on rhwp (MIT) \u00A9 2025-2026 Edward Kim';
    body.appendChild(copyright);

    return body;
  }

  protected onConfirm(): void {
    // 정보 표시 전용 — 확인 동작 없음
  }

  override show(): void {
    super.show();
    // footer를 "닫기" 버튼 하나로 교체
    const footer = this.dialog.querySelector('.dialog-footer');
    if (footer) {
      footer.replaceChildren();
      const closeBtn = document.createElement('button');
      closeBtn.className = 'dialog-btn dialog-btn-primary';
      closeBtn.textContent = '닫기';
      closeBtn.addEventListener('click', () => this.hide());
      footer.appendChild(closeBtn);
    }
  }
}
