// The original battle renderer faces -Z. PATROL uses +Z for north.
function createAirCombatView(canvas, combat, world) {
  const T = THREE;
  const renderer = new T.WebGLRenderer({canvas, alpha:true, antialias:false, powerPreference:'high-performance'});
  renderer.setClearColor(0, 0);
  renderer.autoClear = false;
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(55, 1, .18, 3500);
  scene.add(new T.HemisphereLight(0xffead1, 0x625470, 2));
  const sun = new T.DirectionalLight(0xffca87, 2.3);
  sun.position.set(24, 46, -50);
  scene.add(sun);
  const vfx = new RiderVFX(scene, camera);
  const pilotCamera = camera.clone();
  const six = createSixSkills(T, scene, pilotCamera, vfx);
  const fleet = createFleet(T, scene, true);
  const formations = new T.Group();
  scene.add(formations);
  const swarm = createSwarm(T, formations, vfx, combat.state.swarm.drones.length);

  const engines = new T.Group();
  scene.add(engines);
  engines.add(vfx.jetGroup, vfx.storm, vfx.sideStorm, ...vfx.trails.map(trail => trail.mesh));
  const shield = new T.Mesh(new T.SphereGeometry(1, 18, 12), new T.ShaderMaterial({
    transparent:true, blending:T.AdditiveBlending, depthWrite:false, side:T.DoubleSide,
    uniforms:{strength:{value:0}},
    vertexShader:'varying vec3 n,v; void main(){vec4 mv=modelViewMatrix*vec4(position,1.); n=normalize(normalMatrix*normal);v=-mv.xyz;gl_Position=projectionMatrix*mv;}',
    fragmentShader:'uniform float strength; varying vec3 n,v; void main(){float rim=pow(1.-abs(dot(normalize(v),normalize(n))),2.8);gl_FragColor=vec4(.18,.9,1.,rim*strength);}'
  }));
  shield.scale.set(3.2,2.3,4.5);
  scene.add(shield);
  const rocketShape = new T.ConeGeometry(.24,1.45,6);
  rocketShape.rotateX(-Math.PI/2);
  function missilePool(length, tint) {
    const material = new T.MeshBasicMaterial({color:tint});
    return Array.from({length}, () => {
      const mesh = new T.Mesh(rocketShape, material);
      mesh.visible = false;
      scene.add(mesh);
      return mesh;
    });
  }
  const enemyRockets = missilePool(combat.state.missiles.length, 0xff5e59);
  const friendlyRockets = missilePool(combat.state.shots.length, 0xabfff4);
  const feedback = {x:0, y:0, flash:0};
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const toWorld = new T.Matrix4(), toBattle = new T.Matrix4(), basis = new T.Matrix4();
  const right = new T.Vector3(), up = new T.Vector3(), back = new T.Vector3(), temp = new T.Vector3();
  const pilot = new T.Vector3(), attitude = new T.Quaternion(), inverseAttitude = new T.Quaternion();
  const euler = new T.Euler(0,0,0,'YXZ');
  const neutral = {x:0, y:0, z:0};
  const nose = new T.Vector3(0,0,-1);
  const grid = 64, spacing = 12;
  const terrain = new T.Mesh(new T.PlaneGeometry(1,1,grid,grid),
    new T.MeshBasicMaterial({colorWrite:false, side:T.DoubleSide}));
  terrain.renderOrder = -100;
  terrain.frustumCulled = false;
  if (world) scene.add(terrain);
  let cellX, cellZ, width = 0, height = 0, shieldFlash = 0;

  function reset(nextCombat) {
    combat = nextCombat;
    const origin = new T.Vector3(...combat.toWorld(0,0,0));
    right.set(...combat.toWorld(1,0,0)).sub(origin);
    up.set(...combat.toWorld(0,1,0)).sub(origin);
    back.set(...combat.toWorld(0,0,-1)).sub(origin);
    toWorld.makeBasis(right,up,back).setPosition(origin);
    toBattle.copy(toWorld).invert();
    cellX = cellZ = undefined;
    shieldFlash = 0;
    six.reset();vfx.reset();swarm.reset();
    feedback.x = feedback.y = feedback.flash = 0;
    renderer.clear();
  }
  function updateTerrain() {
    if (!world) return;
    const cx = Math.floor(pilot.x/spacing/4)*spacing*4, cz = Math.floor(pilot.z/spacing/4)*spacing*4;
    if (cx === cellX && cz === cellZ) return;
    cellX = cx; cellZ = cz;
    const positions = terrain.geometry.attributes.position;
    for (let row=0; row<=grid; row++) for (let col=0; col<=grid; col++) {
      const x = cx+(col-grid/2)*spacing, z = cz+(row-grid/2)*spacing;
      temp.set(x,0,z).applyMatrix4(toWorld);
      temp.y = world.height(temp.x,temp.z)-2;
      temp.applyMatrix4(toBattle);
      positions.setXYZ(row*(grid+1)+col,x,temp.y,z);
    }
    positions.needsUpdate = true;
  }
  function draw(view, plane, dt, events) {
    if (width !== canvas.width || height !== canvas.height) {
      width = canvas.width; height = canvas.height;
      renderer.setSize(width,height,false);
    }
    const state = combat.state;
    pilot.set(state.x,state.y,state.z);
    camera.position.set(...view.pos).applyMatrix4(toBattle);
    right.set(...view.right).transformDirection(toBattle);
    up.set(...view.up).transformDirection(toBattle);
    back.set(...view.forward).transformDirection(toBattle).negate();
    camera.quaternion.setFromRotationMatrix(basis.makeBasis(right,up,back));
    camera.fov = 2*Math.atan(view.tan)*180/Math.PI;
    camera.aspect = width/height;
    camera.updateProjectionMatrix();
    attitude.setFromEuler(euler.set(state.aimPitch || 0,-(state.aimYaw || 0),0));
    inverseAttitude.copy(attitude).invert();
    pilotCamera.position.copy(camera.position).sub(pilot).applyQuaternion(inverseAttitude);
    pilotCamera.quaternion.copy(inverseAttitude).multiply(camera.quaternion);
    pilotCamera.fov = camera.fov;
    pilotCamera.aspect = camera.aspect;
    pilotCamera.updateProjectionMatrix();
    updateTerrain();
    for (const event of events) {
      vfx.trigger(event,state,0);
      if (typeof event === 'string' && /^six[0-5]$/.test(event)) six.cast(Number(event[3]));
      if (event === 'shield-block') shieldFlash = 1;
      if (event === 'hit') vfx.motion.add(.42,3,20);
    }
    vfx.update(dt,state,reduced.matches);
    // Original trail vertices are built in battle space, around the aircraft's position.
    engines.quaternion.copy(attitude);
    engines.position.copy(pilot).sub(temp.copy(pilot).applyQuaternion(attitude));
    shieldFlash = Math.max(0, shieldFlash-dt*4);
    shield.visible = state.shield > 0 || state.mode === 3;
    if (shield.visible) {
      shield.position.copy(pilot);
      shield.quaternion.copy(attitude);
      shield.material.uniforms.strength.value = .38+.42*shieldFlash;
    }
    fleet.update(state,0);
    swarm.update(dt,state,0);
    for (let i=0; i<enemyRockets.length; i++) {
      const m = state.missiles[i], object = enemyRockets[i];
      object.visible = m.active;
      if (m.active) {
        object.position.set(m.x,m.y,-m.d);
        if (m.phase === 1) temp.set(m.vx,m.vy,-m.vd);
        else temp.copy(pilot).sub(object.position);
        if (temp.lengthSq()>0) object.quaternion.setFromUnitVectors(nose,temp.normalize());
      }
    }
    for (let i=0; i<friendlyRockets.length; i++) {
      const m = state.shots[i], object = friendlyRockets[i];
      if (m.active) {
        temp.set(m.x,m.y,-m.d).sub(object.position);
        if (object.visible && temp.lengthSq()>0) object.quaternion.setFromUnitVectors(nose,temp.normalize());
        else object.quaternion.copy(attitude);
        object.position.set(m.x,m.y,-m.d);
      }
      object.visible = m.active;
    }
    six.update(dt,neutral);
    renderer.clear();
    renderer.render(scene,camera);
    six.syncCamera();
    renderer.render(six.root,six.camera);
    const offset = vfx.motion.rig.shakeOffset;
    feedback.x = reduced.matches ? 0 : offset.x*2;
    feedback.y = reduced.matches ? 0 : offset.y*2;
    feedback.flash = reduced.matches ? 0 : Math.min(.23,vfx.flash*.28);
  }
  reset(combat);
  return {draw,reset,feedback};
}
