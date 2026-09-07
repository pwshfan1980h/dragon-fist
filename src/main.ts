import './style.css';
import { drawHarbor } from './scene';
import { damagePlayer, registerHit, stepIntent, type EnemyIntent } from './combat';
import { clampPlayerX, createGame, movePlayerX, resolveAttack, spawnEnemy, stepEnemy, type Enemy, type EnemyKind } from './rules';
import { actionDuration, createAnimation, requestAction, stepAnimation, type FighterAnimation } from './animation';

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const ctx = canvas.getContext('2d')!;
const W = 960;
const H = 540;
canvas.addEventListener('click', () => { if (game.mode === 'title' || game.mode === 'won' || game.mode === 'lost') reset(); else if (game.mode === 'paused') togglePause(); });
canvas.width = W * Math.min(2, devicePixelRatio);
canvas.height = H * Math.min(2, devicePixelRatio);
ctx.scale(canvas.width / W, canvas.height / H);

const keys = new Set<string>();
const game = createGame();
let camera = 0;
let vertical = 0;
let vy = 0;
let attack: null | { kind: 'punch' | 'kick'; until: number; connected: boolean } = null;
let playerAnim = createAnimation();
const enemyAnims = new Map<number, FighterAnimation>();
let now = 0;
let last = performance.now();
let stageTime = 120;
let wave = 0;
let bossSpawned = false;
let shake = 0;
let flash = 0;
let audio: AudioContext | null = null;
let banner = '';
let bannerUntil = 0;
const particles: Array<{ x: number; y: number; vx: number; vy: number; life: number; color: string }> = [];
const projectiles: Array<{ x: number; y: number; vx: number; life: number }> = [];

const intents = new Map<number, EnemyIntent>();
const combo = { hits: 0, expires: 0, best: 0 };
let dodgeUntil = 0, dodgeReady = 0, hitStop = 0;
let buffered: { kind: 'punch' | 'kick'; expires: number } | null = null;
let muted = false;
let bestScore = 0;
try { bestScore = Number(localStorage.getItem('dragon-fist-best') || 0); } catch { /* Storage is optional. */ }
const floaters: Array<{ x: number; y: number; label: string; color: string; life: number }> = [];
const laneY = 410;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
function announce(label: string, x = game.player.x, color = '#ffe0a0') {
  floaters.push({ x, y: laneY - 110, label, color, life: 1 });
}
function saveBest() {
  bestScore = Math.max(bestScore, game.score);
  try { localStorage.setItem('dragon-fist-best', String(bestScore)); } catch { /* Storage is optional. */ }
}
function dodge() {
  if (game.mode !== 'playing' || now < dodgeReady || vertical > 0) return;
  dodgeUntil = now + .24; dodgeReady = now + 1.2;
  game.player.invulnerableUntil = Math.max(game.player.invulnerableUntil ?? 0, dodgeUntil);
  attack = null; playerAnim = createAnimation();
  burst(game.player.x, laneY, '#77dad0', 6); tone(180, .1, 'triangle', .025);
}

const stageEnd = 3100;

function tone(freq: number, duration = 0.08, type: OscillatorType = 'square', volume = 0.045) {
  if (muted) return;
  audio ??= new AudioContext();
  if (audio.state === 'suspended') void audio.resume();
  const o = audio.createOscillator();
  const g = audio.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, audio.currentTime);
  g.gain.setValueAtTime(volume, audio.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
  o.connect(g).connect(audio.destination); o.start(); o.stop(audio.currentTime + duration);
}

function reset() {
  keys.clear();
  Object.assign(game, createGame());
  game.mode = 'playing'; game.player.x = 120; game.player.health = 10;
  camera = 0; vertical = 0; vy = 0; stageTime = 120; wave = 0; bossSpawned = false;
  playerAnim = createAnimation(); enemyAnims.clear(); intents.clear(); attack = null; buffered = null;
  combo.hits = 0; combo.best = 0; combo.expires = 0; dodgeUntil = 0; dodgeReady = 0; hitStop = 0; shake = 0; flash = 0; floaters.length = 0;
  game.enemies.length = 0; projectiles.length = 0; particles.length = 0;
  banner = 'WAREHOUSE DISTRICT'; bannerUntil = now + 2.2;
  spawnWave(); tone(196, 0.12); setTimeout(() => tone(294, 0.16), 90);
}

