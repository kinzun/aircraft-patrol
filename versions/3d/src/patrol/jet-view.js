// The airframe is modelled in metres. Three.js looks down -Z, while patrol north is +Z.
function createJetView(canvas) {
  const T=THREE;
  const renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'});
  renderer.setClearColor(0,0);
  renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.05;
  const scene=new T.Scene(),jet=new T.Group(), camera=new T.PerspectiveCamera(55,1,.25,350);
  scene.add(jet,new T.HemisphereLight(0xf6e5d2,0x596a7b,1.55));
  const sun=new T.DirectionalLight(0xffdbac,2.5), rim=new T.DirectionalLight(0xbcd6fa,1.15);
  sun.position.set(11,8,-19);rim.position.set(-8,6,7);scene.add(sun,rim);

  function texture(w,h,draw) {
    const c=document.createElement('canvas');c.width=w;c.height=h;
    draw(c.getContext('2d'),w,h);
    const tex=new T.CanvasTexture(c);
    tex.colorSpace=T.SRGBColorSpace;
    tex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    return tex;
  }
  const reflections=texture(512,256,(g,w,h)=>{
    const sky=g.createLinearGradient(0,0,0,h);
    [[0,'#456480'],[.34,'#92aec0'],[.48,'#f6c995'],[.50,'#a3a7a1'],[.57,'#596d74'],[1,'#2a3c4c']].forEach(([n,c])=>sky.addColorStop(n,c));
    g.fillStyle=sky;g.fillRect(0,0,w,h);
    g.fillStyle='#ffedd1';g.beginPath();g.ellipse(150,106,21,8,-.1,0,Math.PI*2);g.fill();
    g.fillStyle='#fff8e5';g.beginPath();g.arc(165,113,5,0,Math.PI*2);g.fill();
  });
  reflections.mapping=T.EquirectangularReflectionMapping;
  scene.environment=reflections;
  const paint=texture(1024,1024,(g,w,h)=>{
    g.fillStyle='#8b9ba4';g.fillRect(0,0,w,h);
    function patch(color,coords) {
      g.beginPath();coords.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));
      g.closePath();g.fillStyle=color;g.fill();
    }
    patch('#b6c1c3',[[185,0],[422,0],[405,252],[576,409],[514,475],[322,381],[164,506],[45,450],[45,174]]);
    patch('#556a7c',[[358,96],[507,213],[504,318],[669,468],[608,579],[410,470],[372,396],[211,328],[315,288]]);
    patch('#657a88',[[847,180],[778,376],[852,483],[702,608],[782,694],[1004,528],[1024,334]]);
    patch('#566875',[[335,544],[501,581],[579,668],[804,779],[709,883],[500,725],[309,735],[151,615],[194,590]]);
    patch('#a9b5b9',[[0,708],[114,635],[292,728],[304,825],[471,940],[302,1024],[26,948]]);
    // Airbrakes, access panels, control surface joints and squadron markings.
    g.lineWidth=2.2;g.strokeStyle='rgba(32,46,61,.53)';
    for(const side of [-1,1]){
      g.save();g.translate(512,0);g.scale(side,1);
      for(const [a,b,c,d] of [[131,563,418,628],[199,494,222,625],[274,637,438,655],[48,672,42,816],[122,682,262,772],[84,369,90,511]]){
        g.beginPath();g.moveTo(a,b);g.lineTo(c,d);g.stroke();
      }
      g.fillStyle='#a9493c';g.fillRect(431,488,12,230);
      g.fillStyle='#d8cfae';g.fillRect(444,488,8,230);
      g.restore();
    }
    g.fillStyle='#334454';g.font='bold 35px sans-serif';g.fillText('07',724,605);
    g.lineWidth=5;g.strokeStyle='#42596a';g.beginPath();g.arc(243,594,21,0,Math.PI*2);g.stroke();
    g.fillStyle='#d7c7a3';g.beginPath();g.arc(243,594,10,0,Math.PI*2);g.fill();
  });
  const material=(color,roughness=.5,metalness=.35)=>new T.MeshStandardMaterial({color,roughness,metalness,side:T.DoubleSide});
  const skin=new T.MeshStandardMaterial({map:paint,metalness:.42,roughness:.47,side:T.DoubleSide});
  const belly=material(0x77848e), edge=material(0xa7b3b5), dark=material(0x283949,.41), steel=material(0x646c70,.34,.83);
  const enamel=material(0xb44d42,.39),ivory=material(0xd6d0af);
  const glass=new T.MeshPhysicalMaterial({color:0x8c7450,metalness:.62,roughness:.12,clearcoat:1,
    clearcoatRoughness:.055,envMapIntensity:1.4,side:T.DoubleSide});
  function mesh(parent,geometry,mat,x=0,y=0,z=0){
    const item=new T.Mesh(geometry,mat);item.position.set(x,y,-z);parent.add(item);return item;
  }
  function makeGeometry(vertices,triangles){
    const geo=new T.BufferGeometry();
    geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
    const uv=[];
    for(let i=0;i<vertices.length;i+=3)uv.push(.5+vertices[i]/17,(10-vertices[i+2])/20);
    geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(triangles);geo.computeVertexNormals();return geo;
  }
  function loft(mat,stations,segments=32,offsetX=0,parent=jet){
    const v=[],tri=[];
    for(let s=0;s<stations.length;s++){
      const [z,rx,cy,ry]=stations[s];
      for(let k=0;k<segments;k++){
        const a=k*Math.PI*2/segments;
        v.push(offsetX+rx*Math.cos(a),cy+ry*Math.sin(a),-z);
        if(s){
          const lo=(s-1)*segments+k,ln=(s-1)*segments+(k+1)%segments;
          tri.push(lo,ln,lo+segments,ln,ln+segments,lo+segments);
        }
      }
    }
    return mesh(parent,makeGeometry(v,tri),mat);
  }
  loft(skin,[[7.25,.56,.23,.38],[6.5,.79,.30,.60],[5.1,1.0,.34,.77],[3.7,1.24,.34,.88],
    [2.2,1.50,.33,.99],[.2,1.72,.26,1.02],[-2.4,1.73,.26,.98],[-4.8,1.50,.16,.82],[-6.4,1.04,.03,.54],[-7.15,.04,.01,.12]]);
  loft(dark,[[10.18,.012,.2,.012],[9.18,.21,.22,.16],[8.2,.42,.23,.29],[7.25,.565,.23,.38]]);
  loft(edge,[[7.36,.55,.23,.37],[7.24,.57,.23,.39]]);
  loft(dark,[[6.85,.025,.78,.02],[5.6,.55,.95,.41],[4.25,.86,1.13,.60],[3.18,.94,1.22,.68],[2.12,.82,1.26,.48],[1.20,.26,1.24,.07]]);
  loft(glass,[[6.66,.020,.84,.015],[5.53,.52,1.02,.40],[4.3,.81,1.20,.63],[3.28,.90,1.29,.72],[2.28,.78,1.31,.56],[1.55,.38,1.28,.21],[1.35,.04,1.27,.04]]);
  loft(dark,[[2.36,.80,1.32,.58],[2.24,.80,1.31,.56]]);
  const railMeshes=[],burners=[];
  const exhaustRim=material(0x9a9790,.24,.88);
  const hot=new T.MeshBasicMaterial({color:0xffb25d});
  const core=new T.MeshBasicMaterial({color:0xffeabe});
  const flameMat=new T.ShaderMaterial({
    uniforms:{power:{value:0},clock:{value:0}},transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,
    vertexShader:'varying vec3 loc;void main(){loc=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'varying vec3 loc;uniform float power,clock;void main(){float t=clamp(loc.z,0.,1.);float a=pow(1.-t,1.25);float rib=.86+.14*cos(t*28.-clock*15.);vec3 c=mix(vec3(1.,.88,.55),mix(vec3(1.,.25,.04),vec3(.29,.61,1.),power),smoothstep(.03,.65,t));gl_FragColor=vec4(c,a*rib*.72);}'
  });
  const flame=new T.ConeGeometry(1,1,32,1,true);flame.rotateX(Math.PI/2);flame.translate(0,0,.5);
  function wing(side,outline,rootHeight,tipHeight){
    const v=[],tri=[],n=outline.length;
    const curve=outline.map(([x,z])=>new T.Vector2(x,z));
    for(const upper of [true,false])for(const [x,z] of outline){
      const thick=.20*Math.max(.14,1-x/8);
      v.push(side*x,rootHeight+(tipHeight-rootHeight)*x/8+(upper?thick:-thick),-z);
    }
    for(const [a,b,c] of T.ShapeUtils.triangulateShape(curve,[])){
      if(side>0)tri.push(a,b,c,n+c,n+b,n+a);else tri.push(c,b,a,n+a,n+b,n+c);
    }
    for(let i=0;i<n;i++){const j=(i+1)%n;tri.push(i,n+i,j,j,n+i,n+j);}
    return mesh(jet,makeGeometry(v,tri),skin);
  }
  function fin(side,mat,shape,offset=0){
    const v=[],tri=[];
    for(const [z,y] of shape)v.push(side*(1.43+.414*y+offset),y,-z);
    for(let i=1;i<shape.length-1;i++)tri.push(0,i,i+1);
    mesh(jet,makeGeometry(v,tri),mat);
  }
  for(const s of [-1,1]){
    wing(s,[[.72,5.40],[2.45,2.25],[3.21,2.49],[7.91,-2.57],[7.69,-3.7],[3.24,-4.12],[1.02,-4.75]],.29,.03);
    wing(s,[[1.40,-4.12],[2.98,-4.49],[5.47,-6.63],[5.22,-7.33],[1.75,-6.89]],.12,.04);
    fin(s,belly,[[-2.25,.65],[-4.88,3.03],[-7.07,2.86],[-6.90,.65]]);
    fin(s,ivory,[[-4.88,3.03],[-5.1,3.22],[-7.09,3.04],[-7.07,2.86]]);
    fin(s,enamel,[[-5.1,3.22],[-5.72,3.82],[-7.15,3.63],[-7.09,3.04]]);
    fin(s,dark,[[-4.48,2.32],[-4.65,2.49],[-5.73,2.40],[-5.57,2.23]],.019);
    const cx=s*1.48;
    loft(belly,[[3.1,.61,-.28,.51],[2.55,.86,-.31,.63],[.8,1.04,-.16,.77],[-1.8,1.11,-.06,.85],[-4.70,1.07,-.06,.80],[-6.06,.90,-.10,.72]],32,cx);
    loft(dark,[[3.16,.02,-.28,.02],[3.13,.58,-.28,.50],[2.9,.62,-.28,.52]],32,cx);
    loft(steel,[[-5.89,.93,-.1,.75],[-6.22,.94,-.1,.77],[-6.70,.88,-.10,.72],[-7.64,.70,-.10,.59]],32,cx);
    loft(exhaustRim,[[-6.25,.95,-.1,.78],[-6.33,.94,-.1,.77]],32,cx);
    loft(dark,[[-7.65,.705,-.1,.59],[-7.60,.54,-.1,.47],[-7.37,.47,-.1,.40]],32,cx);
    loft(hot,[[-7.45,.53,-.10,.42],[-7.32,.34,-.10,.26]],32,cx);
    loft(core,[[-7.32,.34,-.10,.26],[-7.32,.002,-.10,.002]],32,cx);
    const seam=new T.LineBasicMaterial({color:0x42494d});
    for(let k=0;k<12;k++){
      const a=k*Math.PI/6;
      const line=new T.BufferGeometry().setFromPoints([
        new T.Vector3(cx+.9*Math.cos(a),-.1+.74*Math.sin(a),6.46),
        new T.Vector3(cx+.71*Math.cos(a+.05),-.1+.60*Math.sin(a+.05),7.63)]);
      jet.add(new T.Line(line,seam));
    }
    burners.push(mesh(jet,flame,flameMat,cx,-.1,-7.54));
    const light=material(s>0?0x5fd8b5:0xe85449,.3,.1);
    light.emissive.set(s>0?0x36aa84:0xd43930);
    mesh(jet,new T.SphereGeometry(.10,10,8),light,s*7.78,.09,-3.10);
  }
  const missilePaint=material(0xc5c8c1,.45,.27);
  for(const x of [-5.35,5.35,-3.85,3.85]){
    mesh(jet,new T.BoxGeometry(.16,.38,1.45),belly,x,-.20,.05);
    const rack=new T.Group();jet.add(rack);rack.position.set(x,-.52,0);railMeshes.push(rack);
    loft(missilePaint,[[2.20,.01,0,.01],[1.69,.115,0,.115],[1.26,.15,0,.15],[-1.70,.15,0,.15],[-1.88,.10,0,.10]],16,0,rack);
    loft(dark,[[1.18,.155,0,.155],[1.03,.155,0,.155]],16,0,rack);
    for(let k=0;k<4;k++){
      const v=[.12,0,1.0,.38,0,1.58,.38,0,1.85,.12,0,1.72];
      const stabilizer=mesh(rack,makeGeometry(v,[0,1,2,0,2,3]),edge);
      stabilizer.rotation.z=k*Math.PI/2+.78;
    }
  }
  const basis=new T.Matrix4(),right=new T.Vector3(),up=new T.Vector3(),back=new T.Vector3();
  let w=0,h=0;
  function draw(view,p,visibility,rails){
    canvas.style.opacity=String(visibility);
    if(visibility<.002)return;
    if(canvas.width!==w||canvas.height!==h){w=canvas.width;h=canvas.height;renderer.setSize(w,h,false);}
    camera.position.set(view.pos[0]-p.x,view.pos[1]-p.y,-(view.pos[2]-p.z));
    right.set(view.right[0],view.right[1],-view.right[2]);up.set(view.up[0],view.up[1],-view.up[2]);
    back.set(-view.forward[0],-view.forward[1],view.forward[2]);
    camera.quaternion.setFromRotationMatrix(basis.makeBasis(right,up,back));
    camera.fov=2*Math.atan(view.tan)*180/Math.PI;camera.aspect=w/h;camera.updateProjectionMatrix();
    jet.rotation.set(p.pitch,-p.yaw,-p.roll,'YXZ');
    for(let i=0;i<railMeshes.length;i++)railMeshes[i].visible=rails[i]===0;
    const power=Math.min(1,Math.max(p.boost?1:0,(p.speed-95)/90));
    flameMat.uniforms.power.value=power;flameMat.uniforms.clock.value=p.time;
    burners.forEach((b,i)=>{b.scale.set(.59,.49,(.95+power*4.3)*(1+.055*Math.sin(p.time*39+i)));});
    renderer.render(scene,camera);
  }
  return {draw};
}
