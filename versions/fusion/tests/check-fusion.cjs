const assert = require('node:assert/strict');
const game = require('../src/simulation/player.cjs');
const battle = require('../src/simulation/battle.cjs');

const jet = game.fresh(true), world = game.create(), events = new Set();
function fly(input = {}, frames = 1) {
  for (let i = 0; i < frames; i++) {
    for (const event of game.step(jet, input, 1/60, world)) events.add(event);
    assert.equal(jet.status, 'playing');
    assert.equal(jet.falling, false);
    assert(jet.y >= 0.8 && jet.y <= 16 && Math.abs(jet.x) <= 22);
  }
}
assert(jet.flight && !game.fresh().flight);
fly({}, 96);
assert(events.has('ring'));
fly({right: true, forward: true, boost: true}, 150);
assert(jet.roll < 0 && jet.x === 22 && jet.y === 16);
assert(jet.speed > 50 && jet.energy < 100);
fly({brake: true}, 175);
assert.equal(jet.y, 0.8);
fly({jump: true}, 12);
assert(events.has('jump') && jet.y > 2);
fly({tier1: true, roar: true, fire: true, six0: true, pelican: true}, 1);
fly({fire: true}, 250);
assert.equal(jet.mode, 0);
assert.equal(jet.x, 22); // Expiring the support skills must not teleport the pilot to the road.
for (const event of ['tier1', 'roar', 'fire', 'six0', 'six-impact0', 'pelican', 'power-end', 'wave']) {
  assert(events.has(event), event);
}
fly({tier2: true}, 1);
fly({}, 250);
fly({tier3: true}, 1);
assert(events.has('tier2') && events.has('tier3') && events.has('boss'));
const boss = jet.battle.enemies[12];
assert(boss.active && jet.swarm.drones.some(drone => drone.active));
const before = boss.hp;
const stagger = [];
battle.hit(jet, boss, 10, stagger, 12);
assert(stagger.includes('overload'));
fly({six1:true, six2:true, six3:true, six4:true, six5:true}, 1);
for(let i=1;i<6;i++) assert(events.has('six'+i) && events.has('six-impact'+i));
assert(boss.hp < before - 10, 'the equipment damages the same live boss');
fly({}, 350);
assert.equal(jet.mode, 0);
assert(jet.flight && jet.y > 0 && jet.speed > 20);
// Fly the same low gate at two heights and verify clearance affects damage.
for (const altitude of [0.8, 10]) {
  const pilot = game.fresh(true), course = game.create();
  pilot.distance = 4 * game.LENGTH + game.LENGTH * .56 - 1;
  course.sync(pilot.distance);
  const gate = course.at(pilot.distance);
  pilot.x = game.profile(gate.tile, .56).x;
  pilot.y = altitude;
  const result = game.step(pilot, {}, 1/60, course);
  assert.equal(result.includes('hit'), altitude < 1.6);
  assert.equal(pilot.health, altitude < 1.6 ? 99 : 100);
}
console.log('FUSION PASS: sustained flight, steering, boost, terrain clearance, rings, six skills, support powers, volleys, enemy waves, boss damage and overload');
