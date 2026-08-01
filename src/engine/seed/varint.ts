/** Enteros de longitud variable (LEB128 sin signo). */

export class ByteWriter {
  private readonly bytes: number[] = [];

  writeByte(value: number): void {
    this.bytes.push(value & 255);
  }

  writeVarint(value: number): void {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`Varint inválido: ${value}`);
    }
    let remaining = value;
    while (remaining >= 0x80) {
      this.bytes.push((remaining & 0x7f) | 0x80);
      remaining = Math.floor(remaining / 128);
    }
    this.bytes.push(remaining);
  }

  toBytes(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }
}

export class ByteReader {
  private offset = 0;

  constructor(private readonly bytes: Uint8Array) {}

  get exhausted(): boolean {
    return this.offset >= this.bytes.length;
  }

  readByte(): number {
    if (this.offset >= this.bytes.length) {
      throw new Error('Seed truncado: se esperaban más datos.');
    }
    return this.bytes[this.offset++] as number;
  }

  readVarint(): number {
    let result = 0;
    let shift = 1;
    for (;;) {
      const byte = this.readByte();
      result += (byte & 0x7f) * shift;
      if ((byte & 0x80) === 0) return result;
      shift *= 128;
      if (shift > 2 ** 42) throw new Error('Varint demasiado largo.');
    }
  }
}

/**
 * FNV-1a de 16 bits.
 *
 * No es criptográfico ni pretende serlo: solo detecta un seed pegado a medias
 * o con un carácter cambiado. Sin él, un seed corrupto produciría una lista
 * plausible pero equivocada — el fallo silencioso que hay que evitar.
 */
export function checksum16(bytes: Uint8Array): number {
  let hash = 0x811c;
  for (const byte of bytes) {
    hash ^= byte;
    hash = (hash * 0x0193) & 0xffff;
  }
  return hash;
}

/** Huella estable de la versión de contenido, para detectar desajustes. */
export function versionFingerprint(contentVersion: string): number {
  let hash = 0x811c;
  for (let i = 0; i < contentVersion.length; i++) {
    hash ^= contentVersion.charCodeAt(i) & 255;
    hash = (hash * 0x0193) & 0xffff;
  }
  return hash;
}
