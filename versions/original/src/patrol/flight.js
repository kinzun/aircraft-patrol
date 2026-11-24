const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const angle = n => Math.atan2(Math.sin(n), Math.cos(n));

function createFlight() {
  return {x:0, y:350, z:0, yaw:0, pitch:0, roll:0, speed:90, boost:false, time:0,
    verticalSpeed:0, turnRate:0, g:1, bank:0, rollTime:1, heading:0};
}

function advanceFlight(p, dt, input, world) {
  p.time += dt;
  const follow = 1 - Math.exp(-dt * 3);
  let steer = input.x, climb = -input.y;
  if (!input.manual) {
    steer = 0.19 * Math.sin(p.time * .23);
    climb = .04 * Math.sin(p.time * .16);
  } else if (input.top) {
    steer = Math.hypot(input.x,input.y) < .04 ? 0 : clamp(angle(Math.atan2(input.x, -input.y) - p.yaw) * 1.6, -1, 1);
    climb = 0;
  }
  p.boost = !!input.boost;
  p.speed += ((p.boost ? 173 : 90) - p.speed) * (1 - Math.exp(-dt * .95));
  p.bank += (steer * .95 - p.bank) * follow;
  p.turnRate = p.bank * .76;
  p.yaw = angle(p.yaw + p.turnRate * dt);
  p.heading = p.yaw;
  const dx = Math.sin(p.yaw), dz = Math.cos(p.yaw);
  const ahead = p.speed * 1.7;
  const floor = Math.max(world.height(p.x+dx*ahead,p.z+dz*ahead),world.height(p.x+dx*ahead*.5,p.z+dz*ahead*.5));
  const pitchGoal = Math.max(climb * .58, clamp((floor + 20 - p.y)/ahead, -.65, .9));
  p.pitch += (pitchGoal - p.pitch) * follow;
  p.rollTime = Math.min(1, p.rollTime + dt / .92);
  const spin = p.rollTime * p.rollTime * (3-2*p.rollTime);
  p.roll = p.bank + (p.rollTime < 1 ? spin * Math.PI * 2 : 0);
  p.x += dx * p.speed * Math.cos(p.pitch) * dt;
  p.z += dz * p.speed * Math.cos(p.pitch) * dt;
  const oldY = p.y;
  p.y = clamp(p.y + Math.sin(p.pitch) * p.speed * dt, world.height(p.x,p.z) + 8, 1700);
  p.verticalSpeed = (p.y - oldY)/dt;
  p.g = Math.sqrt(1 + (p.turnRate * p.speed/9.81)**2);
}

function flightCamera(p, mode, title, aspect) {
  const top = mode === 1, cockpit = mode === 2;
  const yaw = top ? 0 : p.yaw;
  const pitch = top ? -Math.PI/2 : cockpit ? p.pitch : p.pitch*.45 - .16;
  const roll = cockpit ? p.roll : 0;
  const back = top ? 0 : cockpit ? -4.4 : 40;
  const side = title && !top && !cockpit ? -Math.min(11,6*aspect) : 0;
  return {pos:[p.x - Math.sin(yaw)*back + Math.cos(yaw)*side,
    p.y + (top ? 150 : cockpit ? 1.4 : 13),
    p.z - Math.cos(yaw)*back - Math.sin(yaw)*side],yaw,pitch,roll,tan:top ? .54 : .52};
}

function cameraBasis(c) {
  const sy=Math.sin(c.yaw), cy=Math.cos(c.yaw), sp=Math.sin(c.pitch), cp=Math.cos(c.pitch);
  const cr=Math.cos(c.roll), sr=Math.sin(c.roll);
  c.forward=[sy*cp,sp,cy*cp];
  c.right=[cy*cr+sy*sp*sr,-cp*sr,-sy*cr+cy*sp*sr];
  c.up=[cy*sr-sy*sp*cr,cp*cr,-sy*sr-cy*sp*cr];
  return c;
}
