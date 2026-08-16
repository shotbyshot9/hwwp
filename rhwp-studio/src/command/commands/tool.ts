import type { CommandDef } from '../types';
import { OptionsDialog } from '../../ui/options-dialog';
import { AboutDialog } from '../../ui/about-dialog';

export const toolCommands: CommandDef[] = [
  {
    id: 'tool:options',
    label: '환경 설정',
    execute(services) {
      const dlg = new OptionsDialog(services.eventBus);
      dlg.show();
    },
  },
  {
    // 제품 정보는 도구 메뉴에 둔다 — 파일 메뉴에 있으면 파일 조작 사이에 끼어 어색하다.
    id: 'tool:about',
    label: '제품 정보',
    icon: 'icon-help',
    execute() {
      new AboutDialog().show();
    },
  },
];
