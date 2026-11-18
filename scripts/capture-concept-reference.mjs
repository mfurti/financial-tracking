import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL, URL } from 'node:url';
import { chromium } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, '.local/design-concepts/output/html/integrated');
const output = resolve(root, '.local/concept-reference');
const indexPath = resolve(root, 'specs/001-integrated-household-concept/reference-index.md');
const checkOnly = process.argv.includes('--check');
const unknown = process.argv
  .slice(2)
  .filter(
    /** Reject unsupported switches instead of silently changing capture scope. */ (value) => value !== '--check',
  );
if (unknown.length) throw new Error(`Unsupported option: ${unknown[0]}`);

const devices = [
  { name: 'pc', width: 1440, height: 1000, hash: '9203eea3c7db6733646105fc31bf46db5914a7e900f766e985995b427ae4e600' },
  {
    name: 'tablet',
    width: 768,
    height: 1024,
    hash: '96f6f1bfadc31a8345b79d8bb84068f0c10d3266c61e49013ed39c6692942728',
  },
  { name: 'mobile', width: 390, height: 844, hash: '32e3055680f81f21288bcaf4b2750f2ddaba225d30de01575cfd0fea436cfc2d' },
];
const views = [
  ['overview', 'seite-03'],
  ['analysis', 'seite-06'],
  ['accounts', 'konten'],
  ['contracts', 'seite-08'],
  ['calendar', 'vertragskalender'],
  ['wealth', 'scalable'],
  ['settings', 'einstellungen'],
  ['appearance', 'darstellung'],
];
const screenshots = [];
const blocked = new Set();
const errors = [];

for (const device of devices) {
  const file = resolve(source, `haushaltsbuch-${device.name}.html`);
  let bytes;
  try {
    bytes = await readFile(file);
  } catch {
    throw new Error(`Reference missing: ${relative(root, file)}. Restore the supplied local concept before capture.`);
  }
  const hash = createHash('sha256').update(bytes).digest('hex');
  const viewCount = [...bytes.toString('utf8').matchAll(/<article\b[^>]*data-title=/g)].length;
  if (hash !== device.hash || viewCount !== 39)
    throw new Error(`Reference changed: ${device.name}; review its fingerprint.`);
  device.file = file;
  process.stdout.write(`${device.name}: verified SHA-256 and ${viewCount} views\n`);
}

