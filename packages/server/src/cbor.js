/**
 * Minimal CBOR decoder (RFC 8949) for WebAuthn attestation objects and COSE
 * keys: unsigned/negative integers, byte and text strings, arrays, maps,
 * tags (ignored), true/false/null/undefined. No floats, no indefinite lengths.
 */
export function decodeCbor(bytes) {
  const buf = Buffer.from(bytes);
  const { value, offset } = decodeAt(buf, 0);
  return { value, length: offset };
}

function decodeAt(buf, offset) {
  if (offset >= buf.length) throw new RangeError('CBOR: unexpected end of input');
  const initial = buf[offset];
  const major = initial >> 5;
  const info = initial & 0x1f;
  let { value: argument, offset: next } = readArgument(buf, offset + 1, info);

  switch (major) {
    case 0:
      return { value: argument, offset: next };
    case 1:
      return { value: -1 - argument, offset: next };
    case 2:
      return { value: slice(buf, next, argument), offset: next + argument };
    case 3:
      return { value: slice(buf, next, argument).toString('utf8'), offset: next + argument };
    case 4: {
      const items = [];
      for (let i = 0; i < argument; i++) {
        const item = decodeAt(buf, next);
        items.push(item.value);
        next = item.offset;
      }
      return { value: items, offset: next };
    }
    case 5: {
      const map = new Map();
      for (let i = 0; i < argument; i++) {
        const key = decodeAt(buf, next);
        const value = decodeAt(buf, key.offset);
        map.set(key.value, value.value);
        next = value.offset;
      }
      return { value: map, offset: next };
    }
    case 6:
      return decodeAt(buf, next); // tag: return the tagged value
    case 7:
      if (info === 20) return { value: false, offset: next };
      if (info === 21) return { value: true, offset: next };
      if (info === 22) return { value: null, offset: next };
      if (info === 23) return { value: undefined, offset: next };
      throw new Error(`CBOR: unsupported simple value ${info}`);
    default:
      throw new Error(`CBOR: unsupported major type ${major}`);
  }
}

function readArgument(buf, offset, info) {
  if (info < 24) return { value: info, offset };
  if (info === 24) return { value: buf.readUInt8(offset), offset: offset + 1 };
  if (info === 25) return { value: buf.readUInt16BE(offset), offset: offset + 2 };
  if (info === 26) return { value: buf.readUInt32BE(offset), offset: offset + 4 };
  if (info === 27) {
    const big = buf.readBigUInt64BE(offset);
    if (big > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError('CBOR: integer too large');
    return { value: Number(big), offset: offset + 8 };
  }
  throw new Error('CBOR: indefinite lengths are not supported');
}

function slice(buf, start, length) {
  if (start + length > buf.length) throw new RangeError('CBOR: string runs past end of input');
  return buf.subarray(start, start + length);
}
