import type { CommandDef } from '../types';
import { setThemeMode, syncThemeMenu, type EffectiveTheme } from '../../core/theme';
import { userSettings, type ThemeMode } from '../../core/user-settings';
import { GridSettingsDialog } from '../../ui/grid-settings-dialog';
import {
  type GridOffsetMm,
  type GridViewSettings,
  getGridViewSettings,
  setGridViewSettings,
  toggleGridVisibility,
} from '../../view/grid-settings';
import { HWPUNIT_PER_MM } from '../../core/hwp-constants';
import { calculateFitPageZoom, calculateFitWidthZoom } from '../../view/zoom-fit';
import { toRenderZoom } from '../../core/display-calibration.ts';
import { DisplayCalibrationDialog } from '../../ui/display-calibration-dialog';

const PX_TO_MM = 25.4 / 96;

/**
 * 배율 고정값 커맨드 생성 헬퍼.
 *
 * 사용자가 고른 배율은 "용지 실물 대비" 비율이다 — 100% 면 종이와 1:1.
 * 화면 보정값을 곱해야 실제 렌더 배율이 된다. 보정 전이면 곱이 1 이라 종전과 같다.
 */
function zoomLevel(pct: number, shortcutLabel?: string): CommandDef {
  return {
    id: `view:zoom-${pct}`,
    label: `${pct}%`,
    shortcutLabel,
    execute(services) {
      services.getViewportManager()?.setZoom(toRenderZoom(pct / 100));
    },
  };
}

function themeModeCommand(mode: ThemeMode, label: string): CommandDef {
  return {
    id: `view:theme-${mode}`,
    label,
    execute(services) {
      const effective: EffectiveTheme = setThemeMode(mode);
      syncThemeMenu(mode);
      services.eventBus.emit('theme-changed', { mode, effective });
      services.eventBus.emit('document-view-changed');
    },
  };
}

/**
 * 켜짐 표시를 맞춘다.
 *
 * 같은 `data-cmd` 가 메뉴 항목과 도구 모음 버튼 양쪽에 있으므로 둘 다 잡힌다.
 * 버튼에는 `aria-pressed` 도 붙인다 — 배경색만으로 알리면 색을 구별하기 어려운
 * 사람에게는 켜진 것인지 알 길이 없다.
 */
export function markToggleState(cmd: string, on: boolean): void {
  document.querySelectorAll(`[data-cmd="${cmd}"]`).forEach((el) => {
    el.classList.toggle('active', on);
    if (el.tagName === 'BUTTON') {
      el.setAttribute('aria-pressed', String(on));
    } else if (el.classList.contains('md-item')) {
      // 메뉴 항목은 button 이 아니라 div 다. 화면에는 왼쪽 칸의 체크로 켜짐이 보이지만
      // (menu-bar.css 의 `.md-item.active::before`) 그것만으로는 화면 낭독기에 아무
      // 소리도 나지 않는다. 켜고 끄는 항목이라는 것과 지금 켜졌는지를 함께 알린다.
      // 이미 역할이 적힌 항목(테마 고르기의 menuitemradio 등)은 건드리지 않는다.
      if (!el.hasAttribute('role')) el.setAttribute('role', 'menuitemcheckbox');
      el.setAttribute('aria-checked', String(on));
    }
  });
}

export function syncTextMarkMenu(showControlCodes: boolean, showParagraphMarks: boolean): void {
  markToggleState('view:ctrl-mark', showControlCodes);
  markToggleState('view:para-mark', showParagraphMarks);
}

/**
 * view:toggle-clip 내부 상태(clipEnabled). true=잘림 적용, false=오버플로 표시(짤림보기 켜짐).
 * 저장된 짤림보기 설정(clipView)에서 초기화한다. clipEnabled = !clipView.
 */
let clipEnabled = !userSettings.getViewSettings().clipView;

