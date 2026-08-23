/**
 * 웹폰트 로더 — web/editor.html의 폰트 로딩 시스템을 TypeScript로 포팅
 *
 * 2계층 로딩:
 *   1. CSS @font-face 규칙 생성 (Canvas 2D 호환)
 *   2. FontFace API로 즉시 로드 + document.fonts.add()
 */

interface FontEntry {
  name: string;
  file: string;
  /** woff2(기본) 또는 woff — CDN woff 파일용 */
  format?: 'woff2' | 'woff';
  /** CSS unicode-range — 지정 시 해당 코드포인트만 매칭, 다운로드도 해당 영역 사용 시에만 발생 */
  unicodeRange?: string;
  /**
   * @font-face 의 `font-weight` 서술자. 없으면 400(normal) 이다.
   *
   * 굵은 짝(`BOLD_FONT_LIST`)만 700 을 쓴다. 이 서술자가 있어야 브라우저가
   * `font: bold 14px "나눔명조"` 요청에 **진짜 굵은 파일**을 물린다.
   */
  weight?: '700';
}

export interface WebFontLoadOptions {
  /** true면 CDN 등 외부 URL 웹폰트 등록/로드를 건너뛴다. */
  disableExternalWebFonts?: boolean;
}

export interface CanvasKitBundledFontSource {
  url: string;
  aliases: string[];
}

export interface CanvasKitFontPlanOptions extends WebFontLoadOptions {
  /** `fonts/` 상대 경로를 이 URL 아래의 확장/앱 자산으로 바꾼다. */
  localFontBaseUrl?: string;
  /** 배포 표면이 실제로 포함한 로컬 파일만 허용한다. 미지정 시 전체 카탈로그를 허용한다. */
  availableLocalFiles?: ReadonlySet<string>;
}

export interface CanvasKitFontPlan {
  sources: CanvasKitBundledFontSource[];
  unavailableFonts: string[];
}

// 함초롬체 CDN (눈누 jsdelivr — 비상업적 사용 허용, 한컴 라이선스)
const CDN_HAMCHOB_R = 'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2104@1.0/HANBatang.woff';
const CDN_HAMCHOB_B = 'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2104@1.0/HANBatangB.woff';
const CDN_HAMCHOD_R = 'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_four@1.0/HCRDotum.woff';

