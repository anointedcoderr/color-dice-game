// Procedural dice sound effects via the Web Audio API. No external audio
// assets: a short noise burst is filtered/pitched differently per "clack" so
// nothing needs to be sourced, licensed, or shipped as a static file.

let ctx: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined" || typeof AudioContext === "undefined") return null;
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    // Sound is a nice-to-have, never let it block gameplay (blocked autoplay,
    // no audio hardware, a browser policy, etc. all land here).
    return null;
  }
}

function getNoiseBuffer(context: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    const length = Math.floor(context.sampleRate * 0.1);
    noiseBuffer = context.createBuffer(1, length, context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

interface ClackOptions {
  freq: number;
  q: number;
  gain: number;
  duration: number;
}

function clack(context: AudioContext, time: number, { freq, q, gain, duration }: ClackOptions): void {
  try {
    const source = context.createBufferSource();
    source.buffer = getNoiseBuffer(context);
    source.playbackRate.value = 0.8 + Math.random() * 0.6;

    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = freq;
    filter.Q.value = q;

    const gainNode = context.createGain();
    gainNode.gain.setValueAtTime(0, time);
    gainNode.gain.linearRampToValueAtTime(gain, time + 0.005);
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + duration);

    source.connect(filter).connect(gainNode).connect(context.destination);
    source.start(time);
    source.stop(time + duration + 0.02);
  } catch {
    // Same rationale as getContext(): never let a sound glitch break a roll.
  }
}

/**
 * Starts a looping dice-rattle sound (randomised plastic-on-plastic clacks).
 * Call the returned function to stop it, e.g. when the dice settles.
 */
export function startDiceRattle(): () => void {
  const context = getContext();
  if (!context) return () => {};

  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;

  const scheduleNext = () => {
    if (stopped) return;
    clack(context, context.currentTime, {
      freq: 1800 + Math.random() * 1400,
      q: 2 + Math.random() * 3,
      gain: 0.16 + Math.random() * 0.08,
      duration: 0.05 + Math.random() * 0.03,
    });
    timer = setTimeout(scheduleNext, 70 + Math.random() * 70);
  };
  timer = setTimeout(scheduleNext, 0);

  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}

/** A single soft, low landing knock. Play once, when the dice settles on a colour. */
export function playDiceLand(): void {
  const context = getContext();
  if (!context) return;
  clack(context, context.currentTime, { freq: 220, q: 0.9, gain: 0.3, duration: 0.18 });
}
