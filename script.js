const displayContainer = document.getElementById("display");
const uiPanel = document.getElementById("ui-panel");
const pauseOverlay = document.getElementById("pause-overlay");

const chunkSize = 16;
const chunks = {};
const portalRegistry = {};

let webHubs = [
  "checkboxrace.com", "onesquareminesweeper.com", "doughnutkitten.com", "puginarug.com",
  "longdogechallenge.com", "mondrianandme.com", "potatoortomato.com", "heeeeeeeey.com",
  "www.rrrgggbbb.com", "thepigeon.org", "endless.horse", "cat-bounce.com",
  "thatsthefinger.com", "cant-not-tweet-this.com", "eelslap.com", "staggeringbeauty.com",
  "burymewithmymoney.com", "fallingfalling.com", "ducksarethebest.com", "trypap.com",
  "pictureofhotdog.com", "hotdog.com", "corndog.io", "zoomquilt.org", "zombo.com"
];

async function initializeUselessWebDatabase() {
  try {
    // cdn patch to kick cross-origin cors blocks out of github pages deployment
    const res = await fetch('https://cdn.jsdelivr.net/gh/isaacsalvacion/the-useless-web@master/js/uselessweb.js');
    const txt = await res.text();

    const tokenRegex = /["'](https?:\/\/)?([^"'\s]+)["']/g;
    let match;
    const sites = [];

    while ((match = tokenRegex.exec(txt)) !== null) {
      let rawUrl = match[2];
      rawUrl = rawUrl.replace(/^www\./, '').replace(/\/$/, '');
      if (rawUrl.includes('.') && !rawUrl.includes('github') && rawUrl.length > 3) {
        sites.push(rawUrl);
      }
    }

    if (sites.length > 0) {
      webHubs = [...new Set(sites)];
      console.log(`scraped ${webHubs.length} endpoints from registry`);
    }
  } catch (err) {
    console.warn("db pull blocked or down, falling back on static links", err);
  }

  update();
}

let playerX = 2.5;
let playerY = 2.5;
let playerA = 1.5;
let playerPitch = 0;

const screenWidth = 600;
const screenHeight = 110;
const fov = Math.PI / 2.4;
const depth = 20.0;

const keys = {};
let activePortalUrl = null;
let isPaused = true;

document.body.addEventListener('click', () => {
  if (activePortalUrl && !isPaused) {
    const hiddenLink = document.createElement('a');
    hiddenLink.href = activePortalUrl;
    hiddenLink.target = '_blank';
    hiddenLink.rel = 'noopener noreferrer';
    const bgClick = new MouseEvent('click', {
      ctrlKey: true,
      metaKey: true
    });
    hiddenLink.dispatchEvent(bgClick);
    return;
  }

  if (document.pointerLockElement !== document.body) {
    document.body.requestPointerLock();
  }
});

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === document.body) {
    isPaused = false;
    pauseOverlay.classList.add('hidden');
  } else {
    isPaused = true;
    pauseOverlay.classList.remove('hidden');
    for (let k in keys) keys[k] = false; // kill movement drift when tabbing out
  }
});

window.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === document.body && !isPaused) {
    playerA += e.movementX * 0.003;
    playerPitch -= e.movementY * 0.4;

    let maxPitch = screenHeight * 0.5;
    if (playerPitch > maxPitch) playerPitch = maxPitch;
    if (playerPitch < -maxPitch) playerPitch = -maxPitch;
  }
});

window.addEventListener('keydown', (e) => {
  if (isPaused) return;
  keys[e.key.toLowerCase()] = true;
  if (e.key === 'enter' && activePortalUrl) {
    window.open(activePortalUrl, '_blank');
  }
});
window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false });

