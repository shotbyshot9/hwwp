<p align="center">
  <img src="rhwp-studio/public/icons/icon-256.png" alt="hwwp" width="120" />
</p>

<h1 align="center">hwwp</h1>

<p align="center">
  <strong>Homeground of Writer Word Processor</strong><br/>
  원고를 완성하고 싶은 작가를 위한 HWP 편집기
</p>

<p align="center">
  <a href="https://hwwp.kr"><strong>hwwp.kr</strong></a> ·
  <a href="HWWP.md">설계 노트</a> ·
  <a href="https://github.com/edwardkim/rhwp">문서 엔진 rhwp</a>
</p>

---

브라우저에서 HWP·HWPX 문서를 열고 고치고 저장한다. 설치할 것이 없고, 맥과 리눅스에서도
같은 화면이 나온다. 무료이고 광고가 없다.

문서 엔진(파싱·렌더링·편집)은 [rhwp](https://github.com/edwardkim/rhwp)(MIT) 그대로
쓴다. hwwp 가 그 위에 얹는 것은 **작가를 위한 화면**이다.

## 배명훈 모드

배명훈 작가의 단편 〈홈, 어웨이〉(소설집
[『미래과거시제』](https://product.kyobobook.co.kr/detail/S000201293357) 수록)에
"문장을 쓰면 환호하고 박수쳐 주는 텍스트 에디터"가 나온다. 그걸 만들었다.

`Alt+Shift+F` 로 들어간다. 메뉴와 도구 상자가 사라지고 종이만 남는다. 문장을 끝낼
때마다 화면 가장자리에서 색종이가 터지고 박수 소리가 난다. 쉬지 않고 이어 쓸수록
소리가 커진다.

자세한 것은 [HWWP.md](HWWP.md)에 있다.

## 문서는 어디로 가는가

**서버가 없다.** 문서는 브라우저 안에서 처리되고, 저장은 사용자 본인의 구글 드라이브로만
간다. 만든 사람의 서버를 거치지 않는다. 드라이브 권한은 `drive.file` 하나만 쓴다 —
앱이 만든 파일 외에는 볼 수 없는 범위다.

[개인정보처리방침](https://hwwp.kr/privacy) · [서비스 약관](https://hwwp.kr/terms)

## 이 저장소에 대해

혼자 만듭니다. 이슈와 PR 은 환영하지만 **답이 느릴 수 있습니다.** 급한 사정이 있는
일에 기대지 말아 주세요.

버그를 알려주실 때는 어떤 문서에서 무엇을 하다가 그랬는지 적어 주시면 좋습니다. HWP 는
예외 사례가 많은 형식이라, 재현되는 문서 하나가 설명 열 줄보다 낫습니다.

**문서 엔진 쪽 문제라면** [rhwp](https://github.com/edwardkim/rhwp)에 올리시는 편이
더 많은 사람에게 도움이 됩니다. 파싱·렌더링·저장이 거기에 해당합니다.

### 미리 알려두는 것

보안 검사 도구가 아래 둘을 잡을 수 있습니다. 둘 다 알고 둔 것입니다.

- **구글 API 키와 클라이언트 ID** — 브라우저 번들에 실리는 값이라 원래 공개됩니다.
  숨길 수 있는 종류의 값이 아니고, 실제 방어는 구글 콘솔의 사용처 제한입니다.
  사정은 [`drive-config.ts`](rhwp-studio/src/storage/drive-config.ts)에 적었습니다.
  **클라이언트 보안 비밀번호는 저장소에 없습니다.**
- **`web/certs/localhost-*.pem`** — rhwp 초기 커밋에 있던 자체 서명
  `CN=localhost` 개발 인증서입니다. 이미 지웠고 현재 트리에 없습니다. `localhost`
  외에는 쓸 수 없는 키라 값어치가 없습니다.

## 빌드

Rust 툴체인과 Node 가 필요하다.

```bash
wasm-pack build --target web --out-dir pkg
```

```bash
cd rhwp-studio && npm install && npm run dev
```

WASM 산출물(`pkg/`)은 저장소에 커밋해 둔다. 배포 환경에 Rust 툴체인이 없어서다.
엔진을 새로 빌드했으면 `pkg/.gitignore` 를 비운 상태로 되돌리고 함께 커밋해야 한다.

## 라이선스

MIT. 자세한 것은 [LICENSE](LICENSE)에 있다.

- hwwp (이 파생물의 변경분) — © 2026 류지원
- rhwp (문서 엔진 원본) — © 2025-2026 Edward Kim, MIT

함께 쓰는 글꼴·음원·아이콘·외부 서비스의 고지는
[THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md)에 모아 두었다.

hwwp 는 (주)한글과컴퓨터와 아무런 관련이 없으며, HWP·HWPX 파일 형식 호환을 목적으로
하는 독립 프로젝트입니다.
