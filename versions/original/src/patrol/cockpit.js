// Three-by-five instrument lettering stays legible on the low-resolution canvas.
const drawCockpit = (() => {
  const glyphs = {
    A:'25755',B:'65656',C:'34443',D:'65556',E:'74647',F:'74644',G:'34553',
    H:'55755',I:'72227',J:'11152',K:'55655',L:'44447',M:'57755',N:'57775',
    O:'25552',P:'65644',Q:'25573',R:'65655',S:'34216',T:'72222',U:'55557',
    V:'55552',W:'55775',X:'55255',Y:'55222',Z:'71247',
    0:'75557',1:'26227',2:'71247',3:'71217',4:'55711',5:'74617',6:'34757',
    7:'71122',8:'75757',9:'75716','-':'00700','+':'02720','.':'00002',':':'02020',
    '/':'11244',' ':'00000'
  };
  const pi = Math.PI, tau = pi * 2, deg = pi / 180;
  const edge = '#a6a08a', metal = '#52555a', dark = '#1a2026', ink = '#10171c';
  const enamel = '#2c363a', pale = '#dcd2a7', amber = '#efb76d';
  let radar = null, lastScan = -Infinity, radarWorld;

  return function drawCockpit(ctx, plane, camera, world, ammo, opacity = 1) {
    if (opacity <= 0.001) return;
    const width = ctx.canvas.width, height = ctx.canvas.height;
    const cx = width / 2, cy = height / 2, focal = cy / camera.tan;
    const fit = Math.min(width / 394, height / 322);
    const scale = fit < 1 ? fit : Math.floor(fit);
    const halfWidth = Math.ceil(cx / scale), top = -88;
    const speed = Math.round(plane.speed * 1.94384);
    const altitude = Math.round(plane.y * 3.28084);
    const clearance = (plane.y - world.height(plane.x, plane.z)) * 3.28084;
    const heading = (Math.round(plane.yaw / deg) % 360 + 360) % 360;
    const low = clearance < 200;
    const activeBoost = plane.boost > 0.1;
    const bright = '#bff8af';
    ctx.save();
    ctx.globalAlpha *= opacity;
    ctx.imageSmoothingEnabled = false;

    function rect(x, y, w, h, color) {
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    }
    function line(x1, y1, x2, y2, color) {
      x1 = Math.round(x1); x2 = Math.round(x2); y1 = Math.round(y1); y2 = Math.round(y2);
      const dx = Math.abs(x2-x1), dy = -Math.abs(y2-y1);
      const sx = x1 < x2 ? 1 : -1, sy = y1 < y2 ? 1 : -1;
      let error = dx + dy;
      ctx.fillStyle = color;
      for (;;) {
        ctx.fillRect(x1, y1, 1, 1);
        if (x1 === x2 && y1 === y2) break;
        const twice = 2 * error;
        if (twice >= dy) { error += dy; x1 += sx; }
        if (twice <= dx) { error += dx; y1 += sy; }
      }
    }
    function text(value, x, y, color, align = 0) {
      const str = String(value);
      x = Math.round(x - (str.length * 4 - 1) * align);
      ctx.fillStyle = color;
      for (let i = 0; i < str.length; i++) {
        const glyph = glyphs[str[i]] || glyphs[' '];
        for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++)
          if (Number(glyph[r]) & (4 >> c)) ctx.fillRect(x + i*4+c, Math.round(y)+r, 1, 1);
      }
    }
    function polygon(points, color) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(points[0], points[1]);
      for (let i=2; i<points.length; i+=2) ctx.lineTo(points[i], points[i+1]);
      ctx.closePath();
      ctx.fill();
    }
    function dial(x, y, r) {
      for (const [offset, shrink, fill] of [[1,0,'#838079'],[0,0,ink],[0,2,metal],[0,3,enamel]]) {
        ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y+offset, r-shrink, 0, tau); ctx.fill();
      }
    }
    function needle(x,y,r,angle,color) {
      const sin = Math.sin(angle), cos = Math.cos(angle);
      line(x - sin * 2, y + cos * 2, x + r * sin, y - r * cos, color);
      rect(x-1, y-1, 3, 3, '#a2a59a');
    }
    function gauge(x, y, radius, fraction, label, reading) {
      dial(x,y,radius);
      for (let i=0; i<=12; i++) {
        const angle = (i/12 - 0.5) * 4.75;
        const sin = Math.sin(angle), cos = Math.cos(angle), tick = i%3 ? 4 : 6;
        line(x+(radius-4)*sin, y-(radius-4)*cos, x+(radius-tick)*sin, y-(radius-tick)*cos,
          i>10 ? '#de956e' : '#bebfac');
      }
      needle(x,y,radius-6, (Math.max(0,Math.min(1,fraction))-.5)*4.75, pale);
      if (reading !== undefined) {
        const number = String(reading);
        rect(x-(4*number.length+3)/2,y+5,number.length*4+3,7,ink);
        text(number,x,y+6,pale,.5);
      }
      text(label,x,y+radius+3,'#cfccb2',.5);
    }

    // Project the ladder's world-space pitch lines through the actual camera basis.
    const azimuth = Math.atan2(camera.forward[0], camera.forward[2]);
    function skyPoint(az, elevation) {
      const c = Math.cos(elevation), x = c*Math.sin(az), y = Math.sin(elevation), z = c*Math.cos(az);
      const dot = a => x*a[0] + y*a[1] + z*a[2];
      const depth = dot(camera.forward);
      if (depth < .22) return null;
      return [cx + focal*dot(camera.right)/depth, cy - focal*dot(camera.up)/depth];
    }
    const hudWidth = Math.min(width*.42, 154*scale), hudHeight = Math.min(height*.52, 150*scale);
    const hudY = cy - hudHeight*.56;
    const hudInk = 'rgba(173,249,164,.90)';
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx-hudWidth/2, hudY, hudWidth, hudHeight);
    ctx.clip();
    for (let pitch = -80; pitch<=80; pitch+=10) {
      for (const side of [-1,1]) {
        const span = pitch === 0 ? .164 : .091;
        const inner = skyPoint(azimuth+side*.028, pitch*deg);
        const outer = skyPoint(azimuth+side*span, pitch*deg);
        if (!outer || !inner || Math.max(inner[1],outer[1])<hudY-8 || Math.min(inner[1],outer[1])>hudY+hudHeight+8) continue;
        if (pitch >= 0) line(...inner,...outer,hudInk);
        else for (let k=0;k<3;k++) {
          const step = k/3, end = (k+.58)/3;
          line(inner[0]+(outer[0]-inner[0])*step, inner[1]+(outer[1]-inner[1])*step,
            inner[0]+(outer[0]-inner[0])*end,inner[1]+(outer[1]-inner[1])*end,hudInk);
        }
        if (pitch) {
          const notch = skyPoint(azimuth+side*span,(pitch-Math.sign(pitch)*.65)*deg);
          if (notch) line(...outer,...notch,hudInk);
          if (side===1) text(Math.abs(pitch), outer[0]+3,outer[1]-2,hudInk);
        }
      }
    }
    const p = skyPoint(plane.yaw,plane.pitch);
    if (p) {
      const [x,y] = p, s = Math.max(2,Math.round(3*scale));
      rect(x-s+1,y-s,2*s-1,1,bright); rect(x-s+1,y+s,2*s-1,1,bright);
      rect(x-s,y-s+1,1,2*s-1,bright); rect(x+s,y-s+1,1,2*s-1,bright);
      line(x-3*s,y,x-s,y,bright); line(x+s,y,x+3*s,y,bright); line(x,y-s*2,x,y-s,bright);
    }
    ctx.restore();

    // Draw panel and window furniture in design pixels, anchored to the sill.
    ctx.translate(Math.round(cx),height);
    ctx.scale(scale,scale);
    const hudTop = (hudY-height)/scale, hudSide = hudWidth/scale/2;
    const tapeY = hudTop-8;
    for (let i=-30;i<=30;i++) {
      const mark = heading+i;
      if (mark % 5) continue;
      const x = i*1.45;
      rect(x,tapeY,1,mark%10===0?4:2,hudInk);
      if (mark%10===0) text(String(((mark+360)%360)/10).padStart(2,'0'),x,tapeY-7,hudInk,.5);
    }
    polygon([-2,tapeY+7,2,tapeY+7,0,tapeY+4],bright);
    function hudValue(value,x,y,label) {
      const val = String(value), span = val.length*4+6;
      text(label,x,y-8,hudInk,.5);
      rect(x-span/2,y-2,span,1,hudInk); rect(x-span/2,y+6,span,1,hudInk);
      rect(x-span/2,y-1,1,7,hudInk); rect(x+span/2-1,y-1,1,7,hudInk);
      text(val,x,y,bright,.5);
    }
    const mid = -cy/scale - 1;
    hudValue(speed,-hudSide-7,mid,'KTS');
    hudValue(altitude,hudSide+7,mid,'FT');
    text('G '+plane.g.toFixed(1),-hudSide-7,mid+15,hudInk,.5);
    text('R '+Math.round(clearance),hudSide+7,mid+15,hudInk,.5);
    text('MSL '+ammo,0,Math.min(-112,mid+37),hudInk,.5);
    if (low) text('PULL UP',0,mid-22,'#ffe192',.5);

    for (const sign of [-1,1]) {
      const rail = [halfWidth*sign,-height/scale*.60,(halfWidth-4)*sign,-height/scale*.60,
        (halfWidth-32)*sign,-96,(halfWidth-47)*sign,-64,halfWidth*sign,-47];
      polygon(rail,'#242933');
      line((halfWidth-5)*sign,-height/scale*.60,(halfWidth-33)*sign,-96,'#8b8280');
    }
    polygon([-halfWidth,-61,-174,-76,-145,top,-77,top-4,-58,top-11,
      58,top-11,77,top-4,145,top,174,-76,halfWidth,-61,halfWidth,0,-halfWidth,0],ink);
    polygon([-halfWidth,-55,-172,-70,-144,top+6,-73,top+1,-52,top-6,
      52,top-6,73,top+1,144,top+6,172,-70,halfWidth,-55,halfWidth,0,-halfWidth,0],metal);
    polygon([-halfWidth,-38,-164,-63,-139,-76,139,-76,164,-63,halfWidth,-38,halfWidth,0,-halfWidth,0],'#3b4145');
    line(-172,-70,-144,top+6,edge); line(-144,top+6,-74,top+1,edge);
    line(-52,top-6,52,top-6,'#b4aa92');line(74,top+1,144,top+6,'#8c8a7d');
    for (const side of [-1,1]) {
      for (let i=0;i<7;i++) {
        line(side*(73+i*9),-83,side*(78+i*9),-82,dark);
      }
    }
    // Collimator projector box at the foot of the combiner.
    polygon([-29,-95,-21,-102,21,-102,29,-95],dark);
    rect(-18,-100,36,2,'#607365');rect(-12,-100,24,1,'#a3b797');
    function bezel(x,y,w,h) {
      rect(x,y,w,h,'#777b74');rect(x,y,w-1,h-1,ink);rect(x+2,y+2,w-4,h-4,'#343d3f');
      for (const a of [x+3,x+w-5]) for (const b of [y+3,y+h-5]) {
        rect(a,b,2,2,'#85867b');rect(a,b+1,1,1,dark);
      }
    }
    bezel(-81,-80,161,77);
    gauge(-58,-56,17,speed/800,'KTS',speed);
    dial(-18,-56,20);
    ctx.save(); ctx.beginPath();ctx.arc(-18,-56,16,0,tau);ctx.clip();
    ctx.translate(-18,-56);ctx.rotate(-plane.roll);
    const horizonOffset = Math.max(-28,Math.min(28,plane.pitch/deg*.76));
    rect(-32,-32,64,64,'#648696');rect(-32,horizonOffset,64,65,'#ad7854');
    line(-25,horizonOffset,25,horizonOffset,'#eee0b6');
    for (let i=-2;i<=2;i++) if(i) line(-3,horizonOffset+i*5,3,horizonOffset+i*5,'#dcc8a5');
    ctx.restore();
    line(-29,-56,-21,-56,'#ffe6a7');line(-15,-56,-7,-56,'#ffe6a7');rect(-19,-55,3,2,ink);
    text('ATT',-18,-33,'#cfccb2',.5);
    gauge(23,-56,17,(altitude%1000)/1000,'ALT',String(altitude).padStart(4,'0'));
    gauge(61,-56,14,.5+plane.verticalSpeed/120,'VSI');
    rect(-74,-21,61,13,ink);text('HDG',-71,-17,'#94a296');text(String(heading).padStart(3,'0'),-45,-17,pale);
    rect(-9,-21,44,13,ink);text('SLIP',-7,-17,'#94a296');
    line(12,-14,31,-14,'#72807a');
    const ball = Math.max(-8,Math.min(8,(plane.turnRate - Math.sin(plane.roll)*9.81/Math.max(1,plane.speed))*34));
    rect(21+ball,-16,3,3,pale);
    rect(41,-21,32,13,ink);
    const now = new Date(); text([now.getHours(),now.getMinutes()].map(n=>String(n).padStart(2,'0')).join(':'),57,-17,amber,.5);

    bezel(-152,-73,67,70);
    text('TERRAIN',-118,-68,pale,.5);
    const radius=23, radarX=-118,radarY=-36;
    if (!radar) { radar = document.createElement('canvas');radar.width=radar.height=47; }
    if (radarWorld!==world || plane.time-lastScan>.24 || plane.time<lastScan) {
      radarWorld=world;lastScan=plane.time;
      const scan=radar.getContext('2d'), cos=Math.cos(plane.yaw),sin=Math.sin(plane.yaw);
      scan.clearRect(0,0,47,47);
      for(let dy=-radius;dy<=radius;dy+=2) for(let dx=-radius;dx<=radius;dx+=2) {
        if(dx*dx+dy*dy>radius*radius) continue;
        const elevation=world.rawHeight(plane.x+(dx*cos-dy*sin)*48, plane.z+(-dx*sin-dy*cos)*48);
        scan.fillStyle=elevation<0?'#241c1c':elevation<40?'#594022':elevation<130?'#79502b':
          elevation<280?'#a46a38':'#d39957';
        scan.fillRect(dx+radius,dy+radius,2,2);
      }
    }
    dial(radarX,radarY,26);
    ctx.drawImage(radar,radarX-radius,radarY-radius);
    ctx.strokeStyle='#9d7d4b';ctx.lineWidth=1;
    for(const r of [9,16,22]) {ctx.beginPath();ctx.arc(radarX,radarY,r,0,tau);ctx.stroke();}
    const sweep=plane.time*1.65;
    line(radarX,radarY,radarX+Math.sin(sweep)*22,radarY-Math.cos(sweep)*22,'#ffce7e');
    rect(radarX-1,radarY-1,3,2,'#ffe7a6');

    bezel(84,-73,69,70);
    const enginePower=Math.min(1,Math.max(.1,plane.speed/320+(activeBoost?.12:0)));
    gauge(102,-50,13,enginePower,'N1');gauge(135,-50,13,enginePower,'N2');
    text('AGL',90,-23,pale);rect(105,-24,40,7,ink);text(Math.round(clearance),125,-23,amber,.5);
    rect(91,-13,25,6,low?'#d76b4a':'#48554b');text('LOW',103,-13,low?'#ffdfa0':'#92a38c',.5);
    rect(120,-13,25,6,activeBoost?'#bc793c':'#48554b');text('AB',132,-13,activeBoost?'#ffdfa0':'#92a38c',.5);

    bezel(-190,-57,34,55);
    text('THR',-173,-51,pale,.5);
    rect(-178,-40,10,31,ink);
    for(let i=0;i<7;i++) rect(-184,-39+i*4,i%2?2:3,1,edge);
    const leverY=activeBoost?-37:-22;
    rect(-180,leverY,15,7,ink);rect(-179,leverY,13,5,'#a6a79b');rect(-178,leverY,11,1,'#d5c9af');
    bezel(156,-57,35,55);
    text('TURN',173,-50,pale,.5);
    const turn = Math.max(-1,Math.min(1,plane.turnRate*2));
    dial(173,-32,12);needle(173,-32,8,turn*1.3,pale);
    text('L   R',173,-15,pale,.5);
    ctx.restore();
  };
})();
