/**
 * 제품 정보 / 라이센스 다이얼로그
 *
 * 제품의 출발점(배명훈 〈홈, 어웨이〉)과 원본 rhwp 고지, 그리고 저작권 고지 전문으로
 * 가는 길을 보여 준다.
 *
 * 주의 — 원래 이 자리에 있던 "한글과컴퓨터의 한글 문서 파일(.hwp) 공개 문서를
 * 참고하여 개발하였습니다" 문구는 HWP 공개 스펙의 고지 조항 때문에 있던 것이다.
 * 제품 소유자의 결정으로 뺐다. 배포 형태에 따라 그 조항을 다시 살펴야 할 수 있다.
 */
import { ModalDialog } from './dialog';

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
    // 72px 자리에 256px 원본 — 고해상도 화면에서 번지지 않게 넉넉히 준다.
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

    // 만든 사람. 이름 옆에 연락처를 붙여 둔다 — 제품 정보는 "무엇을 쓰고 있나" 만이
    // 아니라 "누구에게 말하면 되나" 를 찾는 자리이기도 하다.
    const author = document.createElement('div');
    author.className = 'about-author';
    author.append('만든 사람: 류지원 · ');
    const twitter = document.createElement('a');
    twitter.className = 'about-license-link';
    twitter.href = 'https://twitter.com/shotbyshot';
    twitter.target = '_blank';
    twitter.rel = 'noopener noreferrer';
    twitter.textContent = '@shotbyshot';
    author.appendChild(twitter);
    body.appendChild(author);

    // 기술 스택
    const tech = document.createElement('div');
    tech.className = 'about-tech';
    tech.textContent = 'Rust + WebAssembly + TypeScript';
    body.appendChild(tech);

    // 제품의 출발점.
    //
    // 〈홈, 어웨이〉는 배명훈 소설집 『미래과거시제』에 실려 있다. 여기까지
    // 읽은 사람은 "그 소설이 뭔데" 를 궁금해할 참이므로 원작으로 가는 길을 붙여 둔다 —
    // 빚진 것을 밝히는 자리에서 출처를 감추면 고지가 아니라 장식이 된다.
    const notice = document.createElement('div');
    notice.className = 'about-notice';
    const source = document.createElement('a');
    source.className = 'about-license-link';
    source.href = 'https://product.kyobobook.co.kr/detail/S000201293357';
    source.target = '_blank';
    source.rel = 'noopener noreferrer';
    source.textContent = '『미래과거시제』';
    notice.append(
      '배명훈 작가의 단편소설 〈홈, 어웨이〉',
      '(소설집 ',
      source,
      ' 수록)',
      "에 등장하는 '문장을 쓰면 환호하고 박수쳐 주는 텍스트 에디터'에서 영감을 받아, ",
      'rhwp를 기반으로 개발했습니다. ',
      // 남의 이름을 제품 기능에 붙였으면 그 허락을 받았다는 사실도 같은 자리에 적는다.
      // 다만 허락과 제휴는 다르다 — 작가가 이 제품을 보증한 것처럼 읽히면 안 된다.
      "'배명훈 모드'라는 명칭은 작가의 허락을 받아 사용하며, 이 프로젝트는 작가나 출판사와 ",
      '공식적인 제휴 관계가 아닙니다.',
    );
    body.appendChild(notice);

    // 면책 고지. 약관에만 두면 읽는 사람이 거의 없다 — 제품 정보는 "이게 무엇인가" 를
    // 묻는 사람이 오는 자리이므로 출처 혼동을 막을 자리도 여기다. hwwp 라는 이름과
    // HWP 편집이라는 기능이 겹쳐 보이는 만큼, 관계 없음을 먼저 말해 둔다.
    const disclaimer = document.createElement('div');
    disclaimer.className = 'about-disclaimer';
    disclaimer.textContent =
      'hwwp는 (주)한글과컴퓨터와 아무런 관련이 없으며, HWP·HWPX 파일 형식 호환을 목적으로 하는 '
      + '독립 프로젝트입니다.';
    body.appendChild(disclaimer);

    // 오픈소스 라이선스.
    //
    // 예전에는 여기에 크레이트 16개를 표로 늘어놓았다. 두 가지가 문제였다.
    //
    // 하나 — 실제로 싣는 것은 119개인데 16개만 보였다. "핵심만 표시합니다" 라고 적어
    // 두긴 했지만, 목록이란 다 있을 때 목록이다. 절반도 안 되는 표는 정보가 아니라
    // 분위기다.
    //
    // 둘 — "quick-xml, MIT" 같은 줄은 고지가 아니다. MIT 가 사본에 남기라고 요구하는
    // 것은 저작권자의 이름과 허가 문구지 라이선스의 이름이 아니다. 표를 아무리 길게
    // 늘여도 그 요구는 이행되지 않는다.
    //
    // 그래서 표를 걷고, 요구를 실제로 이행하는 파일로 보낸다. 그 파일은 의존성 목록에서
    // 기계가 만든다(scripts/gen-notices.mjs) — 손으로 관리하면 반드시 어긋난다.
    const licenseTitle = document.createElement('div');
    licenseTitle.className = 'about-license-title';
    licenseTitle.textContent = '오픈소스 라이선스';
    body.appendChild(licenseTitle);

    const licenseNote = document.createElement('div');
    licenseNote.className = 'about-license-note';
    licenseNote.append(
      'hwwp 는 Rust 크레이트 119개와 npm 패키지 4개 위에서 동작합니다. 저작권 고지 전문은 ',
      makeLicenseLink('THIRD_PARTY_NOTICES.txt', '서드파티 고지'),
      '에, 어떤 소프트웨어를 왜 쓰는지는 ',
      makeLicenseLink('THIRD_PARTY_LICENSES.txt', '서드파티 목록'),
      '에 있습니다. hwwp 자체의 라이선스는 ',
      makeLicenseLink('LICENSE.txt', 'MIT'),
      ' 입니다.',
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
    copyright.textContent = '© 2026 hwwp — 류지원';
    body.appendChild(copyright);

    // 원본 고지. hwwp 는 rhwp(MIT)를 수정한 파생물이다. MIT 는 저작권 고지와 허가
    // 문구를 사본에 함께 남길 것을 요구하는데, 웹앱 사용자는 LICENSE 파일을 받지
    // 않으므로 여기에 둔다. "modified" 표기는 파생물임을 분명히 하기 위한 것이다.
    const upstream = document.createElement('div');
    upstream.className = 'about-copyright';
    upstream.textContent = 'Based on rhwp (MIT) © 2025-2026 Edward Kim — modified';
    body.appendChild(upstream);

    // 글꼴 고지. hwwp 는 한컴 글꼴 파일을 배포하지 않지만, 함초롬체는 문서 호환을 위해
    // 외부 CDN 에서 불러 쓴다. 권리자를 밝혀 두는 데 드는 비용이 없고, 나중에 문제가
    // 생겨도 숨기지 않았다는 근거가 된다. 나머지 글꼴은 서드파티 목록에 있다.
    const fonts = document.createElement('div');
    fonts.className = 'about-copyright';
    fonts.textContent = '함초롬체 © 주식회사 한글과컴퓨터 — 비상업적 이용 조건으로 사용';
    body.appendChild(fonts);

    // 아이콘 고지. ISC 도 MIT 와 마찬가지로 사본에 고지를 남길 것을 요구한다. 사본은
    // 배포물에 들어간 SVG 24개이고, 웹앱 사용자는 LICENSE 파일을 열어 보지 않으므로
    // 글꼴과 같은 자리에 둔다. 원문은 /icons/LICENSE.txt 로 함께 배포한다.
    const icons = document.createElement('div');
    icons.className = 'about-copyright';
    icons.textContent = '아이콘 © Lucide Icons and Contributors — ISC';
    body.appendChild(icons);

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
