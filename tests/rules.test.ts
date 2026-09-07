import { describe, expect, it } from 'vitest';
import { clampPlayerX, createGame, movePlayerX, resolveAttack, resolveEnemyContact, spawnEnemy, stepEnemy } from '../src/rules';

describe('combat rules', () => {
  it('damages an enemy once when a facing attack reaches it', () => {
    const state = createGame();
    const enemy = spawnEnemy('runner', 155);
    state.enemies.push(enemy);

    const result = resolveAttack(state, { kind: 'punch', reach: 60, damage: 1 });

    expect(result.hitIds).toEqual([enemy.id]);
    expect(enemy.health).toBe(1);
    expect(state.score).toBe(100);
  });
});

describe('enemy rules', () => {
  it('moves a runner toward the player without crossing through them', () => {
    const state = createGame();
    const enemy = spawnEnemy('runner', 300);

    stepEnemy(enemy, state.player, 1);

    expect(enemy.x).toBeLessThan(300);
    expect(enemy.x).toBeGreaterThanOrEqual(state.player.x + 28);
  });

  it('damages the player on contact but respects invulnerability time', () => {
    const state = createGame();
    const enemy = spawnEnemy('grappler', 120);

    const first = resolveEnemyContact(state, enemy, 0);
    const second = resolveEnemyContact(state, enemy, 0.2);

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(state.player.health).toBe(9);
  });
});

describe('movement rules', () => {
  it('moves at the slower readable player pace', () => {
    expect(movePlayerX(100, 1, 1, 20, 940)).toBe(245);
  });

  it('keeps the player inside the active combat lane', () => {
    expect(clampPlayerX(-50, 20, 940)).toBe(20);
    expect(clampPlayerX(999, 20, 940)).toBe(940);
  });
});
