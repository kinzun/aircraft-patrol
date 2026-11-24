const assert = require('node:assert/strict');

module.exports = async function checkPatrol(p, advance, screenshot, edition) {
  await p.waitForFunction(
    () => !document.querySelector('#launch').disabled,
    {},
    { timeout: 60000 }
  );
  await advance(1, true);
  await screenshot('title');
  await p.locator('#launch').click();
  await p.evaluate((edition) => {
    if (edition === '3d') {
      const drawJet = jetView.draw;
      jetView.draw = (...args) => {
        if (window.paint) drawJet(...args);
      };
    }
    window.logEvents = [];
    window.seenHit = false;
    const step = combat.step;
    combat.step = (...args) => {
      const ev = step(...args);
      logEvents.push(...ev.map((e) => (typeof e === 'string' ? e : e.type)));
      return ev;
    };
    const drawWorld = world.draw,
      drawFX = combatView.draw;
    world.draw = (...args) => {
      if (window.paint) drawWorld(...args);
    };
    combatView.draw = (...args) => {
      if (!window.stress || window.paint) drawFX(...args);
    };
    const strike = combat.strikeSegment;
    combat.strikeSegment = (...args) => {
      const result = strike(...args);
      if (result) window.seenHit = true;
      return result;
    };
  }, edition);
  const press = async (key) => {
    await p.keyboard.down(key);
    await advance(1, true);
    await p.keyboard.up(key);
    await advance();
  };
  // 在敌机进入射程前保持平飞。
  await p.mouse.move(576, 376);
  await advance(80, true);
  assert(await p.evaluate(() => combat.state.battle.wave > 0 && !!combat.lockTarget(plane, world)));
  await screenshot('chase');
  await press('f');
  await advance(24, true);
  assert(await p.evaluate(() => window.seenHit), '翼下导弹应击中空中目标');
  await screenshot('missile-hit');
  await p.keyboard.down('z');
  await press('c');
  await press('1');
  await press('4');
  for (const key of ['q', 'e', 'r', 'b', 'v', 'x']) await press(key);
  await advance(35, true);
  await screenshot('skills');
  await press('Space');
  await advance(23, true);
  assert.equal(await p.evaluate(() => mode), 1);
  await press('q');
  await screenshot('top');
  await press('Space');
  await advance(23, true);
  assert.equal(await p.evaluate(() => mode), 2);
  await advance(35);
  await press('2');
  await advance(170, true);
  await press('3');
  await advance(3, true);
  assert(await p.evaluate(() => combat.state.battle.enemies[12].active));
  await press('b');
  await screenshot('cockpit');
  await p.keyboard.up('z');
  await p.locator('#loadout-toggle').click();
  assert(await p.locator('#loadout').isVisible());
  await p.locator('#loadout-toggle').click();
  const names = await p.evaluate(() => logEvents);
  for (const n of [
    'wave',
    'boss',
    'roar',
    'fire',
    'pelican',
    'tier1',
    'tier2',
    'tier3',
    ...Array.from({ length: 6 }, (_, i) => 'six' + i),
    ...Array.from({ length: 6 }, (_, i) => 'six-impact' + i)
  ])
    assert(names.includes(n), n);
  // 按固定顺序混合转向、切换视角和技能输入，使长航程可复现。
  await p.evaluate(() => (window.stress = true));
  for (let i = 0; i < 35; i++) {
    await p.mouse.move(400 + ((i * 83) % 350), 330 + ((i * 37) % 110));
    await advance(94, true);
    if (i % 4 === 0) await press('Space');
    await press(['q', 'e', 'r', 'b', 'x', 'v'][i % 6]);
    if (await p.evaluate(() => lost)) break;
  }
  console.log(
    await p.evaluate(() => ({
      elapsed: combat.state.elapsed,
      status: combat.state.status,
      scene: document.title,
      world: plane.time,
      airImpact: window.seenHit,
      events: [...new Set(logEvents)],
      hull: combat.state.health
    }))
  );
  await p.locator('#sound').click();
  assert(await p.evaluate(() => battleSound.enabled));
  await p.locator('#sound').click();
  assert(await p.evaluate(() => !battleSound.enabled));
  await p.evaluate(() => {
    combat.state.status = 'lost';
  });
  await advance(1, true);
  assert(await p.locator('#launch').isVisible());
  await p.locator('#launch').click();
  await advance(2, true);
  assert(
    await p.evaluate(
      () =>
        combat.state.status === 'playing' &&
        combat.state.health === 100 &&
        craft.ammo === 4 &&
        mode === 0
    )
  );
  if (edition !== '3d') return;
  await p.keyboard.down('ArrowRight');
  await p.keyboard.down('Shift');
  await advance(10, true);
  await screenshot('bank');
  await p.keyboard.up('ArrowRight');
  await p.keyboard.up('Shift');
  await p.setViewportSize({ width: 390, height: 844 });
  await advance(6, true);
  await press('Space');
  await advance(20, true);
  await press('Space');
  await advance(22, true);
  await screenshot('portrait');
};
