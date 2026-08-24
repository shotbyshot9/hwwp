import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * 목표 달성은 장문 축포와 달라야 한다.
 *
 * 예전에는 둘 다 `celebrate()` 를 불렀다. 그런데 장문 축포는 문장부호 없이 50자만
 * 이어 써도 터지므로 한 세션에 수십 번 나온다. 목표 달성은 많아야 하루 한 번인데
 * 같은 그림·같은 소리면 아무 일도 아닌 것처럼 보인다 — 실제로 그렇게 느껴졌다.
 *
 * 되돌아가면 화면은 멀쩡히 나오되 "어마어마한 일" 이 그냥 지나간다. 눈으로만 보면
 * 알아채기 어려운 종류라 시험으로 걸어 둔다.
 */

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

const confetti = read('../src/focus/confetti.ts');
const engine = read('../src/focus/cheer-engine.ts');
const mode = read('../src/focus/focus-mode.ts');
const css = read('../src/styles/focus-mode.css');

test('목표 달성은 전용 축포를 쓴다', () => {
  assert.match(mode, /this\.cheer\.celebrateGoal\(\)/, '목표 달성이 전용 함수를 안 부른다');
  assert.doesNotMatch(
    mode,
    /checkGoal\(\)[\s\S]{0,400}?this\.cheer\.celebrate\(\)/,
    '목표 달성이 아직 장문 축포를 부르고 있다',
  );
  assert.match(engine, /celebrateGoal\(\): void/);
  assert.match(engine, /this\.confetti\.fireGoalCelebration\(\)/);
});

test('장문 축포는 그대로 남아 있다', () => {
  // 목표 달성을 갈라내면서 장문 축포까지 없애면 평소 응원이 밋밋해진다.
  assert.match(engine, /celebrate\(\): void/);
  assert.match(confetti, /fireCelebration\(\): void/);
  assert.match(engine, /if \(longRun\) this\.confetti\.fireCelebration\(\)/);
});

