import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Snapshot = { mode: string; time: number; health: number; lives: number; playerX: number; enemies: number; bossSpawned: boolean; score: number; dodgeReady: boolean };
type Debug = { getState(): Snapshot; start(): void; setPlayerX(x: number): void; defeatEnemies(): void };
let debug: Debug;
let tick: (time: number) => void;
let clock = 0;
const handlers = new Map<string, (event: { code: string; repeat: boolean; preventDefault(): void }) => void>();
function advance(seconds: number) { for (let i = 0; i < Math.ceil(seconds * 60); i++) { clock += 1000 / 60; tick(clock); } }
function key(code: string, down = true) { handlers.get(down ? 'keydown' : 'keyup')?.({ code, repeat: false, preventDefault() {} }); }

beforeEach(async () => {
  vi.resetModules(); vi.useFakeTimers(); clock = 0; handlers.clear();
  const noOp = () => {};
  const context = new Proxy({}, { get: (_, prop) => prop === 'createLinearGradient' || prop === 'createRadialGradient' ? () => ({ addColorStop: noOp }) : noOp, set: () => true });
  const attributes = new Map<string, string>();
  const elements = new Map<string, object>();
  for (const selector of ['#game', '#play', '#sound']) elements.set(selector, {
    width: 960, height: 540, textContent: '', getContext: () => context,
    addEventListener: noOp, setAttribute: (k: string, v: string) => attributes.set(k, v), getAttribute: (k: string) => attributes.get(k),
  });
  vi.stubGlobal('document', { hidden: false, querySelector: (s: string) => elements.get(s), querySelectorAll: () => [], addEventListener: noOp });
  vi.stubGlobal('window', {});
  vi.stubGlobal('addEventListener', (name: string, fn: (event: never) => void) => handlers.set(name, fn as never));
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  vi.stubGlobal('devicePixelRatio', 1);
  vi.stubGlobal('performance', { now: () => 0 });
  vi.stubGlobal('requestAnimationFrame', (fn: typeof tick) => { tick = fn; });
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: noOp });
  // Tests mute audio through the real input handler before starting.
  await import('../src/main');
  debug = (window as unknown as { __gameDebug: Debug }).__gameDebug;
  key('KeyM'); key('KeyM', false); debug.start();
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('full game loop', () => {
  it('freezes game time and damage while paused, then resumes', () => {
    advance(1); key('KeyP'); key('KeyP', false); const paused = debug.getState();
    advance(4); expect(debug.getState()).toEqual(paused);
    key('KeyP'); key('KeyP', false); advance(1);
    expect(debug.getState().mode).toBe('playing'); expect(debug.getState().time).toBeLessThan(paused.time);
  });
  it('moves the player with dodge, then enforces its cooldown', () => {
    const start = debug.getState().playerX; key('KeyL'); key('KeyL', false); advance(.3);
    expect(debug.getState().playerX).toBeGreaterThan(start + 100); expect(debug.getState().dodgeReady).toBe(false);
    const end = debug.getState().playerX; key('KeyL'); key('KeyL', false); advance(.3);
    expect(debug.getState().playerX).toBe(end); advance(1); expect(debug.getState().dodgeReady).toBe(true);
  });
  it('buffers a kick after a punch and defeats an enemy through normal combat', () => {
    debug.setPlayerX(590); key('KeyJ'); key('KeyJ', false); advance(.12);
    expect(debug.getState().score).toBe(100);
    key('KeyK'); key('KeyK', false); advance(.6);
    expect(debug.getState().enemies).toBe(2); expect(debug.getState().score).toBe(400);
  });
  it('spends an extra life and restores health before eventual defeat', () => {
    for (let i = 0; i < 3000 && debug.getState().lives === 3; i++) advance(1 / 60);
    expect(debug.getState().lives).toBe(2); expect(debug.getState().health).toBe(10); expect(debug.getState().mode).toBe('playing');
    advance(70); expect(debug.getState().lives).toBe(0); expect(debug.getState().mode).toBe('lost');
  });
  it('progresses through three waves, spawns the boss, and awards victory once', () => {
    debug.defeatEnemies(); advance(.1); expect(debug.getState().enemies).toBe(4);
    debug.defeatEnemies(); advance(.1); expect(debug.getState().enemies).toBe(4);
    debug.defeatEnemies(); debug.setPlayerX(2000); advance(.1);
    expect(debug.getState().bossSpawned).toBe(true); expect(debug.getState().enemies).toBe(1);
    debug.defeatEnemies(); advance(.1); expect(debug.getState().mode).toBe('won');
    const score = debug.getState().score; advance(2); expect(debug.getState().score).toBe(score); expect(score).toBeGreaterThan(0);
  });
  it('clears movement and pauses when window focus is lost', () => {
    key('ArrowRight'); advance(.5);
    handlers.get('blur')?.({ code: '', repeat: false, preventDefault() {} });
    const paused = debug.getState(); advance(1); expect(debug.getState()).toEqual(paused);
    key('KeyP'); key('KeyP', false); advance(.3); expect(debug.getState().playerX).toBe(paused.playerX);
  });
});
