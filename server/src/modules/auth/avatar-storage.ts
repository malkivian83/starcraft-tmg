import { mkdir, rename, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

const DATA_URL_PATTERN = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/;
const STORED_AVATAR_PATTERN = /^([0-9a-f-]{36})\.(png|jpe?g|webp)$/i;

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

const MIME_BY_EXTENSION: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

export interface AvatarData {
  mime: 'image/png' | 'image/jpeg' | 'image/webp';
  bytes: Buffer;
}

export interface StoredAvatarFile {
  path: string;
  mime: string;
}

export const AVATAR_DATA_URL_PATTERN = DATA_URL_PATTERN;
export const AVATAR_STORED_PATH_PATTERN = /^\/auth\/avatars\/[0-9a-f-]{36}\.(?:png|jpe?g|webp)$/i;

export function decodeAvatarDataUrl(value: string): AvatarData | null {
  const match = DATA_URL_PATTERN.exec(value);
  if (!match) return null;
  const mime = match[1] as AvatarData['mime'];
  const bytes = Buffer.from(match[2]!, 'base64');
  if (bytes.length > 150 * 1024) return null;
  return { mime, bytes };
}

export class AvatarStorage {
  private readonly directory = resolve(process.cwd(), 'uploads', 'avatars');

  async save(userId: string, data: AvatarData): Promise<string> {
    await mkdir(this.directory, { recursive: true });
    const extension = EXTENSION_BY_MIME[data.mime];
    const filename = `${userId}.${extension}`;
    const temporaryPath = resolve(this.directory, `.${filename}.${randomUUID()}.tmp`);
    await writeFile(temporaryPath, data.bytes, { flag: 'wx' });
    await this.remove(userId);
    await rename(temporaryPath, resolve(this.directory, filename));
    return `/auth/avatars/${filename}`;
  }

  async remove(userId: string): Promise<void> {
    await Promise.all(['png', 'jpg', 'jpeg', 'webp'].map(async (extension) => {
      await unlink(resolve(this.directory, `${userId}.${extension}`)).catch(() => undefined);
    }));
  }

  resolvePublicFile(filename: string): StoredAvatarFile | null {
    const match = STORED_AVATAR_PATTERN.exec(filename);
    if (!match) return null;
    const extension = match[2]!.toLowerCase();
    return { path: resolve(this.directory, filename), mime: MIME_BY_EXTENSION[extension]! };
  }
}
