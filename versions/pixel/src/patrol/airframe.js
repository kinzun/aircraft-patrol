// Local model coordinates are metres, with the nose along +Z.
function createAirframe() {
  const hull = [], gear = [0, 0, 0, 0], shots = [], impacts = [], trails = [];
  const rails = [-5.35, 5.35, -3.85, 3.85];
  const ink = '#273140', deep = '#3c4859', slate = '#5a6976', grey = '#839399';
  const light = '#b7c2ba', cream = '#e8dfbb', red = '#bf5547';
  function face(color, ...points) { hull.push({color, points}); }
  function mirrored(side, color, ...points) {
    face(color, ...points.map(([x,y,z]) => [side*x,y,z]));
  }

  // Stations describe the faceted spine and its gold canopy.
  function loft(stations, colors) {
    let last;
    for (const [z, width, low, high] of stations) {
      const middle = low + (high-low)*0.53;
      const ring = [[0,high,z],[width*.72,high-(high-low)*.15,z],[width,middle,z],
        [width*.75,low,z],[-width*.75,low,z],[-width,middle,z],[-width*.72,high-(high-low)*.15,z]];
      if (last) ring.forEach((p,i) => face(colors[i], last[i], last[(i+1)%7], ring[(i+1)%7], p));
      last = ring;
    }
    face(colors[3], ...last);
  }
  loft([[7.3,.72,-.12,.74],[4.7,1.12,-.45,1.18],[.7,1.63,-.75,1.30],[-3.9,1.58,-.74,1.15],[-7.15,.8,-.44,.59]],
    [grey,slate,deep,ink,deep,grey,light]);
  loft([[10.0,.015,.30,.34],[7.26,.74,-.12,.75]], [slate,deep,ink,ink,ink,deep,grey]);
  loft([[6.9,.045,.68,.74],[5.25,.69,.80,1.64],[3.28,.90,1.02,2.22],[1.85,.65,1.12,1.81],[1.34,.16,1.23,1.30]],
    ['#edc873','#b68548','#49525a',deep,'#765841','#d99b56','#fff0b0']);
  loft([[2.13,.67,1.12,1.81],[1.94,.66,1.10,1.83],[1.76,.62,1.11,1.70]],
    [grey,slate,deep,deep,deep,grey,light]);

  for (const side of [-1,1]) {
    const panel = (color, ...points) => mirrored(side,color,...points);
    // Cropped delta, dogtooth leading edge, broad stabilators and splinter paint.
    panel(slate,[.95,.20,4.90],[2.45,.02,2.20],[3.16,.05,2.48],[7.85,.06,-2.51],[7.66,.08,-3.70],[3.15,.24,-4.01],[1.03,.35,-4.78]);
    panel(side<0 ? light : grey,[1.0,.26,4.90],[2.47,.11,2.15],[3.17,.13,2.48],[7.86,.13,-2.55],[4.44,.22,-2.19],[2.84,.45,-.70],[1.14,.65,.17]);
    panel(deep,[1.16,.68,.15],[2.9,.48,-.66],[4.50,.25,-2.17],[5.85,.23,-2.45],[4.71,.24,-3.84],[3.0,.33,-3.93],[3.20,.36,-2.71],[1.24,.59,-2.19]);
    panel(grey,[5.17,.20,-.08],[6.16,.19,-.73],[5.61,.25,-1.31],[6.76,.21,-2.72],[5.59,.22,-2.48],[4.51,.30,-1.34]);
    panel(cream,[7.25,.18,-1.91],[7.75,.18,-2.42],[7.60,.18,-3.52],[7.13,.18,-3.51]);
    panel(red,[7.74,.19,-2.43],[7.87,.19,-2.56],[7.70,.19,-3.62],[7.57,.19,-3.59]);
    panel(light,[1.74,.12,-4.46],[3.1,.21,-4.50],[5.35,.08,-6.59],[5.18,.10,-7.27],[2.05,.18,-6.90]);
    panel(slate,[2.10,.21,-5.94],[4.16,.18,-5.53],[5.35,.15,-6.65],[5.18,.16,-7.24],[3.4,.21,-7.07]);

    panel(slate,[.04,1.30,1.07],[.71,1.23,.39],[.78,1.14,-1.89],[.20,1.21,-.72]);
    panel(grey,[.25,1.17,-2.68],[.85,1.07,-3.13],[.94,.97,-4.30],[.33,1.09,-3.64]);

    // Boxy inlet transitions to a separate, octagonal engine and nozzle.
    const center=1.48;
    const section=(z,r,cy) => Array.from({length:8},(_,i)=>{
      const a=(i+.5)*Math.PI/4;
      return [side*(center+Math.sin(a)*r),cy+Math.cos(a)*r*.84,z];
    });
    let prev=section(2.72,.72,-.13);
    face(ink,...prev);
    for(const [z,r,cy,metal] of [[1.75,1.08,-.1,false],[-3.75,1.10,-.01,false],[-6.14,1,-.10,false],[-6.58,.99,-.10,true],[-7.62,.76,-.11,true]]) {
      const ring=section(z,r,cy);
      const paints=metal ? [deep,grey,deep,ink,ink,deep,light,slate] : [grey,slate,deep,ink,deep,slate,grey,light];
      ring.forEach((p,i)=>face(paints[i],prev[i],prev[(i+1)%8],ring[(i+1)%8],p));
      prev=ring;
    }
    face(ink,...prev);
    face('#cd6242',...section(-7.65,.53,-.11));
    face('#ffcb78',...section(-7.68,.30,-.11));

    // Twin outward-canted fins with a contrasting crest and unit stripe.
    panel(side<0 ? light : grey,[1.52,.68,-2.24],[1.91,.75,-6.96],[3.06,3.54,-7.03],[2.92,3.68,-5.77]);
    panel(slate,[1.71,.88,-3.27],[2.67,3.04,-5.47],[2.70,2.84,-6.84],[1.94,1.10,-6.87]);
    panel(cream,[2.46,2.47,-5.18],[2.55,2.72,-5.37],[2.84,2.83,-6.93],[2.75,2.58,-6.91]);
    panel(red,[2.76,3.23,-5.41],[2.91,3.70,-5.76],[3.08,3.56,-7.05],[2.94,3.14,-7.00]);
  }

  function pose(plane) {
    const sy=Math.sin(plane.yaw), cy=Math.cos(plane.yaw), sp=Math.sin(plane.pitch), cp=Math.cos(plane.pitch);
    const sr=Math.sin(plane.roll), cr=Math.cos(plane.roll);
    return ([x,y,z]) => {
      const lateral=x*cr+y*sr, vertical=y*cr-x*sr, ahead=z*cp-vertical*sp;
      return [plane.x+lateral*cy+ahead*sy,plane.y+vertical*cp+z*sp,plane.z-lateral*sy+ahead*cy];
    };
  }
  function polygon(ctx, points, color, outline=false) {
    if(points.some(p=>!p)) return;
    ctx.beginPath();
    ctx.moveTo(Math.round(points[0].x), Math.round(points[0].y));
    for (let i=1;i<points.length;i++) ctx.lineTo(Math.round(points[i].x), Math.round(points[i].y));
    ctx.closePath();
    if(outline) {ctx.strokeStyle=ink;ctx.lineWidth=1.6;ctx.stroke();}
    else {ctx.fillStyle=color;ctx.fill();}
  }
  function line(ctx, a,b,color,width=1) {
    if(!a || !b) return;
    ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();
    ctx.moveTo(Math.round(a.x)+.5,Math.round(a.y)+.5);
    ctx.lineTo(Math.round(b.x)+.5,Math.round(b.y)+.5);ctx.stroke();
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
  function draw(ctx,project,plane,visibility) {
    const projectPoint=p=>project(...p);
    ctx.save();ctx.lineCap='butt';ctx.lineJoin='round';
    for(const e of impacts) {
      const t=e.age, center=project(e.x,e.y,e.z);
      if(!center) continue;
      function ring(radius,color) {
        const points=Array.from({length:21},(_,i)=>{
          const a=i*Math.PI/10;
          return project(e.x+radius*Math.cos(a),e.y+.15,e.z+radius*Math.sin(a));
        });
        for(let i=1;i<points.length;i++) line(ctx,points[i-1],points[i],color,1);
      }
      function puff(x,y,z,size,color,k) {
        const p=project(x,y,z);
        if(!p) return;
        const r=Math.max(1,size*p.scale);
        const oct=Array.from({length:8},(_,i)=>{
          const angle=(i+k)*Math.PI/4;
          return {x:p.x+Math.cos(angle)*r,y:p.y+Math.sin(angle)*r*.86};
        });
        polygon(ctx,oct,color);
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
        line(ctx,projectPoint(s.trail[i-1]),projectPoint(s.trail[i]),'#e0d7c2',i<s.trail.length/2?2:1);
      }
      ctx.globalAlpha=1;
      if(p) {
        line(ctx,p,project(s.x-s.vx*.025,s.y-s.vy*.025,s.z-s.vz*.025),'#ffc778',3);
        ctx.fillStyle='#fffbe0';ctx.fillRect(Math.round(p.x)-1,Math.round(p.y)-1,3,2);
      }
    }
    const local=pose(plane), screen=p=>projectPoint(local(p));
    for(let i=1;i<trails.length;i++) {
      const older=trails[i-1], newer=trails[i];
      for(let wing=0;wing<2;wing++) {
        ctx.globalAlpha=(1-older.age/.72)*.53;
        line(ctx,projectPoint(older.points[wing]),projectPoint(newer.points[wing]),'#e6e4d2');
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
    ctx.globalAlpha=typeof visibility==='number' ? Math.max(0,Math.min(visibility,1)) : visibility?1:0;
    if(ctx.globalAlpha>0) {
      const polygons=[];
      function add(color,points) {
        const projected=points.map(screen);
        if(projected.every(Boolean)) polygons.push({color,points:projected,depth:projected.reduce((a,b)=>a+b.depth,0)/projected.length});
      }
      for(const f of hull) add(f.color,f.points);
      rails.forEach((x,i)=>{
        if(gear[i]>0) return;
        const y=-.42;
        add(ink,[[x-.12,y,1.46],[x+.13,y,1.46],[x+.19,y,-1.65],[x+.37,y,-2.16],[x-.34,y,-2.16],[x-.15,y,-1.64]]);
        add(cream,[[x,y,2.22],[x+.16,y+.15,1.36],[x+.13,y+.15,-1.94],[x-.14,y+.15,-1.94],[x-.15,y+.15,1.36]]);
      });
      for(const s of [-1,1]) {
        const x=s*1.48,len=(plane.boost?4.2:1.18)+.33*Math.sin(plane.time*39+s);
        add('#e87b52',[[x-.55,-.11,-7.66],[x,.31,-7.66],[x+.55,-.11,-7.66],[x,-.11,-7.66-len]]);
        add('#fff2b3',[[x-.26,.10,-7.75],[x+.25,.10,-7.75],[x,.03,-7.83-len*.75]]);
      }
      polygons.sort((a,b)=>b.depth-a.depth);
      // Stroke the union first so interior facet seams retain their paint.
      for(const f of polygons) polygon(ctx,f.points,f.color,true);
      for(const f of polygons) polygon(ctx,f.points,f.color);
    }
    ctx.restore();
  }
  return {update,fire,draw,get ammo(){return gear.filter(t=>t===0).length;}};
}
