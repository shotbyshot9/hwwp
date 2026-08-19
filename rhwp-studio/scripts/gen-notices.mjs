/**
 * 서드파티 저작권 고지 전문을 만든다.
 *
 * 왜 필요한가 — MIT 는 "저작권 고지와 허가 문구를 사본에 함께 남길 것" 을 요구하고,
 * Apache-2.0 도 같은 요구를 한다. 그런데 `THIRD_PARTY_LICENSES.md` 는 "quick-xml | MIT"
 * 같은 표일 뿐 고지가 아니다. 표는 무엇을 왜 쓰는지 사람에게 설명하는 문서고, 고지는
 * 권리자의 이름과 허가 문구 그 자체다. 둘은 다른 물건이라 표로 고지를 대신할 수 없다.
 *
 * 그래서 실제 의존성 목록에서 라이선스 원문을 모아 한 파일로 낸다. 손으로 관리하면
 * 의존성이 바뀔 때마다 어긋나므로 기계가 만든다.
 *
 * 왜 빌드 때 안 하나 — Cloudflare 빌드 환경에는 Rust 툴체인이 없다. `pkg/` 와 같은
 * 사정이라, 여기서 만든 결과물을 저장소에 넣어 둔다. 의존성을 바꿨으면 다시 돌린다:
 *
 *     npm run notices
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const STUDIO = resolve(HERE, '..');
const REPO = resolve(STUDIO, '..');
const OUT = resolve(STUDIO, 'public', 'THIRD_PARTY_NOTICES.txt');

/** 라이선스 원문으로 볼 파일 이름. COPYRIGHT 를 따로 두는 크레이트가 있다. */
const LICENSE_FILE = /^(licen[cs]e|copying|notice|copyright)([-_.].*)?$/i;

