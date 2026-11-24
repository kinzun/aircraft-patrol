// All projection uses the flight camera; panel dimensions use a separate, aspect-fitted design space.
const drawCockpit = (() => {
  const tau=Math.PI*2, rad=Math.PI/180, hud='#b2ffc1', ivory='#e2e8df', amber='#ffcd85';
  const limit=(n,min,max)=>Math.max(min,Math.min(max,n));
  let radar,lastScan=-1,mapWorld;
  function terrainRadar(plane,world) {
    if(!radar){radar=document.createElement('canvas');radar.width=radar.height=96;}
    if(mapWorld===world && plane.time>=lastScan && plane.time-lastScan<.32)return radar;
    const g=radar.getContext('2d'), image=g.createImageData(96,96), data=image.data;
    const c=Math.cos(plane.yaw),s=Math.sin(plane.yaw);
    for(let y=0;y<96;y++)for(let x=0;x<96;x++){
      const dx=(x-47.5)*27,dz=(47.5-y)*27;
      const h=world.rawHeight(plane.x+dx*c+dz*s,plane.z-dx*s+dz*c);
      const relief=h<0?.025:limit(.17+h/620,.17,1);
      const i=4*(96*y+x);
      data[i]=18+177*relief;data[i+1]=16+96*relief;data[i+2]=12+28*relief;data[i+3]=255;
    }
    g.putImageData(image,0,0);mapWorld=world;lastScan=plane.time;return radar;
  }
  return function drawCockpit(ctx,p,camera,world,ammo,opacity=1){
    if(opacity<=.001)return;
    const w=ctx.canvas.width,h=ctx.canvas.height,cx=w/2,cy=h/2,compact=w/h<1.12;
    const unit=Math.min(w/(compact?480:1000),h/(compact?560:630));
    const hudUnit=Math.min(w/(compact?470:940),h/620);
    const airspeed=Math.round(p.speed*1.94384),alt=Math.round(p.y*3.28084);
    const agl=Math.max(0,Math.round((p.y-world.height(p.x,p.z))*3.28084));
    const hdg=(Math.round(p.yaw/rad)%360+360)%360, roc=Math.round(p.verticalSpeed*196.85/10)*10;
    const power=limit(45+(p.speed-90)*.38+(p.boost?22:0),32,100);
    ctx.save();ctx.globalAlpha*=opacity;ctx.imageSmoothingEnabled=true;
    ctx.lineCap='round';ctx.lineJoin='round';
    function line(x,y,u,v,color,width=1){
      ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(u,v);ctx.stroke();
    }
    function ring(x,y,r,color,width=1,start=0,end=tau){
      ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.arc(x,y,r,start,end);ctx.stroke();
    }
    function disk(x,y,r,fill){
      ctx.fillStyle=fill;ctx.beginPath();ctx.arc(x,y,r,0,tau);ctx.fill();
    }
    function box(x,y,w,h,r,fill,border){
      ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();
      if(border){ctx.strokeStyle=border;ctx.lineWidth=1;ctx.stroke();}
    }
    function label(str,x,y,size,color=ivory,weight=500,align='center'){
      ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='middle';
      ctx.font=weight+' '+size+'px ui-monospace, Menlo, Consolas, monospace';ctx.fillText(str,x,y);
    }
    function fade(y0,y1,colors){
      const gradient=ctx.createLinearGradient(0,y0,0,y1);
      colors.forEach(([stop,color])=>gradient.addColorStop(stop,color));return gradient;
    }

    // Project the world-space pitch ladder, including the zero-pitch horizon, onto the combiner.
    const az=Math.atan2(camera.forward[0],camera.forward[2]), focal=cy/camera.tan;
    const project=(a,e)=>{
      const c=Math.cos(e),x=c*Math.sin(a),y=Math.sin(e),z=c*Math.cos(a);
      const dot=v=>x*v[0]+y*v[1]+z*v[2],depth=dot(camera.forward);
      return depth>.16 ? [dot(camera.right)*focal/depth/hudUnit,-dot(camera.up)*focal/depth/hudUnit] : null;
    };
    ctx.save();ctx.translate(cx,cy);ctx.scale(hudUnit,hudUnit);
    const glass=ctx.createLinearGradient(-130,-120,130,100);
    glass.addColorStop(0,'rgba(40,111,112,.11)');glass.addColorStop(.72,'rgba(107,169,124,.035)');glass.addColorStop(1,'rgba(44,91,82,.09)');
    ctx.beginPath();ctx.moveTo(-115,-138);ctx.quadraticCurveTo(-109,-146,-101,-146);ctx.lineTo(101,-146);
    ctx.quadraticCurveTo(109,-146,115,-138);ctx.lineTo(142,89);ctx.quadraticCurveTo(142,101,132,104);
    ctx.lineTo(-132,104);ctx.quadraticCurveTo(-142,101,-142,89);ctx.closePath();
    ctx.fillStyle=glass;ctx.fill();ctx.strokeStyle='rgba(167,207,190,.4)';ctx.lineWidth=1.3;ctx.stroke();ctx.clip();
    ctx.save();ctx.beginPath();ctx.rect(-107,-93,214,165);ctx.clip();
    for(let pitch=-80;pitch<=80;pitch+=10){
      const span=pitch===0?.149:.076;
      ctx.setLineDash(pitch<0?[4,2]:[]);
      for(const side of [-1,1]){
        const a=project(az+side*.024,pitch*rad),b=project(az+side*span,pitch*rad);
        if(!a||!b||Math.min(a[1],b[1])>85||Math.max(a[1],b[1])< -103)continue;
        line(...a,...b,hud,1.35);
        if(pitch){const tick=project(az+side*span,(pitch-Math.sign(pitch)*.55)*rad);
          if(tick)line(...b,...tick,hud,1.2);
          if(side===1)label(Math.abs(pitch),b[0]+10,b[1],9,hud);}
      }
    }
    ctx.setLineDash([]);const sight=project(p.yaw,p.pitch);
    if(sight){const [x,y]=sight;ring(x,y,4.5,hud,1.5);line(x-14,y,x-4.5,y,hud,1.6);
      line(x+4.5,y,x+14,y,hud,1.6);line(x,y-10,x,y-4.5,hud,1.6);}
    ctx.restore();
    // Keep the peripheral readings on dark glass for legibility over the setting sun.
    function hudBox(x,value,unitText){
      label(unitText,x,-16,9,hud,600);box(x-22,-9,44,18,2,'rgba(8,39,28,.34)',hud);
      label(value,x,.5,12,hud,600);
    }
    hudBox(-107,airspeed,'KTS');hudBox(107,alt,'FT');
    label('G '+p.g.toFixed(1),-106,23,9,hud,600);label('R '+agl,106,23,9,hud,600);
    for(let i=-25;i<=25;i++){
      const heading=hdg+i;
      if(heading%5)continue;
      const x=i*3.15,major=heading%10===0;
      line(x,-109,x,-109+(major?6:3),hud,1.25);
      if(major)label(String(((heading+360)%360)/10).padStart(2,'0'),x,-118,9,hud,600);
    }
    line(-3,-99,0,-104,hud,1.4);line(0,-104,3,-99,hud,1.4);
    label('MSL  '+ammo,0,85,10,hud,600);
    if(agl<200)label('PULL UP',0,-65,12,'#ffe395',700);
    ctx.restore();

    ctx.translate(cx,h);ctx.scale(unit,unit);
    const half=w/(2*unit), cap=compact?166:177;
    const body=()=>{ctx.beginPath();ctx.moveTo(-half,-57);ctx.bezierCurveTo(-half*.73,-62,-half*.64,-cap+15,-half*.44,-cap+10);
      ctx.bezierCurveTo(-half*.16,-cap-10,half*.16,-cap-10,half*.44,-cap+10);
      ctx.bezierCurveTo(half*.64,-cap+15,half*.73,-62,half,-57);ctx.lineTo(half,0);ctx.lineTo(-half,0);ctx.closePath();};
    for(const side of [-1,1]){
      ctx.save();ctx.scale(side,1);ctx.beginPath();ctx.moveTo(half+1,-h/unit*.45);
      ctx.bezierCurveTo(half-12,-h/unit*.36,half-30,-130,half-96,-70);
      ctx.lineTo(half-58,-48);ctx.bezierCurveTo(half-25,-83,half-7,-117,half+1,-140);ctx.closePath();
      ctx.fillStyle=fade(-h/unit*.45,-61,[[0,'#828c87'],[.24,'#343b3c'],[.77,'#1c2224'],[1,'#101618']]);ctx.fill();
      ctx.restore();
    }
    body();ctx.fillStyle=fade(-cap-4,0,[[0,'#767870'],[.045,'#424643'],[.09,'#202525'],[.17,'#3d4343'],[1,'#181f21']]);ctx.fill();
    ctx.lineWidth=2;ctx.strokeStyle='rgba(255,215,168,.3)';ctx.stroke();
    const panelWidth=compact?462:800;
    box(-panelWidth/2,-cap+25,panelWidth,cap-29,11,
      fade(-cap+25,0,[[0,'#41484a'],[.13,'#373f41'],[1,'#232a2c']]),'#1b2223');
    function screw(x,y){disk(x,y,2.4,'#78817c');ring(x,y,2.5,'#222726');line(x-1.2,y+.7,x+1.2,y-.7,'#384041',.8);}
    for(const side of [-1,1]){screw(side*(panelWidth/2-8),-cap+33);screw(side*(panelWidth/2-8),-14);}
    function bezel(x,y,r){
      disk(x,y+2,r+1,'#121719');
      disk(x,y,r,fade(y-r,y+r,[[0,'#bac0b4'],[.1,'#646e6b'],[.46,'#353c3d'],[.91,'#262a2c'],[1,'#7c837a']]));
      disk(x,y,r-2.4,'#111819');ring(x,y,r-4,'#565d56',.8);
      const shade=ctx.createRadialGradient(x-r*.23,y-r*.35,0,x,y,r);
      shade.addColorStop(0,'#414b4c');shade.addColorStop(.58,'#263134');shade.addColorStop(1,'#10191c');disk(x,y,r-4.8,shade);
    }
    function gauge(x,y,r,val,min,max,title,valueText,units){
      bezel(x,y,r);
      for(let i=0;i<=28;i++){
        const a=(i/28-.5)*4.8, major=i%4===0, s=Math.sin(a),c=Math.cos(a);
        line(x+s*(r-7),y-c*(r-7),x+s*(r-(major?13:10)),y-c*(r-(major?13:10)),
          i>24?'#e6a282':'#d2ddd1',major?1.8:.9);
      }
      const a=(limit((val-min)/(max-min),0,1)-.5)*4.8;
      line(x-3*Math.sin(a),y+3*Math.cos(a),x+(r-12)*Math.sin(a),y-(r-12)*Math.cos(a),'#f4e2bd',2.2);
      disk(x,y,3,'#d1c1a6');disk(x,y,.9,'#69706a');
      label(title,x,y-r*.35,Math.max(6.4,r*.19),'#b2beb7',650);
      box(x-r*.45,y+r*.27,r*.9,r*.32,2,'#151c1d','#49504d');
      label(valueText,x,y+r*.43,Math.max(7,r*.235),ivory,600);
      if(units)label(units,x,y+r+8,8.2,'#c8cec2',600);
    }
    function attitude(x,y,r){
      bezel(x,y,r);ctx.save();ctx.beginPath();ctx.arc(x,y,r-6,0,tau);ctx.clip();
      ctx.translate(x,y);ctx.rotate(-p.roll);
      const dy=limit(p.pitch/rad*.92,-r*1.4,r*1.4);
      ctx.fillStyle=fade(-r,r,[[0,'#52869e'],[1,'#a1bac4']]);ctx.fillRect(-r*2,-r*2,r*4,r*4);
      ctx.fillStyle=fade(dy,dy+r,[[0,'#b78255'],[1,'#77543f']]);ctx.fillRect(-r*2,dy,r*4,r*3);
      line(-r*1.8,dy,r*1.8,dy,'#f2e8d7',1.5);
      for(let i=-3;i<=3;i++)if(i){const l=i%2?4:9;line(-l,dy+i*8,l,dy+i*8,'rgba(255,248,224,.85)',1);}
      ctx.restore();line(x-r*.55,y,x-5,y,'#ffcf72',3);line(x+5,y,x+r*.55,y,'#ffcf72',3);disk(x,y,1.8,'#ffcc69');
      label('ATTITUDE',x,y+r+8,8.2,'#c8cec2',600);
    }
    function scope(x,y,r){
      bezel(x,y,r);ctx.save();ctx.beginPath();ctx.arc(x,y,r-5,0,tau);ctx.clip();
      ctx.drawImage(terrainRadar(p,world),x-r+4,y-r+4,2*r-8,2*r-8);
      for(const f of [.30,.58,.84])ring(x,y,(r-5)*f,'rgba(243,187,106,.38)',.85);
      line(x-r+5,y,x+r-5,y,'rgba(233,173,89,.23)',.8);line(x,y-r+5,x,y+r-5,'rgba(233,173,89,.23)',.8);
      const sweep=p.time*1.55-Math.PI/2;
      for(let i=0;i<12;i++){
        ctx.beginPath();ctx.moveTo(x,y);ctx.arc(x,y,r-5,sweep-(i+1)*.037,sweep-i*.037);ctx.closePath();
        ctx.fillStyle='rgba(255,203,120,'+(.16*(1-i/12))+')';ctx.fill();
      }
      line(x,y,x+Math.cos(sweep)*(r-5),y+Math.sin(sweep)*(r-5),'#f9ce8f',1.2);
      disk(x,y,1.8,'#ffe7ad');ctx.restore();label('GROUND MAP',x,y+r+8,8.2,'#c8cec2',600);
    }
    const gy=compact?-84:-88;
    if(compact){
      scope(-177,gy,37);gauge(-100,gy,32,airspeed,0,500,'IAS',airspeed,'KNOTS');
      attitude(-23,gy,36);gauge(55,gy,32,alt%1000,0,1000,'ALT',alt,'FEET');
      gauge(131,gy,30,roc,-5000,5000,'V/S',roc,'FT/MIN');
    }else{
      scope(-312,gy,49);gauge(-200,gy,41,airspeed,0,500,'IAS',airspeed,'KNOTS');
      attitude(-103,gy,45);gauge(-5,gy,41,alt%1000,0,1000,'ALT',alt,'FEET');
      gauge(88,gy,37,roc,-5000,5000,'V/S',roc,'FT/MIN');
      gauge(182,gy,32,power,0,100,'N1',Math.round(power),'FAN %');
      gauge(259,gy,32,power,0,100,'N2',Math.round(power),'FAN %');
    }
    const tx=compact?196:340;
    box(tx-13,gy-35,26,64,5,'#1d2425','#5a625c');box(tx-4,gy-29,8,47,3,'#0c1113');
    const leverY=gy+15-(p.boost?41:22);
    box(tx-11,leverY,22,7,2,fade(leverY,leverY+7,[[0,'#c3c5b7'],[.36,'#999e94'],[1,'#515753']]),'#1a1f1e');
    label('THR',tx,gy+39,8.2,'#c8cec2',600);
    const now=new Date(),time=[now.getHours(),now.getMinutes()].map(v=>String(v).padStart(2,'0')).join(':');
    const rowY=-21,span=compact?213:329;
    box(-span,rowY-9,span*2,18,3,'#172021','#4d5653');
    label('HDG '+String(hdg).padStart(3,'0')+'°',-span+7,rowY,9,ivory,600,'left');
    label('AGL '+agl+' FT',compact?-83:-157,rowY,8.5,agl<200?'#ffae7e':ivory,550);
    const turn=limit(p.turnRate*1.6,-1,1),slip=limit((p.turnRate-Math.sin(p.roll)*9.81/Math.max(1,p.speed))*1.6,-1,1);
    const sx=compact?-12:-29;
    label('TURN',sx-30,rowY,7.8,'#afbbb4',550);
    line(sx-11,rowY-3,sx+11,rowY-3,'#75827c',.8);line(sx+10*turn,rowY-5,sx+10*turn,rowY-2,ivory,1.4);
    line(sx-11,rowY+3,sx+11,rowY+3,'#75827c',.8);disk(sx+10*slip,rowY+3,2,'#d9ddc9');
    if(compact)label('N1/2 '+Math.round(power)+'%',50,rowY,8.5,ivory,550);
    else {label('SLIP',sx+30,rowY,7.8,'#afbbb4',550);
      label(agl<200?'LOW ALT':'ALT CLEAR',112,rowY,8.5,agl<200?'#ffae7e':'#9bae9c',550);}
    label('A/B',compact?107:190,rowY,8.5,p.boost?amber:'#7e8982',600);
    label(time,span-8,rowY,10,amber,600,'right');
    ctx.restore();
  };
})();
