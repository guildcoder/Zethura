const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const sprites = new Image();
sprites.src = "assets/sprites.png";

const ASSETS = {
  ship: { x: 0, y: 0, w: 256, h: 256 },
  bumper: { x: 256, y: 0, w: 256, h: 256 },
  arcade: { x: 512, y: 0, w: 256, h: 512 },
  arrow: { x: 0, y: 256, w: 256, h: 128 },
  orb: { x: 256, y: 256, w: 128, h: 128 },
  frog: { x: 512, y: 256, w: 128, h: 128 },
};

sprites.onload = () => {
  render();
};

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(
    sprites,
    ASSETS.ship.x,
    ASSETS.ship.y,
    ASSETS.ship.w,
    ASSETS.ship.h,
    100,
    100,
    128,
    128
  );
  ctx.drawImage(
    sprites,
    ASSETS.arcade.x,
    ASSETS.arcade.y,
    ASSETS.arcade.w,
    ASSETS.arcade.h,
    400,
    80,
    200,
    400
  );
  ctx.drawImage(
    sprites,
    ASSETS.frog.x,
    ASSETS.frog.y,
    ASSETS.frog.w,
    ASSETS.frog.h,
    800,
    480,
    100,
    100
  );
}

