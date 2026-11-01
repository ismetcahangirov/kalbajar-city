import { pinnedRadius } from "./tokens";

/**
 * The state of every scene in `PinnedCardZoom` at a scroll progress, as a
 * pure function so the choreography is unit-tested without a browser.
 *
 * The pin is split into one segment per transition. In segment `k - 1`,
 * scene `k`'s card fades in over the scene before it (scene 1's card is there
 * from the start), then the card grows to fill the stage: its clip goes from
 * the card's rectangle to the whole stage, the frame fades out over the first
 * 30 % of the growth and the captions cross-fade halfway.
 */

/** Distances from each edge of the stage, in percent. */
export type Inset = { top: number; right: number; bottom: number; left: number };

export type SceneState = {
  clip: Inset;
  radius: number;
  layerOpacity: number;
  frameOpacity: number;
  captionOpacity: number;
};

const appearShare = 0.15;
const frameFade = 0.3;
const captionOut = 0.45;
const captionIn = 0.5;
const captionFade = 0.1;

const full: Inset = { top: 0, right: 0, bottom: 0, left: 0 };

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const mix = (from: number, to: number, t: number) => from + (to - from) * t;

/** Progress of scene `k`'s growth, 0 to 1, at segment time `t`. */
function growth(k: number, t: number): number {
  const local = clamp01(t - (k - 1));
  return clamp01((local - appearShare) / (1 - appearShare));
}

export function pinnedScenes(progress: number, count: number, card: Inset): SceneState[] {
  const t = clamp01(progress) * Math.max(0, count - 1);
  const states: SceneState[] = [];
  for (let k = 0; k < count; k++) {
    const grow = k === 0 ? 1 : growth(k, t);
    const appear = k <= 1 ? 1 : clamp01((t - (k - 1)) / appearShare);
    const fadingIn = k === 0 ? 1 : clamp01((grow - captionIn) / captionFade);
    const fadingOut =
      k === count - 1 ? 1 : 1 - clamp01((growth(k + 1, t) - captionOut) / captionFade);
    states.push({
      clip:
        k === 0
          ? full
          : {
              top: mix(card.top, 0, grow),
              right: mix(card.right, 0, grow),
              bottom: mix(card.bottom, 0, grow),
              left: mix(card.left, 0, grow),
            },
      radius: k === 0 ? pinnedRadius.stage : mix(pinnedRadius.card, pinnedRadius.stage, grow),
      layerOpacity: appear,
      frameOpacity: k === 0 ? 0 : appear * (1 - clamp01(grow / frameFade)),
      captionOpacity: fadingIn * fadingOut,
    });
  }
  return states;
}