if (checkOnly) process.exit(0);
const ownedRelative = relative(resolve(root, '.local'), output);
if (ownedRelative.startsWith('..') || isAbsolute(ownedRelative)) throw new Error('Capture output must stay in .local.');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const device of devices) {
    const context = await browser.newContext({
      viewport: { width: device.width, height: device.height },
      deviceScaleFactor: 1,
      locale: 'de-DE',
      timezoneId: 'Europe/Berlin',
      colorScheme: 'light',
      reducedMotion: 'reduce',
      hasTouch: device.name === 'mobile',
    });
    await context.route(
      /^https?:\/\//,
      /** Keep the supplied offline reference independent of remote resources and banking. */ (route) => {
        blocked.add(new URL(route.request().url()).origin);
        return route.abort();
      },
    );
    const page = await context.newPage();
    page.on(
      'pageerror',
      /** Retain synthetic reference errors rather than claim a clean capture. */ (error) => errors.push(error.message),
    );
    await page.clock.install({ time: new Date('2026-11-18T12:00:00Z') });
    await page.goto(`${pathToFileURL(device.file).href}#seite-03`, { waitUntil: 'load' });
    await page.locator('#seite-03').waitFor({ state: 'visible' });

    for (const theme of ['light', 'dark']) {
      const dark = await page
        .locator('html')
        .evaluate(
          /** The reference defaults to its saved demo tone rather than the browser's media preference. */ (element) =>
            element.classList.contains('dark'),
        );
      if (dark !== (theme === 'dark'))
        await page.getByRole('button', { name: 'Hell und Dunkel wechseln', exact: true }).click();
      await page.waitForFunction(
        /** Check the actual applied tone so capture labels cannot silently be reversed. */ (expected) =>
          globalThis.document.documentElement.classList.contains('dark') === expected,
        theme === 'dark',
      );
      for (const [name, id] of views) {
        await page.evaluate(
          /** Use the reference's own hash router and render cascade without injecting replacement markup. */ (
            hash,
          ) => {
            globalThis.location.hash = hash;
          },
          id,
        );
        await page.locator(`#${id}`).waitFor({ state: 'visible' });
        await page.evaluate(
          /** Wait for local fonts and a settled render; reduced motion removes decorative transitions. */ async () => {
            await globalThis.document.fonts.ready;
            globalThis.scrollTo(0, 0);
            await new Promise(globalThis.requestAnimationFrame);
          },
        );
        const geometry = await page.evaluate(
          /** Preserve computed evidence for final overrides, without recording user inputs. */ () => {
            const selectors = [
              '.main',
              '.integrated-home-columns',
              '.integrated-column',
              '.feature-grid',
              '.feature-tile',
              '.insight-tile',
              '.compact-account-card',
              '.transaction-day .row',
            ];
            return selectors.map(
              /** Ignore hidden samples from other views, since they do not establish rendered geometry. */ (
                selector,
              ) => {
                const element = [...globalThis.document.querySelectorAll(selector)].find(
                  /** Only rendered elements contribute measurements. */ (entry) =>
                    entry.getBoundingClientRect().width > 0,
                );
                if (!element) return { selector, visible: false };
                const css = globalThis.getComputedStyle(element);
                const box = element.getBoundingClientRect();
                return {
                  selector,
                  width: box.width,
                  height: box.height,
                  padding: css.padding,
                  gap: css.gap,
                  radius: css.borderRadius,
                  shadow: css.boxShadow,
                  background: css.backgroundColor,
                  color: css.color,
                  grid: css.gridTemplateColumns,
                };
              },
            );
          },
        );
        const filename = `${device.name}-${theme}-${name}.png`;
        await page.screenshot({ path: resolve(output, filename), fullPage: true, animations: 'disabled' });
        screenshots.push({
          device: device.name,
          viewport: `${device.width}x${device.height}`,
          theme,
          view: id,
          file: `.local/concept-reference/${filename}`,
          geometry,
        });
      }
      await page.evaluate(
        /** Open the wealth route before using its actual trade dialog trigger. */ () => {
          globalThis.location.hash = 'scalable';
        },
      );
      await page.locator('#scalable').waitFor({ state: 'visible' });
      await page.locator('[data-open="trade-dialog"]:visible').first().click();
      await page.locator('#trade-dialog').waitFor({ state: 'visible' });
      const filename = `${device.name}-${theme}-order-dialog.png`;
      await page.screenshot({ path: resolve(output, filename), fullPage: true, animations: 'disabled' });
      screenshots.push({
        device: device.name,
        viewport: `${device.width}x${device.height}`,
        theme,
        view: 'trade-dialog',
        file: `.local/concept-reference/${filename}`,
      });
      await page.locator('#trade-dialog [data-close]').first().click();
    }
    await context.close();
    process.stdout.write(`${device.name}: captured 18 reference screens\n`);
  }
} finally {
  await browser.close();
}

if (errors.length) throw new Error(`Reference page errors: ${errors.join('; ')}`);
const manifest = {
  capturedAt: new Date().toISOString(),
  referenceTime: '2026-11-18T12:00:00Z',
  locale: 'de-DE',
  timezone: 'Europe/Berlin',
  scale: 1,
  reducedMotion: true,
  sources: devices.map(
    /** Publish only repository-relative synthetic source provenance. */ ({ name, hash, width, height }) => ({
      name,
      hash,
      width,
      height,
    }),
  ),
  blockedOrigins: [...blocked],
  screenshots,
};
await writeFile(resolve(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
const rows = screenshots.map(
  /** The tracked index describes ignored local evidence, not uploaded images. */ (entry) =>
    `| ${entry.device} | ${entry.viewport} | ${entry.theme} | ${entry.view} | \`${entry.file}\` |`,
);
await writeFile(
  indexPath,
  `# Integrated Concept Reference Captures\n\nGenerated with \`node scripts/capture-concept-reference.mjs\`. Use \`--check\` for fingerprint/view validation only.\n\nReference clock: 2026-11-18 12:00 UTC; timezone Europe/Berlin; locale de-DE; scale 1; reduced motion. Fresh synthetic context per device. Theme changes use the actual header control. No source HTML edits or remote banking/resources.\n\nThe 54 images and computed-style manifest remain ignored under .local/concept-reference/. They are local reference evidence, not implementation acceptance or published images. Source fingerprints remain in contracts/ui.md.\n\n| Device | Viewport | Theme | View | Local artifact |\n| --- | --- | --- | --- | --- |\n${rows.join('\n')}\n\nFinal geometry is captured for visible .main, .integrated-home-columns, .integrated-column, .feature-grid, .feature-tile, .insight-tile, .compact-account-card and .transaction-day .row elements. Preserve final .T/.INTEGRATED overrides when implementing.\n\nBlocked remote origins: ${blocked.size ? [...blocked].join(', ') : 'none requested'}. Page errors: none.\n`,
);
process.stdout.write(`Captured ${screenshots.length} screens; index: ${relative(root, indexPath)}\n`);
