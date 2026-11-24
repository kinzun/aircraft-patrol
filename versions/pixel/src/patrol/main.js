const el = id => document.getElementById(id);
const surface=el('viewport'), canvas=el('world'), overlay=el('overlay'), ctx=overlay.getContext('2d');
const plane=createFlight(), battleSound=createBattleAudio();
let craft=createAirframe(), combat=null, combatView=null, contact=null, lockAt=-1, lost=false;
const armKeys={KeyQ:'six0',KeyE:'six1',KeyR:'six2',KeyB:'six3',KeyV:'six4',KeyX:'six5',
  Digit1:'tier1',Digit2:'tier2',Digit3:'tier3',Digit4:'pelican',KeyZ:'fire',KeyC:'roar'};
const heldWeapons=new Set(), tappedWeapons=new Set();
const combatHUD=createCombatHUD((action,down)=>setWeapon(action,down,'panel'));
function setWeapon(action,down,source){
  if(!launched || lost)return;
  const id=source+':'+action;
  if(down){heldWeapons.add(id);tappedWeapons.add(action);}else heldWeapons.delete(id);
}
const input={x:0,y:0,manual:false,boost:false,top:false};
let world, mode=0, launched=false, leftAt=null, stick=null, blendStart=-2, previousCamera, camera, cockpitAmount=0, previousAmount=0;
let screenHeight=340, last=0, slow=0, fast=0, telemetryAt=-1, sound, engine, volume;
const keys = new Set();
const modes=['CHASE','NORTH UP','COCKPIT'];
function setAmmo() {
  el('ammo').textContent=String(craft.ammo).padStart(2,'0');
  document.querySelectorAll('.rounds i').forEach((item,i)=>item.classList.toggle('empty',i>=craft.ammo));
}
document.querySelector('.rounds').innerHTML='<i></i>'.repeat(4);
function drawTitle() {
  const glyphs={P:['11110','11011','11011','11110','11000','11000','11000'],A:['01110','11011','11011','11111','11011','11011','11011'],T:['11111','11111','00110','00110','00110','00110','00110'],R:['11110','11011','11011','11110','11100','11010','11011'],O:['01110','11011','11011','11011','11011','11011','01110'],L:['11000','11000','11000','11000','11000','11000','11111']};
  const title=el('titleArt'), g=title.getContext('2d'); title.width=147;title.height=28;g.fillStyle='#ffefd2';
  [...'PATROL'].forEach((letter,i)=>glyphs[letter].forEach((row,y)=>[...row].forEach((on,x)=>{
    if(on==='1')g.fillRect(i*24+x*4+Math.floor((6-y)/2),y*4,4,4);
  })));
}
drawTitle();
function start() {
  if(!world)return;
  if(lost){
    lost=false;launched=false;Object.assign(plane,createFlight());craft=createAirframe();mode=0;input.top=false;
    el('view').innerHTML='CHASE VIEW <b>▸</b>';input.manual=false;camera=previousCamera=null;blendStart=-2;
    cockpitAmount=previousAmount=0;telemetryAt=lockAt=-1;contact=null;combatHUD.reset();clearInput();
  }
  if(!launched){
    combat=createAirCombat(plane);
    if(volume && battleSound.enabled)volume.gain.setTargetAtTime(.018,sound.currentTime,.05);
    if(combatView)combatView.reset(combat);else combatView=createAirCombatView(el('battle-layer'),combat,world);
    launched=true;el('brief').hidden=true;document.body.classList.add('flying');startBlend();
  }
}
function startBlend(){
  if(camera){previousCamera={...camera,offset:camera.pos.map((value,i)=>value-[plane.x,plane.y,plane.z][i])};previousAmount=cockpitAmount;blendStart=plane.time;}
}
function changeView(){if(!world || lost)return;start();startBlend();mode=(mode+1)%3;input.top=mode===1;el('view').innerHTML=modes[mode]+' VIEW <b>▸</b>';}
function fire(){if(launched && !lost && craft.fire(plane,combat.lockTarget(plane,world))){setAmmo();chirp(145,45,.18);}}
function chirp(from,to,duration) {
  if(!battleSound.enabled || !sound || sound.state!=='running')return;
  const osc=sound.createOscillator(),g=sound.createGain(),now=sound.currentTime;
  osc.type='triangle';osc.frequency.setValueAtTime(from,now);osc.frequency.exponentialRampToValueAtTime(to,now+duration);
  g.gain.setValueAtTime(.1,now);g.gain.exponentialRampToValueAtTime(.001,now+duration);
  osc.connect(g).connect(sound.destination);osc.start();osc.stop(now+duration);
}
el('sound').onclick=()=>{
  const on=battleSound.enable(!battleSound.enabled);
  if(!engine && on){
    sound=battleSound.context;engine=sound.createOscillator();volume=sound.createGain();
    engine.type='sawtooth';engine.connect(volume).connect(sound.destination);engine.start();
  }
  if(volume)volume.gain.setTargetAtTime(on && !lost ? .018 : 0,sound.currentTime,.02);
  el('sound').setAttribute('aria-pressed',String(on));el('sound').innerHTML='<span>♪</span> SOUND '+(on?'ON':'OFF');
};
el('launch').onclick=start;el('view').onclick=changeView;
function aim(e){
  const r=surface.getBoundingClientRect();
  input.x=clamp((e.clientX-r.left)/r.width*2-1,-1,1);
  input.y=clamp((e.clientY-r.top)/r.height*2-1,-1,1);input.manual=true;
}
surface.addEventListener('pointermove',e=>{
  if(launched && !lost && !e.target.closest('button,section') && (e.pointerType==='mouse'||e.pointerId===stick))aim(e);
});
surface.addEventListener('contextmenu',e=>e.preventDefault());
surface.addEventListener('pointerdown',e=>{
  if(!world || lost || e.target.closest('button,section'))return;
  start();aim(e);
  if(e.pointerType!=='mouse'){stick=e.pointerId;surface.setPointerCapture(stick);return;}
  if(e.button===2)fire();
  if(e.button===0)leftAt=performance.now();
});
// Mouse button chords emit mousedown/up even when pointerdown/up are suppressed.
surface.addEventListener('mousedown',e=>{
  if(!launched || e.target.closest('button,section'))return;
  if(e.button===2 && (e.buttons&1))fire();
  if(e.button===0 && (e.buttons&2))leftAt=performance.now();
});
window.addEventListener('mouseup',e=>{
  if(e.button===0 && leftAt!==null){if(performance.now()-leftAt<190)plane.rollTime=0;leftAt=null;}
});
window.addEventListener('pointerup',e=>{if(e.pointerId===stick){stick=null;input.x=0;input.y=0;}});
function clearInput(){heldWeapons.clear();tappedWeapons.clear();leftAt=null;stick=null;keys.clear();input.x=0;input.y=0;input.boost=false;}
window.addEventListener('blur',clearInput);window.addEventListener('pointercancel',clearInput);
el('roll').onclick=()=>{plane.rollTime=0;};el('fire').onclick=fire;
el('thrust').onpointerdown=e=>{e.target.setPointerCapture(e.pointerId);keys.add('Boost');};el('thrust').onlostpointercapture=()=>keys.delete('Boost');
window.addEventListener('keydown',e=>{
  if(!world)return;
  if(lost){if(e.code==='Enter' && !e.repeat){e.preventDefault();start();}return;}
  if(armKeys[e.code] && launched){
    e.preventDefault();if(!e.repeat)setWeapon(armKeys[e.code],true,'key');return;
  }
  if(!['Space','KeyF','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','ShiftLeft','ShiftRight','Enter'].includes(e.code))return;
  if(e.target.closest('button') && (e.code==='Enter'||e.code==='Space')){if(e.code==='Enter'|| !launched)return;}
  e.preventDefault();if(e.repeat)return;start();keys.add(e.code);
  if(e.code==='Space')changeView();if(e.code==='KeyF')fire();
});
window.addEventListener('keyup',e=>{keys.delete(e.code);if(armKeys[e.code])setWeapon(armKeys[e.code],false,'key');});
function resize(){
  const h=Math.max(1,Math.min(Math.round(surface.clientHeight),screenHeight));
  const w=Math.max(1,Math.round(h*surface.clientWidth/Math.max(1,surface.clientHeight)));
  if(canvas.width!==w || canvas.height!==h){canvas.width=w;canvas.height=h;el('battle-layer').width=w;el('battle-layer').height=h;}
  const overlayHeight=Math.min(surface.clientHeight,Math.max(340,Math.round(394*surface.clientHeight/Math.max(1,surface.clientWidth))));
  const overlayWidth=Math.round(overlayHeight*surface.clientWidth/Math.max(1,surface.clientHeight));
  if(overlay.width!==overlayWidth || overlay.height!==overlayHeight){
    overlay.width=overlayWidth;overlay.height=overlayHeight;ctx.imageSmoothingEnabled=false;
  }
}
function frame(now){
  const elapsed=last?(now-last)/1000:1/60;last=now;
  const dt=clamp(elapsed,.001,.06);
  if(elapsed>.036){slow+=dt;fast=0;}else{slow=Math.max(0,slow-dt*.6);if(elapsed<.019)fast+=dt;else fast=0;}
  if(slow>1.8 && screenHeight>180){screenHeight=Math.max(180,screenHeight-40);slow=0;}
  if(fast>10 && screenHeight<340){screenHeight=Math.min(340,screenHeight+20);fast=0;}
  resize();input.boost=(leftAt!==null && performance.now()-leftAt>190)||keys.has('Boost')||keys.has('ShiftLeft')||keys.has('ShiftRight');
  const horizontal=Number(keys.has('ArrowRight'))-Number(keys.has('ArrowLeft'));
  const vertical=Number(keys.has('ArrowDown'))-Number(keys.has('ArrowUp'));
  if(lost){requestAnimationFrame(frame);return;}
  const state=combat?.state;
  input.thrust=state ? ([1,1.32,1.65,1.8][state.mode] * (state.overload>0?1.35:1)) : 1;
  const controls=horizontal||vertical?{...input,x:horizontal,y:vertical,manual:true}:input;
  advanceFlight(plane,dt,controls,world);
  const impact=craft.update(dt,plane,world,combat?.strikeSegment);
  if(impact)chirp(85,25,.65);
  let events=[];
  if(combat){
    const weapons=Object.fromEntries([...tappedWeapons].map(action=>[action,true]));
    for(const key of heldWeapons)weapons[key.split(':')[1]]=true;
    tappedWeapons.clear();
    events=combat.step(dt,plane,weapons,world);
    for(const event of events)battleSound.event(event,state);

    if(plane.time-lockAt>.14){contact=combat.lockTarget(plane,world);lockAt=plane.time;}
  }
  camera=flightCamera(plane,mode,!launched,canvas.width/canvas.height);
  const t=clamp((plane.time-blendStart)/.95,0,1),s=t*t*(3-2*t);
  if(previousCamera && t<1){
    // Carry the start pose forward with the aircraft through the transition.
    const origin=[plane.x,plane.y,plane.z];
    for(let i=0;i<3;i++)camera.pos[i]=(origin[i]+previousCamera.offset[i])*(1-s)+camera.pos[i]*s;
    for(const k of ['yaw','pitch','roll'])camera[k]=previousCamera[k]+angle(camera[k]-previousCamera[k])*s;
  }
  cockpitAmount=previousAmount*(1-s)+(mode===2?1:0)*s;
  cameraBasis(camera);world.draw(camera,plane.time,plane);
  if(combat){
    combatView.draw(camera,plane,dt,events);combatHUD.update(state,events);
    const feedback=combatView.feedback;
    surface.style.setProperty('--shake-x',feedback.x+'px');
    surface.style.setProperty('--shake-y',feedback.y+'px');
    surface.style.setProperty('--impact',feedback.flash);
  }
  ctx.clearRect(0,0,overlay.width,overlay.height);
  const project=(x,y,z)=>{
    const d=[x-camera.pos[0],y-camera.pos[1],z-camera.pos[2]];
    const dot=v=>v[0]*d[0]+v[1]*d[1]+v[2]*d[2];
    const depth=dot(camera.forward);if(depth<.8)return null;
    const scale=overlay.height/(2*camera.tan*depth);
    return {x:overlay.width/2+dot(camera.right)*scale,y:overlay.height/2-dot(camera.up)*scale,scale,depth};
  };
  const locked=contact?.position();
  if(locked){
    const point=project(...locked);
    if(point){
      const x=Math.round(point.x),y=Math.round(point.y),r=clamp(Math.round(point.scale*12),5,14);
      ctx.fillStyle='#ffdea4';
      for(const h of [-1,1])for(const v of [-1,1]){
        ctx.fillRect(x+h*r-(h>0?3:0),y+v*r,4,1);
        ctx.fillRect(x+h*r,y+v*r-(v>0?3:0),1,4);
      }
    }
  }
  craft.draw(ctx,project,plane,1-cockpitAmount);
  if(cockpitAmount>.005)drawCockpit(ctx,plane,camera,world,craft.ammo,cockpitAmount);
  if(plane.time>telemetryAt+.15){telemetryAt=plane.time;el('alt').textContent=Math.round(plane.y);el('speed').textContent=Math.round(plane.speed*1.94384);setAmmo();if(sound)engine.frequency.setTargetAtTime(30+plane.speed*.25,sound.currentTime,.2);}
  if(state?.status==='lost'){
    lost=true;clearInput();battleSound.stop();if(volume)volume.gain.setTargetAtTime(0,sound.currentTime,.05);
    el('brief').hidden=false;document.body.classList.remove('flying');
    el('brief').querySelector('p').textContent='Aircraft lost · '+state.kills+' intercepts';
    el('launch').textContent='FLY AGAIN  →';el('launch').focus();
    surface.style.setProperty('--impact',0);surface.style.setProperty('--shake-x','0px');surface.style.setProperty('--shake-y','0px');
  }
  requestAnimationFrame(frame);
}
(async()=>{
  try{
    resize();world=await createWorld(canvas,n=>el('loading').value=n);
    el('launch').disabled=false;el('launch').textContent='TAKE FLIGHT  →';el('loading').hidden=true;requestAnimationFrame(frame);
  }catch(err){el('launch').textContent='FLIGHT DISPLAY UNAVAILABLE';el('loading').hidden=true;el('brief').querySelector('p').textContent='WebGL 2 is required. Enable graphics acceleration and reload.';console.error(err);}
})();
