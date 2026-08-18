# Third-Party Licenses

hwwp(및 그 원본인 rhwp)가 사용하는 서드파티 라이브러리 및 리소스의 라이선스 목록이다.

hwwp 자체는 rhwp(MIT, © 2025-2026 Edward Kim)의 파생물이며 MIT 로 배포한다. 원본
고지는 저장소 루트 `LICENSE` 와 앱의 `도구 → 제품 정보` 양쪽에 남아 있다.

기준 파일:

- `Cargo.toml` / `Cargo.lock` (`rhwp` v0.8.4)
- `rhwp-studio/package.json` / `rhwp-studio/package-lock.json`
- `rhwp-chrome/package.json` / `rhwp-chrome/package-lock.json`
- `rhwp-firefox/package.json` / `rhwp-firefox/package-lock.json`
- `rhwp-vscode/package.json` / `rhwp-vscode/package-lock.json`
- `assets/fonts/FONTS.md`

---

## Rust 크레이트

### 직접 의존성

| 크레이트 | 버전 | 라이선스 | 저장소 | 비고 |
|---------|------|---------|--------|------|
| aes | 0.9.2 | MIT OR Apache-2.0 | RustCrypto/block-ciphers | HWPX 암호화 |
| base64 | 0.23.1 | MIT OR Apache-2.0 | marshallpierce/rust-base64 | Base64 인코딩 |
| blake3 | 1.8.6 | CC0-1.0 OR Apache-2.0 OR Apache-2.0 WITH LLVM-exception | BLAKE3-team/BLAKE3 | 해시/진단 |
| byteorder | 1.5.0 | Unlicense OR MIT | BurntSushi/byteorder | 바이너리 endian 처리 |
| cbc | 0.2.1 | MIT OR Apache-2.0 | RustCrypto/block-modes | HWPX 암호화 모드 |
| cfb | 0.14.0 | MIT | mdsteele/rust-cfb | OLE Compound File |
| cipher | 0.5.2 | MIT OR Apache-2.0 | RustCrypto/traits | 암호 trait |
| codepage | 0.1.2 | Apache-2.0 OR MIT | hsivonen/codepage | 코드페이지 처리 |
| console_error_panic_hook | 0.1.7 | Apache-2.0/MIT | rustwasm/console_error_panic_hook | WASM panic hook |
| crc32fast | 1.5.0 | MIT OR Apache-2.0 | srijs/rust-crc32fast | HWP3 암호 키 검증 |
| des | 0.9.0 | MIT OR Apache-2.0 | RustCrypto/block-ciphers | HWP3 암호화 |
| ed25519-dalek | 2.2.0 | BSD-3-Clause | dalek-cryptography/curve25519-dalek | capsule 서명 |
| embedded-io | 0.7.1 | MIT OR Apache-2.0 | rust-embedded/embedded-hal | IO trait |
| encoding_rs | 0.8.35 | (Apache-2.0 OR MIT) AND BSD-3-Clause | hsivonen/encoding_rs | 문자 인코딩 |
| flate2 | 1.1.9 | MIT OR Apache-2.0 | rust-lang/flate2-rs | 압축/해제 |
| getrandom | 0.4.3 | MIT OR Apache-2.0 | rust-random/getrandom | 서명 키 난수 생성 |
| hmac | 0.13.0 | MIT OR Apache-2.0 | RustCrypto/MACs | HWPX 무결성 |
| image | 0.25.10 | MIT OR Apache-2.0 | image-rs/image | BMP/JPEG/PNG 디코딩 |
| js-sys | 0.3.102 | MIT OR Apache-2.0 | rustwasm/wasm-bindgen | WASM JS interop |
| paste | 1.0.15 | MIT OR Apache-2.0 | dtolnay/paste | 매크로 보조 |
| pbkdf2 | 0.13.0 | MIT OR Apache-2.0 | RustCrypto/password-hashes | HWPX 키 파생 |
| pcx | 0.2.5 | MIT OR Apache-2.0 OR WTFPL | kryptan/pcx | PCX 이미지 디코딩 |
| pdf-writer | 0.12.1 | MIT OR Apache-2.0 | typst/pdf-writer | PDF 출력 |
| quick-xml | 0.41.0 | MIT | tafia/quick-xml | HWPX XML 파싱 |
| resvg | 0.47.0 | Apache-2.0 OR MIT | linebender/resvg | native-skia SVG raster (optional) |
| roxmltree | 0.21.1 | MIT OR Apache-2.0 | RazrFalcon/roxmltree | XML 검증·정규화 |
| serde | 1.0.229 | MIT OR Apache-2.0 | serde-rs/serde | 직렬화 |
| serde_json | 1.0.151 | MIT OR Apache-2.0 | serde-rs/json | JSON 직렬화 |
| sha1 | 0.11.0 | MIT OR Apache-2.0 | RustCrypto/hashes | HWPX 암호 키 파생 |
| sha2 | 0.11.0 | MIT OR Apache-2.0 | RustCrypto/hashes | 서명·CAS 해시 |
| skia-safe | 0.99.0 | MIT | rust-skia/rust-skia | native-skia PNG/PDF backend (optional) |
| snafu | 0.9.2 | MIT OR Apache-2.0 | shepmaster/snafu | 에러 처리 |
| strum | 0.28.0 | MIT | Peternator7/strum | enum derive |
| subsecond | 0.7.10 | MIT OR Apache-2.0 | DioxusLabs/dioxus | 개발 핫패치 (optional) |
| subsetter | 0.2.6 | MIT OR Apache-2.0 | typst/subsetter | 폰트 subset |
| svg2pdf | 0.13.0 | MIT OR Apache-2.0 | typst/svg2pdf | SVG → PDF |
| svgtypes | 0.16.1 | Apache-2.0 OR MIT | linebender/svgtypes | SVG 값 파싱 |
| ttf-parser | 0.25.1 | MIT OR Apache-2.0 | harfbuzz/ttf-parser | 폰트 파싱 |
| unicode-properties | 0.1.4 | MIT OR Apache-2.0 | unicode-rs/unicode-properties | 유니코드 문자 분류 |
| unicode-segmentation | 1.13.3 | MIT OR Apache-2.0 | unicode-rs/unicode-segmentation | grapheme/word segmentation |
| unicode-width | 0.2.2 | MIT OR Apache-2.0 | unicode-rs/unicode-width | 문자 폭 계산 |
| usvg | 0.45.1 | Apache-2.0 OR MIT | linebender/resvg | SVG 파싱 |
| wasm-bindgen | 0.2.125 | MIT OR Apache-2.0 | rustwasm/wasm-bindgen | WASM binding |
| wasm-bindgen-test | 0.3.75 | MIT OR Apache-2.0 | rustwasm/wasm-bindgen | WASM 테스트 |
| web-sys | 0.3.102 | MIT OR Apache-2.0 | rustwasm/wasm-bindgen | Web API binding |
| zip | 8.6.0 | MIT | zip-rs/zip2 | HWPX ZIP 처리 |

