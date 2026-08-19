import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dialog = readFileSync(
  new URL('../src/ui/focus-settings-dialog.ts', import.meta.url),
  'utf8',
);
const focusCmd = readFileSync(
  new URL('../src/command/commands/focus.ts', import.meta.url),
  'utf8',
);
const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(
  new URL('../src/styles/focus-settings-dialog.css', import.meta.url),
  'utf8',
);
const styleEntry = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');

/**
 * 설정 열넷이 서브메뉴 스물다섯 줄로 늘어서 있었다. 세로로 길어 큰 화면에서도 아래가
 * 잘렸고, 1920×1080 노트북에서는 목표 항목에 닿을 수가 없었다.
 */
test('배명훈 모드 설정은 메뉴가 아니라 대화상자로 연다', () => {
  assert.match(indexHtml, /data-cmd="focus:settings"[^>]*>[^<]*<span class="md-label">배명훈 모드 설정…<\/span>/);
  // 서브메뉴가 되살아나면 같은 문제가 돌아온다.
  for (const cmd of ['focus:theme', 'focus:zoom', 'focus:goal', 'focus:cheer-rate',
    'focus:cheer-quiet', 'focus:toggle-confetti', 'focus:toggle-startup']) {
    assert.doesNotMatch(
      indexHtml,
      new RegExp(`data-cmd="${cmd}"`),
      `${cmd} 가 다시 메뉴에 늘어서 있다`,
    );
  }
});

test('설정 항목이 하나도 빠지지 않았다', () => {
  // 메뉴에 있던 열넷이 그대로 있어야 한다.
  for (const label of ['테마', '배율', '강도', '배속', '목표',
    '폭죽 효과', '박수 효과음', '음성 칭찬', '타자기 스크롤', '켤 때 배명훈 모드로 시작']) {
    assert.ok(dialog.includes(`'${label}'`), `${label} 이 대화상자에 없다`);
  }
  // 배속 여섯 단계는 표를 손으로 옮기지 않고 CHEER_RATES 에서 가져온다.
  assert.match(dialog, /CHEER_RATES\.map/);
});

test('고른 즉시 반영된다', () => {
  // 확인 단추를 눌러야 적용되던 적이 없었고, 응원 소리·배율은 겪어 봐야 고를 수 있다.
  assert.match(dialog, /userSettings\.updateFocusSettings\(patch\)/);
  assert.match(dialog, /this\.onChanged\(\)/);
  assert.match(focusCmd, /new FocusSettingsDialog\(\(\) => \{/);
  assert.match(focusCmd, /getFocusMode\(services\)\.refresh\(\)/);
});

test('대화상자 안에서만 스크롤한다', () => {
  // 잘려서 못 고르던 것이 애초의 문제였다. 항목이 늘어도 화면 밖으로 밀려나면 안 된다.
  assert.match(css, /\.fs-body \{[^}]*max-height: min\(/s);
  assert.match(css, /\.fs-body \{[^}]*overflow-y: auto;/s);
  assert.match(styleEntry, /@import '\.\/styles\/focus-settings-dialog\.css';/);
});
