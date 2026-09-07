import { canHitVertically } from './combat';
export type EnemyKind = 'runner' | 'grappler' | 'thrower' | 'boss';

export interface Fighter {
  x: number;
  y: number;
  width: number;
  height: number;
  health: number;
  maxHealth: number;
  facing: 1 | -1;
  invulnerableUntil?: number;
}

export interface Enemy extends Fighter {
  id: number;
  kind: EnemyKind;
  speed: number;
  cooldown: number;
  dead: boolean;
}

export interface GameState {
  player: Fighter;
  enemies: Enemy[];
  score: number;
  lives: number;
  time: number;
  distance: number;
  mode: 'title' | 'playing' | 'paused' | 'won' | 'lost';
}

let nextId = 1;

export function createGame(): GameState {
  return {
    player: { x: 100, y: 0, width: 28, height: 64, health: 10, maxHealth: 10, facing: 1 },
    enemies: [],
    score: 0,
    lives: 3,
    time: 90,
    distance: 0,
    mode: 'title',
  };
}

export function spawnEnemy(kind: EnemyKind, x: number): Enemy {
  const stats = {
    runner: { health: 2, speed: 76, width: 26, height: 58 },
    grappler: { health: 3, speed: 44, width: 30, height: 64 },
    thrower: { health: 2, speed: 30, width: 26, height: 60 },
    boss: { health: 14, speed: 52, width: 44, height: 76 },
  }[kind];
  return { id: nextId++, kind, x, y: 0, ...stats, maxHealth: stats.health, facing: -1, cooldown: 0, dead: false };
}

export function resolveAttack(state: GameState, attack: { kind: 'punch' | 'kick'; reach: number; damage: number }): { hitIds: number[] } {
  const p = state.player;
  const start = p.facing === 1 ? p.x + p.width / 2 : p.x - p.width / 2 - attack.reach;
  const end = p.facing === 1 ? p.x + p.width / 2 + attack.reach : p.x - p.width / 2;
  const hitIds: number[] = [];
  for (const enemy of state.enemies) {
    if (enemy.dead || !canHitVertically(p, enemy) || enemy.x + enemy.width / 2 < start || enemy.x - enemy.width / 2 > end) continue;
    enemy.health -= attack.damage;
    enemy.dead = enemy.health <= 0;
    state.score += enemy.dead ? 300 : attack.kind === 'kick' ? 150 : 100;
    hitIds.push(enemy.id);
  }
  return { hitIds };
}

export function stepEnemy(enemy: Enemy, player: Fighter, dt: number): void {
  if (enemy.dead) return;
  const gap = player.x - enemy.x;
  enemy.facing = gap < 0 ? -1 : 1;
  const stop = (player.width + enemy.width) / 2;
  const movement = Math.min(Math.abs(gap) - stop, enemy.speed * dt);
  if (movement > 0) enemy.x += Math.sign(gap) * movement;
  enemy.cooldown = Math.max(0, enemy.cooldown - dt);
}

export function resolveEnemyContact(state: GameState, enemy: Enemy, now: number): boolean {
  const player = state.player;
  const touching = Math.abs(player.x - enemy.x) <= (player.width + enemy.width) / 2 + 4;
  if (!touching || enemy.dead || now < (player.invulnerableUntil ?? -1)) return false;
  player.health = Math.max(0, player.health - 1);
  player.invulnerableUntil = now + 0.65;
  return true;
}

export function clampPlayerX(x: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, x));
}

export function movePlayerX(x: number, direction: number, dt: number, min: number, max: number): number {
  return clampPlayerX(x + direction * 145 * dt, min, max);
}
