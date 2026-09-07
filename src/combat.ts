import type { Enemy, Fighter } from './rules';

export interface Combo { hits: number; expires: number; best: number }
export function registerHit(combo: Combo, now: number): number {
  combo.hits = now <= combo.expires ? combo.hits + 1 : 1;
  combo.expires = now + 1.8;
  combo.best = Math.max(combo.best, combo.hits);
  return Math.min(4, 1 + Math.floor(combo.hits / 3));
}
export function canHitVertically(player: Fighter, enemy: Fighter): boolean {
  return Math.abs(player.y - enemy.y) < enemy.height * .8;
}
export interface EnemyIntent { phase: 'approach' | 'windup' | 'recover'; remaining: number }
export function stepIntent(intent: EnemyIntent, enemy: Enemy, distance: number, dt: number): boolean {
  intent.remaining = Math.max(0, intent.remaining - dt);
  if (intent.phase === 'windup' && intent.remaining === 0) {
    intent.phase = 'recover'; intent.remaining = enemy.kind === 'boss' ? .8 : 1.1;
    return true;
  }
  if (intent.phase === 'recover' && intent.remaining === 0) intent.phase = 'approach';
  const range = enemy.kind === 'thrower' ? 390 : enemy.kind === 'boss' ? 96 : 60;
  if (intent.phase === 'approach' && distance < range) {
    intent.phase = 'windup'; intent.remaining = enemy.kind === 'boss' ? .65 : enemy.kind === 'thrower' ? .7 : .48;
  }
  return false;
}
export function damagePlayer(player: Fighter, now: number, amount = 1): boolean {
  if (now < (player.invulnerableUntil ?? -1)) return false;
  player.health = Math.max(0, player.health - amount);
  player.invulnerableUntil = now + .8;
  return true;
}