### 전체 Rust 의존성 요약

`cargo metadata --locked` 기준 package entry는 247개이며, 그중 registry 또는 Git
source를 가진 외부 Rust 크레이트는 243개다. 나머지 4개는 현재 workspace 패키지다.

주요 라이선스군:

- MIT / Apache-2.0 dual license 계열
- MIT 단독
- Apache-2.0 OR MIT
- BSD-2-Clause / BSD-3-Clause
- Zlib
- Unlicense
- 0BSD
- ISC
- Unicode-DFS-2016
- CC0-1.0 / Apache-2.0 WITH LLVM-exception (`blake3`)
- WTFPL 대체 선택지 포함 (`pcx`, MIT/Apache 선택 가능)

> 모든 Rust 의존성은 MIT, Apache-2.0, BSD, Zlib, Unlicense, 0BSD, ISC 등 permissive license 계열이거나
> permissive option을 포함하며, rhwp의 MIT 라이선스와 호환된다.

---

## npm 패키지

### npm 배포 패키지

| 패키지 | 버전 | 라이선스 | 용도 |
|--------|------|---------|------|
| @rhwp/core | 0.8.4 | MIT | WASM parser/renderer API |
| @rhwp/editor | 0.8.4 | MIT | iframe 기반 웹 에디터 wrapper |

### rhwp-studio