function MathRandomSeeded(seed) {
  let x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

function generateChunk(cx, cy) {
  let key = `${cx},${cy}`;
  if (chunks[key]) return chunks[key];

  let grid = [];
  let chunkSeed = cx * 73856093 ^ cy * 19349663;

  for (let y = 0; y < chunkSize; y++) {
    let row = "";
    for (let x = 0; x < chunkSize; x++) {
      let globalX = cx * chunkSize + x;
      let globalY = cy * chunkSize + y;

      if (globalX >= 1 && globalX <= 4 && globalY >= 1 && globalY <= 4) {
        row += ".";
        continue;
      }

      let r = MathRandomSeeded(chunkSeed + y * chunkSize + x);

      if (globalX % 5 === 0 && globalY % 5 === 0) row += "#";
      else if (r < 0.12) row += "#";
      else if (r > 0.97) {
        row += "@";
        let portalKey = `${globalX},${globalY}`;
        let hub = webHubs[Math.floor(r * 1000) % webHubs.length];
        let nodeNum = Math.floor(r * 100000);
        portalRegistry[portalKey] = {
          name: `${hub} (Node #${nodeNum})`,
          url: `https://${hub}`
        }
      }
      else row += ".";
    }
    grid.push(row);
  }

  chunks[key] = grid;
  return grid;
}

function getTileAt(gx, gy) {
  let cx = Math.floor(gx / chunkSize);
  let cy = Math.floor(gy / chunkSize);
  let lx = Math.floor(gx % chunkSize);
  let ly = Math.floor(gy % chunkSize);

  if (lx < 0) lx += chunkSize;
  if (ly < 0) ly += chunkSize;

  let chunk = generateChunk(cx, cy);
  return chunk[ly][lx];
}

function isSolid(gx, gy) {
  let tile = getTileAt(gx, gy);
  return tile === '#' || tile === '@';
}

function handleMovement() {
  if (isPaused) return;
  let moveX = 0;
  let moveY = 0;

  if (keys['w'] || keys['arrowup']) {
    moveX += Math.sin(playerA) * 0.12;
    moveY += Math.cos(playerA) * 0.12;
  }
  if (keys['s'] || keys['arrowdown']) {
    moveX -= Math.sin(playerA) * 0.12;
    moveY -= Math.cos(playerA) * 0.12;
  }

  if (keys['a'] || keys['arrowleft']) {
    moveX -= Math.cos(playerA) * 0.06;
    moveY += Math.sin(playerA) * 0.06;
  }
  if (keys['d'] || keys['arrowright']) {
    moveX += Math.cos(playerA) * 0.06;
    moveY -= Math.sin(playerA) * 0.06;
  }

  if (moveX !== 0 || moveY !== 0) {
    let paddingX = moveX > 0 ? 0.25 : -0.25;
    let paddingY = moveY > 0 ? 0.25 : -0.25;

    let nextX = playerX + moveX;
    let testX = nextX + paddingX;
    if (!isSolid(testX, playerY)) playerX = nextX;

    let nextY = playerY + moveY;
    let testY = nextY + paddingY;
    if (!isSolid(playerX, testY)) playerY = nextY;
  }
}

function runRaycaster() {
  let activeKey = null;
  let cols = [];

  for (let x = 0; x < screenWidth; x++) {
    let rayAngle = (playerA - fov / 2.0) + (x / screenWidth) * fov;

    let distToWall = 0;
    let hitWall = false;
    let hitPortal = false;
    let localPortalKey = null;

    let eyeX = Math.sin(rayAngle);
    let eyeY = Math.cos(rayAngle);

    while (!hitWall && distToWall < depth) {
      distToWall += 0.02;
      let testX = Math.floor(playerX + eyeX * distToWall);
      let testY = Math.floor(playerY + eyeY * distToWall);

      let tile = getTileAt(testX, testY);
      if (tile === '#') hitWall = true;
      else if (tile === '@') {
        hitPortal = true;
        localPortalKey = `${Math.floor(testX)},${Math.floor(testY)}`;
        hitWall = true;
      }
    }

    // fix look angle warping layout artifacts
    let angleDiff = rayAngle - playerA;
    if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

    let dist = distToWall * Math.cos(angleDiff);
    if (dist < 0.1) dist = 0.1;

    let horizon = (screenHeight / 2) + playerPitch;
    let ceiling = horizon - (screenHeight / dist) * 0.42;
    let floor = horizon + (screenHeight / dist) * 0.42;

    let pixels = [];
    let shade = ' ';
    if (hitPortal) {
      shade = '@';
      if (x === Math.floor(screenWidth / 2) && dist < 2.5) {
        activeKey = localPortalKey;
      }
    } else {
      if (dist <= depth * 0.25) shade = '█';
      else if (dist < depth * 0.45) shade = '▓';
      else if (dist < depth * 0.70) shade = '▒';
      else if (dist < depth * 0.90) shade = '░';
      else shade = ' ';
    }

    for (let y = 0; y < screenHeight; y++) {
      if (y < ceiling) pixels.push(" ");
      else if (y >= ceiling && y <= floor) pixels.push(shade);
      else pixels.push(".");
    }
    cols.push(pixels);
  }

  // stitches dropped data loops to eliminate random text gaps
  let buf = "";
  for (let y = 0; y < screenHeight; y++) {
    for (let x = 0; x < screenWidth; x++) {
      if (cols[x] && cols[x][y]) {
        buf += cols[x][y];
      } else {
        buf += (x > 0 && cols[x - 1]) ? cols[x - 1][y] : " ";
      }
    }
    buf += "\n";
  }

  return {
    screenText: buf,
    portalKey: activeKey
  };
}

let lastPortalKey = null;

function update() {
  handleMovement();

  if (!isPaused) {
    let frame = runRaycaster();
    displayContainer.textContent = frame.screenText;

    if (uiPanel) {
      if (frame.portalKey && portalRegistry[frame.portalKey]) {
        if (lastPortalKey !== frame.portalKey) {
          let portalData = portalRegistry[frame.portalKey];
          activePortalUrl = portalData.url;
          uiPanel.innerHTML = `⚠️ LINK UNLOCKED: Left-Click anywhere to warp to ${portalData.name}`;
          lastPortalKey = frame.portalKey;
        }
      } else {
        if (lastPortalKey !== null) {
          activePortalUrl = null;
          uiPanel.innerHTML = "Navigating infinite matrix chunks... Search the voids for numerical nodes";
          lastPortalKey = null;
        }
      }
    }
  }

  requestAnimationFrame(update);
}

initializeUselessWebDatabase();
