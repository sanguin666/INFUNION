import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { shrinkPicture } from './image-storage.js';

describe('shrinkPicture', () => {
  it('shrinks a large camera photo to a JPEG no bigger than the given side', async () => {
    const photo = await sharp({ create: { width: 4000, height: 3000, channels: 3, background: '#6C4FD9' } })
      .jpeg()
      .toBuffer();
    const picture = await shrinkPicture(photo, 512);
    const meta = await sharp(picture.buffer).metadata();
    expect(picture.extension).toBe('jpg');
    expect(meta.format).toBe('jpeg');
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBe(512);
  });

  it('keeps a transparent logo as a PNG and never enlarges a small one', async () => {
    const logo = await sharp({ create: { width: 200, height: 100, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .png()
      .toBuffer();
    const picture = await shrinkPicture(logo, 512);
    const meta = await sharp(picture.buffer).metadata();
    expect(picture.extension).toBe('png');
    expect(meta.width).toBe(200);
  });

  it('refuses something that is not a picture', async () => {
    await expect(shrinkPicture(Buffer.from('not a picture'), 512)).rejects.toThrow();
  });
});