function spawn(kind: EnemyKind, offset: number) {
  game.enemies.push(spawnEnemy(kind, camera + 610 + offset));
}

function spawnWave() {
  wave++;
  if (wave === 1) { spawn('runner', 30); spawn('runner', 160); spawn('grappler', 300); }
  else if (wave === 2) { spawn('thrower', 40); spawn('runner', 190); spawn('grappler', 330); spawn('runner', 470); }
  else if (wave === 3) { spawn('grappler', 30); spawn('thrower', 180); spawn('runner', 300); spawn('grappler', 440); }
}

function startAttack(kind: 'punch' | 'kick') {
  if (game.mode !== 'playing' || now < dodgeUntil) return;
  if (attack || !requestAction(playerAnim, kind)) { buffered = { kind, expires: now + .22 }; return; }
  attack = { kind, until: now + actionDuration(kind), connected: false };
  tone(kind === 'kick' ? 115 : 170, 0.055, 'sawtooth', 0.025);
}

function burst(x: number, y: number, color: string, count = 8) {
  for (let i = 0; i < count; i++) particles.push({ x, y, vx: (Math.random() - .5) * 180, vy: -30 - Math.random() * 170, life: .25 + Math.random() * .35, color });
}

function keyDown(e: KeyboardEvent) {
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(e.code)) e.preventDefault();
  keys.add(e.code);
  if (e.repeat) return;
  if (e.code === 'Enter' && (game.mode === 'title' || game.mode === 'won' || game.mode === 'lost')) reset();
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyL') dodge();
  if (e.code === 'KeyM') toggleSound();
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
    if (e.code === 'KeyJ' || e.code === 'KeyZ') startAttack('punch');
  if (e.code === 'KeyK' || e.code === 'KeyX') startAttack('kick');
  if ((e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') && vertical === 0 && game.mode === 'playing') { vy = 430; tone(240, .05, 'triangle', .02); }
}
addEventListener('keydown', keyDown);
addEventListener('keyup', e => keys.delete(e.code));

function togglePause() {
  if (game.mode === 'playing' || game.mode === 'paused') game.mode = game.mode === 'paused' ? 'playing' : 'paused';
  keys.clear();
}
function toggleSound() {
  muted = !muted;
  document.querySelector('#sound')!.textContent = muted ? 'Sound off' : 'Sound on';
  document.querySelector('#sound')!.setAttribute('aria-pressed', String(!muted));
}
document.querySelector('#play')!.addEventListener('click', () => {
  if (game.mode === 'title' || game.mode === 'won' || game.mode === 'lost') reset(); else togglePause();
});
document.querySelector('#sound')!.addEventListener('click', toggleSound);
addEventListener('blur', () => { keys.clear(); if (game.mode === 'playing') game.mode = 'paused'; });
document.addEventListener('visibilitychange', () => { if (document.hidden) { keys.clear(); if (game.mode === 'playing') game.mode = 'paused'; } });
for (const button of document.querySelectorAll<HTMLButtonElement>('button[data-key]')) {
  const code = button.dataset.key!;
  button.addEventListener('pointerdown', e => {
    e.preventDefault(); button.setPointerCapture(e.pointerId); keyDown(new KeyboardEvent('keydown', { code }));
  });
  const up = () => keys.delete(code);
  button.addEventListener('pointerup', up); button.addEventListener('pointercancel', up); button.addEventListener('lostpointercapture', up);
}

function update(dt: number) {
  if (game.mode !== 'playing') return;
  if (hitStop > 0) { hitStop -= dt; return; }
  now += dt;
  stageTime = Math.max(0, stageTime - dt);
  if (stageTime === 0) { game.mode = 'lost'; banner = 'TIME HAS RUN OUT'; saveBest(); return; }
  const p = game.player;
  const dx = Number(keys.has('ArrowRight') || keys.has('KeyD')) - Number(keys.has('ArrowLeft') || keys.has('KeyA'));
  if (dx && now >= dodgeUntil) p.facing = dx > 0 ? 1 : -1;
  const crouching = keys.has('ArrowDown') || keys.has('KeyS');
  if (now < dodgeUntil) p.x = clampPlayerX(p.x + p.facing * 540 * dt, 24, stageEnd - 90);
  else if (!attack && !crouching && playerAnim.state !== 'hurt') p.x = movePlayerX(p.x, dx, dt, 24, stageEnd - 90);
  if (vertical > 0 || vy > 0) {
    vertical += vy * dt; vy -= 980 * dt;
    if (vertical <= 0) { vertical = 0; vy = 0; burst(p.x, laneY + 4, '#b9b1a1', 5); }
  }
  p.y = vertical;
  camera += (clampPlayerX(p.x - 310, 0, stageEnd - W) - camera) * Math.min(1, dt * 7);
  stepAnimation(playerAnim, dt, { moving: dx !== 0 && !crouching, grounded: vertical === 0 });
  if (attack && now >= attack.until) attack = null;
  if (!attack && buffered) { const next = buffered; buffered = null; if (now <= next.expires) startAttack(next.kind); }
  if (attack && !attack.connected && now > attack.until - .18) {
    const result = resolveAttack(game, { kind: attack.kind, reach: attack.kind === 'kick' ? 72 : 50, damage: attack.kind === 'kick' ? 2 : 1 });
    if (result.hitIds.length) {
      attack.connected = true; shake = .12; flash = .04; hitStop = .045;
      const multiplier = registerHit(combo, now);
      game.score += (multiplier - 1) * result.hitIds.length * 100;
      tone(82 + combo.hits * 8, .09, 'square', .05);
      for (const id of result.hitIds) {
        const e = game.enemies.find(v => v.id === id)!;
        e.x = clampPlayerX(e.x + p.facing * (attack.kind === 'kick' ? 38 : 12), 20, stageEnd - 30);
        intents.set(id, { phase: 'recover', remaining: .45 });
        const anim = enemyAnims.get(id); if (anim) requestAction(anim, 'hurt');
        burst(e.x, laneY - e.height * .55, e.dead ? '#ffd166' : '#ff7965', e.dead ? 18 : 9);
        if (e.dead) announce(`+${300 + (multiplier - 1) * 100}`, e.x);
      }
    }
  }
  if (now > combo.expires) combo.hits = 0;
  function hurt(amount = 1) {
    if (!damagePlayer(p, now, amount)) return;
    attack = null; buffered = null; combo.hits = 0; combo.expires = 0;
    requestAction(playerAnim, 'hurt'); shake = .2;
    burst(p.x, laneY - 42, '#ff6173', 12); tone(62, .16, 'sawtooth', .055);
  }
  for (const enemy of game.enemies) {
    if (enemy.dead) continue;
    const dist = Math.abs(enemy.x - p.x);
    const intent = intents.get(enemy.id) ?? { phase: 'approach', remaining: 0 };
    intents.set(enemy.id, intent);
    const enemyAnim = enemyAnims.get(enemy.id) ?? createAnimation(); enemyAnims.set(enemy.id, enemyAnim);
    if (intent.phase === 'approach') stepEnemy(enemy, p, dt);
    if (stepIntent(intent, enemy, dist, dt)) {
      requestAction(enemyAnim, enemy.kind === 'boss' ? 'kick' : 'punch');
      if (enemy.kind === 'thrower' && dist > 100) {
        projectiles.push({ x: enemy.x, y: laneY - 38, vx: enemy.facing * 300, life: 3 });
        tone(540, .045, 'square', .018);
      } else if (dist < (enemy.kind === 'boss' ? 106 : 74) && vertical < 32 && Math.sign(p.x - enemy.x) === enemy.facing) hurt(enemy.kind === 'boss' ? 2 : 1);
    }
    stepAnimation(enemyAnim, dt, { moving: intent.phase === 'approach' && dist > 34, grounded: true });
  }
  for (const knife of projectiles) {
    knife.x += knife.vx * dt; knife.life -= dt;
    if (knife.life > 0 && vertical < 42 && !crouching && Math.abs(knife.x - p.x) < 23 && now >= (p.invulnerableUntil ?? 0)) { hurt(); knife.life = 0; }
  }
  for (const e of game.enemies) if (e.dead) { enemyAnims.delete(e.id); intents.delete(e.id); }
  game.enemies = game.enemies.filter(e => !e.dead || e.kind === 'boss');
  const livingNormal = game.enemies.filter(e => !e.dead && e.kind !== 'boss').length;
  if (!livingNormal && wave < 3) {
    p.health = Math.min(p.maxHealth, p.health + 2); stageTime += 12;
    spawnWave(); banner = `WAVE ${wave} / 3   ·   +2 VITALITY   +12 SEC`; bannerUntil = now + 2;
  }
  if (wave >= 3 && !livingNormal && !bossSpawned && p.x > 1850) {
    bossSpawned = true; game.enemies.push(spawnEnemy('boss', 2580));
    banner = 'THE IRON MANTIS'; bannerUntil = now + 2; tone(82, .4);
  }
  if (p.health <= 0) {
    game.lives--;
    if (game.lives > 0) {
      p.health = p.maxHealth; p.invulnerableUntil = now + 2;
      attack = null; buffered = null; playerAnim = createAnimation(); projectiles.length = 0;
      for (const e of game.enemies) { e.x = clampPlayerX(e.x + (e.x >= p.x ? 150 : -150), 20, stageEnd - 20); intents.set(e.id, { phase: 'recover', remaining: 1.5 }); }
      banner = `${game.lives} LIVES LEFT · BACK IN THE FIGHT`; bannerUntil = now + 1.6;
    } else { game.mode = 'lost'; banner = 'YOU HAVE FALLEN'; saveBest(); tone(74, .5, 'sawtooth'); }
  }
  const boss = game.enemies.find(e => e.kind === 'boss');
  if (boss?.dead && game.mode === 'playing') { game.score += Math.floor(stageTime) * 25; game.mode = 'won'; banner = 'DISTRICT CLEARED'; saveBest(); tone(392, .4); }
  for (const q of particles) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 440 * dt; q.life -= dt; }
  for (const q of floaters) { q.y -= dt * 28; q.life -= dt; }
  for (let i = floaters.length - 1; i >= 0; i--) if (floaters[i].life <= 0) floaters.splice(i, 1);
  for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);
  for (let i = projectiles.length - 1; i >= 0; i--) if (projectiles[i].life <= 0) projectiles.splice(i, 1);
  shake = Math.max(0, shake - dt); flash = Math.max(0, flash - dt);
}

