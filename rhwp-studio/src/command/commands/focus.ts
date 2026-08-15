import type { CommandDef, CommandServices } from '../types';
import { userSettings, type FocusCheerLevel } from '../../core/user-settings';
import { FocusMode } from '../../focus/focus-mode';

/**
 * 집중 작업 모드 커맨드.
 *
 * 컨트롤러는 eventBus 가 필요하므로 첫 실행 때 만들어 붙잡아 둔다
 * (커맨드 정의는 서비스 주입 전에 모듈 로드 시점에 평가되기 때문).
 */
let focusMode: FocusMode | null = null;

function getFocusMode(services: CommandServices): FocusMode {
  if (!focusMode) focusMode = new FocusMode(services.eventBus);
  return focusMode;
}

/** 이미 만들어진 컨트롤러. 아직 한 번도 진입하지 않았으면 null */
export function currentFocusMode(): FocusMode | null {
  return focusMode;
}

/** 메뉴 항목의 켜짐 표시를 현재 설정과 맞춘다 */
export function syncFocusMenu(): void {
  const s = userSettings.getFocusSettings();
  const flags: [string, boolean][] = [
    ['focus:toggle-confetti', s.confetti],
    ['focus:toggle-sound', s.sound],
    ['focus:toggle-praise', s.praise],
    ['focus:toggle-typewriter', s.typewriter],
    ['focus:cheer-quiet', s.cheerLevel === 'quiet'],
    ['focus:cheer-normal', s.cheerLevel === 'normal'],
    ['focus:cheer-festival', s.cheerLevel === 'festival'],
  ];
  for (const [cmd, on] of flags) {
    document.querySelectorAll(`[data-cmd="${cmd}"]`).forEach((el) => {
      el.classList.toggle('active', on);
    });
  }
  document.querySelectorAll('[data-cmd="focus:goal"]').forEach((el) => {
    const goal = Number((el as HTMLElement).dataset.goal ?? '0');
    el.classList.toggle('active', goal === s.goalChars);
  });
  document.querySelectorAll('[data-cmd="focus:toggle"]').forEach((el) => {
    el.classList.toggle('active', focusMode?.isActive() === true);
  });
}

/** 켜고 끄는 설정 하나를 커맨드로 만든다 */
function toggleSetting(
  id: string,
  label: string,
  key: 'confetti' | 'sound' | 'praise' | 'typewriter',
): CommandDef {
  return {
    id,
    label,
    execute(services) {
      const next = !userSettings.getFocusSettings()[key];
      userSettings.updateFocusSettings({ [key]: next });
      syncFocusMenu();
      getFocusMode(services).refresh();
    },
  };
}

function cheerLevelCommand(level: FocusCheerLevel, label: string): CommandDef {
  return {
    id: `focus:cheer-${level}`,
    label,
    execute(services) {
      userSettings.updateFocusSettings({ cheerLevel: level });
      syncFocusMenu();
      getFocusMode(services).refresh();
    },
  };
}

export const focusCommands: CommandDef[] = [
  {
    id: 'focus:toggle',
    label: '집중 작업 모드',
    shortcutLabel: 'Alt+Shift+F',
    canExecute: (ctx) => ctx.hasDocument,
    execute(services) {
      getFocusMode(services).toggle();
      syncFocusMenu();
    },
  },
  cheerLevelCommand('quiet', '조용히'),
  cheerLevelCommand('normal', '기본'),
  cheerLevelCommand('festival', '축제'),
  toggleSetting('focus:toggle-confetti', '폭죽 효과', 'confetti'),
  toggleSetting('focus:toggle-sound', '박수 효과음', 'sound'),
  toggleSetting('focus:toggle-praise', '음성 칭찬', 'praise'),
  toggleSetting('focus:toggle-typewriter', '타자기 스크롤', 'typewriter'),
  {
    id: 'focus:goal',
    label: '세션 목표',
    execute(services, params) {
      const goal = Number(params?.goal ?? 0);
      userSettings.updateFocusSettings({ goalChars: Number.isFinite(goal) ? Math.max(0, goal) : 0 });
      syncFocusMenu();
      getFocusMode(services).refresh();
    },
  },
];