// 한컴 webhwp CSS(@font-face) 매핑 기준 + HWP 문서에서 사용하는 별칭
const FONT_LIST: FontEntry[] = [
  // === 함초롬/함초롱/한컴 폰트 (CDN 참조) ===
  { name: '함초롬돋움', file: CDN_HAMCHOD_R, format: 'woff' },
  { name: '함초롬바탕', file: CDN_HAMCHOB_R, format: 'woff' },
  { name: '함초롱돋움', file: CDN_HAMCHOD_R, format: 'woff' },
  { name: '함초롱바탕', file: CDN_HAMCHOB_R, format: 'woff' },
  { name: '한컴돋움', file: CDN_HAMCHOD_R, format: 'woff' },
  { name: '한컴바탕', file: CDN_HAMCHOB_R, format: 'woff' },
  { name: '한컴산뜻돋움', file: CDN_HAMCHOD_R, format: 'woff' },
  { name: '새돋움', file: CDN_HAMCHOD_R, format: 'woff' },
  { name: '새바탕', file: CDN_HAMCHOB_R, format: 'woff' },
  // === 한컴 HY 폰트 → 오픈소스 대체 ===
  { name: 'HY헤드라인M', file: 'fonts/NotoSansKR-Bold.woff2' },
  { name: 'HYHeadLine M', file: 'fonts/NotoSansKR-Bold.woff2' },
  { name: 'HYHeadLine Medium', file: 'fonts/NotoSansKR-Bold.woff2' },
  { name: 'HY견고딕', file: 'fonts/NotoSansKR-Bold.woff2' },
  { name: 'HYGothic-Extra', file: 'fonts/NotoSansKR-Bold.woff2' },
  { name: 'HY그래픽', file: 'fonts/NotoSansKR-Regular.woff2' },
  { name: 'HYGraphic-Medium', file: 'fonts/NotoSansKR-Regular.woff2' },
  { name: 'HY그래픽M', file: 'fonts/NotoSansKR-Regular.woff2' },
  { name: 'HY견명조', file: 'fonts/NotoSerifKR-Bold.woff2' },
  { name: 'HYMyeongJo-Extra', file: 'fonts/NotoSerifKR-Bold.woff2' },
  { name: 'HY신명조', file: 'fonts/NotoSerifKR-Regular.woff2' },
  { name: 'HY중고딕', file: 'fonts/NotoSansKR-Regular.woff2' },
  { name: '양재튼튼체B', file: 'fonts/NotoSansKR-Bold.woff2' },
  // === 한글 시스템 폰트 → 오픈소스 대체 (OS 폰트 없을 때 폴백) ===
  { name: 'Malgun Gothic', file: 'fonts/Pretendard-Regular.woff2' },
  { name: '맑은 고딕', file: 'fonts/Pretendard-Regular.woff2' },
  // Task #1224: 한컴 돋움/MS 돋움·굴림 계열은 한컴 돋움(획 두께 페이지밀도 0.265)에
  // 근접한 Noto Sans KR ExtraLight 로 대체. 기존 NotoSansKR-Regular(밀도 0.378)는
  // 획이 +43% 두꺼워 PDF 대비 과도하게 굵게 보였다(네이티브 generic_fallback 와 정합).
  { name: '돋움', file: 'fonts/NotoSansKR-ExtraLight.woff2' },
  { name: '돋움체', file: 'fonts/NotoSansKR-ExtraLight.woff2' },
  { name: '굴림', file: 'fonts/NotoSansKR-ExtraLight.woff2' },
  { name: '굴림체', file: 'fonts/D2Coding-Regular.woff2' },
  { name: '새굴림', file: 'fonts/NotoSansKR-ExtraLight.woff2' },
  // Haansoft Dotum: HWP 문서가 직접 지정하는 한컴 돋움 영문명(예: 수능 모의고사 본문).
  // 기존 미등록 → 체인의 'Malgun Gothic'(Pretendard) 가 먼저 매칭되어 굵게 렌더됐다.
  { name: 'Haansoft Dotum', file: 'fonts/NotoSansKR-ExtraLight.woff2' },
  { name: '바탕', file: 'fonts/NotoSerifKR-Regular.woff2' },
  { name: '바탕체', file: 'fonts/D2Coding-Regular.woff2' },
  { name: '궁서', file: 'fonts/GowunBatang-Regular.woff2' },
  { name: '궁서체', file: 'fonts/GowunBatang-Regular.woff2' },
  { name: '새궁서', file: 'fonts/GowunBatang-Regular.woff2' },
  // === 나눔 폰트 (OFL, 로컬) ===
  { name: '나눔고딕', file: 'fonts/NanumGothic-Regular.woff2' },
  { name: '나눔명조', file: 'fonts/NanumMyeongjo-Regular.woff2' },
  { name: '나눔고딕코딩', file: 'fonts/NanumGothicCoding-Regular.woff2' },
  // === 영문 폰트 → OS 폴백 (번들 제거) ===
  { name: 'Palatino Linotype', file: 'fonts/NotoSerifKR-Regular.woff2' },
  // === Noto (OFL, 로컬) ===
  { name: 'Noto Sans KR', file: 'fonts/NotoSansKR-Regular.woff2' },
  // Task #1224: generic_fallback sans 체인 말단의 'Noto Sans KR ExtraLight' 해석용.
  // 미등록 고딕 문서폰트가 체인을 따라 내려올 때 무거운 Noto 직전에 ExtraLight 매칭.
  { name: 'Noto Sans KR ExtraLight', file: 'fonts/NotoSansKR-ExtraLight.woff2' },
  { name: 'Noto Serif KR', file: 'fonts/NotoSerifKR-Regular.woff2' },
  // === Pretendard ===
  { name: 'Pretendard', file: 'fonts/Pretendard-Regular.woff2' },
  { name: 'Pretendard Thin', file: 'fonts/Pretendard-Thin.woff2' },
  { name: 'Pretendard ExtraLight', file: 'fonts/Pretendard-ExtraLight.woff2' },
  { name: 'Pretendard Light', file: 'fonts/Pretendard-Light.woff2' },
  { name: 'Pretendard Medium', file: 'fonts/Pretendard-Medium.woff2' },
  { name: 'Pretendard SemiBold', file: 'fonts/Pretendard-SemiBold.woff2' },
  { name: 'Pretendard Bold', file: 'fonts/Pretendard-Bold.woff2' },
  { name: 'Pretendard ExtraBold', file: 'fonts/Pretendard-ExtraBold.woff2' },
  { name: 'Pretendard Black', file: 'fonts/Pretendard-Black.woff2' },
  // === D2 Coding (OFL, 로컬) ===
  { name: 'D2Coding', file: 'fonts/D2Coding-Regular.woff2' },
  // === Happiness Sans ===
  { name: '해피니스 산스 레귤러', file: 'fonts/Happiness-Sans-Regular.woff2' },
  { name: 'Happiness Sans Regular', file: 'fonts/Happiness-Sans-Regular.woff2' },
  { name: '해피니스 산스 볼드', file: 'fonts/Happiness-Sans-Bold.woff2' },
  { name: 'Happiness Sans Bold', file: 'fonts/Happiness-Sans-Bold.woff2' },
  { name: '해피니스 산스 타이틀', file: 'fonts/Happiness-Sans-Title.woff2' },
  { name: 'Happiness Sans Title', file: 'fonts/Happiness-Sans-Title.woff2' },
  { name: '해피니스 산스 VF', file: 'fonts/HappinessSansVF.woff2' },
  { name: 'Happiness Sans VF', file: 'fonts/HappinessSansVF.woff2' },
  // === Cafe24 ===
  { name: 'Cafe24 Ssurround Bold', file: 'fonts/Cafe24Ssurround-v2.0.woff2' },
  { name: '카페24 슈퍼매직', file: 'fonts/Cafe24Supermagic-Regular-v1.0.woff2' },
  { name: 'Cafe24 Supermagic', file: 'fonts/Cafe24Supermagic-Regular-v1.0.woff2' },
  // === 수식 전용 폰트 (OFL/GUST, 로컬) ===
  { name: 'Latin Modern Math', file: 'fonts/LatinModernMath-Regular.woff2' },
  // === 기타 ===
  { name: 'SpoqaHanSans', file: 'fonts/SpoqaHanSans-Regular.woff2' },
  // === Gowun (OFL, 로컬) ===
  { name: '고운바탕', file: 'fonts/GowunBatang-Regular.woff2' },
  { name: '고운돋움', file: 'fonts/GowunDodum-Regular.woff2' },
  // === Source Han Serif K Old Hangul (Task #528, OFL, 로컬, 옛한글 자모 한정 subset) ===
  // PUA 옛한글 (HanCom 자체 인코딩) 을 KS X 1026-1:2007 자모 시퀀스로 변환 후
  // 합자 렌더링용. unicode-range 로 옛한글 영역에서만 매칭 → 일반 한글 영향 0.
  {
    name: 'Source Han Serif K Old Hangul',
    file: 'fonts/SourceHanSerifK-OldHangul-subset.woff2',
    unicodeRange: 'U+1100-11FF, U+A960-A97F, U+D7B0-D7FF',
  },
];