| 패키지 | Lock 버전 | 라이선스 | 용도 |
|--------|-----------|---------|------|
| canvaskit-wasm | 0.41.1 | BSD-3-Clause | CanvasKit 렌더링 backend |
| @noble/hashes | 2.3.0 | MIT | 렌더 리소스 키와 문서 digest |
| @types/chrome | 0.2.5 | MIT | Chrome API 타입 |
| pixelmatch | 7.2.0 | ISC | 시각 diff 픽셀 비교 |
| pngjs | 7.0.0 | MIT | 시각 diff PNG 처리 |
| puppeteer-core | 25.5.0 | Apache-2.0 | E2E 테스트 / CDP 연결 |
| typescript | 7.0.2 | Apache-2.0 | TypeScript 컴파일 |
| vite | 8.2.1 | MIT | 개발 서버 + 빌드 |
| vite-plugin-pwa | 1.3.0 | MIT | PWA 빌드 보조 |
| workbox-window | 7.4.1 | MIT | Service worker runtime 보조 |

### rhwp-chrome / rhwp-firefox

| 패키지 | Lock 버전 | 라이선스 | 용도 |
|--------|-----------|---------|------|
| typescript | 7.0.2 | Apache-2.0 | TypeScript 컴파일 |
| vite | 8.2.1 | MIT | 확장 번들 빌드 |

### rhwp-vscode

| 패키지 | Lock 버전 | 라이선스 | 용도 |
|--------|-----------|---------|------|
| @types/node | 18.15.13 | MIT | Node.js 타입 |
| @types/vscode | 1.82.0 | MIT | VS Code API 타입 |
| @typescript/native | 7.0.2 | Apache-2.0 | TypeScript native preview 컴파일러 |
| copy-webpack-plugin | 14.0.0 | MIT | Webpack 파일 복사 |
| null-loader | 4.0.1 | MIT | Webpack 로더 |
| ts-loader | 9.6.2 | MIT | Webpack TypeScript 로더 |
| typescript | 6.0.2 | Apache-2.0 | TypeScript 컴파일 |
| webpack | 5.109.2 | MIT | 번들러 |
| webpack-cli | 7.2.2 | MIT | Webpack CLI |
| @noble/hashes | 2.3.0 | MIT | 문서 digest |
| canvaskit-wasm | 0.41.1 | BSD-3-Clause | 자동 선택 CanvasKit backend |

### rhwp-shared

`rhwp-shared`는 현재 별도 외부 npm 의존성이 없는 shared source package다.

---

## 웹 폰트 및 폰트 리소스

`assets/fonts/`에 포함된 canonical 폰트 목록이다. 저작권 보호가 필요한 한컴/Microsoft 폰트는 Git에
포함하지 않으며, 세부 파일 목록과 폴백 관계는 `assets/fonts/FONTS.md`를 참조한다.

| 폰트/리소스 | 라이선스 | 출처 | 비고 |
|-------------|---------|------|------|
| Pretendard (9종) | SIL Open Font License 1.1 | github.com/orioncactus/pretendard | Sans-serif fallback |
| Noto Serif KR (2종) | SIL Open Font License 1.1 | Google Fonts | Serif fallback |
| Noto Sans KR (3종) | SIL Open Font License 1.1 | Google Fonts | Sans-serif fallback |
| Nanum Myeongjo (3종) | SIL Open Font License 1.1 | Google Fonts | Serif fallback |
| Nanum Gothic (3종) | SIL Open Font License 1.1 | Google Fonts | Sans-serif fallback |
| Nanum Gothic Coding (2종) | SIL Open Font License 1.1 | Google Fonts | Monospace fallback |
| Gowun Batang (2종) | SIL Open Font License 1.1 | Google Fonts | Serif fallback |
| Gowun Dodum | SIL Open Font License 1.1 | Google Fonts | Sans-serif fallback |
| D2 Coding (2종) | SIL Open Font License 1.1 | NAVER | Monospace fallback |
| Spoqa Han Sans | SIL Open Font License 1.1 | github.com/spoqa/spoqa-han-sans | Sans-serif fallback |
| Source Han Serif K Old Hangul subset | SIL Open Font License 1.1 | Adobe / Google | 옛한글 PUA fallback, `SourceHanSerifK-OFL.txt` 동봉 |
| Latin Modern Math | GUST Font License | GUST / TeX ecosystem | 수식 fallback |
| Cafe24 써라운드 | 카페24 무료 배포 | fonts.cafe24.com | 장식체 |
| Cafe24 슈퍼매직 | 카페24 무료 배포 | fonts.cafe24.com | 장식체 |
| 행복고딕 (Happiness Sans, 4종) | 무료 배포 | 행복나눔재단 | Sans-serif fallback |

