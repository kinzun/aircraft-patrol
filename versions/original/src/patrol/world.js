// Both the renderer and flight dynamics sample this periodic elevation field.
async function createWorld(canvas, onProgress = () => {}) {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: true, powerPreference: 'high-performance' });
  if (!gl) throw new Error('This flight deck needs WebGL 2. Enable hardware acceleration and reload.');
  const size = 1024, period = 8192, span = 2048, floor = -192;

  function generateTerrain(size, period, span, floor) {
    const mask = size - 1, count = size * size;
    const elevation = new Float32Array(count);
    const forest = new Float32Array(count);
    const species = new Float32Array(count);
    const crown = new Float32Array(count);
    const foliage = new Uint8Array(count);
    const heights = new Uint8Array(count * 4), colors = new Uint8Array(count * 4);
    const hash = new Float32Array(256 * 256);
    let seed = 32017;
    function random() {
      seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
      return seed / 4294967296;
    }
    for (let i = 0; i < hash.length; i++) hash[i] = random();
    const clamp = x => Math.max(0, Math.min(1, x));
    function noise(x, z, n, salt) {
      const ix = Math.floor(x * n), iz = Math.floor(z * n), m = n - 1;
      let fx = x * n - ix, fz = z * n - iz;
      fx *= fx * (3 - 2 * fx); fz *= fz * (3 - 2 * fz);
      const a = ((ix & m) + salt) & 255, b = (((ix + 1) & m) + salt) & 255;
      const row = (((iz & m) + salt * 3) & 255) * 256;
      const next = ((((iz + 1) & m) + salt * 3) & 255) * 256;
      const lo = hash[row + a] * (1 - fx) + hash[row + b] * fx;
      const hi = hash[next + a] * (1 - fx) + hash[next + b] * fx;
      return lo + (hi - lo) * fz;
    }
    for (let z = 0; z < size; z++) {
      const v = z / size, a = v * Math.PI * 2;
      const meander = .055 * Math.sin(a + .4) + .115 * Math.sin(2 * a - .6);
      const width = .113 + .048 * Math.sin(a + .5) + .043 * Math.cos(2 * a - .7);
      for (let x = 0; x < size; x++) {
        const u = x / size, i = z * size + x;
        const big = noise(u, v, 8, 7), medium = noise(u, v, 32, 49), fine = noise(u, v, 128, 41);
        const dx = u - meander + .13 * (noise(u, v, 4, 93) - .5);
        const shore = Math.abs(dx - Math.round(dx)) - width;
        // A curving flooded valley with islands, foothills, and folded ridgelines.
        const relief = shore * 1240 + (big - .5) * 445 + (medium - .5) * 86 + (fine - .5) * 13;
        const ridge = 1 - Math.abs(2 * noise(u + .045 * big, v - .06 * big, 8, 63) - 1);
        const peaks = clamp((shore + .008) * 3.75);
        elevation[i] = Math.max(-182, relief + peaks * (245 + ridge * ridge * 510 + 350 * (noise(u,v,4,81) - .5)));
        forest[i] = noise(u, v, 32, 25) + .4 * big + .14 * fine;
        species[i] = noise(u, v, 16, 57) * .7 + .3 * noise(u,v,64,17);
      }
      if (!(z % 128)) postMessage({progress: .05 + .42 * v});
    }
    function at(x,z) { return (z & mask) * size + (x & mask); }
    for (let tree = 0; tree < count * .24; tree++) {
      const x = Math.floor(random() * size), z = Math.floor(random() * size), i = at(x,z);
      const h = elevation[i];
      if (h < 6 || h > 830 || forest[i] < .64) continue;
      const pine = species[i] < .32 || h > 480 || random() < .11;
      const tall = pine ? 13 + random() * 19 : 10 + random() * 11;
      const radius = pine ? 1.1 + random() * .7 : 1.4 + random() * 1.35;
      const kind = pine ? 1 : species[i] > .61 ? 2 : species[i] > .47 ? 3 : 4;
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
        const r = Math.sqrt(dx * dx + dz * dz) / radius;
        if (r >= 1) continue;
        const n = at(x + dx, z + dz);
        const top = tall * (pine ? 1 - r : Math.sqrt(1 - r*r));
        if (top > crown[n] && elevation[n] > 3) { crown[n] = top; foliage[n] = kind; }
      }
    }
    postMessage({progress:.62});
    const sand = [219,184,128], meadow = [175,158,91], moss = [132,141,95], pine = [62,94,85];
    const copper = [192,105,61], gold = [225,165,75], crimson = [160,82,69], rock = [144,134,148], snow = [242,220,204];
    for (let z = 0; z < size; z++) {
      for (let x = 0; x < size; x++) {
        const i = at(x,z), k = i * 4, h = elevation[i], top = h + crown[i];
        const r = at(x+1,z), l = at(x-1,z), f = at(x,z+1), b = at(x,z-1);
        const gx = (elevation[r]+crown[r]-elevation[l]-crown[l]) / 16;
        const gz = (elevation[f]+crown[f]-elevation[b]-crown[b]) / 16;
        const slope = Math.hypot(gx,gz);
        let base = h < 5 ? sand : species[i] < .36 ? moss : meadow;
        if (foliage[i]) base = [null,pine,gold,copper,crimson][foliage[i]];
        if (h > 690 + species[i] * 160 || (slope > 1.05 && !foliage[i])) base = rock;
        if (h > 882 + 180 * species[i] + 62 * slope) base = snow;
        const lit = (.55 - gx * .36 - gz * .86) / Math.sqrt(1 + slope*slope);
        let obscured = 0;
        for (const step of [2,5,11,23,45,88]) {
          const j = at(x + Math.round(step * .36), z + Math.round(step * .93));
          obscured = Math.max(obscured, (elevation[j]+crown[j]-top)/(step*8) - .14);
        }
        const shade = Math.min(.65, Math.max(0,.18-lit)*.64 + Math.min(.4,obscured*.9));
        const tint = (Math.round(lit * 3) / 3 - .2) * 14 + (random()-.5)*7;
        const shadow = [75,67,93];
        for(let c=0;c<3;c++) colors[k+c] = Math.max(0,Math.min(255,Math.round((base[c]+tint)*(1-shade)+shadow[c]*shade)));
        colors[k+3] = 255;
        const packed = Math.max(0,Math.min(65535,Math.round((top-floor)/span*65535)));
        heights[k] = packed >> 8; heights[k+1] = packed & 255; heights[k+3] = 255;
      }
      if (!(z % 128)) postMessage({progress: .65 + .33 * z / size});
    }
    postMessage({heights,colors},[heights.buffer,colors.buffer]);
  }
  const workerURL = URL.createObjectURL(new Blob(['(' + generateTerrain.toString() + ')(' + [size,period,span,floor].join(',') + ')'], {type:'text/javascript'}));
  const worker = new Worker(workerURL);
  let data;
  try {
    data = await new Promise((resolve, reject) => {
      worker.onmessage = ({data}) => data.heights ? resolve(data) : onProgress(data.progress);
      worker.onerror = e => reject(new Error(e.message || 'Terrain generation failed'));
    });
  } finally { worker.terminate(); URL.revokeObjectURL(workerURL); }
  function program(vs,fs) {
    function compile(type,src) {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
      return sh;
    }
    const p = gl.createProgram();
    gl.attachShader(p,compile(gl.VERTEX_SHADER,vs)); gl.attachShader(p,compile(gl.FRAGMENT_SHADER,fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }
  const common = `#version 300 es
precision highp float;
uniform vec2 res;
uniform vec3 eye, rightV, upV, forwardV, aircraft;
uniform float fov, clock, heading;
const vec3 sun = vec3(.347,.153,.925);
vec3 ray(){vec2 p=(gl_FragCoord.xy*2.-res)/res.y; return normalize(forwardV+fov*(rightV*p.x+upV*p.y));}
float bayer(){
 const float m[16]=float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
 ivec2 xy=ivec2(gl_FragCoord.xy)&3;return (m[xy.y*4+xy.x]+.5)/16.;
}
float hash(vec2 v){vec3 p=fract(v.xyx*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
vec3 horizon(vec3 r){return mix(vec3(.78,.66,.73),vec3(1.,.81,.58),smoothstep(-.2,.97,dot(r,sun)));}
vec3 pigment(vec3 c){return floor(clamp(c,0.,1.)*48.+bayer()*.65+.175)/48.;}
float jetShade(vec3 pos){
 float dy=aircraft.y-pos.y;if(dy<0.)return 0.;
 vec2 q=pos.xz-aircraft.xz+sun.xz*dy/sun.y;
 float co=cos(heading),si=sin(heading);q=vec2(co*q.x-si*q.y,si*q.x+co*q.y);
 float body=max(abs(q.x)/2.1,abs(q.y)/12.);
 float wing=max(abs(q.x)/9.,abs(q.y+abs(q.x)*.67)/2.9);
 return (1.-smoothstep(.8,1.2,min(body,wing)))*max(.08,1.-dy/800.);
}
out vec4 frag;
`;
  const fullscreen = `#version 300 es
void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.-1.,0.,1.);}`;
  const surface = program(fullscreen,common+`
uniform sampler2D relief, albedo;
const float tile=8192.;
vec2 uv(vec2 x){return x/tile+.5/1024.;}
float elev(vec2 p){vec2 v=textureLod(relief,uv(p),0.).rg;return dot(v,vec2(2048.*256./257.,2048./257.))-192.;}
vec3 sky(vec3 r){
 float y=max(0.,r.y);vec3 h=horizon(r);
 vec3 top=mix(vec3(.34,.43,.60),vec3(.48,.50,.64),pow(max(dot(r,sun),0.),4.));
 vec3 c=mix(h,top,smoothstep(-.07,.84,pow(y,.72)));
 // Streaked cirrus catch the light well above the low cumulus deck.
 vec2 p=r.xz/(max(.03,y)+.07);
 float cirrus=noise(p*vec2(2.1,6.))+noise(p*vec2(4.2,12.))*.30;
 c=mix(c,mix(vec3(.88,.76,.77),vec3(1.,.84,.69),max(0.,dot(r,sun))),smoothstep(.79,.86,cirrus)*smoothstep(.015,.105,y)*.58);
 float sunDist=length(r-sun);
 c=mix(c,vec3(1.,.837,.596),max(0.,1.-sunDist/.38)*.30);
 if(sunDist<.086)c=vec3(1.,.94,.72);
 return c;
}
vec3 water(vec3 p,vec3 r,float depth,float dist){
 float deep=smoothstep(0.,100.,depth);
 vec3 c=mix(vec3(.41,.72,.69),vec3(.185,.37,.47),floor(deep*4.+bayer()*.56)/4.);
 float refl=pow(1.-max(0.,-r.y),3.);
 c=mix(c,mix(vec3(.56,.56,.67),horizon(r),.40),refl*.68);
 vec2 wave=p.xz*.072;
 float n=noise(vec2(wave.x*.19,wave.y*1.6+clock*.84));
 float ripple=noise(vec2(wave.x*.39+clock*.22,wave.y*2.8));
 c+=vec3(.06,.10,.10)*step(.76,n)*(1.-smoothstep(500.,4200.,dist));
 float sg=dot(normalize(r.xz),normalize(sun.xz));
 float path=pow(max(0.,sg),52.)*(1.-smoothstep(.13,.85,-r.y));
 c=mix(c,vec3(.99,.76,.47),path*.38);
 if(n+.12*ripple>mix(1.05,.49,path) && dist<7600.) c=mix(c,vec3(1.,.88,.61),.81);
 else if(ripple>.88 && n>.47 && dist<3500.)c=mix(c,vec3(.79,.86,.80),.62);
 float foam=2.8+1.7*sin(clock*1.8+noise(p.xz*.045)*6.);
 if(depth<foam && n>.21)c=vec3(.82,.85,.73);
 vec2 wake=p.xz-aircraft.xz; vec2 dir=vec2(sin(heading),cos(heading));
 float behind=-dot(wake,dir), side=abs(dot(wake,vec2(dir.y,-dir.x)));
 if(aircraft.y<27. && behind>0. && behind<115. && abs(side-behind*.19)<2.2)
   c=mix(c,vec3(.9,.92,.83),pow(1.-behind/115.,.5));
 return c;
}
float cloudShadow(vec3 p, bool high){
 float target=high?1100.:218.;
 if(p.y>target+200.)return 0.;
 vec2 projected=p.xz+sun.xz*(target-p.y)/sun.y;
 vec2 cell=floor(projected/1120.);
 float k=hash(cell+11.);if(k<.63 || (k>.71)!=high)return 0.;
 float h=high?920.+hash(cell+6.)*350.:194.+hash(cell+6.)*52.;
 if(p.y>h)return 0.;
 vec2 center=(cell+vec2(.17+.65*hash(cell+3.),.2+.6*hash(cell+5.)))*1120.;
 center.x+=sin(clock*.009)*38.;
 vec2 delta=p.xz+sun.xz*(h-p.y)/sun.y-center;
 float scale=(75.+95.*hash(cell+9.))*(high?1.8:1.);
 float d=length(delta/(scale*vec2(2.1,1.6)));
 return 1.-smoothstep(.65,1.14,d);
}
void main(){
 vec3 r=ray();vec3 color=sky(r);float t=0.,last=0.;bool hit=false;
 if(eye.y>1500. && r.y<-.0001)t=max(0.,(1500.-eye.y)/r.y);
 for(int i=0;i<135;i++){
   vec3 p=eye+r*t;if(t>12400. || (r.y>=0. && p.y>1500.))break;
   float gap=p.y-max(0.,elev(p.xz));
   if(gap<=0.){hit=true;break;}
   last=t;t+=clamp(gap/(.62+max(0.,-r.y))*.83,4.+t*.0045,170.);
 }
 if(hit){
   for(int i=0;i<6;i++){float m=(t+last)*.5;vec3 p=eye+m*r;if(p.y>max(elev(p.xz),0.))last=m;else t=m;}
   vec3 p=eye+r*t;float h=elev(p.xz);
   if(h<.1){p.y=0.;color=water(p,r,-h,t);}
   else {color=textureLod(albedo,uv(p.xz),clamp(log2(max(1.,t*fov/res.y/4.)),0.,5.)).rgb;}
   color=mix(color,color*vec3(.76,.78,.87),max(cloudShadow(p,false),cloudShadow(p,true)));
   color*=1.-jetShade(p)*.48;
   float fog=1.-exp(-t*.000144);
   color=mix(color,horizon(r),fog*.90);
   gl_FragDepth=clamp(1.-1./(1.+t*dot(r,forwardV)),0.,1.);
 }else gl_FragDepth=1.;
 frag=vec4(pigment(color),1.);
}`);
  function texture(unit,bytes,mipmap) {
    const tex=gl.createTexture();gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,size,size,0,gl.RGBA,gl.UNSIGNED_BYTE,bytes);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,mipmap?gl.LINEAR_MIPMAP_LINEAR:gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,mipmap?gl.NEAREST:gl.LINEAR);
    if(mipmap)gl.generateMipmap(gl.TEXTURE_2D);
  }
  texture(0,data.heights,false); texture(1,data.colors,true);
  const locations = p => Object.fromEntries(['eye','rightV','upV','forwardV','res','fov','clock','aircraft','heading'].map(key=>[key,gl.getUniformLocation(p,key)]));
  const worldLoc=locations(surface);
  gl.useProgram(surface); gl.uniform1i(gl.getUniformLocation(surface,'relief'),0);gl.uniform1i(gl.getUniformLocation(surface,'albedo'),1);
  function uniforms(loc,c,t,plane){
    gl.uniform2f(loc.res,canvas.width,canvas.height);
    gl.uniform3fv(loc.eye,c.pos); gl.uniform3fv(loc.rightV,c.right); gl.uniform3fv(loc.upV,c.up);
    gl.uniform3fv(loc.forwardV,c.forward);gl.uniform1f(loc.fov,c.tan);gl.uniform1f(loc.clock,t);
    gl.uniform3f(loc.aircraft,plane.x,plane.y,plane.z);gl.uniform1f(loc.heading,plane.heading || 0);
  }
  function sample(x,z){
    const ix=(x&1023),iz=(z&1023),k=(iz*size+ix)*4;
    return ((data.heights[k]*256+data.heights[k+1])/65535)*span+floor;
  }
  function rawHeight(x,z) {
    const px=x*size/period,pz=z*size/period,ix=Math.floor(px),iz=Math.floor(pz);
    const dx=px-ix,dz=pz-iz;
    const a=sample(ix,iz)*(1-dx)+sample(ix+1,iz)*dx;
    return a*(1-dz)+(sample(ix,iz+1)*(1-dx)+sample(ix+1,iz+1)*dx)*dz;
  }
  // Small banks of intersecting ellipsoids give the cloud deck real parallax from all three views.
  const cloudVertex=`#version 300 es
precision highp float;
uniform vec2 res;
uniform vec3 eye,rightV,upV,forwardV;
uniform float fov,clock;
flat out vec3 cloudCenter;
flat out float cloudScale;
flat out vec2 cloudShape;
float hash(vec2 v){vec3 p=fract(v.xyx*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
void main(){
 vec2 cell=floor(eye.xz/1120.)+vec2(gl_InstanceID%17-8,gl_InstanceID/17-8);
 float k=hash(cell+11.);
 vec2 pos=(cell+vec2(.17+.65*hash(cell+3.),.2+.6*hash(cell+5.)))*1120.;
 float y=k>.71?920.+hash(cell+6.)*350.:194.+hash(cell+6.)*52.;
 cloudScale=75.+95.*hash(cell+9.);if(k>.71)cloudScale*=1.8;
 cloudShape=vec2(hash(cell+12.),hash(cell+16.));
 cloudCenter=vec3(pos.x+sin(clock*.009)*38.,y,pos.y);
 vec3 rel=cloudCenter-eye;
 float z=dot(rel,forwardV), depth=max(.8,z-2.8*cloudScale);
 if(k<.63 || z< -2.7*cloudScale || length(rel)>9100.){gl_Position=vec4(2.,2.,2.,1.);return;}
 vec2 q=vec2((gl_VertexID==1||gl_VertexID==3)?1.:-1.,(gl_VertexID>=2)?1.:-1.);
 if(z<3.*cloudScale){gl_Position=vec4(q,.1,1.);return;}
 vec2 ndc=vec2(dot(rel,rightV)*res.y/res.x,dot(rel,upV))/(fov*z);
 vec2 extent=(abs(ndc)+vec2(res.y/res.x,1.)/fov)*2.8*cloudScale/depth;
 gl_Position=vec4(ndc+q*extent,.1,1.);
}`;
  const cloud=program(cloudVertex,common+`
flat in vec3 cloudCenter;flat in float cloudScale;flat in vec2 cloudShape;
void main(){
 vec3 rd=ray();vec3 eyeCloud=(eye-cloudCenter)/cloudScale;
 const vec3 center[7]=vec3[7](vec3(-1.4,-.06,.04),vec3(-.83,.14,.06),vec3(-.24,.36,.02),vec3(.32,.16,-.14),vec3(.78,.21,.08),vec3(1.35,-.01,.10),vec3(.07,-.08,.16));
 const vec3 scale[7]=vec3[7](vec3(.77,.31,.51),vec3(.76,.55,.64),vec3(.72,.64,.75),vec3(.65,.56,.67),vec3(.62,.54,.50),vec3(.75,.34,.48),vec3(1.26,.34,.72));
 float best=1.e6;vec3 normal=vec3(0);
 for(int i=0;i<7;i++){
   vec3 bulb=center[i], radii=scale[i];
   bulb.x*=cloudShape.x>.5?-1.:1.;
   float puff=fract(cloudShape.y*45.+float(i)*.618);
   bulb.y+=(puff-.5)*.28;
   radii.y*=.58+.72*puff;
   radii.x*=.86+cloudShape.x*.32;
   vec3 off=eyeCloud-bulb,v=rd/radii,o=off/radii;
   float b=dot(o,v),a=dot(v,v),disc=b*b-a*(dot(o,o)-1.);
   if(disc<=0.)continue;
   float t=(-b-sqrt(disc))/a;
   if(t>.005 && t<best){best=t;normal=normalize((off+rd*t)/(radii*radii));}
 }
 if(best>99999.)discard;
 float dist=best*cloudScale;vec3 hit=eye+rd*dist;
 float l=dot(normal,normalize(vec3(.39,.69,.63)))+bayer()*.065;
 vec3 color=l<-.25?vec3(.62,.57,.67):l<.13?vec3(.77,.66,.70):l<.49?vec3(.89,.74,.70):l<.76?vec3(.98,.84,.72):vec3(1.,.91,.75);
 color*=1.-jetShade(hit)*.32;
 color=mix(color,horizon(rd),.76*(1.-exp(-dist*.00018)));
 gl_FragDepth=clamp(1.-1./(1.+dist*dot(rd,forwardV)),0.,1.);
 frag=vec4(pigment(color),1.);
}`);
  const cloudLoc=locations(cloud);
  onProgress(1);
  return {
    rawHeight, height:(x,z)=>Math.max(0,rawHeight(x,z)),
    draw(camera,time,plane) {
      gl.viewport(0,0,canvas.width,canvas.height);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.ALWAYS);
      gl.useProgram(surface); uniforms(worldLoc,camera,time,plane); gl.drawArrays(gl.TRIANGLES,0,3);
      gl.depthFunc(gl.LESS);
      gl.useProgram(cloud); uniforms(cloudLoc,camera,time,plane); gl.drawArraysInstanced(gl.TRIANGLE_STRIP,0,4,289);
    }
  };
}
