const assert=require('node:assert/strict');
const createAirCombat=require('../src/patrol/combat.js');
const swarm=require('../src/simulation/swarm.cjs');
const plane={x:720,y:410,z:-230,yaw:Math.PI/2,pitch:0,roll:0,speed:90};
const world={height:()=>0};
const battle=createAirCombat(plane),s=battle.state;
const seen=new Set();
function fly(seconds,input={}){
  for(let i=0;i<Math.round(seconds*60);i++){
    plane.x+=Math.sin(plane.yaw)*plane.speed/60;
    plane.z+=Math.cos(plane.yaw)*plane.speed/60;
    for(const e of battle.step(1/60,plane,input,world))seen.add(e.type||e);
  }
}
fly(2.2);
assert(seen.has('wave') && s.battle.enemies.some(e=>e.active));
assert.equal(s.swarm.drones.length,12);
assert.equal(s.swarm.drones.filter(e=>e.active).length,3);
assert.equal(s.battle.enemies.filter(e=>e.active).length,4);
assert(s.battle.enemies.some(e=>e.active && e.heavy));
assert(Math.abs(battle.toWorld(s.x,s.y,s.distance)[0]-plane.x)<1e-8);
const e=s.battle.enemies[1],beforePos=battle.toWorld(e.x,e.y,e.d);
plane.yaw+=Math.PI;fly(1/60);
const afterPos=battle.toWorld(e.x,e.y,e.d);
assert(Math.hypot(...afterPos.map((x,i)=>x-beforePos[i]))<2,'turning the player must not teleport the formation');
assert.equal(battle.lockTarget(plane,world),null);
assert(!swarm.contains(s,e,3),'beam fired backwards cannot hit the formation');
plane.yaw-=Math.PI;fly(1/60);
const lock=battle.lockTarget(plane,world);
assert(lock && lock.position());
assert.equal(battle.lockTarget(plane,{height:()=>100000}),null,'target behind mountain');
const [x,y,z]=battle.toWorld(e.x,e.y,e.d);
assert(!battle.strikeSegment([x,y+80,z-1],[x,y+80,z+1]));
assert(battle.strikeSegment([x,y,z-3],[x,y,z+3]));
assert(!e.active && s.kills>0);
fly(1/60);assert(seen.has('enemy-burst') && seen.has('blast'));
for(const action of ['six0','six1','six2','six3','six4','six5','tier1','pelican','fire','roar']){
  fly(.05,{[action]:true}); fly(.05);
}
fly(4);assert(s.swarm.drones.filter(e=>e.active).length<=12);fly(.05,{tier2:true});fly(4);fly(.05,{tier3:true});fly(12,{fire:true});
for(const name of ['wave','boss','fire','roar','pelican','tier1','tier2','tier3',...Array.from({length:6},(_,i)=>'six-impact'+i)])assert(seen.has(name),name);
const carrier=s.battle.enemies[12];
assert(carrier.active);
const xyz=battle.toWorld(carrier.x,carrier.y,carrier.d),hp=carrier.hp;
assert(battle.strikeSegment(xyz,xyz));
assert(carrier.hp<hp);
for(let i=0;i<4;i++)battle.strikeSegment(xyz,xyz);
fly(1/60);assert(seen.has('overload'));
s.health=1; s.shield=0;s.hit=0;s.mode=0;
swarm.damage(s,[]);assert.equal(s.status,'lost');
const elapsed=s.elapsed;fly(.5,{fire:true});assert.equal(s.elapsed,elapsed);
const passPlane={x:0,y:300,z:0,yaw:0,pitch:0,roll:0,speed:90};
const pass=createAirCombat(passPlane);
passPlane.z=183;
function waitForWing(seconds) {
  for(let i=0;i<seconds*60;i++)pass.step(1/60,passPlane,{},world);
  return pass.state.swarm.drones.filter(e=>e.active);
}
assert.equal(waitForWing(1).length,3);
assert.equal(waitForWing(4).length,12);
assert(waitForWing(6.5).some(e=>e.presence<1));
assert.equal(waitForWing(5).length,0);
console.log('Air combat passed: world-space turn, heading-aware skills, missile lock and occlusion, air hits, original six skills, wing systems, carrier and overload, defeat.');
