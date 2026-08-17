import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { USAGE_SECTIONS } from '../src/core/usage-guide.ts';

const fileCmd = readFileSync(new URL('../src/command/commands/file.ts', import.meta.url), 'utf8');
const usage = USAGE_SECTIONS
  .flatMap((s) => [s.title, ...(s.paragraphs ?? [])])
  .join('\n');

/**
 * 파이어폭스·사파리에는 File System Access API 가 없어 저장이 내려받기로 떨어진다.
 * hwwp 가 고를 수 있는 다른 길이 없다. 문제는 아무 말도 하지 않아서, 사용자가
 * "저장을 눌렀는데 왜 파일이 또 생기지" 하고 자기가 뭘 잘못한 줄 안다는 것이었다.
 */
test('내려받기로 떨어지면 사용자에게 알린다', () => {
  assert.match(fileCmd, /function notifyDownloadFallback/);
  // 두 갈래(저장 / 다른 이름으로 저장) 모두에서 알려야 한다.
  const calls = fileCmd.match(/notifyDownloadFallback\(downloadName\)/g) ?? [];
  assert.equal(calls.length, 2, '내려받기 경로 두 곳 모두에서 알려야 한다');
});

test('알림은 브라우저 한계임을 밝히고 드라이브를 권한다', () => {
  assert.match(fileCmd, /이 브라우저는 저장 위치/);
  assert.match(fileCmd, /구글 드라이브를 연결하면 같은 문서에 이어서 저장됩니다/);
});

test('드라이브가 이미 연결돼 있으면 다른 말을 한다', () => {
  // "연결하면 …" 은 이미 연결한 사람에게 거짓말이다.
  assert.match(fileCmd, /if \(isDriveConnected\(\)\)/);
  assert.match(fileCmd, /문서 자체는 구글 드라이브에 계속 저장되고 있습니다/);
});

test('사용법이 브라우저별 차이를 설명한다', () => {
  assert.match(usage, /파이어폭스·사파리에서는 저장이 조금 다릅니다/);
  // 왜 그런지(브라우저 한계)와 어떻게 하면 되는지(드라이브)를 둘 다 말해야 한다.
  assert.match(usage, /브라우저가 주지 않는 기능입니다/);
  assert.match(usage, /드라이브에는 같은 문서에 계속 덮어써지므로/);
});