/**
 * 짤림보기(잘림 보기) 메뉴 활성 상태와 내부 상태를 동기화한다.
 * 버튼 active = 잘림 미적용(오버플로 보임) = !enabled.
 * 문서 로드 시 저장된 설정 적용에도 사용한다.
 */
export function syncClipMenu(enabled: boolean): void {
  clipEnabled = enabled;
  markToggleState('view:toggle-clip', !enabled);
}

function refreshCaretAfterViewChange(services: Parameters<CommandDef['execute']>[0]): void {
  const inputHandler = services.getInputHandler() as any;
  inputHandler?.updateCaret?.(true);
  requestAnimationFrame(() => inputHandler?.updateCaret?.(true));
}

interface GridOriginMetrics {
  defaults: Record<'page' | 'paper', GridOffsetMm>;
  bases: Record<'page' | 'paper', GridOffsetMm>;
}

function getGridOriginMetrics(services: Parameters<CommandDef['execute']>[0]): GridOriginMetrics {
  let pageIndex = 0;
  const ih = services.getInputHandler();
  const cursor = ih ? (ih as any).cursor : null;
  if (typeof cursor?.rect?.pageIndex === 'number') {
    pageIndex = cursor.rect.pageIndex;
  }

  const pageInfo = services.wasm.getPageInfo(pageIndex);
  const documentInfo = services.wasm.getDocumentInfo();
  const sectionDef = services.wasm.getSectionDef(pageInfo.sectionIndex ?? 0);
  const pageBorderFill = services.wasm.getPageBorderFill(pageInfo.sectionIndex ?? 0);
  const rawPageDef = services.wasm.getPageDef(pageInfo.sectionIndex ?? 0);
  const paperX = roundMm(rawPageDef.marginLeft / HWPUNIT_PER_MM);
  const paperBaseY = roundMm((rawPageDef.marginTop + rawPageDef.marginHeader) / HWPUNIT_PER_MM);
  const hwp3PageYOffsetY = documentInfo.hwp3Variant && pageBorderFill.basis === 'page'
    ? roundMm(sectionDef.columnSpacing / HWPUNIT_PER_MM)
    : 0;
  const paperDefaultY = hwp3PageYOffsetY > 0
    ? roundMm(
      roundMm(rawPageDef.marginTop / HWPUNIT_PER_MM)
      + roundMm(rawPageDef.marginHeader / HWPUNIT_PER_MM)
      + hwp3PageYOffsetY,
    )
    : paperBaseY;
  const pageDefaultY = roundMm(paperDefaultY - paperBaseY);

  return {
    defaults: {
      page: { x: 0, y: pageDefaultY },
      paper: {
        x: paperX,
        y: paperDefaultY,
      },
    },
    bases: {
      page: {
        x: paperX,
        y: paperBaseY,
      },
      paper: { x: 0, y: 0 },
    },
  };
}

function roundMm(value: number): number {
  return Math.round(value * 100) / 100;
}

function applyGridDefaults(settings: GridViewSettings, defaults: GridOriginMetrics['defaults']): GridViewSettings {
  if (!closeMm(settings.offsetXmm, 0) || !closeMm(settings.offsetYmm, 0)) {
    return settings;
  }
  const defaultOffset = defaults[settings.origin];
  return {
    ...settings,
    offsetXmm: defaultOffset.x,
    offsetYmm: defaultOffset.y,
  };
}

function closeMm(a: number, b: number): boolean {
  return Number.isFinite(a) && Math.abs(a - b) < 0.01;
}

