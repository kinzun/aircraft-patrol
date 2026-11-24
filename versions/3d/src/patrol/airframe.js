// Local model coordinates are metres, with the nose along +Z.
function createAirframe() {
  const gear = [0, 0, 0, 0], shots = [], impacts = [], trails = [];
  const rails = [-5.35, 5.35, -3.85, 3.85];
  function pose(plane) {
    const sy=Math.sin(plane.yaw), cy=Math.cos(plane.yaw), sp=Math.sin(plane.pitch), cp=Math.cos(plane.pitch);
    const sr=Math.sin(plane.roll), cr=Math.cos(plane.roll);
    return ([x,y,z]) => {
      const lateral=x*cr+y*sr, vertical=y*cr-x*sr, ahead=z*cp-vertical*sp;
      return [plane.x+lateral*cy+ahead*sy,plane.y+vertical*cp+z*sp,plane.z-lateral*sy+ahead*cy];
    };
  }
  function polygon(ctx, points, color) {
    if(points.some(p=>!p)) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x,points[0].y);
    for (let i=1;i<points.length;i++) ctx.lineTo(points[i].x,points[i].y);
    ctx.closePath();
    ctx.fillStyle=color;ctx.fill();
  }
  function line(ctx, a,b,color,width=1) {
    if(!a || !b) return;
    ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();
    ctx.moveTo(a.x,a.y);
    ctx.lineTo(b.x,b.y);ctx.stroke();
  }
  function fire(plane, target = null) {
    const slot=gear.indexOf(0);
    if(slot<0) return false;
    const [x,y,z]=pose(plane)([rails[slot],-.46,1]);
    const speed=plane.speed+260;
    shots.push({x,y,z,target, vx:Math.sin(plane.yaw)*Math.cos(plane.pitch)*speed,
      vz:Math.cos(plane.yaw)*Math.cos(plane.pitch)*speed,vy:Math.sin(plane.pitch)*speed-9, age:0,trail:[],sample:0});
    gear[slot]=5.2;
    return true;
  }
  let tipClock=0,waterHeight=null;
  function update(dt,plane,world,strikeSegment) {
    let hit=null;
    for(let i=0;i<gear.length;i++) gear[i]=Math.max(0,gear[i]-dt);
    for(let i=impacts.length-1;i>=0;i--) if((impacts[i].age+=dt)>impacts[i].life) impacts.splice(i,1);
    for(let i=trails.length-1;i>=0;i--) if((trails[i].age+=dt)>.72) trails.splice(i,1);
    tipClock+=dt;
    waterHeight=world.rawHeight(plane.x,plane.z)<0 && plane.y<25 ? 0 : null;
    if(tipClock>=.035) {
      const local=pose(plane);
      const points=[local([-7.7,.13,-3.54]),local([7.7,.13,-3.54])];
      if(waterHeight===0) points.push([plane.x,.1,plane.z]);
      trails.push({points,age:0});tipClock%=.035;
    }
    for(let i=shots.length-1;i>=0;i--) {
      const s=shots[i];
      s.age+=dt;s.sample+=dt;
      if(s.sample>=.045) {
        s.trail.push([s.x,s.y,s.z]);s.sample%=.045;
        if(s.trail.length>29) s.trail.shift();
      }
      const previous=[s.x,s.y,s.z];
      const contact=s.target?.position();
      if(contact){
        const dx=contact[0]-s.x,dy=contact[1]-s.y,dz=contact[2]-s.z;
        const scale=440/Math.max(1,Math.hypot(dx,dy,dz)), turn=1-Math.exp(-dt*12);
        s.vx+=(dx*scale-s.vx)*turn;s.vy+=(dy*scale-s.vy)*turn;s.vz+=(dz*scale-s.vz)*turn;
      }
      s.x+=s.vx*dt;s.y+=s.vy*dt;s.z+=s.vz*dt;
      if(!contact)s.vy-=dt*77;
      const ground=world.height(s.x,s.z);
      if(s.y<=ground) {
        const water=world.rawHeight(s.x,s.z)<0;
        impacts.push({x:s.x,y:ground+.4,z:s.z,age:0,water,life:water?3.3:8.2});
        shots.splice(i,1);hit=water?'water':'land';
      } else if(strikeSegment && strikeSegment(previous,[s.x,s.y,s.z])) {
        shots.splice(i,1);hit='air';
      } else if(s.age>21) shots.splice(i,1);
    }
    return hit;
  }
  function draw(ctx,project,plane) {
    const projectPoint=p=>project(...p);
    ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
    const density=Math.max(1,ctx.canvas.height/600);
    for(const e of impacts) {
      const t=e.age, center=project(e.x,e.y,e.z);
      if(!center) continue;
      function ring(radius,color) {
        const points=Array.from({length:53},(_,i)=>{
          const a=i*Math.PI/26;
          return project(e.x+radius*Math.cos(a),e.y+.15,e.z+radius*Math.sin(a));
        });
        for(let i=1;i<points.length;i++) line(ctx,points[i-1],points[i],color,1);
      }
      function puff(x,y,z,size,color,k) {
        const p=project(x,y,z);
        if(!p) return;
        const r=Math.max(1,size*p.scale);
        const cx=p.x+Math.cos(k)*r*.12,cy=p.y-r*.22;
        const glow=ctx.createRadialGradient(cx,cy,r*.04,p.x,p.y,r);
        glow.addColorStop(0,color);glow.addColorStop(.48,color+'d8');glow.addColorStop(1,color+'00');
        ctx.fillStyle=glow;ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();
      }
      if(!e.water) {
        const scorch=Array.from({length:14},(_,i)=>{
          const a=i*Math.PI/7,r=(10+Math.sin(i*12.6+.4)*3)*Math.min(1,t*9);
          return project(e.x+r*Math.cos(a),e.y,e.z+r*Math.sin(a));
        });
        ctx.globalAlpha=Math.min(1,(e.life-t)*1.3)*.8;
        polygon(ctx,scorch,'#3d3740');
        if(t>.42 && t<4.2) for(let i=0;i<6;i++) {
          const a=i*2.4, radius=2+i;
          const ember=project(e.x+Math.cos(a)*radius,e.y+.3,e.z+Math.sin(a)*radius);
          if(!ember) continue;
          ctx.fillStyle=Math.sin(t*8+i)>0?'#eaa05c':'#9e5646';
          ctx.fillRect(Math.round(ember.x),Math.round(ember.y),1,1);
        }
      }
      if(t<1.3) {
        ctx.globalAlpha=Math.min(1,(1.3-t)*1.6);
        ring(3+t*38,e.water?'#d7e8d6':'#fbe4aa');
      }
      const duration=e.water?1.65:3.8;
      if(t<duration) {
        ctx.globalAlpha=Math.min(1,(duration-t)*1.2);
        for(let i=0;i<11;i++) {
          const a=i*2.40, speed=5+(i%4)*2.4;
          const dx=Math.cos(a)*speed*t, dz=Math.sin(a)*speed*t;
          const h=e.water?Math.max(0,(26+(i%5)*6)*t-30*t*t):(7+i%5)*t;
          const fire=t<.52+(i%3)*.13;
          const col=e.water?['#72a7b2','#a7c9c8','#eff1d9'][i%3]:
            fire?['#bd5042','#f08040','#ffd784'][i%3]:['#555260','#79737a','#9c8d8d'][i%3];
          puff(e.x+dx,e.y+h,e.z+dz,e.water?3+(i%3):4+t*(2+i%3),col,i*.34);
        }
      }
      if(t<.22) {
        ctx.globalAlpha=1-t/.22;
        puff(e.x,e.y+3,e.z,15,'#fff7d4',.4);
      }
      ctx.globalAlpha=1;
    }
    for(const s of shots) {
      const p=projectPoint([s.x,s.y,s.z]);
      for(let i=1;i<s.trail.length;i++) {
        ctx.globalAlpha=.12+.64*i/s.trail.length;
        line(ctx,projectPoint(s.trail[i-1]),projectPoint(s.trail[i]),'#e0d7c2',density*(2.7-1.8*i/s.trail.length));
      }
      ctx.globalAlpha=1;
      if(p) {
        line(ctx,p,project(s.x-s.vx*.025,s.y-s.vy*.025,s.z-s.vz*.025),'#ffc778',3);
        ctx.fillStyle='#fffbe0';ctx.fillRect(Math.round(p.x)-1,Math.round(p.y)-1,3,2);
      }
    }
    for(let i=1;i<trails.length;i++) {
      const older=trails[i-1], newer=trails[i];
      for(let wing=0;wing<2;wing++) {
        ctx.globalAlpha=(1-older.age/.72)*.53;
        line(ctx,projectPoint(older.points[wing]),projectPoint(newer.points[wing]),'#f2ede1',density*1.1);
      }
      if(older.points[2] && newer.points[2]) {
        ctx.globalAlpha=(1-older.age/.72)*.72;
        for(const side of [-1,1]) {
          const wake=q=>project(q.points[2][0]+Math.cos(plane.yaw)*side*(1+q.age*18),.2,
            q.points[2][2]-Math.sin(plane.yaw)*side*(1+q.age*18));
          line(ctx,wake(older),wake(newer),'#d3ebe0',1.5);
          if(i%2===0 && newer.age<.42) {
            const puff=wake(newer);
            if(puff) {
              const h=Math.max(1,Math.round(puff.scale*Math.sin(newer.age*7)*2));
              ctx.fillStyle='#f1f1db';
              ctx.fillRect(Math.round(puff.x)+side,Math.round(puff.y)-h,1,2);
            }
          }
        }
      }
    }
    ctx.restore();
  }
  return {update,fire,draw,get ammo(){return gear.filter(t=>t===0).length;},get rails(){return gear;}};
}