### 런타임 CDN 폰트 — 상업적 배포 시 주의

`rhwp-studio/src/core/font-loader.ts` 는 함초롬바탕/함초롬돋움을 눈누(jsdelivr) CDN 에서
불러온다. **함초롬체는 한컴 폰트이고 비상업적 사용만 허용된다.** Git 에 포함되지 않으므로
재배포는 아니다.

**현재 hwwp 는 무료 서비스로 운영하므로 켜 둔다.** 실수가 아니라 결정이다 — 함초롬체는
HWP 문서가 가장 많이 쓰는 글꼴이라, 이것이 없으면 남의 문서를 열었을 때 줄바꿈 위치가
달라진다.

수익화하면(광고·구독·유료 기능 무엇이든) 꺼야 한다:

```bash
RHWP_DISABLE_EXTERNAL_WEBFONTS=1 npm run build
```

이 스위치를 켜면 CDN 을 타지 않고 위 표의 OFL 폰트 폴백만 쓴다.

---

## 도구 모음 아이콘

도구 상자와 상태 표시줄의 아이콘 22개는 [Lucide](https://lucide.dev) 를 쓴다. 메뉴
드롭다운은 아이콘을 쓰지 않는다.

| 리소스 | 라이선스 | 비고 |
|--------|---------|------|
| `rhwp-studio/public/icons/ui/*.svg` (22개, 33KB) | ISC | Lucide (`lucide-static`). 고지 원문은 `rhwp-studio/public/icons/LICENSE.txt` 에 함께 배포한다. Feather Icons(MIT) 에서 파생된 아이콘 목록과 원본 MIT 고지도 그 안에 있다 |

빌드 시점이 아니라 저장소에 파일로 두고 쓴다 — `npm i -D lucide-static` 으로 받은 SVG 를
필요한 것만 골라 `public/icons/ui/` 에 이름을 바꿔 넣는다. 그래서 배포물에는 Lucide 전체
2027개가 아니라 실제로 쓰는 22개만 들어간다.

CSS 는 그림을 배경이 아니라 **마스크**로 쓰고 색은 `currentColor` 로 채운다
(`toolbar.css` 의 `.tb-sprite`). 아이콘이 글자색을 따라가므로 어두운 테마용 두 번째 파일이
필요 없다. 조판부호(`¶`)와 문단부호(`↵`)만은 Lucide 에 대응이 없어 글자로 그린다.

**바뀐 내력.** 원래는 rhwp 가 가져온 한컴 SVG 스프라이트 두 장
(`icon_small_ko.svg` 470KB, `icon_small_ko_dark.svg` 454KB, 합계 908KB)에서 좌표로 잘라
썼다. 아이콘은 미술저작물이라 HWP 형식 호환이라는 명분이 닿지 않고, 스프라이트는 파일
자체를 배포하는 것이었다 — 저장소에서 라이선스가 정리되지 않은 유일한 자산이었다. 두 장을
지우고 Lucide 로 갈아 끼우면서 908KB → 33KB 가 되었고 다크판이 통째로 사라졌다.
`tests/icon-set-contract.test.ts` 가 스프라이트가 되돌아오지 않는지 지킨다.

## 음원 (hwwp 추가)

배명훈 모드에서 문장을 끝낼 때마다 나는 환호·박수 음원이다. Writer's Homeground
(hwwp 이전에 같은 저자가 만든 서비스)에서 쓰던 것을 그대로 가져왔다.

| 리소스 | 라이선스 | 비고 |
|--------|---------|------|
| `rhwp-studio/public/sounds/sfx-01~15.mp3` (15개, 2.2MB) | 저작자 표시 없이 사용 가능 | 환호·박수 효과음. 저작자 표시 의무가 없음을 저자가 확인 |

음원을 불러오지 못하면 `focus/cheer-engine.ts` 가 WebAudio 로 합성한 박수로 물러나므로,
음원 없이 배포해도 기능은 동작한다.

---

## 외부 서비스 (hwwp 추가)

| 서비스 | 용도 | 비고 |
|--------|------|------|
| Google Identity Services (`accounts.google.com/gsi/client`) | 구글 드라이브 OAuth 토큰 발급 | 런타임 로드. Google API 서비스 약관 적용 |
| Google Picker API (`apis.google.com`) | 드라이브에서 문서 고르기 | 런타임 로드 |
| Google Drive API v3 | 문서 읽기·쓰기 | `drive.file` 범위만 사용 — 앱이 만들었거나 사용자가 고른 파일에만 닿는다 |

문서는 사용자 본인의 구글 드라이브에만 저장되며 hwwp 배포자의 서버를 거치지 않는다.

---

## 도구

| 도구 | 라이선스 | 용도 |
|------|---------|------|
| Docker | Apache-2.0 | WASM 빌드 환경 |
| wasm-pack | MIT OR Apache-2.0 | WASM 패키징 |
| Chrome DevTools Protocol | BSD-3-Clause | E2E 테스트 / 브라우저 자동화 |
| GitHub Actions | GitHub Terms | CI/CD |
| npm Trusted Publishing / OIDC | npm Terms | npm 배포 |

---

## 직접 포팅한 알고리즘

### Volexity hwp-extract

- 출처: [volexity/hwp-extract](https://github.com/volexity/hwp-extract), commit
  `e5f8b5e1590dee973630666e687e919fa70da2e2`
- 참조 파일: `src/hwp_extract/encrypt.py`
- 적용 위치: `src/parser/crypto.rs`의 HWP5 EncryptVersion 4 키 파생 및 비트 단위
  AES-CFB 복호화
- 라이선스: BSD-3-Clause

Modified BSD License

_Copyright © `2024`, `Volexity, Inc`_

_All rights reserved._

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright
   notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright
   notice, this list of conditions and the following disclaimer in the
   documentation and/or other materials provided with the distribution.
3. Neither the name of the `Volexity, Inc` nor the
   names of its contributors may be used to endorse or promote products
   derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL `Volexity, Inc` BE LIABLE FOR ANY
DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

---

## 참조한 오픈소스 프로젝트 (스펙·설계 참조)

rhwp는 아래 프로젝트들의 **코드를 직접 복사하지 않으며**, 공개된 스펙 정보(enum 값·속성 기본값·태그 이름·검증 규칙 등)만 참조한다.
Apache-2.0 라이선스 고지 의무는 본 문서, 관련 기술 문서, 그리고 각 참조 파일의 헤더 주석으로 충족한다.

| 프로젝트 | 라이선스 | 참조 범위 | rhwp 위치 |
|---------|---------|----------|-----------|
| [hancom-io/hwpx-owpml-model](https://github.com/hancom-io/hwpx-owpml-model) | Apache-2.0 © 2022 Hancom Inc. | HWPX enum 정의, 속성 기본값, 태그 전체 집합, canonical 속성·자식 순서 | `src/serializer/hwpx/canonical_defaults.rs`, `src/serializer/hwpx/{header,table,shape,picture}.rs`, `mydocs/tech/hwpx_hancom_reference.md` |
| [hancom-io/dvc](https://github.com/hancom-io/dvc) | Apache-2.0 © 2022 Hancom Inc. | HWPX 검증 규칙 JSON 스키마, errorCode 체계 | `mydocs/tech/hwpx_dvc_reference.md` |

---

## 라이선스 호환성

rhwp는 **MIT 라이선스**로 배포된다.

- MIT, Apache-2.0, BSD, Zlib, Unlicense, 0BSD, ISC, CC0 — MIT와 호환되는 permissive license 계열
- `encoding_rs`의 BSD-3-Clause 조항은 고지 의무를 요구하며, 이 문서로 충족
- `pcx`는 WTFPL 대체 선택지를 포함하지만 MIT/Apache-2.0 선택지가 있어 rhwp MIT 배포와 호환
- 오픈 폰트는 SIL OFL 1.1 또는 GUST Font License 등 재배포 가능한 라이선스만 Git에 포함
- 저작권 보호 대상 폰트(한컴, Microsoft 등)는 Git에 포함하지 않으며 `ttfs/FONTS.md`, `assets/fonts/FONTS.md`에서 목록과 폴백만 관리

---

*이 문서는 `Cargo.toml`, `Cargo.lock`, 각 `package.json`/`package-lock.json`, `assets/fonts/FONTS.md` 기준으로 현행화되었으며, 의존성 업데이트 시 함께 갱신해야 한다.*