function rect(x: number, y: number, w: number, h: number, fill: string) { ctx.fillStyle = fill; ctx.fillRect(Math.round(x), Math.round(y), w, h); }
function text(value: string, x: number, y: number, size: number, align: CanvasTextAlign = 'left', color = '#f7e8c6') {
  ctx.fillStyle = color; ctx.font = `${size}px "Bebas Neue", Impact, sans-serif`; ctx.textAlign = align; ctx.fillText(value, x, y);
}

function drawBackground() { drawHarbor(ctx, camera, reducedMotion ? 0 : performance.now() / 1000); }

function limb(x: number, y: number, angle: number, upper: number, bend: number, lower: number, width: number, color: string, endColor = color) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(upper, 0); ctx.stroke();
  ctx.translate(upper, 0); ctx.rotate(bend);
  ctx.strokeStyle = endColor; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(lower, 0); ctx.stroke();
  ctx.fillStyle = endColor; ctx.beginPath(); ctx.arc(lower, 0, width * .54, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function bellBottomLeg(x: number, y: number, angle: number, upper: number, bend: number, lower: number, color: string, bootColor: string) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  ctx.strokeStyle = color; ctx.lineWidth = 10; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(upper, 0); ctx.stroke();
  ctx.translate(upper, 0); ctx.rotate(bend);
  ctx.fillStyle = color; ctx.beginPath();
  ctx.moveTo(0, -5); ctx.lineTo(lower * .62, -6); ctx.lineTo(lower, -13);
  ctx.lineTo(lower + 5, 12); ctx.lineTo(lower * .62, 7); ctx.lineTo(0, 5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = bootColor; ctx.beginPath(); ctx.ellipse(lower + 4, 3, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawFighter(f: typeof game.player | Enemy, isPlayer: boolean, portrait = false) {
  const x = f.x - camera, y = laneY - (isPlayer && !portrait ? vertical : 0);
  ctx.fillStyle = '#06121b88'; ctx.beginPath(); ctx.ellipse(x, laneY + 13, 25, 6, 0, 0, Math.PI * 2); ctx.fill();
  if (x < -90 || x > W + 90) return;
  const enemy = !isPlayer ? f as Enemy : null;
  const anim = portrait ? createAnimation() : isPlayer ? playerAnim : enemyAnims.get(enemy!.id) ?? createAnimation();
  const flicker = isPlayer && !portrait && now < (f.invulnerableUntil ?? 0) && Math.floor(now * 18) % 2;
  if (flicker) return;

  const scale = enemy?.kind === 'boss' ? 1.22 : f.height / 64;
  const walk = anim.state === 'walk' ? Math.sin(anim.phase * Math.PI * 2) : 0;
  const strike = anim.state === 'punch' || anim.state === 'kick' ? Math.sin(Math.min(1, anim.phase) * Math.PI) : 0;
  const jump = anim.state === 'jump';
  const hurt = anim.state === 'hurt' ? Math.sin(anim.phase * Math.PI) : 0;
  const crouch = isPlayer && !portrait && (keys.has('ArrowDown') || keys.has('KeyS')) && vertical === 0;
  const bob = anim.state === 'walk' ? Math.abs(Math.sin(anim.phase * Math.PI * 2)) * 2 : 0;
  const lean = (anim.state === 'punch' ? strike * .12 : 0) - hurt * .24;

  const suit = isPlayer ? '#f4efe2' : enemy?.kind === 'boss' ? '#211b29' : enemy?.kind === 'thrower' ? '#a83e35' : enemy?.kind === 'grappler' ? '#444661' : '#284a63';
  const suitDark = isPlayer ? '#d4cbb8' : enemy?.kind === 'boss' ? '#0d0a13' : '#172434';
  const accent = isPlayer ? '#bc2f3e' : enemy?.kind === 'boss' ? '#d5a742' : '#17121e';
  const skin = isPlayer ? '#d5a079' : enemy?.kind === 'boss' ? '#ad7c63' : '#c38e6b';

  if (enemy) {
    const intent = intents.get(enemy.id);
    if (intent?.phase === 'windup') {
      ctx.strokeStyle = '#ff9570'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x + enemy.facing * 22, laneY + 8, enemy.kind === 'boss' ? 80 : 46, 9, 0, 0, Math.PI * 2); ctx.stroke();
      text('!', x, y - f.height - 40, 25, 'center', '#ffba82');
    }
    if (enemy.health < enemy.maxHealth && enemy.kind !== 'boss') {
      rect(x - 18, y - f.height - 20, 36, 3, '#12222b'); rect(x - 18, y - f.height - 20, 36 * enemy.health / enemy.maxHealth, 3, '#f1a173');
    }
  }
  if (isPlayer && !portrait && now < dodgeUntil) {
    ctx.globalAlpha = .3; rect(x - f.facing * 65, y - 55, 65, 35, '#81e0cf'); ctx.globalAlpha = 1;
  }
  ctx.save(); ctx.translate(x, y - bob); ctx.scale(f.facing * scale, scale); ctx.rotate(lean);

  ctx.shadowColor = isPlayer ? '#ffbd68aa' : '#ff4f3d66'; ctx.shadowBlur = 3;

  const hipY = crouch ? -18 : -28;
  const shoulderY = crouch ? -45 : -56;
  const rearLeg = jump ? 2.25 : 1.55 + walk * .62;
  const frontLeg = jump ? .78 : 1.55 - walk * .62;
  // Rear limbs establish depth.
  if (isPlayer) bellBottomLeg(-6, hipY, rearLeg, 18, jump ? -1.1 : .18 + walk * .25, 20, suitDark, '#17121a');
  else limb(-6, hipY, rearLeg, 18, jump ? -1.1 : .18 + walk * .25, 18, 9, suitDark);
  limb(-9, shoulderY, 2.25 + walk * .35, 15, -.65, 15, 8, suitDark, skin);

  // Torso tapers from broad shoulders to the belt.
  ctx.fillStyle = suit; ctx.beginPath(); ctx.moveTo(-16, shoulderY - 3); ctx.quadraticCurveTo(-19, -43, -11, hipY); ctx.lineTo(11, hipY); ctx.quadraticCurveTo(19, -43, 16, shoulderY - 3); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#fff3'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-12, shoulderY); ctx.lineTo(-7, hipY + 2); ctx.stroke();
  ctx.fillStyle = accent; ctx.fillRect(-13, hipY - 4, 26, 7); ctx.fillRect(9, hipY + 1, 19, 4);

  if (isPlayer) {
    // High collar, red scarf and gold studs over a functional karate gi.
    ctx.fillStyle = '#f8f3e7';
    ctx.beginPath(); ctx.moveTo(-15, shoulderY - 3); ctx.lineTo(-5, shoulderY + 13); ctx.lineTo(-1, shoulderY - 4); ctx.fill();
    ctx.beginPath(); ctx.moveTo(15, shoulderY - 3); ctx.lineTo(5, shoulderY + 13); ctx.lineTo(1, shoulderY - 4); ctx.fill();
    ctx.fillStyle = '#c5323d'; ctx.beginPath(); ctx.moveTo(-4, shoulderY + 2); ctx.lineTo(5, shoulderY + 2); ctx.lineTo(2, shoulderY + 18); ctx.fill();
    ctx.fillStyle = '#d9aa48';
    for (const sx of [-10, 10]) for (const sy of [shoulderY + 7, shoulderY + 17]) { ctx.beginPath(); ctx.arc(sx, sy, 1.5, 0, Math.PI * 2); ctx.fill(); }
  }

  // Head, hair and readable face direction.
  ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(1, shoulderY - 15, 11, 13, -.08, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#17121a';
  if (isPlayer) {
    // Pompadour and sideburns keep the likeness readable at sprite scale.
    ctx.beginPath(); ctx.moveTo(-11, shoulderY - 20); ctx.bezierCurveTo(-8, shoulderY - 35, 8, shoulderY - 36, 13, shoulderY - 23); ctx.lineTo(7, shoulderY - 17); ctx.lineTo(-9, shoulderY - 17); ctx.closePath(); ctx.fill();
    ctx.fillRect(-9, shoulderY - 20, 4, 13); ctx.fillRect(7, shoulderY - 19, 3, 11);
  } else {
    ctx.beginPath(); ctx.arc(-1, shoulderY - 19, 11, Math.PI, Math.PI * 2); ctx.lineTo(8, shoulderY - 15); ctx.lineTo(4, shoulderY - 24); ctx.closePath(); ctx.fill();
    ctx.fillStyle = accent; ctx.fillRect(-12, shoulderY - 20, 23, 4);
  }
  ctx.fillStyle = '#251719'; ctx.fillRect(6, shoulderY - 15, 3, 2);

  // Front leg becomes the kick silhouette during the active strike.
  if (anim.state === 'kick') {
    if (isPlayer) bellBottomLeg(7, hipY, 1.52 - strike * 1.48, 22 + strike * 8, .08, 20 + strike * 12, suit, '#17121a');
    else limb(7, hipY, 1.52 - strike * 1.48, 22 + strike * 8, .08, 20 + strike * 12, 10, suit, suitDark);
  } else if (isPlayer) bellBottomLeg(7, hipY, frontLeg, 18, jump ? 1.05 : -.12 - walk * .25, 20, suit, '#17121a');
  else limb(7, hipY, frontLeg, 18, jump ? 1.05 : -.12 - walk * .25, 18, 10, suit, suitDark);

  // Front arm snaps out for the punch, otherwise counter-swings with the gait.
  if (anim.state === 'punch') limb(10, shoulderY, .08 - strike * .05, 18 + strike * 10, 0, 15 + strike * 10, 8, suit, skin);
  else limb(10, shoulderY, .7 - walk * .32, 16, .72, 15, 8, suit, skin);

  if (isPlayer && strike > .35) {
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = strike * .55;
    ctx.strokeStyle = anim.state === 'kick' ? '#ffd47a' : '#fff2ca'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath();
    if (anim.state === 'kick') ctx.arc(5, hipY - 2, 55, -1.05, .2);
    else { ctx.moveTo(25, shoulderY - 3); ctx.lineTo(70, shoulderY - 5); }
    ctx.stroke(); ctx.restore();
  }

  if (enemy?.kind === 'boss') {
    ctx.fillStyle = '#d6a53b';
    ctx.beginPath(); ctx.moveTo(-13, shoulderY - 20); ctx.lineTo(-23, shoulderY - 39); ctx.lineTo(-5, shoulderY - 25); ctx.fill();
    ctx.beginPath(); ctx.moveTo(13, shoulderY - 20); ctx.lineTo(23, shoulderY - 39); ctx.lineTo(5, shoulderY - 25); ctx.fill();
  }
  ctx.shadowBlur = 0; ctx.restore();
}

function drawLighting() {
  const vignette = ctx.createRadialGradient(480, 300, 240, 480, 270, 590);
  vignette.addColorStop(0, '#07132300'); vignette.addColorStop(1, '#04102199');
  ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H);
}

function label(value: string, x: number, y: number, color = '#9ab6bc', align: CanvasTextAlign = 'left') {
  ctx.font = '600 10px system-ui, sans-serif'; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(value, x, y);
}
function drawHud() {
  rect(22, 20, 286, 70, '#071722db'); rect(22, 20, 3, 70, '#edac78');
  label('01 / THE KING', 38, 39, '#edc096');
  label(`LIVES  ${'◆ '.repeat(Math.max(0, game.lives))}`, 291, 39, '#edc096', 'right');
  for (let i = 0; i < 10; i++) rect(38 + i * 25, 49, 21, 11, i < game.player.health ? '#edb888' : '#334550');
  label(now >= dodgeReady ? 'DODGE READY  /  SHIFT' : 'DODGE RECHARGING', 38, 78, now >= dodgeReady ? '#8ed5c9' : '#6b8b97');
  rect(386, 20, 188, 57, '#071722db'); label('DISTRICT 01  /  HARBOR CITY', 480, 39, '#adc5c6', 'center');
  text(String(Math.ceil(stageTime)).padStart(3, '0'), 480, 68, 29, 'center', stageTime < 20 ? '#ff947b' : '#f6dec1');
  rect(747, 20, 191, 70, '#071722db'); label('SCORE', 766, 39); text(String(game.score).padStart(7, '0'), 921, 65, 30, 'right', '#f6dec1'); label(`BEST  ${String(bestScore).padStart(7, '0')}`, 921, 80, '#86a5ae', 'right');
  const boss = game.enemies.find(e => e.kind === 'boss' && !e.dead);
  if (boss) { label('THE IRON MANTIS', 480, 104, '#ffc693', 'center'); rect(330, 112, 300, 5, '#263b46'); rect(330, 112, 300 * boss.health / boss.maxHealth, 5, '#ed9475'); }
  label(boss ? 'FINAL ENCOUNTER' : `WAVE ${wave || 1} / 3`, 28, 491, '#b4ccca');
  const clear = !game.enemies.some(e => !e.dead);
  label(clear && !bossSpawned ? 'KEEP MOVING  →  FIND THE IRON MANTIS' : 'READ THE WINDUP. MAKE YOUR MOVE.', 931, 491, '#b4ccca', 'right');
  rect(28, 502, 904, 2, '#47616a'); rect(28, 502, 904 * game.player.x / stageEnd, 2, '#dcaf80');
  if (combo.hits > 1) {
    text(`${combo.hits} HIT`, 42, 139, 34, 'left', '#ffdab0'); label(`×${Math.min(4, 1 + Math.floor(combo.hits / 3))} SCORE MULTIPLIER`, 44, 158, '#eab287');
    rect(44, 166, 100 * Math.max(0, combo.expires - now) / 1.8, 2, '#eab287');
  }
}

function overlay(title: string, subtitle: string, instruction: string) {
  const titleScreen = game.mode === 'title';
  const shade = ctx.createLinearGradient(0, 0, 960, 0); shade.addColorStop(0, '#06131af5'); shade.addColorStop(.57, '#081823de'); shade.addColorStop(1, '#08182344');
  ctx.fillStyle = shade; ctx.fillRect(0, 0, W, H);
  label('A HARBOR CITY STORY  /  VOL. 01', 60, 106, '#8cc5c0');
  rect(60, 127, 42, 3, '#e9b383');
  if (titleScreen) {
    text('DRAGON', 56, 228, 101, 'left', '#f3dfc1'); text('FIST', 56, 318, 101, 'left', '#eab082');
    label('THE KING ENTERS HARBOR CITY', 62, 348, '#a6c0c2');
  } else {
    text(title, 57, 240, 83, 'left', '#f3dfc1'); text(subtitle, 62, 282, 25, 'left', '#edac87');
    label(`BEST COMBO  ${combo.best} HITS   /   SCORE  ${game.score}`, 62, 322, '#a6c0c2');
  }
  ctx.font = '13px system-ui, sans-serif'; ctx.fillStyle = '#b9cbcb'; ctx.textAlign = 'left';
  ctx.fillText(titleScreen ? 'Three waves. One last showdown. Own the night.' : game.mode === 'paused' ? 'Take a breath. Your fight will be here.' : 'Every fight is a chance to find your rhythm.', 62, 379);
  rect(60, 407, 344, 47, '#e9b383'); text(instruction, 232, 438, 22, 'center', '#10232c');
  label('J / Z  PUNCH     K / X  KICK     SHIFT / L  DODGE', 62, 482, '#86a5ae');
  ctx.save(); ctx.strokeStyle = '#d8b48355'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(731, 277, 133, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(731, 277, 145, -.9, 1.3); ctx.stroke();
  ctx.translate(730, 408); ctx.scale(2.55, 2.55); ctx.translate(-(game.player.x - camera), -laneY);
  drawFighter({ ...game.player, facing: 1 }, true, true); ctx.restore();
  label('THE KING', 732, 460, '#edc398', 'center'); label('KARATE / ROCK ’N’ ROLL', 732, 480, '#8aa9b1', 'center');
}


function render() {
  ctx.save(); if (shake && !reducedMotion) ctx.translate((Math.random() - .5) * 10, (Math.random() - .5) * 6);
  drawBackground();
  for (const knife of projectiles) { const x = knife.x - camera; ctx.save(); ctx.translate(x, knife.y); ctx.rotate(now * 14); rect(-12, -2, 24, 4, '#e7d9b5'); ctx.restore(); }
  for (const e of game.enemies) if (!e.dead) drawFighter(e, false);
  drawFighter(game.player, true);
  for (const p of particles) { ctx.globalAlpha = Math.min(1, p.life * 4); rect(p.x - camera, p.y, 5, 5, p.color); } ctx.globalAlpha = 1;
  drawLighting();
  if (game.mode === 'playing') drawHud();
  for (const q of floaters) { ctx.globalAlpha = Math.min(1, q.life * 2); text(q.label, q.x - camera, q.y, 22, 'center', q.color); } ctx.globalAlpha = 1;
  if (now < bannerUntil && game.mode === 'playing') { ctx.fillStyle = '#080611bb'; ctx.fillRect(210, 188, 540, 45); text(banner, W / 2, 218, 25, 'center', '#f4d58d'); }
  if (game.mode === 'title') overlay('DRAGON FIST', 'THE KING ENTERS HARBOR CITY', 'ENTER / CLICK TO BEGIN');
  else if (game.mode === 'paused') overlay('PAUSED', 'BREATHE. FOCUS.', 'PRESS P TO CONTINUE');
  else if (game.mode === 'won') overlay('VICTORY', `SCORE ${game.score}`, 'PRESS ENTER TO FIGHT AGAIN');
  else if (game.mode === 'lost') overlay('DEFEAT', banner, 'PRESS ENTER TO TRY AGAIN');
  if (flash && !reducedMotion) { ctx.fillStyle = '#ffe8c415'; ctx.fillRect(0, 0, W, H); }
  ctx.restore();
  const play = document.querySelector<HTMLButtonElement>('#play')!;
  const caption = game.mode === 'playing' ? 'Pause' : game.mode === 'paused' ? 'Resume' : game.mode === 'title' ? 'Start game' : 'Play again';
  if (play.textContent !== caption) play.textContent = caption;
  const accessibleState = `Dragon Fist. ${game.mode}. Health ${game.player.health} of 10. Lives ${game.lives}. Score ${game.score}. Time ${Math.ceil(stageTime)}. Wave ${wave}.`;
  if (canvas.getAttribute('aria-label') !== accessibleState) canvas.setAttribute('aria-label', accessibleState);
}

function frame(t: number) {
  const dt = Math.min(.033, (t - last) / 1000); last = t; update(dt); render(); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

Object.assign(window, {
  __gameDebug: {
    getState: () => ({ ready: true, mode: game.mode, playerX: game.player.x, health: game.player.health, lives: game.lives, combo: combo.hits, dodgeReady: now >= dodgeReady, score: game.score, enemies: game.enemies.filter(e => !e.dead).length, bossSpawned, time: stageTime, animation: playerAnim.state, animationPhase: playerAnim.phase, vertical, playerStyle: 'Elvis-inspired karate showman with bell-bottom gi' }),
    start: reset,
    setPlayerX: (x: number) => { game.player.x = x; },
    defeatEnemies: () => { for (const e of game.enemies) e.dead = true; },
  },
});
