/**
 * Minimal parser for RFC 8941 Structured Field Values — the subset HTTP Message
 * Signatures (RFC 9421) needs: dictionaries, inner lists, items with
 * parameters, strings, tokens, integers/decimals, byte sequences and booleans.
 *
 * Every parsed member and inner-list item keeps `raw`, its exact source text,
 * because the signature base must reproduce the sender's serialisation.
 */

/** Parses a dictionary header value into a Map of key → member. */
export function parseDictionary(input) {
  const p = { s: String(input), i: 0 };
  const dict = new Map();
  skip(p, ' ');
  while (p.i < p.s.length) {
    const key = parseKey(p);
    const start = p.i;
    let member;
    if (p.s[p.i] === '=') {
      p.i++;
      const valueStart = p.i;
      member = p.s[p.i] === '(' ? parseInnerList(p) : parseItem(p);
      member.raw = p.s.slice(valueStart, p.i);
    } else {
      member = { value: true, params: parseParameters(p), raw: p.s.slice(start, p.i) };
    }
    dict.set(key, member);
    skip(p, ' \t');
    if (p.i >= p.s.length) break;
    expect(p, ',');
    skip(p, ' \t');
    if (p.i >= p.s.length) throw new SyntaxError('trailing comma in dictionary');
  }
  return dict;
}

/** Parses a single item header value, e.g. a Signature-Agent sf-string. */
export function parseItemValue(input) {
  const p = { s: String(input).trim(), i: 0 };
  const item = parseItem(p);
  if (p.i !== p.s.length) throw new SyntaxError('unexpected characters after item');
  return item;
}

function parseInnerList(p) {
  expect(p, '(');
  const list = [];
  while (p.i < p.s.length) {
    skip(p, ' ');
    if (p.s[p.i] === ')') {
      p.i++;
      return { list, params: parseParameters(p) };
    }
    const start = p.i;
    const item = parseItem(p);
    item.raw = p.s.slice(start, p.i);
    list.push(item);
    if (p.s[p.i] !== ' ' && p.s[p.i] !== ')') throw new SyntaxError('inner list items must be separated by spaces');
  }
  throw new SyntaxError('unterminated inner list');
}

function parseItem(p) {
  const value = parseBareItem(p);
  return { value, params: parseParameters(p) };
}

function parseBareItem(p) {
  const c = p.s[p.i];
  if (c === '"') return parseString(p);
  if (c === ':') return parseBytes(p);
  if (c === '?') return parseBoolean(p);
  if (c === '-' || (c >= '0' && c <= '9')) return parseNumber(p);
  if (/[A-Za-z*]/.test(c ?? '')) return parseToken(p);
  throw new SyntaxError(`unexpected character ${JSON.stringify(c)} at ${p.i}`);
}

function parseParameters(p) {
  const params = {};
  while (p.s[p.i] === ';') {
    p.i++;
    skip(p, ' ');
    const key = parseKey(p);
    let value = true;
    if (p.s[p.i] === '=') {
      p.i++;
      value = parseBareItem(p);
    }
    params[key] = value;
  }
  return params;
}

function parseKey(p) {
  const match = /^[a-z*][a-z0-9_\-.*]*/.exec(p.s.slice(p.i));
  if (!match) throw new SyntaxError(`expected a key at ${p.i}`);
  p.i += match[0].length;
  return match[0];
}

function parseString(p) {
  p.i++;
  let out = '';
  while (p.i < p.s.length) {
    const c = p.s[p.i++];
    if (c === '\\') {
      const next = p.s[p.i++];
      if (next !== '"' && next !== '\\') throw new SyntaxError('invalid escape in string');
      out += next;
    } else if (c === '"') {
      return out;
    } else {
      out += c;
    }
  }
  throw new SyntaxError('unterminated string');
}

function parseBytes(p) {
  p.i++;
  const end = p.s.indexOf(':', p.i);
  if (end < 0) throw new SyntaxError('unterminated byte sequence');
  const b64 = p.s.slice(p.i, end);
  if (!/^[A-Za-z0-9+/=]*$/.test(b64)) throw new SyntaxError('invalid base64 in byte sequence');
  p.i = end + 1;
  return Buffer.from(b64, 'base64');
}

function parseBoolean(p) {
  p.i++;
  const c = p.s[p.i++];
  if (c === '1') return true;
  if (c === '0') return false;
  throw new SyntaxError('invalid boolean');
}

function parseNumber(p) {
  const match = /^-?\d{1,15}(?:\.\d{1,3})?/.exec(p.s.slice(p.i));
  if (!match) throw new SyntaxError('invalid number');
  p.i += match[0].length;
  return Number(match[0]);
}

function parseToken(p) {
  const match = /^[A-Za-z*][A-Za-z0-9!#$%&'*+\-.^_`|~:/]*/.exec(p.s.slice(p.i));
  p.i += match[0].length;
  return match[0];
}

function skip(p, chars) {
  while (p.i < p.s.length && chars.includes(p.s[p.i])) p.i++;
}

function expect(p, c) {
  if (p.s[p.i] !== c) throw new SyntaxError(`expected "${c}" at ${p.i}`);
  p.i++;
}