test('목표 축포는 장문 축포보다 크고 그림이 다르다', () => {
  // 아래에서 솟는 분수는 목표 달성에만 있다 — 좌우 대포만 쓰는 다른 축포와
  // 한눈에 구별되게 하는 것이 이 효과의 요점이다.
  assert.match(confetti, /fireGoalCelebration\(\): void/);
  assert.match(confetti, /private spawnFountains\(/);
  assert.match(confetti, /private spawnUp\(/);
  const longRunBody = confetti.match(/  fireCelebration\(\): void \{[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.ok(longRunBody, 'fireCelebration 본문을 찾지 못했다');
  assert.doesNotMatch(
    longRunBody,
    /spawnFountains|spawnUp/,
    '장문 축포에까지 분수가 들어가면 구별이 사라진다',
  );

  // 파동 수도 더 많아야 한다. 장문 축포는 세 번이다.
  const goal = confetti.match(/fireGoalCelebration\(\): void \{[\s\S]*?\n  \}/)?.[0] ?? '';
  const waves = goal.match(/\{ at: /g) ?? [];
  assert.ok(waves.length >= 5, `목표 축포 파동이 ${waves.length}번뿐이다`);
});

/**
 * 배속을 MAX 로 두면 글자마다 폭죽이 터져 화면이 늘 색종이로 차 있다. 거기에 색종이를
 * 더 뿌리는 것으로는 눈에 띄지 않는다 — 그래서 "다르게" 만드는 장치를 셋 뒀다.
 * 하나라도 빠지면 배속이 높은 사람에게는 다시 묻힌다.
 */
test('배속이 높아도 묻히지 않게 하는 장치가 다 있다', () => {
  // 1. 정적 — 계속 터지던 화면을 먼저 비운다.
  assert.match(confetti, /const SILENT_BEAT_MS = \d+;/);
  const goalBody = confetti.match(/fireGoalCelebration\(\): void \{[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.match(goalBody, /this\.clear\(\)/, '먼저 비우지 않으면 배경에 섞인다');
  assert.match(confetti, /clear\(\): void \{/);

  // 2. 금빛 큰 조각 — 색과 크기가 평소와 달라야 한다.
  assert.match(confetti, /const GOLD_COLORS = \[/);
  assert.match(goalBody, /gold: true/);
  assert.match(goalBody, /sizeScale:/);

  // 3. 화면 전체가 한 번 밝아진다 — 평소 응원은 바탕을 건드리지 않는다.
  assert.match(mode, /private flashScreen\(\): void/);
  assert.match(css, /\.fm-goal-flash \{/);
  assert.match(css, /@keyframes fm-goal-flash/);
});

/**
 * 셋을 한꺼번에 터뜨리면 서로 묻힌다. 정적 → 축포와 빛 → 글자 순서로 온다.
 */
test('효과가 겹치지 않게 순서를 둔다', () => {
  const check = mode.match(/private checkGoal\(\): void \{[\s\S]*?\n  \}/)?.[0] ?? '';
  const flashAt = check.match(/setTimeout\(\(\) => this\.flashScreen\(\), (\d+)\)/)?.[1];
  const bannerAt = check.match(/setTimeout\(\(\) => this\.showGoalBanner\(goal\), (\d+)\)/)?.[1];
  assert.ok(flashAt && bannerAt, '순서가 잡혀 있지 않다');
  const silent = Number(confetti.match(/const SILENT_BEAT_MS = (\d+);/)?.[1]);
  // 빛은 정적이 끝나는 순간, 글자는 그보다 뒤에.
  assert.equal(Number(flashAt), silent, '빛이 정적과 어긋나면 두 사건으로 보인다');
  assert.ok(Number(bannerAt) > Number(flashAt), '글자가 빛보다 먼저 오면 안 된다');
});

test('입자 상한을 넘겨 쏘지 않는다', () => {
  // 상한을 안 지키면 오래 쓴 뒤 목표에 닿는 순간 프레임이 무너진다.
  assert.match(confetti, /const room = MAX_PARTICLES - this\.particles\.length;/);
  const spawnUp = confetti.match(/private spawnUp\([\s\S]*?\n  \}/)?.[0] ?? '';
  assert.match(spawnUp, /MAX_PARTICLES - this\.particles\.length/, '분수가 상한을 안 본다');
});

test('소리도 갈라져 있다', () => {
  // 한 음이 올라가고 끝나는 차임은 "잘했다" 이고, 화음이 쌓여야 "다 했다" 로 들린다.
  assert.match(engine, /private playFanfare\(/);
  assert.match(engine, /this\.playFanfare\(/);
  // 화음이려면 음이 여럿이어야 한다.
  const fanfare = engine.match(/private playFanfare\([\s\S]*?\n  \}/)?.[0] ?? '';
  const notes = fanfare.match(/\[[\d.,\s]+\]/)?.[0] ?? '';
  assert.ok((notes.match(/\d+\.?\d*/g) ?? []).length >= 3, `팡파르 음이 부족하다: ${notes}`);
});

/**
 * 무엇을 달성했는지 말해 주는 것이 폭죽보다 중요할 수 있다.
 * 예전에는 막대 색만 바뀌어서, 달성했다는 사실 자체를 놓치기 쉬웠다.
 */
test('무엇을 달성했는지 화면에 알린다', () => {
  assert.match(mode, /private showGoalBanner\(goal: number\): void/);
  assert.match(mode, /오늘 목표를 채우셨습니다/);
  // 목표 글자수와 걸린 시간을 함께 보인다.
  assert.match(mode, /goal\.toLocaleString\('ko-KR'\)/);
  assert.match(mode, /private elapsedText\(\): string/);
  assert.match(css, /\.fm-goal-banner \{/);
});

/**
 * 이 제품에서 가장 중요한 규칙 — 쓰던 것을 멈추게 하지 않는다.
 * 확인 버튼이 붙거나 클릭을 가로채는 순간 집중 화면이 아니게 된다.
 */
test('알림이 글쓰기를 멈추게 하지 않는다', () => {
  const banner = css.match(/\.fm-goal-banner \{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(banner, /pointer-events: none/, '클릭을 가로채면 안 된다');
  assert.match(banner, /animation:/, '스스로 사라져야 한다');

  // 스스로 사라지는 길이 두 개 — 애니메이션 종료와 시간 제한.
  assert.match(mode, /banner\.addEventListener\('animationend', remove\)/);
  assert.match(mode, /window\.setTimeout\(remove, GOAL_BANNER_MS/);

  // 확인을 요구하는 요소가 없어야 한다.
  const fn = mode.match(/private showGoalBanner\([\s\S]*?\n  \}/)?.[0] ?? '';
  assert.doesNotMatch(fn, /createElement\('button'\)/, '확인 버튼이 생겼다');
  assert.doesNotMatch(fn, /\.focus\(\)/, '포커스를 가져가면 쓰던 글이 끊긴다');
});

test('효과를 줄여 달라는 설정을 지킨다', () => {
  // 폭죽은 엔진이 막고, 배너 움직임은 CSS 가 막는다.
  assert.match(engine, /if \(settings\.confetti && !prefersReducedMotion\(\)\) \{\s*\n\s*this\.confetti\.fireGoalCelebration/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.fm-goal-banner/);
});

test('진행 막대가 다 찬 것을 눈에 띄게 알린다', () => {
  // 색만 바뀌면 알아채기 어렵다 — 그게 원래 문제였다.
  assert.match(css, /@keyframes fm-goal-bar-flash/);
  const fill = css.match(/\.fm-overlay\.fm-goal-reached \.fm-goal-fill \{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(fill, /animation: fm-goal-bar-flash/);
});

test('개발용 확인 페이지에서 눌러 볼 수 있다', () => {
  // 2,000자를 쳐 봐야만 확인할 수 있으면 아무도 다시 안 본다.
  const lab = read('../focus-lab.html');
  const labTs = read('../src/focus/focus-lab.ts');
  assert.match(lab, /id="lab-goal"/);
  assert.match(labTs, /cheer\.celebrateGoal\(\)/);
});
