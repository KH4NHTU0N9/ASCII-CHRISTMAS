/**
 * Minimal zero-dependency RFC 9649 Animated WebP muxer.
 * Assembles single-frame WebP payloads (VP8 / VP8L, optional ALPH) from Canvas
 * exports into an infinitely looping RIFF/WEBP VP8X + ANIM + ANMF animation.
 */

function writeUint24LE(buf, offset, value) {
  buf[offset] = value & 0xff;
  buf[offset + 1] = (value >> 8) & 0xff;
  buf[offset + 2] = (value >> 16) & 0xff;
}

function buildChunk(fourcc, payload) {
  const pad = payload.length & 1;
  const out = Buffer.allocUnsafe(8 + payload.length + pad);
  out.write(fourcc, 0, 4, 'ascii');
  out.writeUInt32LE(payload.length, 4);
  payload.copy(out, 8);
  if (pad) out[out.length - 1] = 0;
  return out;
}

/**
 * Extracts raw frame bitstream chunks (optional ALPH + VP8 / VP8L) from a
 * single-frame WebP RIFF buffer produced by Canvas/Chrome.
 */
export function extractWebpBitstreamChunks(webpBuf) {
  if (!Buffer.isBuffer(webpBuf) || webpBuf.length < 16) {
    throw new Error('Invalid WebP buffer: too short');
  }
  if (
    webpBuf.toString('ascii', 0, 4) !== 'RIFF' ||
    webpBuf.toString('ascii', 8, 12) !== 'WEBP'
  ) {
    throw new Error('Invalid WebP buffer: missing RIFF/WEBP header');
  }

  const extracted = [];
  let hasImageBitstream = false;
  let offset = 12;

  while (offset + 8 <= webpBuf.length) {
    const fourcc = webpBuf.toString('ascii', offset, offset + 4);
    const chunkSize = webpBuf.readUInt32LE(offset + 4);
    const dataStart = offset + 8;
    const dataEnd = dataStart + chunkSize;
    if (dataEnd > webpBuf.length) {
      throw new Error(`Truncated WebP chunk '${fourcc}'`);
    }

    if (fourcc === 'ALPH') {
      extracted.push(buildChunk('ALPH', webpBuf.subarray(dataStart, dataEnd)));
    } else if (fourcc === 'VP8 ' || fourcc === 'VP8L') {
      extracted.push(buildChunk(fourcc, webpBuf.subarray(dataStart, dataEnd)));
      hasImageBitstream = true;
    }

    offset = dataEnd + (chunkSize & 1);
  }

  if (!hasImageBitstream) {
    throw new Error('WebP buffer contains no VP8 or VP8L bitstream chunk');
  }
  return extracted;
}

/**
 * Muxes an array of single-frame WebP buffers into an animated WebP file.
 */
export function encodeAnimatedWebp(
  frameBuffers,
  {
    width,
    height,
    durationMs = 75,
    bgra = [0x08, 0x03, 0x02, 0xff],
    loopCount = 0,
  } = {}
) {
  if (!Array.isArray(frameBuffers) || frameBuffers.length === 0) {
    throw new Error('encodeAnimatedWebp requires at least one frame buffer');
  }
  if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1) {
    throw new Error(`Invalid dimensions: ${width}x${height}`);
  }
  if (!Number.isInteger(durationMs) || durationMs < 1) {
    throw new Error(`Invalid frame durationMs: ${durationMs}`);
  }

  const parsedFrames = frameBuffers.map(extractWebpBitstreamChunks);
  const hasAlpha = parsedFrames.some((chunks) =>
    chunks.some((chunk) => chunk.toString('ascii', 0, 4) === 'ALPH')
  );

  // VP8X (10 bytes): bit 1 = Animation (0x02), bit 4 = Alpha (0x10)
  const vp8xPayload = Buffer.alloc(10);
  vp8xPayload.writeUInt32LE(0x02 | (hasAlpha ? 0x10 : 0), 0);
  writeUint24LE(vp8xPayload, 4, width - 1);
  writeUint24LE(vp8xPayload, 7, height - 1);
  const vp8xChunk = buildChunk('VP8X', vp8xPayload);

  // ANIM (6 bytes): BGRA canvas background + loop count (0 = infinite)
  const animPayload = Buffer.alloc(6);
  animPayload[0] = bgra[0] & 0xff;
  animPayload[1] = bgra[1] & 0xff;
  animPayload[2] = bgra[2] & 0xff;
  animPayload[3] = bgra[3] & 0xff;
  animPayload.writeUInt16LE(loopCount, 4);
  const animChunk = buildChunk('ANIM', animPayload);

  const anmfChunks = parsedFrames.map((subchunks) => {
    const header = Buffer.alloc(16);
    // frameX = 0, frameY = 0
    writeUint24LE(header, 6, width - 1);
    writeUint24LE(header, 9, height - 1);
    writeUint24LE(header, 12, durationMs);
    // Bit 1 = Blending method (1 = overwrite without blending), bit 0 = Disposal (0)
    header[15] = 0x02;
    const payload = Buffer.concat([header, ...subchunks]);
    return buildChunk('ANMF', payload);
  });

  const body = Buffer.concat([
    Buffer.from('WEBP', 'ascii'),
    vp8xChunk,
    animChunk,
    ...anmfChunks,
  ]);
  const riffHeader = Buffer.allocUnsafe(8);
  riffHeader.write('RIFF', 0, 4, 'ascii');
  riffHeader.writeUInt32LE(body.length, 4);
  return Buffer.concat([riffHeader, body]);
}
