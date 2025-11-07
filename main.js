const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const sprites = new Image();
sprites.src = "assets/sprites.png";

// sprite crop coordinates
const ASSETS = {
  ship: { x: 0, y: 0, w: 256, h: 256 },
  orb: { x: 256, y: 256, w: 128, h: 128 },
};

let keys = {};
window.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
window.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

const player = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  vx: 0,
  vy: 0,
  speed: 0.25,
  friction: 0.95,
  radius: 40,
  energy: 0,
};

const orbs = [];
for (let i = 0; i < 10; i++) {
  orbs.push({
    x: Math.random() * (canvas.width - 100) + 50,
    y: Math.random() * (canvas.height - 100) + 50,
    radius: 25,
    collected: false,
  });
}

sprites.onload = () => {
  requestAnimationFrame(loop);
};

function update(dt) {
  // movement input
  if (keys["w"] || keys["arrowup"]) player.vy -= player.speed;
  if (keys["s"] || keys["arrowdown"]) player.vy += player.speed;
  if (keys["a"] || keys["arrowleft"]) player.vx -= player.speed;
  if (keys["d"] || keys["arrowright"]) player.vx += player.speed;

  // physics drift
  player.vx *= player.friction;
  player.vy *= player.friction;
  player.x += player.vx * dt;
  player.y += player.vy * dt;

  // keep in bounds
  player.x = Math.max(player.radius, Math.min(canvas.width - player.radius, player.x));
  player.y = Math.max(player.radius, Math.min(canvas.height - player.radius, player.y));

  // check orb collisions
  for (let orb of orbs) {
    if (orb.collected) continue;
    const dx = player.x - orb.x;
    const dy = player.y - orb.y;
    const dist = Math.hypot(dx, dy);
    if (dist < player.radius + orb.radius) {
      orb.collected = true;
      player.energy += 10;
    }
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // background
  ctx.fillStyle = "#05060a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // draw orbs
  for (let orb of orbs) {
    if (!orb.collected) {
      ctx.drawImage(
        sprites,
        ASSETS.orb.x,
        ASSETS.orb.y,
        ASSETS.orb.w,
        ASSETS.orb.h,
        orb.x - orb.radius,
        orb.y - orb.radius,
        orb.radius * 2,
        orb.radius * 2
      );
    }
  }

  // draw player
  ctx.save();
  ctx.translate(player.x, player.y);
  const angle = Math.atan2(player.vy, player.vx) + Math.PI / 2;
  ctx.rotate(angle);
  ctx.drawImage(
    sprites,
    ASSETS.ship.x,
    ASSETS.ship.y,
    ASSETS.ship.w,
    ASSETS.ship.h,
    -player.radius,
    -player.radius,
    player.radius * 2,
    player.radius * 2
  );
  ctx.restore();

  // HUD
  ctx.font = "20px Orbitron";
  ctx.fillStyle = "#00f0ff";
  ctx.fillText(`Energy: ${player.energy}`, 20, 30);
}

let last = performance.now();
function loop(now) {
  const dt = (now - last) / 16.67; // normalize frame time
  last = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}
