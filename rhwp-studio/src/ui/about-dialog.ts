/**
 * 제품 정보 / 라이센스 다이얼로그
 *
 * 제품의 출발점(배명훈 〈홈, 어웨이〉)과 원본 rhwp 고지, 외부 크레이트의 오픈소스
 * 라이선스 목록을 표시한다.
 *
 * 주의 — 원래 이 자리에 있던 "한글과컴퓨터의 한글 문서 파일(.hwp) 공개 문서를
 * 참고하여 개발하였습니다" 문구는 HWP 공개 스펙의 고지 조항 때문에 있던 것이다.
 * 제품 소유자의 결정으로 뺐다. 배포 형태에 따라 그 조항을 다시 살펴야 할 수 있다.
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

/** 배포본에 함께 실린 라이선스 전문으로 가는 링크 */
function makeLicenseLink(file: string, label: string): HTMLAnchorElement {
  const a = document.createElement('a');
  a.className = 'about-license-link';
  a.href = `/${file}`;
  a.target = '_blank';
  // 새 탭으로 여는 외부 링크는 opener 를 넘기지 않는다.
  a.rel = 'noopener noreferrer';
  a.textContent = label;
  return a;
}

export class AboutDialog extends ModalDialog {
  constructor() {
    super('제품 정보', 460);
  }

  protected createBody(): HTMLElement {
    const body = document.createElement('div');
    body.className = 'about-body';

    // 로고. 제품 정보는 "이게 무엇인가" 를 말하는 자리이므로 이름보다 먼저 얼굴을 보인다.
    const logo = document.createElement('img');
    logo.className = 'about-logo';
    logo.src = '/icons/icon-256.png';
    logo.width = 72;
    logo.height = 72;
    // 바로 아래에 제품명이 글자로 나오므로 대체 텍스트를 또 읽히면 같은 말을 두 번 한다.
    logo.alt = '';
    body.appendChild(logo);

    // 제품 영문명
    const titleEn = document.createElement('div');
    titleEn.className = 'about-product-name';
    titleEn.textContent = 'hwwp — Homeground of Writer Word Processor';
    body.appendChild(titleEn);

    // 제품 한글명
    const titleKo = document.createElement('div');
    titleKo.className = 'about-product-name-ko';
    titleKo.textContent = '원고를 완성하고 싶은 작가를 위한 HWP 편집기';
    body.appendChild(titleKo);

    // 버전
    const version = document.createElement('div');
    version.className = 'about-version';
    version.textContent = `Version ${__APP_VERSION__}`;
    body.appendChild(version);

    // 만든 사람
    const author = document.createElement('div');
    author.className = 'about-author';
    author.textContent = '만든 사람: 류지원 (Jiwon Ryu)';
    body.appendChild(author);

    // 기술 스택
    const tech = document.createElement('div');
    tech.className = 'about-tech';
    tech.textContent = 'Rust + WebAssembly + TypeScript';
    body.appendChild(tech);

    // 제품의 출발점
    const notice = document.createElement('div');
    notice.className = 'about-notice';
    notice.textContent =
      "배명훈 작가의 단편소설 〈홈, 어웨이〉에 등장하는 '문장을 쓰면 환호하고 박수쳐 주는 "
      + '텍스트 에디터\'에서 영감을 받아, rhwp를 기반으로 개발했습니다.';
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

    // 전체 라이선스 목록 안내. 배포본에는 전문이 함께 실리므로(vite 의
    // prune-and-license 플러그인) 파일 이름만 알려 주지 말고 바로 열어 준다 —
    // 웹앱 사용자는 저장소를 받지 않아 그 파일에 닿을 다른 길이 없다.
    const licenseNote = document.createElement('div');
    licenseNote.className = 'about-license-note';
    licenseNote.append(
      'WASM 번들에 포함되는 핵심 크레이트만 표시합니다. 전문은 ',
      makeLicenseLink('LICENSE.txt', 'MIT 라이선스'),
      '와 ',
      makeLicenseLink('THIRD_PARTY_LICENSES.txt', '서드파티 라이선스 전체 목록'),
      '에 있습니다.',
    );
    body.appendChild(licenseNote);

    // 개인정보처리방침·약관. 구글 동의 화면에서도 이 주소를 가리키므로, 앱 안에서도
    // 닿을 수 있어야 한다 — 동의 화면에서만 보이면 나중에 다시 찾을 길이 없다.
    const policyNote = document.createElement('div');
    policyNote.className = 'about-license-note';
    policyNote.append(
      makeLicenseLink('privacy', '개인정보처리방침'),
      ' · ',
      makeLicenseLink('terms', '서비스 약관'),
    );
    body.appendChild(policyNote);

    // 저작권 — hwwp 자체 고지와 원본(rhwp) 고지를 줄을 나눠 둔다.
    // 한 줄에 섞으면 누구의 저작권인지 흐려진다.
    const copyright = document.createElement('div');
    copyright.className = 'about-copyright';
    copyright.textContent = '© 2026 hwwp — Jiwon Ryu';
    body.appendChild(copyright);

    // 원본 고지. hwwp 는 rhwp(MIT)를 수정한 파생물이다. MIT 는 저작권 고지와 허가
    // 문구를 사본에 함께 남길 것을 요구하는데, 웹앱 사용자는 LICENSE 파일을 받지
    // 않으므로 여기에 둔다. "modified" 표기는 파생물임을 분명히 하기 위한 것이다.
    const upstream = document.createElement('div');
    upstream.className = 'about-copyright';
    upstream.textContent = 'Based on rhwp (MIT) © 2025-2026 Edward Kim — modified';
    body.appendChild(upstream);

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
