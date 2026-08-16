import { defineConfig } from 'vite';
import { resolve, extname, join } from 'path';
import { readFileSync, readFile, cpSync, copyFileSync, existsSync, rmSync } from 'fs';
import { VitePWA } from 'vite-plugin-pwa';

/** 웹폰트 원본. `public/fonts` 가 심볼릭 링크로 가리키는 곳이다. */
const fontsDir = resolve(__dirname, '..', 'assets', 'fonts');

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'));
const subsecondWasmDir = resolve(
  __dirname,
  '..',
  'target',
  'rhwp-subsecond-vite',
);
const useSubsecondWasm = process.env.RHWP_SUBSECOND === '1';

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    // 셀프 호스팅 빌드에서 외부(CDN) 웹폰트 로드를 빌드 시점에 끈다.
    // 확장 storage 설정(disableExternalWebFonts)이 있으면 그 값이 우선한다.
    __RHWP_DISABLE_EXTERNAL_WEBFONTS__: JSON.stringify(
      process.env.RHWP_DISABLE_EXTERNAL_WEBFONTS === '1',
    ),
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@wasm/rhwp.js': useSubsecondWasm
        ? resolve(subsecondWasmDir, 'rhwp-subsecond.js')
        : resolve(__dirname, '..', 'pkg', 'rhwp.js'),
      '@wasm': resolve(__dirname, '..', 'pkg'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 7700,
    proxy: useSubsecondWasm ? {
      '/_dioxus': {
        target: 'http://127.0.0.1:7711',
        ws: true,
      },
      '/wasm': {
        target: 'http://127.0.0.1:7711',
      },
    } : undefined,
    fs: {
      // [Task #741 후속] 외부 file path 그림 영역 영역 samples/ dir 영역 영역 fetch 가능 영역.
      allow: [
        __dirname,
        resolve(__dirname, '..', 'pkg'),
        subsecondWasmDir,
        resolve(__dirname, '..', 'samples'),
        resolve(__dirname, '..', 'npm', 'editor'),
      ],
    },
    watch: {
      ignored: ['**/librhwp-subsecond-patch-*.wasm'],
    },
  },
  plugins: [
    {
      name: 'ignore-subsecond-patch-artifacts',
      handleHotUpdate(context) {
        if (/librhwp-subsecond-patch-\d+\.wasm$/.test(context.file)) {
          return [];
        }
      },
    },
    // [Task #741 후속] dev 서버 영역 영역 /samples/* 경로 영역 영역 parent samples/ dir 영역
    // 영역 정적 serve 영역 — wasm-bridge.ts 영역 영역 외부 image fetch 영역 영역 영역.
    {
      name: 'serve-samples-dir',
      configureServer(server) {
        const samplesDir = resolve(__dirname, '..', 'samples');
        server.middlewares.use('/samples', (req, res, next) => {
          if (!req.url) return next();
          // URL decode + sanitize (path traversal 차단)
          const reqPath = decodeURIComponent(req.url.split('?')[0]);
          const relPath = reqPath.replace(/^\/+/, '');
          if (relPath.includes('..')) { res.statusCode = 403; return res.end(); }
          const full = join(samplesDir, relPath);
          if (!full.startsWith(samplesDir)) { res.statusCode = 403; return res.end(); }
          readFile(full, (err: NodeJS.ErrnoException | null, data: Buffer) => {
            if (err) { res.statusCode = 404; return res.end(); }
            const ext = extname(full).toLowerCase();
            const mime: Record<string, string> = {
              '.gif': 'image/gif', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
              '.png': 'image/png', '.bmp': 'image/bmp', '.webp': 'image/webp',
            };
            res.setHeader('Content-Type', mime[ext] ?? 'application/octet-stream');
            // [Task #741 후속] OS 영역 절대 경로 영역 영역 response header 영역 노출 — JS
            // 영역 영역 dialog 영역 영역 한컴 viewer 정합 (D:\\... 영역 영역 영역 의 영역 영역) 영역.
            res.setHeader('X-File-Path', encodeURI(full));
            res.setHeader('Access-Control-Expose-Headers', 'X-File-Path');
            res.end(data);
          });
        });
      },
    },
    {
      /**
       * dev 에서도 `/fonts/*` 를 원본 디렉터리에서 내어 준다.
       *
       * `public/fonts` 심볼릭 링크가 Windows 에서 텍스트 파일로 풀리면 dev 서버에서도
       * 폰트가 전부 404 다. 빌드 쪽(`ship-webfonts`)과 짝을 맞춰 둔다.
       */
      name: 'serve-fonts-dir',
      apply: 'serve',
      configureServer(server) {
        // 라이선스 전문은 빌드 때 저장소 루트에서 복사해 넣는다(prune-and-license).
        // dev 에는 그 파일이 없어 제품 정보의 링크가 깨지므로 여기서도 내어 준다.
        for (const [route, file] of [
          ['/LICENSE.txt', 'LICENSE'],
          ['/THIRD_PARTY_LICENSES.txt', 'THIRD_PARTY_LICENSES.md'],
        ]) {
          server.middlewares.use(route, (_req, res) => {
            readFile(resolve(__dirname, '..', file), (err, data) => {
              if (err) { res.statusCode = 404; return res.end(); }
              res.setHeader('Content-Type', 'text/plain; charset=utf-8');
              res.end(data);
            });
          });
        }
        server.middlewares.use('/fonts', (req, res, next) => {
          if (!req.url) return next();
          const reqPath = decodeURIComponent(req.url.split('?')[0]);
          const relPath = reqPath.replace(/^\/+/, '');
          if (!relPath) return next();
          if (relPath.includes('..')) { res.statusCode = 403; return res.end(); }
          const full = join(fontsDir, relPath);
          if (!full.startsWith(fontsDir)) { res.statusCode = 403; return res.end(); }
          readFile(full, (err: NodeJS.ErrnoException | null, data: Buffer) => {
            if (err) return next();
            const ext = extname(full).toLowerCase();
            const mime: Record<string, string> = {
              '.woff2': 'font/woff2', '.woff': 'font/woff',
              '.ttf': 'font/ttf', '.otf': 'font/otf',
            };
            res.setHeader('Content-Type', mime[ext] ?? 'application/octet-stream');
            res.end(data);
          });
        });
      },
    },
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/*.png'],
      manifest: {
        name: 'hwwp — Homeground of Writer Word Processor',
        short_name: 'hwwp',
        description: '원고를 완성하고 싶은 작가를 위한 HWP 편집기',
        lang: 'ko',
        // 배명훈 모드의 호박색·먹색. 앱을 켜면 바로 그 화면이므로 여기서부터 맞춘다.
        theme_color: '#f59f0a',
        background_color: '#0c0a09',
        display: 'standalone',
        // 루트 배포 기준. 하위 경로(`/rhwp/`)를 물려받은 채로 도메인 루트에 올리면
        // 설치도 파일 연결도 조용히 죽는다 — scope 밖이라 서비스 워커가 안 잡힌다.
        start_url: '/',
        scope: '/',
        file_handlers: [
          {
            action: '/',
            accept: {
              'application/x-hwp': ['.hwp'],
              'application/hwp+zip': ['.hwpx'],
              'application/xml': ['.hml'],
              'text/xml': ['.hml'],
            },
          },
        ],
        icons: [
          { src: 'icons/icon-128.png', sizes: '128x128', type: 'image/png' },
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-256.png', sizes: '256x256', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // WASM (~12 MB) is kept out of precache to avoid blocking SW installation;
        // CacheFirst at runtime still gives offline access after the first load.
        globPatterns: ['**/*.{js,css,html,png,svg,ico,woff,woff2,ttf,otf}'],
        // 폰트는 같은 이유로 뺀다 — 36벌 22MB 를 통째로 미리 받으면 서비스 워커
        // 설치가 첫 방문을 붙잡는다. 문서가 실제로 쓰는 글꼴만 그때 받으면 된다.
        globIgnores: ['fonts/**'],
        maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /\.wasm$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'wasm-cache',
              expiration: { maxEntries: 5, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
    // VitePWA 뒤에 둔다 — 아래 두 플러그인은 산출물을 손보므로 SW 매니페스트가
    // 만들어진 다음에 돌아야 한다.
    {
      /**
       * 웹폰트를 배포본에 넣는다.
       *
       * `public/fonts` 는 `assets/fonts` 를 가리키는 심볼릭 링크인데, Windows 는
       * 기본적으로 심볼릭 링크 없이 체크아웃해서(`core.symlinks=false`) 링크 대상
       * 경로가 적힌 18바이트 텍스트 파일이 된다. vite 는 그것을 그대로 dist 에
       * 복사하므로 폰트가 한 벌도 실리지 않은 배포본이 나온다.
       *
       * 글꼴이 좀 덜 예뻐지는 정도가 아니다 — CanvasKit 은 브라우저의 시스템 폰트
       * 폴백을 쓰지 않아서 `NotoSansKR-Regular.woff2` 가 없으면 기본 typeface 자체가
       * 사라진다. 그래서 OS 와 git 설정에 기대지 않고 여기서 직접 넣는다.
       */
      name: 'ship-webfonts',
      apply: 'build',
      closeBundle() {
        const dest = resolve(__dirname, 'dist', 'fonts');
        if (!existsSync(fontsDir)) {
          this.warn(`웹폰트 원본을 찾지 못했습니다: ${fontsDir}`);
          return;
        }
        // 심볼릭 링크가 텍스트 파일로 복사돼 있으면 먼저 치운다.
        rmSync(dest, { recursive: true, force: true });
        cpSync(fontsDir, dest, { recursive: true });
      },
    },
    {
      /**
       * 배포본을 정리한다.
       *
       * - `samples/` (6.7MB) 는 dev 전용이다. wasm-bridge 의 외부 그림 fetch 는
       *   `import.meta.env.DEV` 에서만 돌므로 프로덕션에서는 아무도 읽지 않는다.
       * - `*.d.ts` 는 타입 정의라 브라우저가 쓸 일이 없다.
       * - 라이선스 전문은 반대로 **넣는다**. MIT 는 저작권 고지를 사본에 함께 남길
       *   것을 요구하는데 웹앱 사용자는 저장소를 받지 않으므로, 배포본에서 URL 로
       *   닿을 수 있어야 한다. 확장자를 .txt 로 바꿔 브라우저가 내려받지 않고 연다.
       */
      name: 'prune-and-license',
      apply: 'build',
      closeBundle() {
        const dist = resolve(__dirname, 'dist');
        for (const junk of ['samples', 'rhwp.d.ts', 'rhwp_bg.wasm.d.ts']) {
          rmSync(resolve(dist, junk), { recursive: true, force: true });
        }
        const root = resolve(__dirname, '..');
        for (const [from, to] of [
          ['LICENSE', 'LICENSE.txt'],
          ['THIRD_PARTY_LICENSES.md', 'THIRD_PARTY_LICENSES.txt'],
        ]) {
          const src = resolve(root, from);
          if (existsSync(src)) copyFileSync(src, resolve(dist, to));
          else this.warn(`라이선스 파일을 찾지 못했습니다: ${src}`);
        }
      },
    },
  ],
});
