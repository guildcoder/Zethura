// main.js — Zethura Royale prototype
// Single-file engine: rendering, input, entities, simple AI, bumpers, boss tile.
// Drop into same folder as index.html + styles.css + assets/sprites.png

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const HUD = {
  energy: document.getElementById('energy'),
  timer: document.getElementById('timer'),
  mode: document.getElementById('mode'),
};

const SPRITE_SRC = 'assets/sprites.png'; // your master sprite sheet

// --- responsive canvas setup ---
function resizeCanvas() {
  const W = 1024, H = 640; // internal resolution
  // scale to fit while preserving aspect ratio
  const maxW = Math.min(window.innerWidth - 40, 1280);
  const maxH = Math.min(window.innerHeight - 140, 800);
  const ratio = Math.min(maxW / W, maxH / H);
  canvas.width = W;
  canvas.height = H;
  canvas.style.width = Math.round(W * ratio) + 'px';
  canvas.style.height = Math.round(H * ratio) + 'px';
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// --- asset sheet coordinates (approx based on generated sheet) ---
const ASSETS = {
  ship: { x: 0, y: 0, w: 400, h: 256 },      // adjust if needed
  orb: { x: 256, y: 256, w: 128, h: 128 },
  bumper: { x: 256, y: 0, w: 128, h: 128 },
  arcade: { x: 512, y: 0, w: 256, h: 512 },
  arrow: { x: 0, y: 256, w: 256, h: 128 },
  frog: { x: 512, y: 256, w: 128, h: 128 },
};

// load sprites
const sprites = new Image();
sprites.src = SPRITE_SRC;

// --- input ---
const keys = {};
window.addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true;
  if ([' ', 'spacebar'].includes(e.key.toLowerCase())) e.preventDefault();
});
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

// --- utility: spatial hash for collisions ---
class SpatialHash {
  constructor(cell = 128) { this.cell = cell; this.buckets = new Map(); }
  _key(x, y){ return (Math.floor(x / this.cell) + ',' + Math.floor(y / this.cell)); }
  clear(){ this.buckets.clear(); }
  insert(obj){
    const k = this._key(obj.x, obj.y);
    if (!this.buckets.has(k)) this.buckets.set(k, []);
    this.buckets.get(k).push(obj);
  }
  nearby(x, y){
    const gx = Math.floor(x / this.cell), gy = Math.floor(y / this.cell);
    const res = [];
    for (let dx=-1; dx<=1; dx++){
      for (let dy=-1; dy<=1; dy++){
        const k = (gx+dx)+','+(gy+dy);
        if (this.buckets.has(k)) res.push(...this.buckets.get(k));
      }
    }
    return res;
  }
}

// --- entities ---
class Entity {
  constructor(x,y,r){ this.x=x;this.y=y;this.vx=0;this.vy=0;this.r=r;this.dead=false; }
  update(dt){}
  render(ctx){}
}

