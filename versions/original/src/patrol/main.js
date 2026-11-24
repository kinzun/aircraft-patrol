const el = id => document.getElementById(id);
const surface=el('viewport'), canvas=el('world'), overlay=el('overlay'), ctx=overlay.getContext('2d');
const plane=createFlight(), craft=createAirframe();
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
  if(!launched){launched=true;el('brief').hidden=true;document.body.classList.add('flying');startBlend();}
}
function startBlend(){
  if(camera){previousCamera={...camera,offset:camera.pos.map((value,i)=>value-[plane.x,plane.y,plane.z][i])};previousAmount=cockpitAmount;blendStart=plane.time;}
}
function changeView(){if(!world)return;start();startBlend();mode=(mode+1)%3;input.top=mode===1;el('view').innerHTML=modes[mode]+' VIEW <b>▸</b>';}
function fire(){if(world && craft.fire(plane)){setAmmo();chirp(145,45,.18);}}
function chirp(from,to,duration) {
  if(!sound || sound.state!=='running')return;
  const osc=sound.createOscillator(),g=sound.createGain(),now=sound.currentTime;
  osc.type='triangle';osc.frequency.setValueAtTime(from,now);osc.frequency.exponentialRampToValueAtTime(to,now+duration);
  g.gain.setValueAtTime(.1,now);g.gain.exponentialRampToValueAtTime(.001,now+duration);
  osc.connect(g).connect(sound.destination);osc.start();osc.stop(now+duration);
}
el('sound').onclick=async()=>{
  if(!sound){sound=new AudioContext();engine=sound.createOscillator();volume=sound.createGain();engine.type='sawtooth';volume.gain.value=.018;engine.connect(volume).connect(sound.destination);engine.start();}
  if(el('sound').getAttribute('aria-pressed')==='true')await sound.suspend();else await sound.resume();
  const on=sound.state==='running';el('sound').setAttribute('aria-pressed',String(on));el('sound').innerHTML='<span>♪</span> SOUND '+(on?'ON':'OFF');
};
el('launch').onclick=start;el('view').onclick=changeView;
function aim(e){
  const r=surface.getBoundingClientRect();
  input.x=clamp((e.clientX-r.left)/r.width*2-1,-1,1);
  input.y=clamp((e.clientY-r.top)/r.height*2-1,-1,1);input.manual=true;
}
surface.addEventListener('pointermove',e=>{
  if(launched && !e.target.closest('button') && (e.pointerType==='mouse'||e.pointerId===stick))aim(e);
});
surface.addEventListener('contextmenu',e=>e.preventDefault());
surface.addEventListener('pointerdown',e=>{
  if(!world || e.target.closest('button,section'))return;
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
function clearInput(){leftAt=null;stick=null;keys.clear();input.x=0;input.y=0;input.boost=false;}
window.addEventListener('blur',clearInput);window.addEventListener('pointercancel',clearInput);
el('roll').onclick=()=>{plane.rollTime=0;};el('fire').onclick=fire;
el('thrust').onpointerdown=e=>{e.target.setPointerCapture(e.pointerId);keys.add('Boost');};el('thrust').onlostpointercapture=()=>keys.delete('Boost');
window.addEventListener('keydown',e=>{
  if(!world || !['Space','KeyF','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','ShiftLeft','ShiftRight','Enter'].includes(e.code))return;
  if(e.target.closest('button') && (e.code==='Enter'||e.code==='Space')){if(e.code==='Enter'|| !launched)return;}
  e.preventDefault();if(e.repeat)return;start();keys.add(e.code);
  if(e.code==='Space')changeView();if(e.code==='KeyF')fire();
});
window.addEventListener('keyup',e=>keys.delete(e.code));
function resize(){
  const h=Math.max(1,Math.min(Math.round(surface.clientHeight),screenHeight));
  const w=Math.max(1,Math.round(h*surface.clientWidth/Math.max(1,surface.clientHeight)));
  if(canvas.width!==w || canvas.height!==h){canvas.width=w;canvas.height=h;}
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
  const controls=horizontal||vertical?{...input,x:horizontal,y:vertical,manual:true}:input;
  advanceFlight(plane,dt,controls,world);
  if(craft.update(dt,plane,world))chirp(85,25,.65);
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
  ctx.clearRect(0,0,overlay.width,overlay.height);
  const project=(x,y,z)=>{
    const d=[x-camera.pos[0],y-camera.pos[1],z-camera.pos[2]];
    const dot=v=>v[0]*d[0]+v[1]*d[1]+v[2]*d[2];
    const depth=dot(camera.forward);if(depth<.8)return null;
    const scale=overlay.height/(2*camera.tan*depth);
    return {x:overlay.width/2+dot(camera.right)*scale,y:overlay.height/2-dot(camera.up)*scale,scale,depth};
  };
  craft.draw(ctx,project,plane,1-cockpitAmount);
  if(cockpitAmount>.005)drawCockpit(ctx,plane,camera,world,craft.ammo,cockpitAmount);
  if(plane.time>telemetryAt+.15){telemetryAt=plane.time;el('alt').textContent=Math.round(plane.y);el('speed').textContent=Math.round(plane.speed*1.94384);setAmmo();if(sound)engine.frequency.setTargetAtTime(30+plane.speed*.25,sound.currentTime,.2);}
  requestAnimationFrame(frame);
}
(async()=>{
  try{
    resize();world=await createWorld(canvas,n=>el('loading').value=n);
    el('launch').disabled=false;el('launch').textContent='TAKE FLIGHT  →';el('loading').hidden=true;requestAnimationFrame(frame);
  }catch(err){el('launch').textContent='FLIGHT DISPLAY UNAVAILABLE';el('loading').hidden=true;el('brief').querySelector('p').textContent='WebGL 2 is required. Enable graphics acceleration and reload.';console.error(err);}
})();
