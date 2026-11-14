import { normalize3 } from './math.js';

export const PART_KINDS = Object.freeze({
  NEEDLE: 0,
  TRUNK: 1,
  BALL: 2,
  LIGHT: 3,
  GARLAND: 4,
  GIFT: 5,
  RIBBON: 6,
  SNOWCAP: 7,
  GROUND: 8,
  STAR: 9,
});

/**
 * Dynamic accumulator that packs 3D scene points into flat TypedArrays
 * for cache-friendly, allocation-free frame projection.
 */
export class PartsBuffer {
  constructor() {
    this._pos = [];
    this._nrm = [];
    this._col = [];
    this._kind = [];
    this._t0 = [];
    this._phase = [];
    this._shine = [];
  }

  /**
   * Appends a single particle point to the scene buffer.
   */
  addPoint(px, py, pz, nx, ny, nz, r, g, b, kind, t0 = 0, phase = 0, shine = 0) {
    const [unx, uny, unz] = normalize3(nx, ny, nz);
    this._pos.push(px, py, pz);
    this._nrm.push(unx, uny, unz);
    this._col.push(r, g, b);
    this._kind.push(kind);
    this._t0.push(t0);
    this._phase.push(phase);
    this._shine.push(shine);
  }

  get count() {
    return this._kind.length;
  }

  /**
   * Finalizes buffers into compact TypedArrays ready for rendering.
   */
  toSceneBuffers() {
    const count = this._kind.length;
    let lightTotal = 0;
    for (let i = 0; i < count; i++) {
      if (this._kind[i] === PART_KINDS.LIGHT) lightTotal++;
    }

    return {
      count,
      lightTotal,
      positions: new Float32Array(this._pos),
      normals: new Float32Array(this._nrm),
      colors: new Float32Array(this._col),
      kinds: new Uint8Array(this._kind),
      t0: new Float32Array(this._t0),
      phase: new Float32Array(this._phase),
      shine: new Float32Array(this._shine),
    };
  }
}