/** 배포물(WASM)에 실제로 들어가는 크레이트만 고른다. dev·build 의존성은 빠진다. */
function shippedCrates() {
  const out = execFileSync(
    'cargo',
    ['tree', '--target', 'wasm32-unknown-unknown', '-e', 'normal', '--prefix', 'none', '-f', '{p}'],
    { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  const seen = new Map();
  for (const line of out.split('\n')) {
    // "quick-xml v0.41.0" / "rhwp v0.8.4 (C:\...)" / "... (*)"
    const m = line.trim().match(/^([A-Za-z0-9_.-]+) v(\d[^\s(]*)/);
    if (!m) continue;
    const [, name, version] = m;
    if (name === 'rhwp') continue; // 우리 자신
    seen.set(`${name}-${version}`, { name, version });
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** 크레이트가 풀려 있는 레지스트리 폴더를 찾는다. */
function crateSourceDirs() {
  const base = join(homedir(), '.cargo', 'registry', 'src');
  if (!existsSync(base)) return [];
  return readdirSync(base).map((idx) => join(base, idx)).filter((p) => statSync(p).isDirectory());
}

/** 폴더에서 라이선스 원문 파일을 모은다. */
function readLicenseFiles(dir) {
  if (!dir || !existsSync(dir)) return [];
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (!LICENSE_FILE.test(entry)) continue;
    if (!statSync(full).isFile()) continue;
    const text = readFileSync(full, 'utf8').trim();
    if (text) found.push({ file: entry, text });
  }
  return found.sort((a, b) => a.file.localeCompare(b.file));
}

/** Cargo.toml 의 license 필드. 원문 파일이 없을 때 최소한 무엇인지는 밝힌다. */
function crateLicenseField(dir) {
  const toml = join(dir ?? '', 'Cargo.toml');
  if (!dir || !existsSync(toml)) return null;
  const m = readFileSync(toml, 'utf8').match(/^\s*license\s*=\s*"([^"]+)"/m);
  return m ? m[1] : null;
}

/** 브라우저 번들에 들어가는 npm 패키지. package.json 의 dependencies 가 그것이다. */
function shippedNpmPackages() {
  const pkg = JSON.parse(readFileSync(join(STUDIO, 'package.json'), 'utf8'));
  return Object.keys(pkg.dependencies ?? {}).sort();
}

function section(title, body) {
  const bar = '─'.repeat(72);
  return `${bar}\n${title}\n${bar}\n\n${body.trim()}\n\n`;
}

/**
 * 같은 원문은 한 번만 싣는다.
 *
 * Apache-2.0 원문은 11KB 인데 크레이트마다 저작권 줄이 없는 동일한 파일이라, 그대로
 * 늘어놓으면 90번 반복되어 파일이 1.2MB 가 된다. MIT 는 저작권 줄이 크레이트마다 달라
 * 저절로 각자 실린다 — 지워야 할 중복만 지워지고 남겨야 할 고지는 남는다.
 */
class LicensePool {
  constructor() {
    this.byText = new Map();
    this.counts = new Map();
  }

  /** 1차 통과 — 몇 번 나오는지만 센다. */
  count(text) {
    this.counts.set(text, (this.counts.get(text) ?? 0) + 1);
  }

  /** 2차 통과 — 두 번 이상 나오는 원문은 공통으로 빼고 이름표를 돌려준다. */
  render(fileName, text) {
    if ((this.counts.get(text) ?? 0) < 2) return `[${fileName}]\n\n${text}`;
    let id = this.byText.get(text);
    if (!id) {
      id = `공통-${this.byText.size + 1}`;
      this.byText.set(text, id);
    }
    return `[${fileName}] → 아래 "공통 라이선스 원문 ${id}" 과 같습니다.`;
  }

  appendix() {
    if (this.byText.size === 0) return '';
    let out = section('공통 라이선스 원문', '여러 패키지가 글자 하나 다르지 않은 같은 원문을 '
      + '쓰는 경우, 그 원문을 여기에 한 번만 싣고 각 패키지에서 가리킵니다.').trimEnd() + '\n\n';
    for (const [text, id] of this.byText) {
      out += section(`공통 라이선스 원문 ${id}`, text);
    }
    return out;
  }
}

function main() {
  const srcDirs = crateSourceDirs();
  const crates = shippedCrates();
  const npmNames = shippedNpmPackages();
  const missing = [];
  const pool = new LicensePool();

  // 패키지마다 (제목, 원문 파일들) 을 먼저 모은다. 어떤 원문이 겹치는지 다 보고 나서야
  // 무엇을 공통으로 뺄지 정할 수 있다.
  const entries = [];
  for (const { name, version } of crates) {
    const dir = srcDirs
      .map((base) => join(base, `${name}-${version}`))
      .find((p) => existsSync(p));
    const files = readLicenseFiles(dir);
    const spdx = crateLicenseField(dir);
    entries.push({
      kind: 'rust',
      head: `${name} ${version}${spdx ? `  —  ${spdx}` : ''}\nhttps://crates.io/crates/${name}`,
      files,
      label: `${name} ${version}${spdx ? ` (${spdx})` : ''}`,
    });
  }
  for (const name of npmNames) {
    const dir = join(STUDIO, 'node_modules', ...name.split('/'));
    const files = readLicenseFiles(dir);
    let spdx = null;
    const pkgJson = join(dir, 'package.json');
    if (existsSync(pkgJson)) spdx = JSON.parse(readFileSync(pkgJson, 'utf8')).license ?? null;
    entries.push({
      kind: 'npm',
      head: `${name}${spdx ? `  —  ${spdx}` : ''}\nhttps://www.npmjs.com/package/${name}`,
      files,
      label: `${name}${spdx ? ` (${spdx})` : ''}`,
    });
  }

  for (const e of entries) for (const f of e.files) pool.count(f.text);

  const NO_TEXT = '(이 패키지는 배포 아카이브에 라이선스 원문 파일을 담고 있지 않습니다. '
    + '위 SPDX 식별자와 주소를 참고하십시오.)';
  let body = '';
  let npmBody = '';
  for (const e of entries) {
    const rendered = e.files.length === 0
      ? NO_TEXT
      : e.files.map((f) => pool.render(f.file, f.text)).join('\n\n');
    if (e.files.length === 0) missing.push(e.label);
    const out = section(e.head, rendered);
    if (e.kind === 'rust') body += out;
    else npmBody += out;
  }

  const header = [
    'hwwp — 서드파티 저작권 고지',
    '',
    'hwwp 가 배포물에 담아 함께 전달하는 오픈소스 소프트웨어의 저작권 고지와 허가 문구',
    '전문입니다. MIT·Apache-2.0 을 비롯한 여러 라이선스가 사본에 이 고지를 함께 남길 것을',
    '요구하므로, 그 요구를 이 파일이 이행합니다.',
    '',
    '이 파일은 실제 의존성 목록에서 기계가 만듭니다(rhwp-studio/scripts/gen-notices.mjs).',
    '무엇을 왜 쓰는지에 대한 사람이 읽는 설명은 저장소의 THIRD_PARTY_LICENSES.md 에 있고,',
    'hwwp 자체의 라이선스는 /LICENSE.txt 에 있습니다.',
    '',
    `Rust 크레이트 ${crates.length}개 · npm 패키지 ${npmNames.length}개`,
    '',
  ].join('\n');

  const text = `${header}\n\n${section('RUST 크레이트', '').trimEnd()}\n\n${body}`
    + `${section('NPM 패키지', '').trimEnd()}\n\n${npmBody}`
    + pool.appendix();

  writeFileSync(OUT, text, 'utf8');
  console.log(`${OUT}`);
  console.log(`  크레이트 ${crates.length}개, npm ${npmNames.length}개, ${(text.length / 1024).toFixed(0)}KB`);
  if (missing.length) {
    console.log(`  원문 파일이 없는 패키지 ${missing.length}개:`);
    for (const m of missing) console.log(`    - ${m}`);
  }
}

main();
