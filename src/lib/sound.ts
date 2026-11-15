import { loadView } from './cardsView'

/** The moves that make a sound: a card discarded (or put in play), a card removed, a roll noted, a new turn. */
export type MoveSound = 'discard' | 'remove' | 'roll' | 'turn'

let audio: AudioContext | null = null

/** The page's one audio context, made on first need; null where the browser has none (tests, old browsers). */
function context(): AudioContext | null {
  if (audio) return audio
  const Ctor = globalThis.AudioContext ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  try {
    audio = new Ctor()
  } catch {
    return null
  }
  return audio
}

/**
 * Android Chrome keeps audio silent until the page is touched: the first tap anywhere wakes it,
 * so a move from the other phone can sound even before this player has played anything.
 */
export function unlockSoundOnFirstTouch(): void {
  const wake = () => {
    void context()?.resume().catch(() => {})
    window.removeEventListener('pointerdown', wake, true)
  }
  window.addEventListener('pointerdown', wake, true)
}

/** A burst of white noise, `length` seconds long. */
function noise(ctx: AudioContext, length: number): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * length), ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buffer
}

/** A short band of noise, shaped to fade out: the body of both sounds. */
function burst(ctx: AudioContext, at: number, length: number, from: number, to: number, gain: number) {
  const source = ctx.createBufferSource()
  source.buffer = noise(ctx, length)
  const band = ctx.createBiquadFilter()
  band.type = 'bandpass'
  band.Q.value = 1.2
  band.frequency.setValueAtTime(from, at)
  band.frequency.exponentialRampToValueAtTime(to, at + length)
  const level = ctx.createGain()
  level.gain.setValueAtTime(0.0001, at)
  level.gain.exponentialRampToValueAtTime(gain, at + 0.008)
  level.gain.exponentialRampToValueAtTime(0.0001, at + length)
  source.connect(band).connect(level).connect(ctx.destination)
  source.start(at)
  source.stop(at + length)
}

/** A card slid onto the table: one sweep of paper, high to low, as long as the removal's denial. */
function cardSound(ctx: AudioContext) {
  burst(ctx, ctx.currentTime, 0.39, 5200, 900, 0.45)
}

/** One buzzy note of the denial: a square tone softened by a low-pass so it buzzes without rasping. */
function buzz(ctx: AudioContext, at: number, pitch: number, length: number) {
  const tone = ctx.createOscillator()
  tone.type = 'square'
  tone.frequency.setValueAtTime(pitch, at)
  const soften = ctx.createBiquadFilter()
  soften.type = 'lowpass'
  soften.frequency.value = 1800
  const level = ctx.createGain()
  level.gain.setValueAtTime(0.0001, at)
  level.gain.exponentialRampToValueAtTime(0.18, at + 0.01)
  level.gain.setValueAtTime(0.18, at + length - 0.03)
  level.gain.exponentialRampToValueAtTime(0.0001, at + length)
  tone.connect(soften).connect(level).connect(ctx.destination)
  tone.start(at)
  tone.stop(at + length)
}

/** A card removed from the game: a "nuh-uh" denial, two short buzzes, the second lower. */
function removeSound(ctx: AudioContext) {
  const start = ctx.currentTime
  buzz(ctx, start, 392, 0.13)
  buzz(ctx, start + 0.17, 294, 0.22)
}

/**
 * A gong struck for a new turn, ringing out for up to two seconds. Pitched where a phone's small speaker
 * can play it (it drops anything much under 300 Hz), each overtone a detuned pair that beats slowly,
 * so the ring shimmers; the overtones fade at their own pace, the highest first, all gone within 2 s.
 */
function gongSound(ctx: AudioContext) {
  const start = ctx.currentTime
  const base = 330
  // Inharmonic partials, as a gong's are: [ratio to the base, loudness, seconds to ring].
  const partials = [
    [1, 0.22, 2],
    [1.48, 0.14, 1.8],
    [2.02, 0.1, 1.5],
    [2.69, 0.07, 1.1],
    [3.42, 0.05, 0.8],
  ] as const
  for (const [ratio, gain, ring] of partials) {
    const level = ctx.createGain()
    level.gain.setValueAtTime(0.0001, start)
    level.gain.exponentialRampToValueAtTime(gain, start + 0.015)
    // A natural tail, all but silent by the end of its ring, so stopping there doesn't click.
    level.gain.setTargetAtTime(0, start + 0.015, ring / 5)
    level.connect(ctx.destination)
    // Two tones a couple of hertz apart beat against each other: the gong's shimmer.
    for (const detune of [-1.2, 1.2]) {
      const tone = ctx.createOscillator()
      tone.type = 'sine'
      // A struck gong sags a touch in pitch as it settles.
      tone.frequency.setValueAtTime(base * ratio * 1.012 + detune, start)
      tone.frequency.exponentialRampToValueAtTime(base * ratio + detune, start + 0.6)
      tone.connect(level)
      tone.start(start)
      tone.stop(start + ring)
    }
  }
  // The mallet's soft hit.
  burst(ctx, start, 0.05, 1200, 500, 0.25)
}

/** A hard, hollow knock, like a die's corner hitting wood: a quick-falling tone with a click on top. */
function knock(ctx: AudioContext, at: number, pitch: number, gain: number) {
  const tone = ctx.createOscillator()
  tone.type = 'triangle'
  tone.frequency.setValueAtTime(pitch, at)
  tone.frequency.exponentialRampToValueAtTime(pitch * 0.6, at + 0.05)
  const level = ctx.createGain()
  level.gain.setValueAtTime(0.0001, at)
  level.gain.exponentialRampToValueAtTime(gain, at + 0.003)
  level.gain.exponentialRampToValueAtTime(0.0001, at + 0.06)
  tone.connect(level).connect(ctx.destination)
  tone.start(at)
  tone.stop(at + 0.07)
  burst(ctx, at, 0.02, 3500, 2500, gain * 0.5)
}

/** Dice thrown on a table: bounces coming closer and quieter as they roll to a stop. */
function rollSound(ctx: AudioContext) {
  const start = ctx.currentTime
  // Two dice, each bouncing a little apart from the other, the gaps shrinking as they settle.
  const bounces = [0, 0.11, 0.2, 0.27, 0.32, 0.36, 0.39]
  for (const [die, pitch, lag] of [
    [0, 900, 0],
    [1, 1150, 0.035],
  ] as const) {
    bounces.forEach((offset, i) => {
      const jitter = (Math.random() - 0.5) * 0.015
      const gain = 0.6 * (1 - i / bounces.length) + 0.08
      knock(ctx, start + offset + lag + jitter + die * 0.01, pitch * (0.95 + Math.random() * 0.1), gain)
    })
  }
}

/** Plays a move's sound, unless sounds are off in the Karty filter panel. */
export function playMoveSound(kind: MoveSound): void {
  if (!loadView().sound) return
  const ctx = context()
  if (!ctx) return
  try {
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
    if (kind === 'discard') cardSound(ctx)
    else if (kind === 'remove') removeSound(ctx)
    else if (kind === 'turn') gongSound(ctx)
    else rollSound(ctx)
  } catch {
    // Audio unavailable: the move still shows.
  }
}
