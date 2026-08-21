<p align="center">
  <img src="rhwp-studio/public/icons/icon-256.png" alt="hwwp" width="120" />
</p>

<h1 align="center">hwwp</h1>

<p align="center">
  <strong>Homeground of Writer Word Processor</strong><br/>
  An HWP editor for writers who want to finish the manuscript
</p>

<p align="center">
  <a href="https://hwwp.kr"><strong>hwwp.kr</strong></a> ·
  <a href="README.md">한국어</a> ·
  <a href="https://github.com/edwardkim/rhwp">rhwp — the document engine</a>
</p>

---

Open, edit, and save HWP/HWPX documents in the browser. Nothing to install, and it looks
the same on macOS and Linux. Free, no ads.

The document engine — parsing, rendering, editing — is
[rhwp](https://github.com/edwardkim/rhwp) (MIT), used as is. What hwwp adds on top is a
screen made for writers.

HWP is the document format of Hancom Office, the standard for public paperwork in South
Korea. Outside Windows it is hard to open at all, which is the gap this fills.

## Focus mode

A short story by Korean novelist Bae Myung-hoon — *Home, Away* — features a text editor
that cheers and applauds when you finish a sentence. This is that editor.

`Alt+Shift+F`. Menus and toolbars disappear, leaving only the page. Every sentence sets
off confetti at the edges of the screen and a burst of applause. The longer you write
without stopping, the louder it gets.

The feature is called **배명훈 모드** — Bae Myung-hoon mode — and the name is used with the
author's permission. That does not make this project affiliated with the author or his
publisher, nor does it imply their endorsement or involvement.

## Where do documents go

**There is no server.** Opening and editing both happen inside the browser, and saving goes
to the user's own machine or their own Google Drive. **There is no path by which document
contents reach the author.**

The only Drive scope requested is `drive.file`. It reaches **files HWWP created, plus files
the user picked themselves in the file picker** — nothing else. HWWP cannot browse the
user's Drive.

Being a word processor, it opens any HWP document the user chooses — including documents
written by someone else, or stored in Drive. What matters is that **whatever is opened never
leaves the browser.**

See the [privacy policy](https://hwwp.kr/privacy) and
[terms of service](https://hwwp.kr/terms) for details.

## About this repository

Built by one person. Issues and pull requests are welcome, but **replies may be slow.**
Please do not depend on it for anything urgent.

When reporting a bug, say what document you were working on and what you were doing. HWP
is a format full of edge cases; one document that reproduces the problem beats ten lines
of description.

**If the problem is in the document engine** — parsing, rendering, saving — filing it at
[rhwp](https://github.com/edwardkim/rhwp) helps more people.

### Known scanner findings

Security scanners may flag these two. Both are intentional.

- **Google API key and client ID.** They ship in the browser bundle, so they are public
  by nature. They cannot be hidden; the real defense is the usage restrictions in the
  Google console. See [`drive-config.ts`](rhwp-studio/src/storage/drive-config.ts).
  **The client secret is not in this repository.**
- **`web/certs/localhost-*.pem`.** A self-signed `CN=localhost` development certificate
  from rhwp's initial commit. Already deleted; not in the current tree. The key is
  worthless — it can only vouch for `localhost`.

## Build

Requires the Rust toolchain and Node.

```bash
wasm-pack build --target web --out-dir pkg
```

```bash
cd rhwp-studio && npm install && npm run dev
```

The WASM output (`pkg/`) is committed, because the deployment environment has no Rust
toolchain. After rebuilding the engine, restore `pkg/.gitignore` to its empty state and
commit `pkg/` along with it.

## License

MIT — see [LICENSE](LICENSE).

- hwwp (changes in this derivative) — © 2026 류지원
- rhwp (the original document engine) — © 2025-2026 Edward Kim, MIT

Notices for the fonts, sounds, icons, and external services used are collected in
[THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).

hwwp is not affiliated with Hancom Inc. in any way. It is an independent project whose
purpose is compatibility with the HWP and HWPX file formats.
