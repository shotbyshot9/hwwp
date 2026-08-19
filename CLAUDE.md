# CLAUDE.md

hwwp 저장소에서 작업할 때의 지침이다.

## 이 저장소가 무엇인가

hwwp 는 [rhwp](https://github.com/edwardkim/rhwp)(MIT)를 갈라 만든 **작가용 HWP
워드프로세서**다. 문서 엔진은 rhwp 그대로 쓰고, 그 위에 집중 집필 모드(개발 중 이름
'배명훈 모드')와 구글 드라이브 연동을 얹었다.

배경과 설계 판단은 [`HWWP.md`](HWWP.md)에 있다. 제품 소개는 [`README.md`](README.md).

## 구조

| 경로 | 무엇 |
| --- | --- |
| `src/` | Rust 문서 엔진 (파싱·렌더링·편집). 단위 시험은 이 안에 `#[cfg(test)]` 로 있다 |
| `pkg/` | wasm-pack 산출물. **저장소에 커밋한다** — 배포 환경에 Rust 툴체인이 없다 |
| `rhwp-studio/` | 웹앱 (TypeScript). 사람이 보는 화면은 전부 여기다 |
| `tests/`, `samples/` | 엔진 통합 시험과 시험 문서 |
| `assets/fonts/` | 배포에 실리는 글꼴. vite 가 여기서 `dist/fonts` 로 복사한다 |

디렉터리와 크레이트 이름은 `rhwp` 그대로다. **hwwp 는 제품이고 rhwp 는 그 엔진이다** —
이름이 갈리는 것이 정확하다. 사정은 `HWWP.md` 에 적었다.

## 명령

```bash
# 엔진 (Rust 를 고쳤을 때만)
cargo test --lib
wasm-pack build --target web --out-dir pkg

# 웹앱
cd rhwp-studio
node node_modules/typescript/bin/tsc --noEmit
node --test tests/*.test.ts
npm run build
```

`main` 에 푸시하면 Cloudflare 가 자동으로 다시 빌드해 `hwwp.kr` 에 올린다.

## 반드시 지킬 것

**`pkg/.gitignore` 함정.** `wasm-pack build` 를 돌리면 이 파일이 `*` 한 줄로 덮인다.
그대로 커밋하면 `pkg/` 가 통째로 빠져 배포 빌드가 죽는다. 엔진을 새로 빌드했으면 이
파일을 주석만 남은 상태로 되돌리고 `pkg/` 를 함께 커밋한다.

**시험은 줄바꿈에 취약하다.** git 의 autocrlf 때문에 작업 사본이 CRLF 가 되면, 개행을
글자 그대로 찾는 검사가 실패한다. 소스를 읽는 시험은 `.replace(/\r\n/g, '\n')` 로
맞춘다.

**화면을 바꿨으면 실제로 열어 확인한다.** 브라우저에서 계산값을 재고 결과를 옮겨 적는다.
"고쳤다" 를 눈으로 확인하지 않은 채 보고하지 않는다.

## UI 규칙

명칭·CSS 접두어·시각 규칙(모서리·그림자·호버·아이콘)은
[`rhwp-studio/UI_CONVENTIONS.md`](rhwp-studio/UI_CONVENTIONS.md)에 있다. 새 스타일은 거기
적힌 토큰만 쓴다.

색은 글자색과 배경색이 **같은 열두 개**를 나눠 쓴다(`rhwp-studio/src/ui/color-menu.ts`).
어떤 배경이든 검은 글자든 흰 글자든 한쪽은 읽혀야 한다는 계약이 시험으로 걸려 있다.

## 라이선스

MIT. rhwp 의 원저작권 고지는 `LICENSE` 와 제품 정보 대화상자에서 지우지 않는다 — MIT 가
사본에 남길 것을 요구한다. 외부 자산 고지는
[`THIRD_PARTY_LICENSES.md`](THIRD_PARTY_LICENSES.md)에 모았고, 배포물에 실리는 고지 전문은
`rhwp-studio/scripts/gen-notices.mjs` 가 실제 의존성에서 만든다.
