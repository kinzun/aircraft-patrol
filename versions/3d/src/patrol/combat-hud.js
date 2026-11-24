// Cockpit controls use the same combat actions as the keyboard.
function createCombatHUD(onAction) {
  const systems = [
    ['six0','Q','Ice spike'], ['six1','E','Thunder'], ['six2','R','Meteor'],
    ['six3','B','Beam'], ['six4','V','Snare'], ['six5','X','Glacier'],
    ['tier1','1','Surge'], ['tier2','2','Overburn'], ['tier3','3','Phase drive'],
    ['pelican','4','Storm pulse'], ['fire','Z','Cannon'], ['roar','C','Burst shield'],
  ];
  const panel = document.getElementById('loadout');
  const toggle = document.getElementById('loadout-toggle');
  const hull = document.getElementById('hull');
  const message = document.getElementById('combat-message');
  const carrier = document.getElementById('carrier-status');
  const carrierLabel = document.getElementById('carrier-label');
  const carrierHull = document.getElementById('carrier-hull');
  const carrierImpact = document.getElementById('carrier-impact');
  let nextDraw = -1, messageUntil = 0, alertText = '';

  const buttons = systems.map(([action,key,name]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.action = action;
    button.innerHTML = '<kbd>'+key+'</kbd><span>'+name+'</span><small>READY</small>';
    button.setAttribute('aria-keyshortcuts', key);
    panel.appendChild(button);
    const status = button.lastElementChild;
    function release() {
      if (!button.classList.contains('held')) return;
      button.classList.remove('held');
      onAction(action,false);
    }
    button.onpointerdown = event => {
      if (event.button !== 0 || button.getAttribute('aria-disabled') === 'true') return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      button.classList.add('held');
      onAction(action,true);
    };
    button.onlostpointercapture = release;
    button.onpointerup = release;
    button.onpointercancel = release;
    button.onclick = event => {
      if (event.detail === 0 && button.getAttribute('aria-disabled') !== 'true') {
        onAction(action,true);
        onAction(action,false);
      }
    };
    return {button,status,release};
  });
  function expand(open) {
    if (!open) buttons.forEach(item => item.release());
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded',String(open));
  }
  toggle.onclick = () => expand(panel.hidden);
  const hud = document.getElementById('combat-hud');
  hud.addEventListener('pointermove',e => e.stopPropagation());
  for (const event of ['keydown','keyup']) hud.addEventListener(event,e => {
    if (e.code === 'Space' || e.code === 'Enter') e.stopPropagation();
  });
  window.addEventListener('blur',() => buttons.forEach(item => item.release()));

  function reset() {
    nextDraw = -1;
    messageUntil = 0;
    alertText = '';
    expand(false);
    hull.textContent = 'HULL 100%';
    hull.classList.remove('low');
    message.hidden = carrier.hidden = true;
  }

  function update(s,events=[]) {
    const alerts = {'wave':'Hostile formation inbound','boss':'Carrier group inbound','boss-down':'Carrier destroyed',
      'incoming':'Missile inbound','boss-area-warning':'Carrier weapons charging','hit':'Hull hit','shield-block':'Attack deflected'};
    for (const event of events) {
      if (typeof event === 'string' && alerts[event]) {
        alertText = alerts[event];
        messageUntil = s.elapsed+1.8;
        nextDraw = -1;
      }
    }
    if (s.elapsed < nextDraw) return;
    nextDraw = s.elapsed + .10;
    hull.textContent = 'HULL '+Math.ceil(s.health)+'%';
    hull.classList.toggle('low',s.health < 30);
    const boss = s.battle.enemies[12];
    carrier.hidden = !boss.active;
    if (boss.active) {
      carrierLabel.textContent = (boss.stagger > 0 ? 'CARRIER STAGGERED' : 'HOSTILE CARRIER')+' · '+Math.ceil(100*boss.hp/boss.maxHp)+'%';
      carrierHull.value = 100*boss.hp/boss.maxHp;
      carrierImpact.value = boss.stagger > 0 ? 120 : boss.impact;
    }
    const warning = s.overload > 0 ? 'OVERLOAD · '+s.overload.toFixed(1)+'s' : s.elapsed<messageUntil ? alertText : '';
    message.hidden = !warning;
    message.textContent = warning;
    if (panel.hidden) return;
    buttons.forEach(({button,status},i) => {
      let delay = 0, active = false, unavailable = false;
      if (i<6) delay = s.overload ? 0 : s.sixCooldowns[i];
      else if (i<9) {
        active = s.mode===i-5;
        unavailable = s.mode!==0;
        delay = s.cooldowns[i-6];
      } else if (i===9) {
        active = s.pelicanTime>0;
        delay = s.pelicanCooldown;
      } else if (i===11) delay = s.roarCooldown;
      const cooling = delay > 0;
      status.textContent = active ? 'ACTIVE' : i===10 ? Math.floor(s.ammo)+'/8' : cooling ? Math.ceil(delay)+'s' : unavailable ? 'BUSY' : 'READY';
      button.setAttribute('aria-disabled',String(s.status!=='playing'||active||unavailable||cooling));
    });
  }
  reset();
  return {update,reset};
}
