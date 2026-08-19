import type { CommandDef, CommandServices } from '../types';
import { userSettings, type FocusCheerLevel } from '../../core/user-settings';
import { normalizeCheerRate, type FocusCheerRate } from '../../focus/cheer-rate';
import { FocusMode } from '../../focus/focus-mode';
import { calculateFitWidthZoom } from '../../view/zoom-fit';
import { FocusSettingsDialog } from '../../ui/focus-settings-dialog';

/**
 * 배명훈 모드 커맨드.
 *
 * 컨트롤러는 eventBus 가 필요하므로 첫 실행 때 만들어 붙잡아 둔다
 * (커맨드 정의는 서비스 주입 전에 모듈 로드 시점에 평가되기 때문).
 */
let focusMode: FocusMode | null = null;

/**
 * 문서 전체의 단어수·글자수.
 *
 * 본문 문단만 센다 — 표 셀·머리말/꼬리말·각주는 제외한다. Writer's Homeground 의
 * 바닥글 집계를 옮긴 것이라 "지금 쓰고 있는 글의 분량"이 기준이다.
 */
function documentStats(services: CommandServices): { words: number; chars: number } {
  const wasm = services.wasm;
  let chars = 0;
  let words = 0;
  const sections = wasm.getSectionCount();
  for (let sec = 0; sec < sections; sec++) {
    const paraCount = wasm.getParagraphCount(sec);
    for (let para = 0; para < paraCount; para++) {
      const len = wasm.getParagraphLength(sec, para);
      if (len <= 0) continue;
      const text = wasm.getTextRange(sec, para, 0, len);
      chars += text.length;
      const trimmed = text.trim();
      if (trimmed) words += trimmed.split(/\s+/).length;
    }
  }
  return { words, chars };
}

function getFocusMode(services: CommandServices): FocusMode {
  if (!focusMode) {
    focusMode = new FocusMode({
      eventBus: services.eventBus,
      focusEditor: () => {
        const ih = services.getInputHandler();
        if (!ih) return;
        // 문서를 아직 한 번도 클릭하지 않았으면 캐럿이 놓이지 않아 입력이 무시된다
        // (빈 문서의 "클릭하여 입력" 안내 상태). 배명훈 모드는 들어오자마자 쓰는
        // 화면이므로 여기서 캐럿을 놓아 준다. 이미 편집 중이면 포커스만 되돌린다.
        if (ih.isActive()) ih.focus();
        else ih.activateWithCaretPosition();
      },
      getDocumentStats: () => documentStats(services),
      getZoom: () => services.getViewportManager()?.getZoom() ?? null,
      setZoom: (zoom) => services.getViewportManager()?.setZoom(zoom),
      getFitWidthZoom: () => {
        if (services.wasm.pageCount === 0) return null;
        const container = document.getElementById('scroll-container');
        if (!container) return null;
        return calculateFitWidthZoom(container.clientWidth, services.wasm.getPageInfo(0).width);
      },
    });
  }
  return focusMode;
}

/** 이미 만들어진 컨트롤러. 아직 한 번도 진입하지 않았으면 null */
export function currentFocusMode(): FocusMode | null {
  return focusMode;
}

/** 메뉴의 `data-rate` 는 문자열이다 — 숫자 단계와 'max' 를 갈라 읽는다 */
function readCheerRate(raw: string | undefined): FocusCheerRate {
  return normalizeCheerRate(raw === 'max' ? 'max' : Number(raw));
}

/**
 * 메뉴 항목의 켜짐 표시를 현재 설정과 맞춘다.
 *
 * 설정 항목들은 대화상자로 옮겨서(ui/focus-settings-dialog.ts) 지금 메뉴에 남은 것은
 *  하나다. 나머지 조회는 맞는 요소가 없으면 조용히 지나가므로, 명령
 * 팔레트처럼 같은 data-cmd 를 쓰는 다른 표면이 생겼을 때를 위해 남겨 둔다.
 */
export function syncFocusMenu(): void {
  const s = userSettings.getFocusSettings();
  const flags: [string, boolean][] = [
    ['focus:toggle-confetti', s.confetti],
    ['focus:toggle-sound', s.sound],
    ['focus:toggle-praise', s.praise],
    ['focus:toggle-typewriter', s.typewriter],
    ['focus:toggle-startup', s.startInFocusMode],
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
  document.querySelectorAll('[data-cmd="focus:cheer-rate"]').forEach((el) => {
    el.classList.toggle('active', readCheerRate((el as HTMLElement).dataset.rate) === s.cheerRate);
  });
  document.querySelectorAll('[data-cmd="focus:zoom"]').forEach((el) => {
    const zoom = Number((el as HTMLElement).dataset.zoom ?? '0');
    el.classList.toggle('active', zoom === s.zoomPercent);
  });
  document.querySelectorAll('[data-cmd="focus:theme"]').forEach((el) => {
    el.classList.toggle('active', (el as HTMLElement).dataset.focusTheme === s.theme);
  });
  document.querySelectorAll('[data-cmd="focus:toggle"]').forEach((el) => {
    el.classList.toggle('active', focusMode?.isActive() === true);
  });
}

/** 켜고 끄는 설정 하나를 커맨드로 만든다 */
function toggleSetting(
  id: string,
  label: string,
  key: 'confetti' | 'sound' | 'praise' | 'typewriter' | 'startInFocusMode',
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
    // 설정 열넷을 서브메뉴 스물다섯 줄로 늘어놓았더니 큰 화면에서도 아래가 잘렸다.
    // 메뉴는 명령을 고르는 자리이지 설정판이 아니다.
    id: 'focus:settings',
    label: '배명훈 모드 설정',
    execute(services) {
      new FocusSettingsDialog(() => {
        syncFocusMenu();
        getFocusMode(services).refresh();
      }).show();
    },
  },
  {
    id: 'focus:toggle',
    label: '배명훈 모드',
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
  toggleSetting('focus:toggle-startup', '켤 때 배명훈 모드로 시작', 'startInFocusMode'),
  {
    id: 'focus:theme',
    label: '배명훈 모드 테마',
    execute(services, params) {
      const theme = params?.focusTheme === 'light' ? 'light' : 'dark';
      userSettings.updateFocusSettings({ theme });
      syncFocusMenu();
      getFocusMode(services).refresh();
    },
  },
  {
    id: 'focus:zoom',
    label: '배명훈 모드 배율',
    execute(services, params) {
      const zoom = Number(params?.zoom ?? 130);
      userSettings.updateFocusSettings({
        zoomPercent: Number.isFinite(zoom) ? Math.min(400, Math.max(50, zoom)) : 130,
      });
      syncFocusMenu();
      getFocusMode(services).refresh();
    },
  },
  {
    // 머리글의 배속 단추와 같은 설정을 가리킨다 — 배명훈 모드에 들어가지 않고도
    // 바꿀 수 있게 메뉴에도 둔다. refresh() 가 단추 표시까지 맞춰 준다.
    id: 'focus:cheer-rate',
    label: '응원 배속',
    execute(services, params) {
      const cheerRate = readCheerRate(params?.rate as string | undefined);
      userSettings.updateFocusSettings({ cheerRate });
      syncFocusMenu();
      getFocusMode(services).refresh();
    },
  },
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
