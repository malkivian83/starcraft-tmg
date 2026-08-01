/**
 * Base32 de Crockford.
 *
 * Se elige este alfabeto y no Base64 porque un seed se comparte por chat y a
 * veces se dicta en voz alta: excluye I, L, O y U, que son los caracteres que
 * se confunden entre sí (y con 1 y 0). Al decodificar se aceptan además las
 * confusiones habituales, de modo que "l" se lee como 1 y "O" como 0.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

const DECODE_MAP: Record<string, number> = (() => {
  const map: Record<string, number> = {};
  for (let i = 0; i < ALPHABET.length; i++) {
    const char = ALPHABET[i] as string;
    map[char] = i;
    map[char.toLowerCase()] = i;
  }
  // Confusiones habituales al teclear o dictar.
  map['I'] = map['i'] = map['L'] = map['l'] = 1;
  map['O'] = map['o'] = 0;
  map['U'] = map['u'] = map['V'] as number;
  return map;
})();

export function encodeBase32(bytes: Uint8Array): string {
  let out = '';
  let buffer = 0;
  let bits = 0;

  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(buffer >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += ALPHABET[(buffer << (5 - bits)) & 31];
  }
  return out;
}

export function decodeBase32(text: string): Uint8Array {
  const clean = text.replace(/[\s-]/g, '');
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (const char of clean) {
    const value = DECODE_MAP[char];
    if (value === undefined) {
      throw new Error(`Carácter no válido en el seed: "${char}"`);
    }
    buffer = (buffer << 5) | value;
    bits += 5;
    if (bits >= 8) {
      bytes.push((buffer >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Uint8Array.from(bytes);
}

/** Agrupa en bloques de 5 para que sea legible y se pueda dictar. */
export function groupSeed(body: string, prefix = 'SCT1'): string {
  const groups = body.match(/.{1,5}/g) ?? [];
  return [prefix, ...groups].join('-');
}