/**
 * 굵은 짝 — 같은 이름에 `font-weight: 700` 으로 얹는 굵은 글꼴 파일.
 *
 * 왜 필요한가. `FONT_LIST` 의 `@font-face` 는 모두 서술자가 없어 400(normal) 이다.
 * 그래서 캔버스가 `font: bold 14px "나눔명조"` 를 요청하면 브라우저는 400 짝밖에
 * 못 찾고 **가짜 볼드(faux bold)** 를 만든다 — 획을 프로그램이 부풀리는 것이라
 * 속공간이 메워지고 가장자리가 번진다. 획이 빽빽한 한글에서 특히 심하다.
 *
 * 같은 이름으로 700 짝을 하나 더 등록하면 브라우저가 진짜 굵은 파일을 물고, 부풀리기
 * 자체가 일어나지 않는다.
 *
 * 엔진은 이미 (이름, 굵기, 기울임)별 실측 폭을 갖고 있으므로(`font_metrics_data.rs`)
 * 진짜 굵은 글꼴을 그리는 쪽이 배치와도 더 맞는다.
 *
 * 이름이 이미 굵은 글꼴인 것(HY견고딕·Pretendard Bold·해피니스 산스 볼드 등)과
 * 굵은 파일을 안 싣는 것(고운돋움·SpoqaHanSans·수식 글꼴)은 여기 없다 — 없으면
 * 지금처럼 브라우저 부풀리기로 떨어진다.
 */
