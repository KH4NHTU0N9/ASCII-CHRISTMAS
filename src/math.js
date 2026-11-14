export const TAU = Math.PI * 2;

/**
 * Clamps a numeric value to [min, max].
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

/**
 * Linearly interpolates between a and b by factor t.
 * @param {number} a
 * @param {number} b
 * @param {number} t
 * @returns {number}
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Creates a deterministic Mulberry32 PRNG for reproducible tree generation.
 * @param {number} seed
 */
export function createRng(seed = 7) {
  let state = seed >>> 0;

  function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  }

  function uniform(min = 0, max = 1) {
    return min + (max - min) * random();
  }

  function normal(mean = 0, stdDev = 1) {
    const u1 = Math.max(1e-7, random());
    const u2 = random();
    const mag = Math.sqrt(-2.0 * Math.log(u1));
    return mean + stdDev * mag * Math.cos(TAU * u2);
  }

  return { random, uniform, normal };
}

/**
 * Distributes n points uniformly on the unit sphere using the Fibonacci lattice.
 * @param {number} n
 * @returns {Array<[number, number, number]>}
 */
export function fibSphere(n) {
  const pts = new Array(n);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const idx = i + 0.5;
    const y = 1 - (2 * idx) / n;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = goldenAngle * idx;
    pts[i] = [r * Math.cos(th), y, r * Math.sin(th)];
  }
  return pts;
}

/**
 * Computes the outer foliage cone radius at height y.
 * @param {number} y
 * @param {number} y0
 * @param {number} y1
 * @returns {number}
 */
export function envelope(y, y0 = 0.42, y1 = 2.55) {
  const f = clamp((y - y0) / (y1 - y0), 0, 1);
  return 0.03 + 0.84 * Math.pow(1 - f, 1.08);
}

/**
 * Normalizes a 3D vector, returning [0, 1, 0] if zero-length.
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {[number, number, number]}
 */
export function normalize3(x, y, z) {
  const len = Math.hypot(x, y, z);
  if (len < 1e-8) return [0, 1, 0];
  return [x / len, y / len, z / len];
}
