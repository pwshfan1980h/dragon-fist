import { describe, expect, it } from 'vitest';
import { damagePlayer, registerHit, stepIntent, type EnemyIntent } from '../src/combat';
import { createGame, resolveAttack, spawnEnemy } from '../src/rules';
import { createAnimation, requestAction } from '../src/animation';

describe('readable enemy attacks', () => {
  it('provides a windup and a recovery window, and only strikes once', () => {
    const enemy = spawnEnemy('runner', 150);
    const intent: EnemyIntent = { phase: 'approach', remaining: 0 };
    expect(stepIntent(intent, enemy, 45, .016)).toBe(false);
    expect(intent.phase).toBe('windup');
    expect(stepIntent(intent, enemy, 45, .3)).toBe(false);
    expect(stepIntent(intent, enemy, 45, .2)).toBe(true);
    expect(intent.phase).toBe('recover');
    expect(stepIntent(intent, enemy, 45, .5)).toBe(false);
    expect(intent.phase).toBe('recover');
  });
  it('does not begin an attack outside its range', () => {
    const intent: EnemyIntent = { phase: 'approach', remaining: 0 };
    stepIntent(intent, spawnEnemy('boss', 400), 300, 1);
    expect(intent.phase).toBe('approach');
  });
});

describe('combat fairness', () => {
  it('uses symmetric left and right attack ranges', () => {
    for (const facing of [-1, 1] as const) {
      const game = createGame(); game.player.facing = facing;
      const inside = spawnEnemy('runner', game.player.x + facing * 70);
      const outside = spawnEnemy('runner', game.player.x + facing * 90);
      game.enemies = [inside, outside];
      expect(resolveAttack(game, { kind: 'punch', reach: 50, damage: 1 }).hitIds).toEqual([inside.id]);
    }
  });
  it('cannot hit enemies on the ground from the peak of a jump', () => {
    const game = createGame(); game.player.y = 90; game.enemies = [spawnEnemy('runner', 140)];
    expect(resolveAttack(game, { kind: 'kick', reach: 72, damage: 2 }).hitIds).toEqual([]);
  });
  it('respects dodge invulnerability and clamps lethal damage', () => {
    const player = createGame().player; player.invulnerableUntil = 1; player.health = 1;
    expect(damagePlayer(player, .8, 2)).toBe(false);
    expect(player.health).toBe(1);
    expect(damagePlayer(player, 1.1, 2)).toBe(true);
    expect(player.health).toBe(0);
    expect(damagePlayer(player, 1.2)).toBe(false);
  });
  it('interrupts attacks when hurt so the animation matches combat', () => {
    const anim = createAnimation(); requestAction(anim, 'kick');
    expect(requestAction(anim, 'hurt')).toBe(true); expect(anim.state).toBe('hurt');
  });
});

describe('combo scoring', () => {
  it('rewards quick consecutive hits and resets after a gap', () => {
    const combo = { hits: 0, expires: 0, best: 0 };
    expect(registerHit(combo, 1)).toBe(1);
    registerHit(combo, 1.5);
    expect(registerHit(combo, 2)).toBe(2);
    expect(combo.best).toBe(3);
    expect(registerHit(combo, 4)).toBe(1);
    expect(combo.hits).toBe(1); expect(combo.best).toBe(3);
  });
  it('caps score multipliers during long combos', () => {
    const combo = { hits: 30, expires: 10, best: 30 };
    expect(registerHit(combo, 8)).toBe(4);
  });
});
