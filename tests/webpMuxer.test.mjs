import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeAnimatedWebp, extractWebpBitstreamChunks } from '../src/webpMuxer.js';

function makeSyntheticSingleWebp(fourcc = 'VP8 ', payloadBytes = [1, 2, 3, 4, 5]) {
  const payload = Buffer.from(payloadBytes);
  const pad = payload.length & 1;
  const chunk = Buffer.alloc(8 + payload.length + pad);
  chunk.write(fourcc, 0, 4, 'ascii');
  chunk.writeUInt32LE(payload.length, 4);
  payload.copy(chunk, 8);

  const body = Buffer.concat([Buffer.from('WEBP', 'ascii'), chunk]);
  const header = Buffer.alloc(8);
  header.write('RIFF', 0, 4, 'ascii');
  header.writeUInt32LE(body.length, 4);
  return Buffer.concat([header, body]);
}

test('extractWebpBitstreamChunks validates RIFF/WEBP and preserves unpadded odd size', () => {
  assert.throws(() => extractWebpBitstreamChunks(Buffer.from('NOPE')), /too short|missing RIFF/);
  const oddWebp = makeSyntheticSingleWebp('VP8 ', [9, 8, 7]);
  const chunks = extractWebpBitstreamChunks(oddWebp);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].toString('ascii', 0, 4), 'VP8 ');
  assert.equal(chunks[0].readUInt32LE(4), 3);
  assert.equal(chunks[0].length, 8 + 3 + 1);
});

test('encodeAnimatedWebp emits RFC 9649 VP8X + ANIM + ANMF chunks cleanly', () => {
  const f1 = makeSyntheticSingleWebp('VP8 ', [10, 20, 30, 40]);
  const f2 = makeSyntheticSingleWebp('VP8L', [1, 2, 3]);
  const anim = encodeAnimatedWebp([f1, f2], {
    width: 800,
    height: 460,
    durationMs: 75,
  });

  assert.equal(anim.toString('ascii', 0, 4), 'RIFF');
  assert.equal(anim.readUInt32LE(4), anim.length - 8);
  assert.equal(anim.toString('ascii', 8, 12), 'WEBP');

  // VP8X header at offset 12
  assert.equal(anim.toString('ascii', 12, 16), 'VP8X');
  assert.equal(anim.readUInt32LE(16), 10);
  assert.equal(anim.readUInt32LE(20) & 0x02, 0x02);
  const wMinusOne = anim[24] | (anim[25] << 8) | (anim[26] << 16);
  const hMinusOne = anim[27] | (anim[28] << 8) | (anim[29] << 16);
  assert.equal(wMinusOne + 1, 800);
  assert.equal(hMinusOne + 1, 460);

  // ANIM header at offset 30
  assert.equal(anim.toString('ascii', 30, 34), 'ANIM');
  assert.equal(anim.readUInt32LE(34), 6);
  assert.equal(anim.readUInt16LE(42), 0);

  // Two ANMF frames following ANIM
  let off = 44;
  let anmfCount = 0;
  while (off < anim.length) {
    const tag = anim.toString('ascii', off, off + 4);
    const size = anim.readUInt32LE(off + 4);
    assert.equal(tag, 'ANMF');
    const dur = anim[off + 8 + 12] | (anim[off + 8 + 13] << 8) | (anim[off + 8 + 14] << 16);
    assert.equal(dur, 75);
    assert.equal(anim[off + 8 + 15], 0x02);
    anmfCount++;
    off += 8 + size + (size & 1);
  }
  assert.equal(anmfCount, 2);
});