const BOLD_FONT_LIST: FontEntry[] = [
  // === 함초롬/한컴 (CDN) — 굵은 짝이 CDN 에 있다 ===
  { name: '함초롬바탕', file: CDN_HAMCHOB_B, format: 'woff', weight: '700' },
  { name: '함초롱바탕', file: CDN_HAMCHOB_B, format: 'woff', weight: '700' },
  { name: '한컴바탕', file: CDN_HAMCHOB_B, format: 'woff', weight: '700' },
  { name: '새바탕', file: CDN_HAMCHOB_B, format: 'woff', weight: '700' },
  // === 한컴 HY → 오픈소스 대체 ===
  { name: 'HY신명조', file: 'fonts/NotoSerifKR-Bold.woff2', weight: '700' },
  { name: 'HY중고딕', file: 'fonts/NotoSansKR-Bold.woff2', weight: '700' },
  { name: 'HY그래픽', file: 'fonts/NotoSansKR-Bold.woff2', weight: '700' },
  { name: 'HY그래픽M', file: 'fonts/NotoSansKR-Bold.woff2', weight: '700' },
  { name: 'HYGraphic-Medium', file: 'fonts/NotoSansKR-Bold.woff2', weight: '700' },
  // === 한글 시스템 글꼴 → 오픈소스 대체 ===
  { name: 'Malgun Gothic', file: 'fonts/Pretendard-Bold.woff2', weight: '700' },
  { name: '맑은 고딕', file: 'fonts/Pretendard-Bold.woff2', weight: '700' },
  { name: '돋움', file: 'fonts/NotoSansKR-Bold.woff2', weight: '700' },
  { name: '돋움체', file: 'fonts/NotoSansKR-Bold.woff2', weight: '700' },
  { name: '굴림', file: 'fonts/NotoSansKR-Bold.woff2', weight: '700' },
  { name: '새굴림', file: 'fonts/NotoSansKR-Bold.woff2', weight: '700' },
  { name: 'Haansoft Dotum', file: 'fonts/NotoSansKR-Bold.woff2', weight: '700' },
  { name: '굴림체', file: 'fonts/D2Coding-Bold.woff2', weight: '700' },
  { name: '바탕체', file: 'fonts/D2Coding-Bold.woff2', weight: '700' },
  { name: '바탕', file: 'fonts/NotoSerifKR-Bold.woff2', weight: '700' },
  { name: '궁서', file: 'fonts/GowunBatang-Bold.woff2', weight: '700' },
  { name: '궁서체', file: 'fonts/GowunBatang-Bold.woff2', weight: '700' },
  { name: '새궁서', file: 'fonts/GowunBatang-Bold.woff2', weight: '700' },
  { name: 'Palatino Linotype', file: 'fonts/NotoSerifKR-Bold.woff2', weight: '700' },
  // === 나눔 ===
  { name: '나눔고딕', file: 'fonts/NanumGothic-Bold.woff2', weight: '700' },
  { name: '나눔명조', file: 'fonts/NanumMyeongjo-Bold.woff2', weight: '700' },
  { name: '나눔고딕코딩', file: 'fonts/NanumGothicCoding-Bold.woff2', weight: '700' },
  // === Noto ===
  { name: 'Noto Sans KR', file: 'fonts/NotoSansKR-Bold.woff2', weight: '700' },
  { name: 'Noto Serif KR', file: 'fonts/NotoSerifKR-Bold.woff2', weight: '700' },
  // === 그 밖 ===
  { name: 'Pretendard', file: 'fonts/Pretendard-Bold.woff2', weight: '700' },
  { name: 'D2Coding', file: 'fonts/D2Coding-Bold.woff2', weight: '700' },
  { name: '고운바탕', file: 'fonts/GowunBatang-Bold.woff2', weight: '700' },
  { name: '해피니스 산스 레귤러', file: 'fonts/Happiness-Sans-Bold.woff2', weight: '700' },
  { name: 'Happiness Sans Regular', file: 'fonts/Happiness-Sans-Bold.woff2', weight: '700' },
];

/**
 * CanvasKit 전용 굵은 짝 이름.
 *
 * CanvasKit 은 `font-weight` 서술자를 모르고 **이름 하나에 얼굴 하나**로만 typeface 를
 * 찾는다(`canvaskit-renderer.ts` 의 `findPreparedTypeface`). 그래서 굵은 파일을 따로
 * 부를 이름이 필요하다. 이 이름은 렌더러 안에서만 쓰이며 글꼴 고르기 목록에는 안 나온다.
 */
