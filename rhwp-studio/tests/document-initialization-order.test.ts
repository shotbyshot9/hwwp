import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * 소스를 읽되 줄바꿈을 LF 로 맞춘다.
 *
 * 이 파일의 검사들은 `'\n        },\n      },'` 처럼 들여쓰기와 개행을 글자 그대로
 * 찾는다. 그런데 git 의 autocrlf 설정에 따라 작업 사본이 CRLF 로 바뀌면 같은 코드인데
 * 찾지 못해 실패한다 — 실제로 병합 뒤 main.ts 가 CRLF 가 되면서 그렇게 됐다.
 * 줄바꿈은 이 검사들이 지키려는 것과 아무 상관이 없으므로 읽는 자리에서 없앤다.
 */
function source(path: string): string {
  return readFileSync(join(rootDir, path), 'utf8').replace(/\r\n/g, '\n');
}

function initializeDocumentSource(): string {
  const main = source('src/main.ts');
  const start = main.indexOf('async function initializeDocument');
  const end = main.indexOf('\nasync function promptLocalFontsIfNeeded', start);
  assert.ok(start >= 0 && end > start, 'initializeDocument 범위를 찾을 수 있어야 한다');
  return main.slice(start, end);
}

test('문서 초기화는 로컬 글꼴 확인 후에만 입력 핸들러를 활성화한다', () => {
  const initializeDocument = initializeDocumentSource();
  const promptIndex = initializeDocument.indexOf('await promptLocalFontsIfNeeded(docInfo, displayName);');
  const activateIndex = initializeDocument.indexOf('inputHandler?.activateWithCaretPosition();');
  const completeIndex = initializeDocument.indexOf("documentState.markClean('document-initialized');");

  assert.ok(promptIndex >= 0, '로컬 글꼴 확인 단계가 있어야 한다');
  assert.ok(activateIndex > promptIndex, '로컬 글꼴 확인 뒤에 캐럿을 활성화해야 한다');
  assert.ok(completeIndex > activateIndex, '편집 준비 뒤에 문서 초기화를 완료해야 한다');
  assert.doesNotMatch(
    initializeDocument,
    /updateLoadProgress\(100, '완료'\)/,
    '최종 파일명 전환 전에 불필요한 100% paint 대기를 두지 않는다',
  );
});

test('CanvasKit local face 등록은 문서 초기화 대신 현재 뷰 재그리기를 요청한다', () => {
  const main = source('src/main.ts');
  const start = main.indexOf('function prepareCanvasKitLocalFonts');
  const end = main.indexOf('\nasync function initialize()', start);
  assert.ok(start >= 0 && end > start, 'CanvasKit local face 준비 함수를 찾을 수 있어야 한다');
  const prepareLocalFonts = main.slice(start, end);

  assert.match(prepareLocalFonts, /eventBus\.emit\('document-view-changed'\);/);
  assert.doesNotMatch(prepareLocalFonts, /canvasView\?\.loadDocument\(\);/);
});

test('CanvasKit 첫 replay는 저장된 local face를 bundled fallback보다 먼저 준비한다', () => {
  const main = source('src/main.ts');
  const start = main.indexOf('async prepareCanvasKitDocument(renderer, report)');
  const end = main.indexOf('\n        },\n      },', start);
  assert.ok(start >= 0 && end > start, 'CanvasKit 문서 준비 콜백을 찾을 수 있어야 한다');
  const prepareDocument = main.slice(start, end);

  const storedIndex = prepareDocument.indexOf('await loadStoredLocalFonts();');
  const localIndex = prepareDocument.indexOf(
    'await renderer.prepareLocalFonts(report.requiredFontFamilies);',
  );
  const catchIndex = prepareDocument.indexOf('} catch (error) {');
  const bundledIndex = prepareDocument.indexOf('await renderer.prepareBundledFonts(plan.sources);');

  assert.ok(storedIndex >= 0, '저장된 local font snapshot을 첫 replay 전에 로드해야 한다');
  assert.ok(localIndex > storedIndex, 'snapshot 로드 뒤 정확한 local face를 준비해야 한다');
  assert.ok(catchIndex > localIndex, 'local face 실패는 bundled fallback으로 격리해야 한다');
  assert.ok(bundledIndex > catchIndex, 'local face 준비 뒤 bundled fallback도 항상 준비해야 한다');
});

test('로컬 글꼴 감지는 Canvas2D 문서를 전체 재로딩하지 않는다', () => {
  const main = source('src/main.ts');
  assert.doesNotMatch(main, /eventBus\.on\('local-fonts-changed',[\s\S]*?canvasView\?\.loadDocument\(\);/);
});
