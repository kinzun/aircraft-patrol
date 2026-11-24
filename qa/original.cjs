const assert = require('node:assert/strict');

module.exports = async function checkOriginal(page, advance, screenshot) {
  await page.waitForFunction(() => !document.getElementById('launch').disabled);
  await advance(1, true);
  await page.locator('#launch').click();
  await page.mouse.move(576, 344);
  await advance(22, true);
  assert(await page.evaluate(() => launched && input.manual));
  const terrainColors = await page.evaluate(() => {
    window.advanceFrames(1, true);
    const gl = canvas.getContext('webgl2');
    const sample = new Uint8Array(4 * 32);
    gl.readPixels(canvas.width >> 1, canvas.height >> 1, 32, 1, gl.RGBA, gl.UNSIGNED_BYTE, sample);
    if (gl.getError() !== gl.NO_ERROR) throw Error('WebGL 读取错误');
    const colors = new Set();
    for (let i = 0; i < sample.length; i += 4) colors.add(sample.slice(i, i + 3).join(','));
    return colors.size;
  });
  assert(terrainColors > 1, '地形画面应有多种颜色');

  await page.evaluate(() => {
    window.flightChecks = { shots: 0, impacts: 0, minClearance: Infinity };
    const fire = craft.fire;
    craft.fire = function (...args) {
      const fired = fire.apply(this, args);
      if (fired) flightChecks.shots++;
      return fired;
    };
    const update = craft.update;
    craft.update = function (...args) {
      const hit = update.apply(this, args);
      if (hit) flightChecks.impacts++;
      const clearance = plane.y - world.height(plane.x, plane.z);
      flightChecks.minClearance = Math.min(clearance, flightChecks.minClearance);
      if (!Object.values(plane).every((v) => typeof v !== 'number' || Number.isFinite(v)))
        throw Error('飞行状态无效');
      if (clearance < 7.999 || craft.ammo < 0 || craft.ammo > 4)
        throw Error('离地高度或导弹库存异常');
      return hit;
    };
  });

  await page.mouse.down({ button: 'left' });
  await advance(7);
  await page.mouse.down({ button: 'right' });
  assert(await page.evaluate(() => plane.boost && craft.ammo === 3));
  await page.mouse.up({ button: 'right' });
  await page.mouse.up({ button: 'left' });
  await advance(10);
  assert(await page.evaluate(() => !plane.boost));
  await page.mouse.down({ button: 'right' });
  await page.mouse.down({ button: 'left' });
  await advance(7);
  assert(await page.evaluate(() => plane.boost && craft.ammo === 2));
  await page.mouse.up({ button: 'left' });
  await page.mouse.up({ button: 'right' });
  await page.mouse.click(576, 344);
  assert(await page.evaluate(() => plane.rollTime === 0));
  await page.keyboard.press('f');
  assert.equal(await page.evaluate(() => craft.ammo), 1);

  for (let i = 0; i < 100 && !(await page.evaluate(() => flightChecks.impacts)); i++)
    await advance(1, true);
  assert(await page.evaluate(() => flightChecks.impacts > 0), '导弹应撞击地形');
  await advance(1, true);
  await screenshot('impact');
  await advance(180);
  assert.equal(await page.evaluate(() => craft.ammo), 4);

  for (const [expected, name] of [
    [1, 'north-up'],
    [2, 'cockpit'],
    [0, 'chase']
  ]) {
    await page.keyboard.press('Space');
    await advance(22, true);
    assert.equal(await page.evaluate(() => mode), expected);
    await screenshot(name);
  }

  let seed = 0x665944;
  const random = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const start = await page.evaluate(() => plane.time);
  for (let batch = 0; batch < 151; batch++) {
    await page.mouse.move(100 + random() * 930, 110 + random() * 490);
    if (random() < 0.18) await page.keyboard.press('Space');
    if (random() < 0.49) await page.keyboard.press('f');
    const direction = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'][Math.floor(4 * random())];
    const boost = random() < 0.36;
    if (boost) await page.mouse.down({ button: 'left' });
    if (batch % 8 === 0) await page.keyboard.down(direction);
    await advance(24, batch % 8 === 0);
    if (batch % 8 === 0) await page.keyboard.up(direction);
    if (boost) await page.mouse.up({ button: 'left' });
  }
  const stats = await page.evaluate(
    (start) => ({ ...flightChecks, mixedInputSeconds: plane.time - start }),
    start
  );
  assert(stats.mixedInputSeconds >= 180 && stats.shots > 10 && stats.impacts > 0);
  console.log(stats);
  await checkTouch(page.context().browser(), page.url());
};

async function checkTouch(browser, url) {
  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  });
  try {
    const errors = [];
    mobile.on('pageerror', (error) => errors.push(error.message));
    mobile.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await mobile.goto(url);
    await mobile.locator('#launch').tap();
    await mobile.locator('#view').tap();
    await mobile.locator('#view').tap();
    assert.equal(await mobile.evaluate(() => mode), 2);
    const session = await mobile.context().newCDPSession(mobile);
    const touch = (type, touchPoints = []) =>
      session.send('Input.dispatchTouchEvent', { type, touchPoints });
    await touch('touchStart', [{ x: 170, y: 260, id: 1 }]);
    await touch('touchMove', [{ x: 242, y: 205, id: 1 }]);
    assert(await mobile.evaluate(() => input.manual && input.x > 0 && input.y < 0));
    await touch('touchEnd');
    assert(await mobile.evaluate(() => input.x === 0 && input.y === 0));

    const button = await mobile.locator('#thrust').boundingBox();
    await touch('touchStart', [
      { x: button.x + button.width / 2, y: button.y + button.height / 2, id: 2 }
    ]);
    await mobile.waitForFunction(() => plane.boost);
    await touch('touchEnd');
    await mobile.waitForFunction(() => !plane.boost);
    await mobile.locator('#fire').tap();
    assert.equal(await mobile.evaluate(() => craft.ammo), 3);
    await mobile.locator('#roll').tap();
    assert(await mobile.evaluate(() => plane.rollTime < 1));
    await mobile.locator('#sound').tap();
    await mobile.waitForFunction(() => sound.state === 'running');
    await mobile.locator('#sound').tap();
    await mobile.waitForFunction(() => sound.state === 'suspended');
    assert.deepEqual(errors, [], '触屏浏览器报错');
  } finally {
    await mobile.close();
  }
}