export function boldFamilyName(name: string): string {
  return `${name}  #bold`;
}


/** @font-face에 등록된 폰트 이름 Set */
export const REGISTERED_FONTS = new Set(FONT_LIST.map(f => f.name));

/** 초기 렌더링에 필수인 폰트 (대부분의 HWP 문서 기본 서체) */
const CRITICAL_FONTS = new Set(['함초롬바탕', '함초롬돋움']);

/** CSS @font-face 등록 여부 (중복 등록 방지) */
let fontFaceRegistrationMode: 'all' | 'local-only' | null = null;

/** 이미 로드 완료된 woff2 파일 (중복 네트워크 요청 방지) */
const loadedFiles = new Set<string>();

function isExternalFontFile(file: string): boolean {
  return /^https?:\/\//i.test(file);
}

function selectableFontList(options?: WebFontLoadOptions): FontEntry[] {
  // 굵은 짝은 이름이 겹치므로 목록에서는 뒤에 온다 — 같은 family 에 400/700 두 얼굴이
  // 붙는 형태다. 순서는 상관없지만 읽을 때 헷갈리지 않게 뒤에 둔다.
  const all = [...FONT_LIST, ...BOLD_FONT_LIST];
  if (options?.disableExternalWebFonts !== true) return all;
  return all.filter(f => !isExternalFontFile(f.file));
}

function normalizeFontFamily(value: string): string {
  return value
    .replace(/\u0000/g, '')
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('en-US');
}

function canvasKitFontUrl(file: string, localFontBaseUrl?: string): string {
  if (isExternalFontFile(file) || !localFontBaseUrl) return file;
  const base = localFontBaseUrl.replace(/\/+$/, '');
  return `${base}/${file.replace(/^fonts\//, '')}`;
}

/** CanvasKit이 첫 replay 전에 등록해야 하는 실제 font byte source를 계산한다. */
export function resolveCanvasKitFontPlan(
  requiredFontFamilies: readonly string[],
  options: CanvasKitFontPlanOptions = {},
): CanvasKitFontPlan {
  const canvasKitSubstitutes = new Map([
    [normalizeFontFamily('휴먼명조'), normalizeFontFamily('HY신명조')],
    [normalizeFontFamily('한양중고딕'), normalizeFontFamily('HY중고딕')],
    [normalizeFontFamily('한컴 윤고딕 230'), normalizeFontFamily('Noto Sans KR ExtraLight')],
  ]);
  const entriesByFamily = new Map<string, FontEntry>();
  for (const entry of FONT_LIST) {
    entriesByFamily.set(normalizeFontFamily(entry.name), entry);
  }

  const sourcesByUrl = new Map<string, Set<string>>();
  const unavailableFonts = new Map<string, string>();
  const requiredEntries: Array<{ entry: FontEntry; requested: string }> = [];
  for (const requested of requiredFontFamilies) {
    const normalized = normalizeFontFamily(requested);
    if (!normalized) continue;
    const entry = entriesByFamily.get(normalized)
      ?? entriesByFamily.get(canvasKitSubstitutes.get(normalized) ?? '');
    if (!entry) {
      unavailableFonts.set(normalized, requested.trim());
      continue;
    }
    const localFile = entry.file.startsWith('fonts/')
      ? entry.file.slice('fonts/'.length)
      : null;
    const unavailable = (options.disableExternalWebFonts === true && isExternalFontFile(entry.file))
      || (localFile !== null
        && options.availableLocalFiles !== undefined
        && !options.availableLocalFiles.has(localFile));
    if (unavailable) {
      unavailableFonts.set(normalized, requested.trim());
      continue;
    }
    requiredEntries.push({ entry, requested: requested.trim() });
  }

  for (const { entry, requested } of requiredEntries) {
    const url = canvasKitFontUrl(entry.file, options.localFontBaseUrl);
    const aliases = sourcesByUrl.get(url) ?? new Set<string>();
    aliases.add(requested);
    for (const candidate of FONT_LIST) {
      if (candidate.file === entry.file) aliases.add(candidate.name);
    }
    sourcesByUrl.set(url, aliases);
  }

  // 굵은 짝을 함께 싣는다. CanvasKit 은 굵기 서술자를 모르므로 `boldFamilyName` 이 주는
  // 별도 이름으로 등록하고, 렌더러가 진하게일 때 그 이름으로 찾아 쓴다.
  //
  // 굵은 짝이 없거나 이 배포 표면에 파일이 없으면 그냥 건너뛴다 — 문서를 못 여는 사유가
  // 되면 안 된다. 그 경우는 지금까지처럼 부풀리기로 떨어진다.
  const boldEntriesByNormalized = new Map<string, FontEntry>(
    BOLD_FONT_LIST.map(entry => [normalizeFontFamily(entry.name), entry]),
  );
  for (const { entry, requested } of requiredEntries) {
    const bold = boldEntriesByNormalized.get(normalizeFontFamily(entry.name));
    if (!bold) continue;
    const boldLocalFile = bold.file.startsWith('fonts/')
      ? bold.file.slice('fonts/'.length)
      : null;
    if (options.disableExternalWebFonts === true && isExternalFontFile(bold.file)) continue;
    if (boldLocalFile !== null
      && options.availableLocalFiles !== undefined
      && !options.availableLocalFiles.has(boldLocalFile)) continue;
    const url = canvasKitFontUrl(bold.file, options.localFontBaseUrl);
    const aliases = sourcesByUrl.get(url) ?? new Set<string>();
    // 문서가 부른 이름과 정착한 엔트리 이름 둘 다 걸어 둔다. 대체 글꼴로 내려온 경우
    // (휴먼명조 → HY신명조) 렌더러는 문서가 부른 이름으로 찾기 때문이다.
    aliases.add(boldFamilyName(entry.name));
    aliases.add(boldFamilyName(requested));
    sourcesByUrl.set(url, aliases);
  }

  return {
    sources: [...sourcesByUrl.entries()].map(([url, aliases]) => ({
      url,
      aliases: [...aliases].sort((left, right) => left.localeCompare(right, 'ko')),
    })),
    unavailableFonts: [...unavailableFonts.values()]
      .sort((left, right) => left.localeCompare(right, 'ko')),
  };
}