// Player hovercraft
class Player extends Entity {
  constructor(x,y){
    super(x,y,40);
    this.maxSpeed=6;
    this.accel=0.5;
    this.friction=0.96;
    this.energy=0;
    this.dashCooldown=0;
    this.colorAngle=0;
  }
  update(dt){
    // input
    let ax=0, ay=0;
    if (keys['w']||keys['arrowup']) ay -= this.accel;
    if (keys['s']||keys['arrowdown']) ay += this.accel;
    if (keys['a']||keys['arrowleft']) ax -= this.accel;
    if (keys['d']||keys['arrowright']) ax += this.accel;
    // dash
    if ((keys[' '] || keys['space']) && this.dashCooldown<=0){
      const mag = Math.hypot(this.vx,this.vy) || 1;
      this.vx += (this.vx/mag || 0) * 6;
      this.vy += (this.vy/mag || -1) * 6;
      this.dashCooldown = 45; // frames
    }
    // physics
    this.vx += ax * dt;
    this.vy += ay * dt;
    // clamp speed
    const sp = Math.hypot(this.vx, this.vy);
    if (sp > this.maxSpeed){
      this.vx = (this.vx / sp) * this.maxSpeed;
      this.vy = (this.vy / sp) * this.maxSpeed;
    }
    this.vx *= this.friction;
    this.vy *= this.friction;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // cooldowns
    if (this.dashCooldown>0) this.dashCooldown -= dt;
    this.colorAngle += 0.02;

    // bounds
    this.x = Math.max(this.r, Math.min(canvas.width - this.r, this.x));
    this.y = Math.max(this.r, Math.min(canvas.height - this.r, this.y));
  }
  render(ctx){
    ctx.save();
    ctx.translate(this.x, this.y);
    const angle = Math.atan2(this.vy, this.vx) + Math.PI/2;
    ctx.rotate(angle);
    // ship sprite with glow
    ctx.shadowBlur = 24;
    ctx.shadowColor = '#00f0ff';
    const drawW = this.r*2, drawH=this.r*2;
    ctx.drawImage(sprites, ASSETS.ship.x, ASSETS.ship.y, ASSETS.ship.w, ASSETS.ship.h,
                  -drawW/2, -drawH/2, drawW, drawH);
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

// Wandering / chasing AI
class Bot extends Entity {
  constructor(x,y){
    super(x,y,36);
    this.state='wander'; // 'wander'|'chase'
    this.targetAngle = Math.random()*Math.PI*2;
    this.speed = 2 + Math.random()*1.5;
  }
  update(dt){
    // simple steer
    if (Math.random() < 0.01) this.targetAngle = Math.random()*Math.PI*2;
    // if player close -> chase
    const dx = player.x - this.x, dy = player.y - this.y;
    const dist = Math.hypot(dx,dy);
    if (dist < 220) this.state='chase';
    if (dist > 300) this.state='wander';
    if (this.state==='chase'){
      const ang = Math.atan2(dy,dx);
      this.vx += Math.cos(ang) * 0.12;
      this.vy += Math.sin(ang) * 0.12;
    } else {
      // wander
      this.vx += Math.cos(this.targetAngle) * 0.06;
      this.vy += Math.sin(this.targetAngle) * 0.06;
    }
    // movement + friction
    this.vx *= 0.98; this.vy *= 0.98;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    // bounds wrap mildly
    if (this.x < -50) this.x = canvas.width + 50;
    if (this.x > canvas.width + 50) this.x = -50;
    if (this.y < -50) this.y = canvas.height + 50;
    if (this.y > canvas.height + 50) this.y = -50;
  }
  render(ctx){
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.shadowBlur = 18;
    ctx.shadowColor = '#ff3db8';
    const s = this.r * 2;
    // draw ship flipped color for bots: reuse same sprite but tinted via globalComposite ?
    ctx.drawImage(sprites, ASSETS.ship.x, ASSETS.ship.y, ASSETS.ship.w, ASSETS.ship.h,
      -s/2, -s/2, s, s);
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

// Energy orb collectible
class Orb extends Entity {
  constructor(x,y){
    super(x,y,22);
    this.pulse = Math.random()*Math.PI*2;
  }
  update(dt){
    this.pulse += 0.06*dt;
  }
  render(ctx){
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.globalCompositeOperation = 'lighter';
    const s = this.r*2;
    const wob = 1 + Math.sin(this.pulse)*0.06;
    ctx.drawImage(sprites, ASSETS.orb.x, ASSETS.orb.y, ASSETS.orb.w, ASSETS.orb.h,
      -s/2*wob, -s/2*wob, s*wob, s*wob);
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }
}

// Pinball bumper
class Bumper extends Entity {
  constructor(x,y){
    super(x,y,36);
    this.strength = 12; // bounce strength
  }
  update(dt){}
  render(ctx){
    ctx.save();
    ctx.translate(this.x,this.y);
    ctx.shadowBlur = 28;
    ctx.shadowColor = '#00f0ff';
    const s=this.r*2;
    ctx.drawImage(sprites, ASSETS.bumper.x, ASSETS.bumper.y, ASSETS.bumper.w, ASSETS.bumper.h,
      -s/2, -s/2, s, s);
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

// Hazard lane (Frogger-style moving hazard)
class Hazard {
  constructor(x,y,w,h,vx,vy){
    this.x=x;this.y=y;this.w=w;this.h=h;this.vx=vx;this.vy=vy;
  }
  update(dt){ this.x += this.vx*dt; this.y += this.vy*dt;
    // wrap for lanes
    if (this.x < -200) this.x = canvas.width + 200;
    if (this.x > canvas.width + 200) this.x = -200;
  }
  render(ctx){
    ctx.save();
    ctx.fillStyle = 'rgba(255,50,50,0.09)';
    ctx.fillRect(this.x - this.w/2, this.y - this.h/2, this.w, this.h);
    // draw arrow sprite if exists
    ctx.drawImage(sprites, ASSETS.arrow.x, ASSETS.arrow.y, ASSETS.arrow.w, ASSETS.arrow.h,
      this.x - 40, this.y - 16, 80, 32);
    ctx.restore();
  }
}

// Boss (simple multi-phase)
class Boss {
  constructor(x,y){
    this.x=x;this.y=y;this.r=110; this.phase=0; this.hp=100; this.timer=0;
  }
  update(dt){
    this.timer += dt;
    if (this.phase===0 && this.timer>180) { this.phase=1; this.timer=0; }
    if (this.phase===1 && this.timer>240) { this.phase=2; this.timer=0; }
    // simple behavior: rotate in place, fire radial pulses (not implemented as projectiles in this prototype)
  }
  render(ctx){
    ctx.save();
    ctx.translate(this.x,this.y);
    ctx.shadowBlur = 40; ctx.shadowColor = '#ff3db8';
    const w = 280, h = 360;
    ctx.drawImage(sprites, ASSETS.arcade.x, ASSETS.arcade.y, ASSETS.arcade.w, ASSETS.arcade.h,
      -w/2, -h/2, w, h);
    ctx.shadowBlur = 0;
    // HP bar
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(-110, -h/2 - 20, 220, 12);
    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(-110, -h/2 - 20, 220 * Math.max(0, this.hp)/100, 12);
    ctx.restore();
  }
}

// --- game state ---
const entities = [];
const orbs = [];
const bumpers = [];
const hazards = [];
const bots = [];
let boss = null;
let player = null;
let shash = new SpatialHash(128);
let frameCount = 0;
let gameMode = 'arena'; // 'arena' | 'crossing' | 'boss'
let matchTimer = 0;

// initialize scene
function initScene(){
  entities.length = 0;
  orbs.length = 0;
  bumpers.length = 0;
  hazards.length = 0;
  bots.length = [];
  shash = new SpatialHash(128);
  // player
  player = new Player(canvas.width/2, canvas.height/2);
  entities.push(player);
  // spawn orbs
  for (let i=0;i<12;i++){
    const o = new Orb(Math.random()*(canvas.width-120)+60, Math.random()*(canvas.height-120)+60);
    orbs.push(o); entities.push(o);
  }
  // bumpers
  const pad = 120;
  for (let i=0;i<4;i++){
    const b = new Bumper(160 + i*(canvas.width-320)/3, canvas.height/2 - 80 + (i%2)*160);
    bumpers.push(b); entities.push(b);
  }
  // hazards (lane crossing on bottom area)
  for (let i=0;i<4;i++){
    const laneY = canvas.height - 120 - i*50;
    for (let j=0;j<3;j++){
      const speed = (1 + i*0.5) * (j%2 ? -1 : 1) * 1.8;
      const hz = new Hazard(200 + j*300 + Math.random()*80, laneY, 140, 32, speed, 0);
      hazards.push(hz);
    }
  }
  // bots
  for (let i=0;i<5;i++){
    const b = new Bot(Math.random()*canvas.width, Math.random()*canvas.height);
    bots.push(b); entities.push(b);
  }
  // boss (offscreen until triggered)
  boss = new Boss(canvas.width - 200, 200);
  // reset timers
  frameCount = 0; matchTimer = 0;
  gameMode = 'arena';
  HUD.mode.textContent = 'Mode: Arena';
}
initScene();

// --- collision helpers ---
function circleCollide(a, b){
  const dx = a.x - b.x, dy = a.y - b.y;
  return dx*dx + dy*dy < (a.r + b.r)*(a.r + b.r);
}
function resolveBumperBounce(entity, bumper){
  // reflect velocity away from bumper center + add impulse
  const dx = entity.x - bumper.x, dy = entity.y - bumper.y;
  const dist = Math.hypot(dx,dy) || 1;
  const nx = dx/dist, ny = dy/dist;
  // push entity out
  const overlap = entity.r + bumper.r - dist;
  if (overlap > 0){
    entity.x += nx * overlap;
    entity.y += ny * overlap;
  }
  // bounce (reflect)
  const dot = entity.vx*nx + entity.vy*ny;
  entity.vx = entity.vx - 2*dot*nx + nx * bumper.strength;
  entity.vy = entity.vy - 2*dot*ny + ny * bumper.strength;
}

// --- update loop ---
let last = performance.now();
function gameLoop(now){
  const dtMs = now - last;
  last = now;
  const dt = Math.min(40, dtMs) / (1000/60); // normalized to 60fps steps
  tick(dt);
  render();
  requestAnimationFrame(gameLoop);
}

function tick(dt){
  frameCount++;
  matchTimer += dt;
  HUD.timer.textContent = formatTime(Math.floor(matchTimer / 60));
  // update entities
  shash.clear();
  for (let e of entities) {
    if (e && !e.dead) { e.update(dt); shash.insert(e); }
  }
  // hazards update
  for (let h of hazards) h.update(dt);

  // collisions: orbs with player
  for (let o of orbs){
    if (o.dead) continue;
    if (circleCollide(o, player)){
      o.dead = true;
      player.energy += 10;
    }
  }
  // bumpers bounce
  for (let b of bumpers){
    for (let e of [player, ...bots]){
      if (e && !e.dead && circleCollide(e,b)){
        resolveBumperBounce(e,b);
      }
    }
  }
  // bots collision with player (ram)
  for (let bt of bots){
    if (bt.dead) continue;
    if (circleCollide(bt, player)){
      // simple ram: transfer momentum, player loses energy
      const dx = player.x - bt.x, dy = player.y - bt.y;
      const len = Math.hypot(dx,dy)||1;
      const push = 6;
      player.vx += (dx/len) * push;
      player.vy += (dy/len) * push;
      // bot gets small recoil
      bt.vx -= (dx/len) * 1.8; bt.vy -= (dy/len) * 1.8;
      // energy loss
      player.energy = Math.max(0, player.energy - 2);
    }
  }

  // hazard collisions: if player hits hazard lane, knock back
  for (let hz of hazards){
    const inRect = (player.x > hz.x - hz.w/2 && player.x < hz.x + hz.w/2 && player.y > hz.y - hz.h/2 && player.y < hz.y + hz.h/2);
    if (inRect){
      // affect player: slide with hazard or get pushed
      player.x += hz.vx * dt * 0.6;
      player.energy = Math.max(0, player.energy - 0.04 * dt);
    }
  }

  // respawn orbs if few remain
  if (orbs.filter(o=>!o.dead).length < 4 && frameCount % 150 === 0){
    for (let i=0;i<4;i++){
      const o = new Orb(Math.random()*(canvas.width-160)+80, Math.random()*(canvas.height-240)+80);
      orbs.push(o); entities.push(o);
    }
  }

  // boss trigger: if player collects > 100 energy, switch to boss mode
  if (gameMode==='arena' && player.energy >= 100){
    gameMode = 'boss';
    HUD.mode.textContent = 'Mode: Boss';
    // teleport player to boss tile center
    player.x = canvas.width - 220; player.y = 220;
    // spawn extra bots
    for (let i=0;i<3;i++){
      const b = new Bot(player.x + (i-1)*80 + Math.random()*40, player.y + 140 + Math.random()*60);
      bots.push(b); entities.push(b);
    }
  }

  // boss update
  if (gameMode === 'boss'){
    boss.update(dt);
    // simple boss damage: if player collides with boss inner core; or we could let player shoot in later iteration
    // if collision with boss core, reduce boss HP slowly
    const dx = player.x - boss.x, dy = player.y - boss.y;
    if (Math.hypot(dx,dy) < boss.r - 40 && frameCount % 9 === 0){
      boss.hp -= 1;
    }
    if (boss.hp <= 0){
      // boss defeated -> reset some state, reward big energy
      player.energy += 200;
      // spawn celebratory orbs
      for (let i=0;i<20;i++){
        const o = new Orb(boss.x + Math.random()*200 - 100, boss.y + Math.random()*200 - 100);
        orbs.push(o); entities.push(o);
      }
      // recreate arena after short pause
      setTimeout(()=>initScene(), 1200);
    }
  }
}

// --- rendering ---
function render(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // background gradient + subtle grid
  drawBackground();
  // hazards lanes (bottom)
  for (let h of hazards) h.render(ctx);
  // draw orbs
  for (let o of orbs) if (!o.dead) o.render(ctx);
  // bumpers
  for (let b of bumpers) b.render(ctx);
  // bots
  for (let bt of bots) if (!bt.dead) bt.render(ctx);
  // boss (if boss mode)
  if (gameMode === 'boss') boss.render(ctx);
  // player (render last on top)
  player.render(ctx);
  // HUD drawn to DOM, not canvas
  HUD.energy.textContent = `Energy: ${Math.floor(player.energy)}`;
}

// background effect
function drawBackground(){
  // base
  ctx.fillStyle = '#03040a';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  // subtle stars
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  for (let i=0;i<80;i++){
    const x = (i*97) % canvas.width + (frameCount%60);
    const y = (i*53) % canvas.height;
    ctx.fillRect(x, y, 1, 1);
  }
  // neon vignette
  const g = ctx.createLinearGradient(0,0,0,canvas.height);
  g.addColorStop(0, 'rgba(0,0,0,0.0)');
  g.addColorStop(1, 'rgba(0,0,0,0.15)');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,canvas.width,canvas.height);
}

// time formatter
function formatTime(secs){
  const m = Math.floor(secs/60), s = secs % 60;
  return `${m}:${s.toString().padStart(2,'0')}`;
}

// start loop when sprites load
sprites.onload = () => {
  requestAnimationFrame(gameLoop);
};
