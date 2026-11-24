const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const checkFusion = require('./fusion.cjs');
const checkPatrol = require('./patrol.cjs');
const checkOriginal = require('./original.cjs');

async function main() {
  const [edition, input] = process.argv.slice(2);
  if (!['original', 'fusion', 'pixel', '3d'].includes(edition)) {
    throw new Error('用法：node smoke.cjs <original|fusion|pixel|3d> [HTML 文件路径]');
  }
  const file = input
    ? path.resolve(input)
    : path.resolve(__dirname, '../versions', edition, 'index.html');
  fs.accessSync(file, fs.constants.R_OK);
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'aircraft-' + edition + '-'));
  console.log('截图目录', output);
  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  });
  try {
    const page = await browser.newPage({
      viewport: edition === 'fusion' ? { width: 1120, height: 750 } : { width: 1152, height: 744 }
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.addInitScript(
      (edition) => {
        const callbackName = edition === 'fusion' ? 'onAnimationFrame' : 'frame';
        const native = requestAnimationFrame.bind(window);
        let nextFrame;
        let now = 100;
        if (edition === 'original') Object.defineProperty(performance, 'now', { value: () => now });
        window.requestAnimationFrame = (callback) => {
          if (callback.name !== callbackName) return native(callback);
          nextFrame = callback;
          return 1;
        };
        window.advanceFrames = (count, draw) => {
          for (let i = 0; i < count; i++) {
            window.paint = draw && (callbackName === 'onAnimationFrame' || i === count - 1);
            nextFrame((now += 50));
          }
        };
        for (const name of [
          'drawArrays',
          'drawElements',
          'drawArraysInstanced',
          'drawElementsInstanced'
        ]) {
          const proto = WebGL2RenderingContext.prototype;
          const original = proto[name];
          proto[name] = function (...args) {
            if (window.paint !== false) return original.apply(this, args);
          };
        }
      },
      edition
    );
    await page.goto(pathToFileURL(file).href);
    const advance = (count = 1, draw = false) =>
      page.evaluate(([count, draw]) => window.advanceFrames(count, draw), [count, draw]);
    const screenshot = (name) => page.screenshot({ path: path.join(output, name + '.png') });
    if (edition === 'original') await checkOriginal(page, advance, screenshot);
    else if (edition === 'fusion') await checkFusion(page, advance, screenshot);
    else await checkPatrol(page, advance, screenshot, edition);
    assert.deepEqual(errors, [], '浏览器报错');
    console.log('通过', edition);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