export const viewCommands: CommandDef[] = [
  {
    id: 'view:zoom-in',
    label: '확대',
    icon: 'icon-zoom-menu-in',
    shortcutLabel: 'Shift+Num +',
    execute(services) {
      const vm = services.getViewportManager();
      if (vm) vm.smoothZoomBy(0.1);
    },
  },
  {
    id: 'view:zoom-out',
    label: '축소',
    icon: 'icon-zoom-menu-out',
    shortcutLabel: 'Shift+Num -',
    execute(services) {
      const vm = services.getViewportManager();
      if (vm) vm.smoothZoomBy(-0.1);
    },
  },
  {
    id: 'view:zoom-fit-page',
    label: '쪽 맞춤',
    shortcutLabel: 'Ctrl+G,P',
    execute(services) {
      const vm = services.getViewportManager();
      if (!vm || services.wasm.pageCount === 0) return;
      const container = document.getElementById('scroll-container')!;
      const pi = services.wasm.getPageInfo(0);
      // pi.width/height는 이미 px 단위 (96dpi 기준)
      vm.setZoom(calculateFitPageZoom(
        container.clientWidth,
        container.clientHeight,
        pi.width,
        pi.height,
      ));
    },
  },
  {
    id: 'view:zoom-fit-width',
    label: '폭 맞춤',
    shortcutLabel: 'Ctrl+G,W',
    execute(services) {
      const vm = services.getViewportManager();
      if (!vm || services.wasm.pageCount === 0) return;
      const container = document.getElementById('scroll-container')!;
      const pi = services.wasm.getPageInfo(0);
      // pi.width는 이미 px 단위 (96dpi 기준)
      vm.setZoom(calculateFitWidthZoom(container.clientWidth, pi.width));
    },
  },
  {
    id: 'view:calibrate-display',
    label: '화면 보정…',
    execute(services) {
      new DisplayCalibrationDialog(() => {
        // 보정이 바뀌면 지금 배율의 "실물 대비" 의미도 바뀐다 — 100% 로 다시 맞춘다.
        services.getViewportManager()?.setZoom(toRenderZoom(1));
        services.eventBus.emit('document-view-changed');
      }).show();
    },
  },
  zoomLevel(50),
  zoomLevel(75),
  zoomLevel(100, 'Ctrl+G,Q'),
  zoomLevel(125),
  zoomLevel(150),
  zoomLevel(200),
  zoomLevel(300),
  themeModeCommand('system', '시스템 설정'),
  themeModeCommand('light', '밝게'),
  themeModeCommand('dark', '어둡게'),
  // ─── 보기 메뉴: 표시/숨기기 ─────────────────────────
  {
    id: 'view:form-mode',
    label: '양식 모드',
    canExecute: (ctx) => ctx.hasDocument,
    execute(services) {
      const next = services.getContext().isFormMode ? 'normal' : 'form';
      services.setEditMode(next);
    },
  },
  {
    id: 'view:ctrl-mark',
    label: '조판 부호',
    icon: 'icon-ctrl-mark',
    shortcutLabel: 'Ctrl+G,C',
    canExecute: (ctx) => ctx.hasDocument,
    execute(services) {
      const ctx = services.getContext();
      const next = !ctx.showControlCodes;
      /*
       * 문단부호 깃발은 건드리지 않는다.
       *
       * 예전에는 "조판부호는 문단부호를 포함한다" 며 두 깃발을 함께 켰다. 그래서 조판부호
       * 하나를 누르면 문단부호 버튼에도 불이 들어왔다 — 누르지 않은 버튼이 켜지는 것으로
       * 보인다.
       *
       * 그런데 함께 켤 이유가 없었다. 렌더러가 이미 두 깃발을 OR 로 묶는다
       * (`paint/builder.rs` 의 `show_paragraph_marks || show_control_codes`,
       * `renderer/skia/text_replay.rs` 의 `if !show_paragraph_marks &&
       * !show_control_codes { 건너뜀 }`). 조판부호만 켜도 문단 표시는 그대로 나온다.
       * 두 번째 깃발은 화면에 아무 영향이 없고 UI 상태와 저장된 설정만 어긋나게 했다.
       *
       * 끌 때도 마찬가지였다. 함께 껐으므로 사용자가 따로 켜 둔 문단부호가 조판부호를
       * 끄는 순간 조용히 사라졌다.
       */
      services.wasm.setShowControlCodes(next);
      userSettings.setShowControlCodes(next);
      syncTextMarkMenu(next, ctx.showParagraphMarks);
      refreshCaretAfterViewChange(services);
      services.eventBus.emit('document-view-changed');
    },
  },
  {
    id: 'view:para-mark',
    label: '문단 부호',
    icon: 'icon-para-mark',
    shortcutLabel: 'Ctrl+G,T',
    canExecute: (ctx) => ctx.hasDocument,
    execute(services) {
      const ctx = services.getContext();
      const next = !ctx.showParagraphMarks;
      services.wasm.setShowParagraphMarks(next);
      userSettings.setShowParagraphMarks(next);
      syncTextMarkMenu(ctx.showControlCodes, next);
      refreshCaretAfterViewChange(services);
      services.eventBus.emit('document-view-changed');
    },
  },
  {
    id: 'view:border-transparent',
    label: '투명 선',
    shortcutLabel: 'Alt+V,T',
    canExecute: (ctx) => ctx.hasDocument,
    execute(services) {
      // WASM 실제 상태를 읽어 토글 — 셀 진입 자동 ON 등으로 인한 초기값 불일치 방지
      const next = !services.wasm.getShowTransparentBorders();
      services.wasm.setShowTransparentBorders(next);
      markToggleState('view:border-transparent', next);
      services.eventBus.emit('transparent-borders-changed', next);
      services.eventBus.emit('document-view-changed');
    },
  },
  {
    id: 'view:toggle-clip',
    label: '잘림 보기',
    canExecute: (ctx) => ctx.hasDocument,
    execute(services) {
      const next = !clipEnabled;
      services.wasm.setClipEnabled(next);
      userSettings.setClipView(!next); // 짤림보기 켜짐(clipView) = 잘림 미적용(!clipEnabled)
      syncClipMenu(next);
      services.eventBus.emit('document-view-changed');
    },
  } satisfies CommandDef,
  {
    id: 'view:toggle-grid',
    label: '격자 보기',
    icon: 'icon-grid',
    canExecute: (ctx) => ctx.hasDocument,
    execute(services) {
      const next = toggleGridVisibility();
      markToggleState('view:toggle-grid', next.visible);
      services.eventBus.emit('grid-view-changed', next);
    },
  },
  {
    id: 'view:grid-settings',
    label: '격자 설정',
    icon: 'icon-grid',
    canExecute: (ctx) => ctx.hasDocument,
    execute(services) {
      const ih = services.getInputHandler();
      const originMetrics = getGridOriginMetrics(services);
      new GridSettingsDialog(
        applyGridDefaults(getGridViewSettings(), originMetrics.defaults),
        originMetrics.bases,
        ih?.getGridStepMm() ?? 3,
        (settings, moveStepMm) => {
          const next = setGridViewSettings(settings);
          ih?.setGridStep(moveStepMm);
          markToggleState('view:toggle-grid', next.visible);
          services.eventBus.emit('grid-view-changed', next);
        },
      ).show();
    },
  },
  (() => {
    let visible: boolean | null = null;
    return {
      id: 'view:toolbox-basic',
      label: '기본',
      execute() {
        const el = document.getElementById('icon-toolbar');
        if (!el) return;
        if (visible === null) visible = getComputedStyle(el).display !== 'none';
        visible = !visible;
        el.style.display = visible ? '' : 'none';
        markToggleState('view:toolbox-basic', visible);
      },
    } satisfies CommandDef;
  })(),
  (() => {
    let visible: boolean | null = null;
    return {
      id: 'view:toolbox-format',
      label: '서식',
      execute() {
        const el = document.getElementById('style-bar');
        if (!el) return;
        if (visible === null) visible = getComputedStyle(el).display !== 'none';
        visible = !visible;
        el.style.display = visible ? '' : 'none';
        markToggleState('view:toolbox-format', visible);
      },
    } satisfies CommandDef;
  })(),
];
