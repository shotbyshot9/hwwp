---
kind: reference
status: active
canonical: mydocs/manual/rhwp_studio_ui_conventions.md
last_verified: 2026-08-18
---

# rhwp-studio UI 명칭과 CSS 접두어

코드, 이슈, PR, 검증 문서에서 rhwp-studio의 UI 영역을 아래 명칭으로 통일한다.

| 한국어 명칭 | HTML id | 설명 |
| --- | --- | --- |
| 제목 줄 | `#title-bar` | 문서 이름·저장 상태·구글 드라이브 연결 |
| 메뉴바 | `#menu-bar` | 파일·편집·보기·입력·서식·쪽·표 메뉴 |
| 도구 상자 | `#icon-toolbar` | 명령 아이콘과 라벨 버튼 모음 |
| 서식 도구 모음 | `#style-bar` | 스타일·글꼴·크기·정렬 등 서식 제어 |
| 편집 영역 | `#scroll-container` | 문서 페이지 렌더링과 스크롤 영역 |
| 상태 표시줄 | `#status-bar` | 쪽·구역·편집 모드·확대 배율 표시 |
| 집중 작업 모드 | `#focus-mode` | 집중 모드 오버레이(HUD·나가기 버튼). 활성 시 `body.fm-active` |

## CSS 접두어

| 접두어 | 대상 |
| --- | --- |
| `tb-` | 도구 상자 요소 |
| `sb-` | 서식 도구 모음 요소 |
| `stb-` | 상태 표시줄 요소 |
| `md-` | 메뉴바 드롭다운 요소 |
| `dialog-` | 대화상자 공통 요소 |
| `cs-` | 글자 모양 대화상자 |
| `ps-` | 문단 모양 대화상자 |
| `fm-` | 집중 작업 모드 오버레이·HUD·폭죽 캔버스 |
| `tbar-` | 제목 줄 요소 |

새 UI 영역이나 접두어를 도입할 때는 기존 DOM과 CSS에서 실제 사용 여부를 확인하고 이 표를 함께
갱신한다.

## 시각 규칙

새 스타일을 쓸 때 아래 넷은 토큰과 규칙을 따른다. 어긴 것은
`rhwp-studio/tests/icon-set-contract.test.ts` 가 잡는다.

| 항목 | 규칙 |
| --- | --- |
| 모서리 | `--radius-control`(4px, 누르는 것) · `--radius-container`(8px, 담는 것) · `--radius-pill`(999px). px 를 직접 쓰지 않는다 |
| 그림자 | `--shadow-light` · `--shadow-dropdown` · `--shadow-dialog`. 가로 오프셋은 0 이다 — 빛은 위에서 온다 |
| 호버 | 배경만 바꾼다. 테두리 색은 상태(선택·활성·포커스)를 위해 아껴 둔다. 예외는 `.tbar-title` — 그 테두리가 "여기는 입력칸" 이라는 유일한 신호다 |
| 아이콘 | Lucide(ISC) 개별 SVG 를 `public/icons/ui/` 에 두고 마스크 + `currentColor` 로 그린다. 획 굵기는 1.75. **도구 상자와 상태 표시줄에만 쓴다** — 메뉴 드롭다운은 글자만 쓴다  |

`--radius-sm`·`--radius-md`·`--radius-lg` 는 예전 이름의 별칭이다. 새로 쓰지 않는다.

메뉴 드롭다운의 왼쪽 칸(24px)은 **상태를 위한 자리**다. 켜진 항목은 `.md-item.active` 가
체크(`✓`)를 그리고, `markToggleState()`(`command/commands/view.ts`)가 `menuitemcheckbox` ·
`aria-checked` 를 붙인다. 새 토글을 만들 때 `classList.toggle('active')` 를 직접 부르지 말고
이 함수를 지나가게 한다 — 그래야 화면 낭독기에도 켜짐이 들린다.
