// Both the renderer and flight dynamics sample this periodic elevation field.
async function createWorld(canvas, onProgress = () => {}) {
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, depth: true, powerPreference: 'high-performance' });
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
    const trunks=[];
    for (let tree = 0; tree < count * .24; tree++) {
      const x = Math.floor(random() * size), z = Math.floor(random() * size), i = at(x,z);
      const h = elevation[i];
      if (h < 6 || h > 830 || forest[i] < .64) continue;
      const pine = species[i] < .32 || h > 480 || random() < .11;
      const tall = pine ? 13 + random() * 19 : 10 + random() * 11;
      const radius = pine ? 1.1 + random() * .7 : 1.4 + random() * 1.35;
      const kind = pine ? 1 : species[i] > .61 ? 2 : species[i] > .47 ? 3 : 4;
      trunks.push(x*period/size,z*period/size,h,tall,radius*8,kind);
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
        const r = Math.sqrt(dx * dx + dz * dz) / radius;
        if (r >= 1) continue;
        const n = at(x + dx, z + dz);
        const top = tall * (pine ? 1 - r : Math.sqrt(1 - r*r));
        if (top > crown[n] && elevation[n] > 3) { crown[n] = top; foliage[n] = kind; }
      }
    }
    postMessage({progress:.62});
    const sand = [210,190,154], meadow = [149,147,97], moss = [111,135,91], pine = [44,84,70];
    const copper = [174,102,56], gold = [198,151,70], crimson = [143,74,55], rock = [141,136,138], snow = [230,223,216];
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
        const tint = (lit - .2) * 16 + (random()-.5)*5;
        const shadow = [75,67,93];
        for(let c=0;c<3;c++) colors[k+c] = Math.max(0,Math.min(255,Math.round((base[c]+tint)*(1-shade)+shadow[c]*shade)));
        colors[k+3] = Math.round(255 * (1-shade));
        const packed = Math.max(0,Math.min(65535,Math.round((top-floor)/span*65535)));
        heights[k] = packed >> 8; heights[k+1] = packed & 255; heights[k+2] = foliage[i] * 50; heights[k+3] = Math.round(255 * Math.min(1, crown[i]/35));
      }
      if (!(z % 128)) postMessage({progress: .65 + .33 * z / size});
    }
    const trees=new Float32Array(trunks);
    postMessage({heights,colors,trees},[heights.buffer,colors.buffer,trees.buffer]);
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
  // Project a concentrically coarser grid instead of sampling the whole relief along each screen ray.
  const gridSteps = [[40,8],[26,20],[26,48],[24,112],[22,360]];
  const half = [0];
  for (const [count,step] of gridSteps) for (let i=0; i<count; i++) half.push(half[half.length-1]+step);
  const axis = half.slice(1).reverse().map(v=>-v).concat(half), side=axis.length;
  const offsets = new Float32Array(side*side*2), indices = new Uint32Array((side-1)*(side-1)*6);
  for (let z=0,k=0;z<side;z++) for(let x=0;x<side;x++,k+=2){offsets[k]=axis[x];offsets[k+1]=axis[z];}
  for (let z=0,k=0;z<side-1;z++) for(let x=0;x<side-1;x++,k+=6){
    const a=z*side+x;indices.set([a,a+side,a+1,a+1,a+side,a+side+1],k);
  }
  const grid=gl.createVertexArray();
  gl.bindVertexArray(grid);
  gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,offsets,gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);
  gl.bindVertexArray(null);

  function texture(unit,bytes,n,mips) {
    const tex=gl.createTexture();gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,n,n,0,gl.RGBA,gl.UNSIGNED_BYTE,bytes);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,mips?gl.LINEAR_MIPMAP_LINEAR:gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    if(mips)gl.generateMipmap(gl.TEXTURE_2D);
  }
  texture(0,data.heights,size,false); texture(1,data.colors,size,true);
  const randomBytes=new Uint8Array(256*256*4);
  let seed=31001;
  for(let i=0;i<randomBytes.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;randomBytes[i]=seed>>>24;}
  texture(2,randomBytes,256,true);

  // Bucket the worker's actual tree positions; only upload nearby groves when crossing a cell.
  const bucketWidth=128, bucketCount=period/bucketWidth;
  const groves=Array.from({length:bucketCount*bucketCount},()=>[]);
  for(let i=0;i<data.trees.length;i+=6){
    const x=Math.floor(data.trees[i]/bucketWidth),z=Math.floor(data.trees[i+1]/bucketWidth);
    groves[z*bucketCount+x].push(i);
  }
  const forestVao=gl.createVertexArray();gl.bindVertexArray(forestVao);
  const treeProfile=[];
  function treeRing(r0,h0,r1,h1,sides){
    for(let j=0;j<sides;j++){
      const a=j*2*Math.PI/sides,b=(j+1)*2*Math.PI/sides;
      const points=[[a,r0,h0],[a,r1,h1],[b,r1,h1],[a,r0,h0],[b,r1,h1],[b,r0,h0]];
      for(const [angle,radius,height] of points)treeProfile.push(Math.cos(angle)*radius,height, Math.sin(angle)*radius);
    }
  }
  // Distinct contiguous ranges share one immutable mesh for trunks, deciduous crowns and spruce tiers.
  treeRing(.065,0,.042,.55,5);const trunkEnd=treeProfile.length/3;
  for(const [r0,h0,r1,h1] of [[.30,.24,.78,.40],[.78,.40,.98,.59],[.98,.59,.82,.79],[.82,.79,.45,.94],[.45,.94,.04,1]])
    treeRing(r0,h0,r1,h1,8);
  const leafEnd=treeProfile.length/3;
  for(const [r,h,peak] of [[.90,.16,.67],[.72,.36,.82],[.49,.55,.94],[.28,.72,1]])
    treeRing(r,h,0,peak,7);
  const spruceEnd=treeProfile.length/3;
  gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(treeProfile),gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);
  const instanceBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,instanceBuffer);
  gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,4,gl.FLOAT,false,24,0);gl.vertexAttribDivisor(1,1);
  gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,2,gl.FLOAT,false,24,16);gl.vertexAttribDivisor(2,1);
  gl.bindVertexArray(null);
  let groveX=Infinity,groveZ=Infinity,broadCount=0,pineCount=0;
  function gatherTrees(pos){
    const cx=Math.floor(pos[0]/bucketWidth),cz=Math.floor(pos[2]/bucketWidth);
    if(cx===groveX && cz===groveZ)return;
    groveX=cx;groveZ=cz;
    const broad=[],pine=[];
    for(let z=cz-18;z<=cz+18;z++)for(let x=cx-18;x<=cx+18;x++){
      const offsetX=Math.floor(x/bucketCount)*period,offsetZ=Math.floor(z/bucketCount)*period;
      for(const i of groves[(z & (bucketCount-1))*bucketCount+(x & (bucketCount-1))]){
        const t=data.trees, list=t[i+5]===1?pine:broad;
        const worldX=t[i]+offsetX,worldZ=t[i+1]+offsetZ;
        const limit=840+5.6*(((t[i]/8)*103+(t[i+1]/8)*293)&255);
        if(Math.hypot(worldX-pos[0],worldZ-pos[2])<limit+190)
          list.push(worldX,worldZ,t[i+2],t[i+3],t[i+4],t[i+5]);
      }
    }
    broadCount=broad.length/6;pineCount=pine.length/6;
    gl.bindBuffer(gl.ARRAY_BUFFER,instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(broad.concat(pine)),gl.DYNAMIC_DRAW);
  }
  const common=`#version 300 es
precision highp float;
uniform vec3 eye,rightV,upV,forwardV,aircraft;
uniform vec2 res;
uniform float fov,clock,heading,mirror;
uniform sampler2D relief,albedo,grain,reflection;
const vec3 sun=vec3(.347,.153,.925);
vec2 uv(vec2 p){return p/8192.+.5/1024.;}
float elevation(vec2 p){
  vec4 sampleData=textureLod(relief,uv(p),0.);
  float top=dot(sampleData.rg,vec2(2048.*256./257.,2048./257.))-192.;
  return top-sampleData.a*35.;
}
vec4 project(vec3 p){
  vec3 v=p-eye; float z=dot(v,forwardV);
  return vec4(dot(v,rightV)*res.y/(fov*res.x),dot(v,upV)/fov,z*1.00002-.8,z);
}
`;
  const fragment=`
out vec4 frag;
vec3 ray(){vec2 p=(gl_FragCoord.xy*2.-res)/res.y;return normalize(forwardV+fov*(rightV*p.x+upV*p.y));}
float n(vec2 p){return texture(grain,p/256.).r;}
float cloudField(vec2 p){
  return .51*n(p)+.26*n(p*2.04+23.)+.14*n(p*4.1+56.)+.065*n(p*8.25)+.025*n(p*16.6);
}
vec3 horizon(vec3 r){
  float facing=pow(max(0.,dot(r,sun)),2.);
  return mix(vec3(.67,.70,.77),vec3(1.,.75,.51),facing);
}
vec3 sky(vec3 r){
  float h=max(0.,r.y),mu=max(0.,dot(r,sun));
  vec3 air=mix(horizon(r),vec3(.24,.47,.67),1.-exp(-h*3.1));
  vec2 p=r.xz/(.04+h)*vec2(3.4,6.)+eye.xz*.00028;
  float vapor=cloudField(p+vec2(clock*.003,0));
  float mask=smoothstep(.50,.74,vapor)*smoothstep(.006,.10,h);
  float reliefLight=clamp(.51+(cloudField(p-.24)-vapor)*2.8,0.,1.);
  vec3 cloud=mix(vec3(.60,.62,.72),vec3(1.,.84,.71),reliefLight);
  air=mix(air,cloud,mask*.91);
  float solarDist=length(r-sun);
  air+=vec3(.32,.18,.065)*exp(-solarDist*8.)+vec3(.16,.075,.015)*exp(-solarDist*32.);
  return mix(air,vec3(1.,.969,.84),1.-smoothstep(.031,.034,solarDist));
}
float shadow(vec3 p){
  float dy=aircraft.y-p.y;if(dy<0. || dy>700.)return 0.;
  vec2 q=p.xz-aircraft.xz+sun.xz*dy/sun.y;
  float co=cos(heading),si=sin(heading);q=vec2(co*q.x-si*q.y,si*q.x+co*q.y);
  float body=max(abs(q.x)/2.1,abs(q.y)/12.);
  float wing=max(abs(q.x)/9.,abs(q.y+abs(q.x)*.67)/2.9);
  return (1.-smoothstep(.75,1.24+dy*.001,min(body,wing)))*(1.-dy/740.);
}
`;
  const screen=`#version 300 es
void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.-1.,0.,1.);}`;
  const skyProgram=program(screen,common+fragment+`
void main(){vec3 r=ray();if(mirror>.5)r.y=-r.y;frag=vec4(sky(r),1.);}
`);
  const groundVertex=common+`
layout(location=0) in vec2 offset;
out vec3 worldPos;
void main(){
  vec2 p=floor(eye.xz/8.)*8.+offset;
  float ground=elevation(p);
  worldPos=vec3(p.x,max(0.,ground),p.y);
  gl_Position=project(vec3(p.x,mix(worldPos.y,-worldPos.y,mirror),p.y));
}`;
  const ground=program(groundVertex,common+fragment+`
in vec3 worldPos;
vec2 ripple(vec2 p,float t,float fade){
  float a=sin(dot(p,vec2(.13,.27))+t*.85+n(p*.035)*5.);
  float b=sin(dot(p,vec2(-.31,.44))-t*1.1+n(p*.08)*4.);
  vec2 broad=(texture(grain,(p*vec2(.10,.26)+vec2(0.,t*.8))/256.).rg-.5);
  return broad*.19+fade*(vec2(.024,.045)*a+vec2(-.022,.031)*b);
}
void main(){
  vec3 p=worldPos,rd=normalize(p-eye);float dist=length(p-eye);
  vec2 coords=uv(p.xz);float h=elevation(p.xz);
  if(mirror>.5 && h<0.)discard;
  vec3 color;
  if(h<0. && mirror<.5){
    float micro=1.-smoothstep(120.,900.,dist);
    vec2 slopes=ripple(p.xz,clock,micro);
    vec3 normal=normalize(vec3(slopes.x,1.,slopes.y));
    float facing=clamp(dot(normal,-rd),0.,1.);
    float fresnel=.06+.88*pow(1.-facing,3.);
    vec3 bottom=mix(vec3(.31,.66,.60),vec3(.075,.29,.38),1.-exp(h*.032));
    vec2 reflectionUV=clamp(gl_FragCoord.xy/res+slopes*(.035+.026*facing),.002,.998);
    color=mix(bottom,texture(reflection,reflectionUV).rgb,fresnel);
    vec3 halfVector=normalize(sun-rd);
    float spec=pow(max(0.,dot(normal,halfVector)),160.);
    color+=vec3(1.,.73,.39)*spec*.72;
    float foam=(1.-smoothstep(.15,2.4,-h))*(.62+.28*n(p.xz*.61+clock*.23));
    vec2 dir=vec2(sin(heading),cos(heading)),wake=p.xz-aircraft.xz;
    float behind=-dot(wake,dir);
    if(aircraft.y<27. && behind>0. && behind<120.){
      float shore=abs(dot(wake,vec2(dir.y,-dir.x)))-behind*.18;
      foam+=exp(-shore*shore*.24)*(1.-behind/120.)*.7;
    }
    color=mix(color,vec3(.83,.91,.84),min(1.,foam));
  }else{
    vec4 material=texture(albedo,coords);
    float dx=elevation(p.xz+vec2(8,0))-elevation(p.xz-vec2(8,0));
    float dz=elevation(p.xz+vec2(0,8))-elevation(p.xz-vec2(0,8));
    vec3 normal=normalize(vec3(-dx,16.,-dz));
    float bounce=normal.y*.22;
    float diffuse=max(0.,dot(normal,normalize(vec3(.34,.53,.84))));
    vec3 light=vec3(.64,.70,.78)+vec3(.52,.41,.26)*diffuse+bounce;
    float micro=n(p.xz*.8+vec2(p.y*.51,p.y*.17));
    color=material.rgb*light*(.94+.12*micro);
    float cloudShade=smoothstep(.51,.67,cloudField(p.xz*.0018+vec2(clock*.007,1.9)));
    color*=1.-cloudShade*.14;
  }
  color*=1.-shadow(p)*.38;
  vec3 air=horizon(rd);
  float fog=(1.-exp(-dist*.00018))*.92;
  frag=vec4(mix(color,air,fog),1.);
}`);
  const treeProgram=program(common+`
layout(location=0) in vec3 profile;
layout(location=1) in vec4 instance;
layout(location=2) in vec2 traits;
out vec3 colorV,normalV,positionV;
uniform float trunk;
void main(){
  vec2 base=instance.xy;
  float distanceXZ=length(base-eye.xz);
  ivec2 tile=ivec2(mod(base,8192.)/8.);
  float limit=840.+5.6*float((tile.x*103+tile.y*293)&255);
  float fade=1.-smoothstep(limit-350.,limit,distanceXZ);
  if(fade<.015){gl_Position=vec4(2.,2.,2.,1.);return;}
  float seed=fract(sin(dot(mod(base,8192.),vec2(.17,.29)))*4375.67);
  float theta=seed*6.2832,cs=cos(theta),sn=sin(theta);
  vec2 rad=vec2(profile.x*cs-profile.z*sn,profile.x*sn+profile.z*cs);
  float h=profile.y, isPine=1.-step(1.5,traits.y);
  float uneven=1.+.16*sin(h*15.+theta)*cos((rad.x+rad.y)*5.+h*6.);
  vec2 canopy=rad*traits.x*.75*uneven;
  canopy.x+=sin(h*4.+theta)*h*traits.x*.16;
  vec3 p=vec3(base.x+canopy.x*fade,instance.z+h*instance.w*fade,base.y+canopy.y*fade);
  positionV=p;
  normalV=normalize(vec3(rad.x,mix((h-.53)*2.,.5,isPine),rad.y)+vec3(.001,0.,0.));
  colorV=traits.y<1.5?vec3(.16,.28,.20):traits.y<2.5?vec3(.77,.53,.19):
         traits.y<3.5?vec3(.68,.34,.13):vec3(.49,.225,.13);
  colorV=mix(colorV,vec3(.30,.23,.16),trunk)*(.82+.32*seed);
  colorV*=mix(.78,1.12,h);
  gl_Position=project(vec3(p.x,mix(p.y,-p.y,mirror),p.z));
}`,common+fragment+`
in vec3 colorV,normalV,positionV;
void main(){
  vec3 normal=normalize(normalV), p=positionV;
  float lit=max(0.,dot(normal,normalize(vec3(.34,.47,.84))));
  float leaves=n(p.xz*.79+p.y*.67);
  vec3 leaf=colorV*(vec3(.67,.72,.75)+vec3(.55,.46,.33)*lit)*(.88+.22*leaves);
  float dist=length(p-eye);
  frag=vec4(mix(leaf,horizon(normalize(p-eye)),(1.-exp(-dist*.00018))*.92),1.);
}`);
  const mist=program(screen,common+fragment+`
void main(){
  vec3 r=ray();
  if(abs(r.y)<.012)discard;
  float t=(232.-eye.y)/r.y;
  if(t<5. || t>7900.)discard;
  vec3 p=eye+r*t;
  vec2 q=p.xz*vec2(.00175,.00245)+vec2(31.2+clock*.006,16.5);
  float field=cloudField(q);
  float a=smoothstep(.645,.762,field)*smoothstep(35.,240.,t)*(1.-smoothstep(4400.,7800.,t));
  if(a<.012)discard;
  float lighting=clamp(.47+(field-cloudField(q-.35))*3.,0.,1.);
  vec3 color=mix(vec3(.62,.66,.74),vec3(1.,.88,.76),lighting);
  color=mix(color,horizon(r),1.-exp(-t*.00018));
  color*=1.-shadow(p)*.30;
  vec4 clip=project(p);gl_FragDepth=(clip.z/clip.w)*.5+.5;
  frag=vec4(color,a*.86);
}`);
  const variables=p=>{
    const loc=Object.fromEntries(['eye','rightV','upV','forwardV','res','fov','clock','aircraft','heading','mirror']
      .map(key=>[key,gl.getUniformLocation(p,key)]));
    gl.useProgram(p);
    for(const [unit,name] of ['relief','albedo','grain','reflection'].entries())gl.uniform1i(gl.getUniformLocation(p,name),unit);
    return loc;
  };
  const groundLoc=variables(ground),treeLoc=variables(treeProgram),skyLoc=variables(skyProgram),mistLoc=variables(mist);
  const trunkLoc=gl.getUniformLocation(treeProgram,'trunk');
  function uniforms(loc,c,t,plane,width,height,mirror){
    gl.uniform2f(loc.res,width,height);gl.uniform3fv(loc.eye,c.pos);gl.uniform3fv(loc.rightV,c.right);
    gl.uniform3fv(loc.upV,c.up);gl.uniform3fv(loc.forwardV,c.forward);gl.uniform1f(loc.fov,c.tan);
    gl.uniform1f(loc.clock,t);gl.uniform1f(loc.heading,plane.heading||0);gl.uniform1f(loc.mirror,mirror);
    gl.uniform3f(loc.aircraft,plane.x,plane.y,plane.z);
  }
  const reflected=gl.createTexture(), framebuffer=gl.createFramebuffer(), depth=gl.createRenderbuffer();
  let reflectedWidth=0,reflectedHeight=0;
  function sizeReflection(width,height){
    if(width===reflectedWidth && height===reflectedHeight)return;
    reflectedWidth=width;reflectedHeight=height;
    gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,reflected);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    for(const p of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,p,gl.LINEAR);
    for(const p of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,p,gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,reflected,0);
    gl.bindRenderbuffer(gl.RENDERBUFFER,depth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,width,height);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,depth);
  }
  onProgress(1);
  return {rawHeight,height:(x,z)=>Math.max(0,rawHeight(x,z)),
    draw(camera,time,plane){
      const rw=Math.max(1,Math.round(canvas.width/3)),rh=Math.max(1,Math.round(canvas.height/3));
      gatherTrees(camera.pos);sizeReflection(rw,rh);
      gl.activeTexture(gl.TEXTURE3);
      for(const mirrored of [1,0]){
        const w=mirrored?rw:canvas.width,h=mirrored?rh:canvas.height;
        gl.bindFramebuffer(gl.FRAMEBUFFER,mirrored?framebuffer:null);
        // A colour attachment cannot also be bound as input in the reflection pass.
        gl.bindTexture(gl.TEXTURE_2D,mirrored?null:reflected);
        gl.viewport(0,0,w,h);gl.clear(gl.DEPTH_BUFFER_BIT);
        gl.disable(gl.DEPTH_TEST);gl.bindVertexArray(null);
        gl.useProgram(skyProgram);uniforms(skyLoc,camera,time,plane,w,h,mirrored);
        gl.drawArrays(gl.TRIANGLES,0,3);
        gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.bindVertexArray(grid);
        gl.useProgram(ground);uniforms(groundLoc,camera,time,plane,w,h,mirrored);
        gl.drawElements(gl.TRIANGLES,indices.length,gl.UNSIGNED_INT,0);
        gl.useProgram(treeProgram);uniforms(treeLoc,camera,time,plane,w,h,mirrored);
        gl.bindVertexArray(forestVao);gl.bindBuffer(gl.ARRAY_BUFFER,instanceBuffer);
        gl.vertexAttribPointer(1,4,gl.FLOAT,false,24,0);gl.vertexAttribPointer(2,2,gl.FLOAT,false,24,16);
        gl.uniform1f(trunkLoc,1);
        gl.drawArraysInstanced(gl.TRIANGLES,0,trunkEnd,broadCount+pineCount);
        gl.uniform1f(trunkLoc,0);
        gl.drawArraysInstanced(gl.TRIANGLES,trunkEnd,leafEnd-trunkEnd,broadCount);
        gl.vertexAttribPointer(1,4,gl.FLOAT,false,24,broadCount*24);gl.vertexAttribPointer(2,2,gl.FLOAT,false,24,broadCount*24+16);
        gl.drawArraysInstanced(gl.TRIANGLES,leafEnd,spruceEnd-leafEnd,pineCount);
      }
      gl.bindVertexArray(null);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(mist);uniforms(mistLoc,camera,time,plane,canvas.width,canvas.height,0);
      gl.drawArrays(gl.TRIANGLES,0,3);gl.disable(gl.BLEND);
    }
  };
}
