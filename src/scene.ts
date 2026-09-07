/** Layered, resolution-independent harbor scenery; no downloaded assets. */
export function drawHarbor(ctx: CanvasRenderingContext2D, camera: number, time: number) {
  const box = (x: number, y: number, w: number, h: number, color: string) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
  const line = (x: number, y: number, xx: number, yy: number, color: string, width = 1) => {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(xx, yy); ctx.stroke();
  };
  const sky = ctx.createLinearGradient(0, 0, 0, 440);
  sky.addColorStop(0, '#081b29'); sky.addColorStop(.6, '#31505a'); sky.addColorStop(1, '#a97962');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 960, 540);
  const mx = 733 - camera * .045;
  const halo = ctx.createRadialGradient(mx, 143, 20, mx, 143, 150);
  halo.addColorStop(0, '#ffdeaa38'); halo.addColorStop(1, '#ffdeaa00'); ctx.fillStyle = halo; ctx.fillRect(mx - 150, 0, 300, 310);
  ctx.fillStyle = '#efcf9f'; ctx.beginPath(); ctx.arc(mx, 143, 49, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 22; i++) {
    const x = i * 69 - camera * .12; const y = 202 - (i * 37 % 101);
    box(x, y, 54, 160, '#112c38'); box(x + 5, y - 5, 37, 5, '#172e39');
    for (let row = 0; row < 8; row++) for (let col = 0; col < 4; col++) if ((i + row * 3 + col * 7) % 5 < 2) box(x + 8 + col * 11, y + 14 + row * 16, 3, 5, '#cda57c50');
  }
  // Container cranes above the distant water.
  for (let i = 0; i < 4; i++) {
    const x = i * 350 + 80 - camera * .2;
    line(x, 300, x, 173, '#17343e', 6); line(x - 25, 180, x + 142, 180, '#17343e', 5);
    line(x, 155, x + 142, 180, '#17343e', 2); line(x + 124, 180, x + 124, 239, '#17343e');
  }
  box(0, 284, 960, 100, '#36545a');
  for (let i = 0; i < 60; i++) {
    const x = ((i * 83.7 - camera * .3 + Math.sin(time * .5 + i) * 5) % 1100 + 1100) % 1100 - 70;
    box(x, 292 + (i * 17 % 76), 12 + i % 38, 1, i % 3 ? '#93b2ad22' : '#e2bc8155');
  }
  // Midground warehouses: masonry, loading doors, signs and warm windows.
  for (let i = -1; i < 10; i++) {
    const x = i * 355 - camera * .72;
    if (x < -360 || x > 970) continue;
    const y = i % 2 ? 232 : 211;
    box(x, y, 306, 169, '#263039'); box(x, y, 306, 8, '#546064'); box(x + 8, y + 10, 290, 3, '#121e29');
    for (let row = 0; row < 9; row++) {
      line(x, y + 28 + row * 16, x + 306, y + 28 + row * 16, '#66716d13');
      for (let col = 0; col < 8; col++) line(x + col * 42 + row % 2 * 20, y + 13 + row * 16, x + col * 42 + row % 2 * 20, y + 28 + row * 16, '#66716d13');
    }
    box(x + 21, y + 47, 120, 116, '#15252e');
    for (let slat = 0; slat < 14; slat++) line(x + 25, y + 51 + slat * 8, x + 136, y + 51 + slat * 8, '#52616655');
    box(x + 166, y + 61, 98, 52, '#101d28'); box(x + 172, y + 67, 86, 40, '#cd946768');
    for (let w = 1; w < 4; w++) box(x + 172 + w * 21, y + 66, 3, 43, '#23303a');
    box(x + 171, y + 84, 88, 3, '#23303a');
    box(x + 163, y + 16, 111, 30, '#101e29');
    ctx.save(); ctx.shadowColor = i % 2 ? '#ff7a66' : '#6bddd1'; ctx.shadowBlur = 12;
    ctx.fillStyle = i % 2 ? '#ffa08a' : '#98d9cc'; ctx.font = '15px Impact, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(i % 2 ? 'HARBOR  /  08' : 'NIGHT MARKET', x + 218, y + 37); ctx.restore();
    box(x + 280, y + 18, 4, 147, '#111e27');
  }
  // Hanging lantern cables.
  ctx.strokeStyle = '#0a1722'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 137); ctx.bezierCurveTo(270, 219, 650, 135, 960, 180); ctx.stroke();
  for (let i = -1; i < 8; i++) {
    const x = i * 168 - (camera * .35 % 168); const y = 164 + Math.sin(x / 290) * 14;
    line(x, y - 23, x, y, '#0d1c24', 2);
    const glow = ctx.createRadialGradient(x, y + 16, 2, x, y + 16, 68); glow.addColorStop(0, '#ff975333'); glow.addColorStop(1, '#ff773300');
    ctx.fillStyle = glow; ctx.fillRect(x - 68, y - 52, 136, 136);
    ctx.fillStyle = '#d04e43'; ctx.beginPath(); ctx.ellipse(x, y + 15, 13, 19, 0, 0, Math.PI * 2); ctx.fill();
    box(x - 6, y, 12, 30, '#fa9a66'); box(x - 11, y - 3, 22, 4, '#442c32'); box(x - 10, y + 32, 20, 4, '#442c32'); line(x, y + 36, x, y + 45, '#e5a568', 2);
  }
  // Wet pavement and a deep foreground curb.
  const ground = ctx.createLinearGradient(0, 379, 0, 540); ground.addColorStop(0, '#576064'); ground.addColorStop(.16, '#303c45'); ground.addColorStop(1, '#101d2a');
  ctx.fillStyle = ground; ctx.fillRect(0, 379, 960, 161); box(0, 379, 960, 3, '#9da79a66');
  for (let i = -1; i < 17; i++) {
    const x = i * 85 - camera % 85;
    line(x, 383, x - 130, 540, '#0b1a2877');
    box(x + 12, 431 + i % 3 * 14, 52, 2, '#d99d6d25');
    box(x + 37, 404 + i % 2 * 5, 25, 1, '#99d7ce44');
  }
  line(0, 449, 960, 449, '#172630', 2); line(0, 501, 960, 501, '#14222d', 2);
  box(0, 510, 960, 30, '#091723'); box(0, 510, 960, 3, '#52707566');
  // Fine drifting rain; deterministic positions keep the scene calm.
  ctx.globalAlpha = .16;
  for (let i = 0; i < 60; i++) {
    const x = (i * 103 + time * 17) % 980; const y = (i * 71 + time * 220) % 530;
    line(x, y, x - 4, y + 12, '#c2dfde');
  }
  ctx.globalAlpha = 1;
}
