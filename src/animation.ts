export type AnimationState = 'idle' | 'walk' | 'jump' | 'punch' | 'kick' | 'hurt';
export type ActionState = 'punch' | 'kick' | 'hurt';

export interface FighterAnimation {
  state: AnimationState;
  elapsed: number;
  phase: number;
  cycle: number;
}

export interface AnimationInput {
  moving: boolean;
  grounded: boolean;
}

const durations: Record<ActionState, number> = {
  punch: 0.28,
  kick: 0.42,
  hurt: 0.3,
};

export function createAnimation(): FighterAnimation {
  return { state: 'idle', elapsed: 0, phase: 0, cycle: 0 };
}

export function requestAction(anim: FighterAnimation, action: ActionState): boolean {
  if (action !== 'hurt' && (anim.state === 'punch' || anim.state === 'kick' || anim.state === 'hurt')) return false;
  anim.state = action;
  anim.elapsed = 0;
  anim.phase = 0;
  return true;
}

export function stepAnimation(anim: FighterAnimation, dt: number, input: AnimationInput): void {
  anim.elapsed += dt;
  anim.cycle += dt;

  if (anim.state === 'punch' || anim.state === 'kick' || anim.state === 'hurt') {
    anim.phase = Math.min(1, anim.elapsed / durations[anim.state]);
    if (anim.elapsed < durations[anim.state]) return;
  }

  const next: AnimationState = input.grounded ? (input.moving ? 'walk' : 'idle') : 'jump';
  if (anim.state !== next) {
    anim.state = next;
    anim.elapsed = 0;
  }
  anim.phase = anim.state === 'walk' ? (anim.cycle * 5) % 1 : anim.state === 'jump' ? 0.5 : 0;
}

export function actionDuration(action: ActionState): number {
  return durations[action];
}
