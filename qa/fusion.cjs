const assert = require('node:assert/strict');

module.exports = async function checkFusion(p, advance, screenshot) {
  await p.waitForFunction(() => !!window.wingRider);
  await advance(1, true);
  await p.locator('#start').click();
  await p.evaluate(() => {
    window.events = new Set();
    const original = InfiniteRoad.step;
    InfiniteRoad.step = function (...args) {
      const result = original.apply(this, args);
      for (const e of result) if (typeof e === 'string') events.add(e);
      return result;
    };
  });
  await advance(18, true);
  assert(await p.evaluate(() => wingRider.status === 'playing' && wingRider.snapshot.flight));
  await screenshot('flight');
  await p.keyboard.down('w');
  await p.keyboard.down('d');
  await advance(8);
  await p.keyboard.up('w');
  await p.keyboard.up('d');
  assert(await p.evaluate(() => wingRider.snapshot.y > 3 && wingRider.snapshot.x > 1));
  await p.keyboard.down('z');
  for (const key of ['1', '4', 'c', 'q', 'e', 'r', 'f', 'v', 'x']) {
    await p.keyboard.down(key);
    await advance(1, true);
    await p.keyboard.up(key);
    await advance(4);
  }
  await advance(18, true);
  assert(
    await p.evaluate(() => wingRider.snapshot.six.active > 0 && wingRider.snapshot.gpuParticles > 0)
  );
  await screenshot('skills');
  await advance(90);
  for (const k of ['2', '3']) {
    await p.keyboard.down(k);
    await advance();
    await p.keyboard.up(k);
    await advance(100);
  }
  await p.keyboard.up('z');
  await advance(1, true);
  const report = await p.evaluate(() => ({
    ...wingRider.snapshot,
    events: [...events],
    status: wingRider.status
  }));
  for (const event of [
    'fire',
    'tier1',
    'tier2',
    'tier3',
    'pelican',
    'roar',
    'wave',
    'boss',
    ...Array.from({ length: 6 }, (_, i) => 'six' + i),
    ...Array.from({ length: 6 }, (_, i) => 'six-impact' + i)
  ])
    assert(report.events.includes(event), event);
  assert.equal(report.status, 'playing');
  assert.equal(report.falling, false);
  assert.equal(report.flight, true);
  await p.keyboard.press('p');
  assert.equal(await p.evaluate(() => wingRider.status), 'paused');
  await p.keyboard.press('p');
  await p.keyboard.press('Backspace');
  await advance(1, true);
  assert(
    await p.evaluate(
      () =>
        wingRider.status === 'playing' &&
        wingRider.snapshot.flight &&
        wingRider.snapshot.distance < 5
    )
  );
  console.log({ distance: report.distance, events: report.events, bossHp: report.bossHp });
};