function registerFontFaces(options?: WebFontLoadOptions): void {
  const disableExternal = options?.disableExternalWebFonts === true;
  const mode = disableExternal ? 'local-only' : 'all';
  if (fontFaceRegistrationMode === mode) return;

  const styleId = 'rhwp-web-font-faces';
  let style = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = styleId;
    document.head.appendChild(style);
  }
  style.textContent = selectableFontList(options).map(f => {
    const fmt = f.format ?? 'woff2';
    const ur = f.unicodeRange ? ` unicode-range: ${f.unicodeRange};` : '';
    // 굵은 짝에만 700 을 적는다. 나머지는 서술자 없이 400 으로 남는다.
    const wt = f.weight ? ` font-weight: ${f.weight};` : '';
    return `@font-face { font-family: "${f.name}"; src: url("${f.file}") format("${fmt}"); font-display: swap;${wt}${ur} }`;
  }).join('\n');
  fontFaceRegistrationMode = mode;
}

/**
 * OS에 설치된 폰트인지 감지한다 (document.fonts.check 기반).
 * @font-face 등록 전에 호출해야 정확하다.
 */
const OS_FONT_CANDIDATES = [
  // Windows
  '맑은 고딕', 'Malgun Gothic', '바탕', 'Batang', '돋움', 'Dotum',
  '굴림', 'Gulim', '굴림체', 'GulimChe', '바탕체', 'BatangChe', '궁서', 'Gungsuh',
  // macOS / iOS
  'Apple SD Gothic Neo', 'AppleMyungjo', 'AppleGothic',
  // Android
  'Noto Sans KR', 'Noto Serif KR',
];
const detectedOSFonts = new Set<string>();

/** OS 폰트 감지 실행 (@font-face 등록 전에 호출) */
function detectOSFonts(): void {
  for (const name of OS_FONT_CANDIDATES) {
    try {
      if (document.fonts.check(`16px "${name}"`)) {
        detectedOSFonts.add(name);
      }
    } catch { /* 무시 */ }
  }
  if (detectedOSFonts.size > 0) {
    console.log(`[FontLoader] OS 폰트 감지: ${Array.from(detectedOSFonts).join(', ')}`);
  }
}

