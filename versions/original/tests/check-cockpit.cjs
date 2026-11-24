const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
let fills=[], scales=[], depth=0;
const ctx={canvas:{width:608,height:342},globalAlpha:1, save(){depth++},restore(){depth--},fillRect(...args){assert(args.every(Number.isFinite)); if(this.fillStyle==='rgba(173,249,164,.90)') fills.push(args)},scale(...args){scales.push(args)},beginPath(){},arc(){},clip(){},rect(){},fill(){},closePath(){},translate(){},stroke(){},rotate(){},drawImage(){},moveTo(){},lineTo(){}};
const scan={clearRect(){},fillRect(){}};
const api=vm.runInNewContext(fs.readFileSync(__dirname+'/../src/patrol/cockpit.js','utf8')+'; drawCockpit',{document:{createElement(){return{getContext(){return scan}}}}});
const plane={x:0,y:350,z:0,yaw:0,pitch:0,roll:0,speed:130,boost:false,time:0,verticalSpeed:0,turnRate:0,g:1};
const world={height(){return 32},rawHeight(){return 32}};
for(const [width,height,pitch,roll] of [[608,342,0,0],[608,342,.12,.25],[170,342,-.16,2.93],[260,143,-.07,-.22]]) {
  ctx.canvas={width,height};fills=[];scales=[];
  const a=Math.sin(pitch), b=Math.cos(pitch), s=Math.sin(roll), c=Math.cos(roll);
  const camera={right:[c,-s*b,s*a],up:[s,c*b,-c*a],forward:[0,a,b],tan:.6};
  api(ctx,{...plane,pitch,roll},camera,world,4,1);
  assert.equal(depth,0);assert.equal(scales.length,1);
  if(Math.abs(roll)<.4) {
    const onHorizon=fills.filter(([x,y])=>Math.abs((y-height/2)*camera.up[1]-(x-width/2)*camera.right[1]-(height/2/camera.tan)*camera.forward[1])<1.5);
    assert(onHorizon.length>3,'天际线投影的像素不足');
  }
}
console.log('通过四组纵横屏、俯仰和侧倾组合的像素地平线与画布状态检查');
