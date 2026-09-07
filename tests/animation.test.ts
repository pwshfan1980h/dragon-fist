import { describe, expect, it } from 'vitest';
import { createAnimation, requestAction, stepAnimation } from '../src/animation';

describe('fighter animation state machine', () => {
  it('transitions between idle and walk from movement input', () => {
    const anim = createAnimation();
    stepAnimation(anim, 0.1, { moving: true, grounded: true });
    expect(anim.state).toBe('walk');
    stepAnimation(anim, 0.1, { moving: false, grounded: true });
    expect(anim.state).toBe('idle');
  });

  it('uses a measured five-step-per-second walk cycle', () => {
    const anim = createAnimation();
    stepAnimation(anim, 0.1, { moving: true, grounded: true });
    expect(anim.phase).toBeCloseTo(0.5);
  });

  it('keeps an attack active until its recovery finishes', () => {
    const anim = createAnimation();
    expect(requestAction(anim, 'punch')).toBe(true);
    stepAnimation(anim, 0.12, { moving: true, grounded: true });
    expect(anim.state).toBe('punch');
    expect(anim.phase).toBeGreaterThan(0);
    stepAnimation(anim, 0.2, { moving: true, grounded: true });
    expect(anim.state).toBe('walk');
  });

  it('uses jump while airborne and lands into idle', () => {
    const anim = createAnimation();
    stepAnimation(anim, 0.05, { moving: false, grounded: false });
    expect(anim.state).toBe('jump');
    stepAnimation(anim, 0.2, { moving: false, grounded: true });
    expect(anim.state).toBe('idle');
  });

  it('does not interrupt a kick with a punch', () => {
    const anim = createAnimation();
    expect(requestAction(anim, 'kick')).toBe(true);
    expect(requestAction(anim, 'punch')).toBe(false);
    expect(anim.state).toBe('kick');
  });
});