/** 감지된 OS 폰트 목록 (외부 참조용) */
export function getDetectedOSFonts(): ReadonlySet<string> {
  return detectedOSFonts;
}

/**
 * 웹폰트를 선별 로드한다.
 *   1단계(동기): CSS @font-face 등록
 *   2단계: 대상 폰트 로드 (이미 로드된 파일은 건너뜀)
 *
 * @param docFonts 문서에서 사용하는 폰트 이름 목록 (있으면 해당 폰트 + CRITICAL만 로드, 없으면 전체)
 * @param onProgress 폰트 로드 진행률 콜백 (loaded, total)
 * @param options 외부 웹폰트 사용 여부 등 로드 옵션
 */
export async function loadWebFonts(
  docFonts?: string[],
  onProgress?: (loaded: number, total: number) => void,
  options?: WebFontLoadOptions,
): Promise<void> {
  // 0) OS 폰트 감지 (@font-face 등록 전에 실행해야 정확)
  if (!fontFaceRegistrationMode) {
    detectOSFonts();
  }

  // 1) CSS @font-face 규칙 등록. 오프라인 옵션이면 외부 URL 폰트는 제외한다.
  registerFontFaces(options);

  // 2) 로드 대상 결정: docFonts에 포함된 폰트 + CRITICAL만 로드
  //    OS에 설치된 폰트는 웹폰트 로딩 건너뜀
  const targetSet = new Set([...(docFonts ?? []), ...CRITICAL_FONTS]);
  const toLoad = selectableFontList(options).filter(f => {
    if (!targetSet.has(f.name)) return false;
    // OS에 동일 이름 폰트가 있으면 웹폰트 로딩 불필요
    if (detectedOSFonts.has(f.name)) return false;
    return true;
  });

  // woff2 파일 기준으로 중복 제거 + 이미 로드된 파일 건너뜀
  const seenFiles = new Set<string>();
  const uniqueToLoad: FontEntry[] = [];
  for (const f of toLoad) {
    if (!seenFiles.has(f.file) && !loadedFiles.has(f.file)) {
      seenFiles.add(f.file);
      uniqueToLoad.push(f);
    }
  }

  if (uniqueToLoad.length === 0) return;

  const total = uniqueToLoad.length;
  console.log(`[FontLoader] 웹폰트 로드 시작: ${total}개 woff2 (이미 로드됨: ${loadedFiles.size}개)`);

  // 같은 woff2 파일에 매핑된 모든 이름도 함께 등록.
  //
  // 이름이 아니라 엔트리를 모으는 이유: 한 파일이 어떤 이름에는 400 으로, 다른 이름에는
  // 700 으로 붙을 수 있다(NotoSansKR-Bold 는 'HY견고딕' 의 400 이면서 '돋움' 의 700 이다).
  // 이름만 모으면 굵기를 잃어 굵은 짝이 400 으로 등록되고, 그 순간 다시 가짜 볼드가 된다.
  const fileToEntries = new Map<string, FontEntry[]>();
  for (const f of toLoad) {
    if (!loadedFiles.has(f.file)) {
      const entries = fileToEntries.get(f.file) ?? [];
      entries.push(f);
      fileToEntries.set(f.file, entries);
    }
  }

  let loaded = 0;
  let failed = 0;
  const BATCH = 4;

  for (let i = 0; i < uniqueToLoad.length; i += BATCH) {
    const batch = uniqueToLoad.slice(i, i + BATCH);
    await Promise.all(batch.map(async (f) => {
      try {
        const entries = fileToEntries.get(f.file) ?? [f];
        const fmt = f.format ?? 'woff2';
        for (const entry of entries) {
          const face = new FontFace(
            entry.name,
            `url(${entry.file}) format('${fmt}')`,
            entry.weight ? { weight: entry.weight } : undefined,
          );
          const result = await face.load();
          document.fonts.add(result);
        }
        loadedFiles.add(f.file);
        loaded++;
      } catch {
        failed++;
      }
      onProgress?.(loaded + failed, total);
    }));
    if (i + BATCH < uniqueToLoad.length) {
      await new Promise(r => setTimeout(r, 0));
    }
  }

  console.log(`[FontLoader] 폰트 로드 완료: ${loaded}개 성공, ${failed}개 실패 (총 ${loadedFiles.size}개 woff2 로드됨)`);
}
