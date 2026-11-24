// Encounter coordinates stay fixed in the lake world; three metres equal one combat unit.
function createAirCombat(plane) {
  const player = typeof module === 'undefined' ? InfiniteRoad : require('../simulation/player.cjs');
  const fleet = typeof module === 'undefined' ? SkyBattle : require('../simulation/battle.cjs');
  const swarm = typeof module === 'undefined' ? SwarmCombat : require('../simulation/swarm.cjs');
  const state = player.fresh(true, 12), start = [plane.x, plane.y, plane.z];
  const heading = plane.yaw, sin = Math.sin(heading), cos = Math.cos(heading);
  const emptyMap = {slots: []}, pending = [];
  let terrain, formation;

  function toWorld(x,y,d) {
    return [start[0] + 3*(x*cos + d*sin), start[1] + 3*y, start[2] + 3*(d*cos - x*sin)];
  }
  function local(x,y,z) {
    const dx = (x-start[0])/3, dz = (z-start[2])/3;
    return [dx*cos-dz*sin,(y-start[1])/3,dx*sin+dz*cos];
  }
  function inFront(e) {
    const dx=e.x-state.x, dy=e.y-state.y, dz=e.d-state.distance;
    const ahead=(dx*air.sinYaw+dz*air.cosYaw)*air.cosPitch+dy*air.sinPitch;
    return ahead>0 && ahead>Math.hypot(dx,dy,dz)*.75;
  }
  function place(e,lateral,altitude,ahead,dt) {
    if (e.age <= dt || !e.formation) {
      if (!formation || formation.at !== state.elapsed) {
        formation = {at:state.elapsed,x:state.x,y:state.y,d:state.distance,
          sin:air.sinYaw,cos:air.cosYaw,speed:Math.max(17,Math.min(32,state.speed*.82))};
      }
      e.formation = formation;
    }
    const f=e.formation, travel=ahead+f.speed*e.age;
    e.x=f.x+lateral*f.cos+travel*f.sin; e.d=f.d-lateral*f.sin+travel*f.cos;
    const wx=start[0]+3*(e.x*cos+e.d*sin), wz=start[2]+3*(e.d*cos-e.x*sin);
    e.y=Math.max(f.y+altitude,(terrain.height(wx,wz)+12-start[1])/3);
  }
  const air=state.air={traveled:0,sinYaw:0,cosYaw:1,sinPitch:0,cosPitch:1,inFront,place};
  state.x=state.y=state.z=state.distance=state.aimYaw=state.aimPitch=state.vd=0;
  function step(dt,p,input,world) {
    const events=pending.splice(0);
    if (state.status!=='playing' || dt<=0) return events;
    terrain=world;
    const oldX=state.x, oldY=state.y, oldD=state.distance;
    [state.x,state.y,state.distance]=local(p.x,p.y,p.z);
    state.z=-state.distance;
    state.aimYaw=p.yaw-heading; state.aimPitch=p.pitch;
    air.sinYaw=Math.sin(state.aimYaw); air.cosYaw=Math.cos(state.aimYaw);
    air.sinPitch=Math.sin(p.pitch); air.cosPitch=Math.cos(p.pitch);
    const dx=state.x-oldX,dy=state.y-oldY,dz=state.distance-oldD;
    air.traveled+=Math.hypot(dx,dy,dz); state.elapsed+=dt;
    state.vx=dx/dt; state.vy=dy/dt; state.vd=dz/dt; state.speed=p.speed/3; state.roll=p.roll;
    state.hit=Math.max(0,state.hit-dt); state.overload=Math.max(0,state.overload-dt);
    state.swarm.fxBudget=0;
    player.abilities(state,input,dt,emptyMap,events);
    player.combat(state,input,dt,emptyMap,events);
    swarm.step(state,dt,events,oldD,oldX,oldY);
    return events;
  }
  function lockTarget(p,world) {
    if(state.status!=='playing')return null;
    const fx=Math.sin(p.yaw)*Math.cos(p.pitch),fy=Math.sin(p.pitch),fz=Math.cos(p.yaw)*Math.cos(p.pitch);
    function bestIn(pool) {
      let best=null, score=Infinity;
      for(const e of pool) {
        if(!e.active)continue;
        const position=toWorld(e.x,e.y,e.d);
        const dx=position[0]-p.x,dy=position[1]-p.y,dz=position[2]-p.z;
        const range=Math.hypot(dx,dy,dz);
        const dot=(fx*dx+fy*dy+fz*dz)/(range || 1);
        if(range>720 || dot<.967)continue;
        const rank=(1-dot)*3000+range*.05;
        if(rank>=score)continue;
        let clear=true;
        for(let i=1;i<=8;i++){
          const t=i/9;
          if(world.height(p.x+dx*t,p.z+dz*t)>p.y+dy*t){clear=false;break;}
        }
        if(clear){best=e;score=rank;}
      }
      return best;
    }
    const e=bestIn(state.battle.enemies) || bestIn(state.swarm.drones);
    if(!e)return null;
    const encounter=e.formation;
    return {boss:!!e.boss,position:()=>e.active && e.formation===encounter ? toWorld(e.x,e.y,e.d) : null};
  }
  function strikeSegment(from,to) {
    if(state.status!=='playing')return false;
    const a=local(...from),b=local(...to),dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2];
    const length2=dx*dx+dy*dy+dz*dz;
    let first=Infinity,target=null,drone=false;
    for(const pool of [state.battle.enemies,state.swarm.drones]){
      for(const e of pool){
        if(!e.active)continue;
        const ex=e.x-a[0],ey=e.y-a[1],ez=e.d-a[2];
        const along=ex*dx+ey*dy+ez*dz;
        const radius=e.boss?9:e.heavy?3.2:pool===state.battle.enemies?2:1.4;
        const c=ex*ex+ey*ey+ez*ez-radius*radius;
        let t=0;
        if(c>0){
          const disc=along*along-length2*c;
          if(!length2 || disc<0)continue;
          t=(along-Math.sqrt(disc))/length2;
          if(t<0 || t>1)continue;
        }
        if(t<first){first=t;target=e;drone=pool===state.swarm.drones;}
      }
    }
    if(!target)return false;
    if(drone)swarm.kill(state,target,pending);
    else fleet.hit(state,target,24,pending,1.3);
    Object.assign(state.lastBlast,{x:target.x,y:target.y,d:target.d});pending.push('blast');
    return true;
  }
  return {state,step,toWorld,lockTarget,strikeSegment};
}
if(typeof module!=='undefined')module.exports=createAirCombat;
