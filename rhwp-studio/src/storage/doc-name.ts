/**
 * 문서 이름 규칙.
 *
 * 자동 저장은 사용자가 이름을 정하기 전에도 돌아야 하므로, 이름 없는 문서에
 * 임시 제목을 주고 저장소에 같은 이름이 있으면 `새 문서(1)` 처럼 번호를 붙인다.
 *
 * 저장소(로컬·구글 드라이브)에 의존하지 않는 순수 함수만 둔다 — 규칙을 눈으로
 * 확인하지 않고 테스트로 고정하기 위해서다.
 */

/** 이름을 정하지 않은 문서의 기본 제목 */
export const DEFAULT_DOC_TITLE = '새 문서';

/** 다루는 문서 확장자 */
const EXTENSION_PATTERN = /\.(hwp|hwpx|hml)$/i;

/** `이름(3)` 꼴의 꼬리 번호 */
const SUFFIX_PATTERN = /^(.*?)\((\d+)\)$/;

/** 파일 이름에 쓸 수 없는 문자 (윈도·macOS 금지 문자 + 제어문자) */
const ILLEGAL_PATTERN = /[\\/:*?"<>|\u0000-\u001F\u007F]/g;

/** 파일명을 몸통과 확장자로 가른다. 확장자가 없으면 빈 문자열. */
export function splitExtension(fileName: string): { base: string; extension: string } {
  const trimmed = fileName.trim();
  const match = trimmed.match(EXTENSION_PATTERN);
  if (!match) return { base: trimmed, extension: '' };
  return { base: trimmed.slice(0, -match[0].length), extension: match[0] };
}

/**
 * 사용자가 입력한 제목을 저장 가능한 이름으로 다듬는다.
 *
 * 빈 제목은 기본 제목으로 되돌리고, 파일 이름에 쓸 수 없는 문자는 걷어낸다.
 * 구글 드라이브는 `/` 만 금지하지만, 나중에 로컬로 내려받을 때 곤란해지므로
 * 윈도·macOS 가 막는 문자까지 함께 막는다.
 */
export function sanitizeDocTitle(title: string): string {
  const cleaned = title
    .replace(ILLEGAL_PATTERN, '')
    .trim()
    // 앞뒤 점은 숨김 파일로 오인되거나 확장자로 먹힌다.
    .replace(/^\.+/, '')
    .replace(/\.+$/, '')
    .trim();
  return cleaned || DEFAULT_DOC_TITLE;
}

/**
 * 이미 쓰이는 이름을 피해 고유한 이름을 만든다.
 *
 * `새 문서` 가 있으면 `새 문서(1)`, 그것도 있으면 `새 문서(2)` 로 올린다.
 * 들어온 이름이 이미 `이름(3)` 꼴이면 그 몸통을 기준으로 다시 센다 —
 * `새 문서(1)(1)` 같은 꼬리 물기를 막는다.
 *
 * 비교는 대소문자를 가리지 않는다. 저장소는 구분하더라도 사람 눈에는
 * `새 문서.hwp` 와 `새 문서.HWP` 가 같은 이름이다.
 *
 * @param desired  원하는 파일명 (확장자 포함 가능)
 * @param taken    이미 저장소에 있는 파일명 목록
 */
export function uniqueDocName(desired: string, taken: Iterable<string>): string {
  const { base, extension } = splitExtension(desired);
  const used = new Set<string>();
  for (const name of taken) used.add(name.trim().toLowerCase());

  const isFree = (candidate: string) => !used.has(candidate.trim().toLowerCase());

  if (isFree(desired)) return desired;

  // `이름(3)` 으로 들어오면 몸통만 남기고 번호는 새로 센다.
  const suffixMatch = base.match(SUFFIX_PATTERN);
  const stem = (suffixMatch ? suffixMatch[1] : base).trimEnd();

  for (let n = 1; n < 10000; n++) {
    const candidate = `${stem}(${n})${extension}`;
    if (isFree(candidate)) return candidate;
  }
  // 만 개까지 찼다면 이름 규칙으로 풀 문제가 아니다 — 호출부가 실패를 보게 둔다.
  throw new Error(`이름을 정할 수 없습니다: ${desired}`);
}

/**
 * 화면 제목 줄에 보일 이름. 확장자는 감춘다 (구글 독스와 같은 방식).
 * 저장은 확장자를 붙여 하되, 사용자가 확장자를 신경 쓰게 하지 않는다.
 */
export function displayTitle(fileName: string): string {
  const { base } = splitExtension(fileName);
  return base || DEFAULT_DOC_TITLE;
}
