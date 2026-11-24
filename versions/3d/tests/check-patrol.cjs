const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const scripts = ['flight.js', 'airframe.js'].map(file =>
  fs.readFileSync(path.join(__dirname, '../src/patrol', file), 'utf8')
).join('\n');
const {createFlight, advanceFlight, flightCamera, cameraBasis, createAirframe} =
  vm.runInNewContext(scripts+'\n;({createFlight,advanceFlight,flightCamera,cameraBasis,createAirframe})');
const p=createFlight(), craft=createAirframe();
const world={height:(x,z)=>Math.max(0,200*Math.sin(z/480)),rawHeight:(x,z)=>200*Math.sin(z/480)};
assert.equal(craft.rails.length,4);
for(let i=0;i<4;i++){
  assert.equal(craft.fire(p),true);
  assert(craft.rails[i]>0, 'a fired missile must disappear from its visual rail');
}
assert.equal(craft.ammo,0);
assert.equal(craft.fire(p),false);
let impacts=0;
for(let i=0;i<60*240;i++){
  const controls={x:Math.sin(i*.0011),y:Math.cos(i*.0022),boost:i%170<60,top:i%3500<900,manual:true};
  advanceFlight(p,1/60,controls,world);
  if(craft.update(1/60,p,world))impacts++;
  assert(p.y >= world.height(p.x,p.z)+7.99);
  assert(Number.isFinite(p.x+p.y+p.z+p.pitch+p.roll+p.yaw));
  const c=cameraBasis(flightCamera(p,i%3,false,1.6));
  for(const basis of [c.forward,c.right,c.up])assert(Math.abs(Math.hypot(...basis)-1)<1e-6);
}
assert(impacts>0);
assert.equal(craft.ammo,4);
assert(craft.rails.every(cooldown=>cooldown===0));
console.log('Patrol flight, cameras, terrain clearance, impacts and rearming passed (240 simulated seconds).');
