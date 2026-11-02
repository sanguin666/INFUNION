import { crc32, inflateRawSync } from 'node:zlib';
import { zip } from './zip.js';

/** Reads the archive back through its central directory. */
function unzip(archive: Buffer): Record<string, Buffer> {
  const end = archive.length - 22;
  expect(archive.readUInt32LE(end)).toBe(0x06054b50);
  const count = archive.readUInt16LE(end + 10);
  let at = archive.readUInt32LE(end + 16);
  const files: Record<string, Buffer> = {};
  for (let i = 0; i < count; i++) {
    expect(archive.readUInt32LE(at)).toBe(0x02014b50);
    const method = archive.readUInt16LE(at + 10);
    const crc = archive.readUInt32LE(at + 16);
    const size = archive.readUInt32LE(at + 20);
    const nameLength = archive.readUInt16LE(at + 28);
    const offset = archive.readUInt32LE(at + 42);
    const name = archive
      .subarray(at + 46, at + 46 + nameLength)
      .toString('utf8');
    const localName = archive.readUInt16LE(offset + 26);
    const start = offset + 30 + localName;
    const body = archive.subarray(start, start + size);
    const data = method === 8 ? inflateRawSync(body) : Buffer.from(body);
    expect(crc32(data) >>> 0).toBe(crc);
    files[name] = data;
    at += 46 + nameLength;
  }
  return files;
}

describe('zip', () => {
  it('round-trips text (deflated) and pictures (stored), accents included', () => {
    const picture = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01, 0x02]);
    const archive = zip([
      { name: 'lugar.json', data: '{"nombre":"Nuestra Señora"}' },
      { name: 'files/logo.jpg', data: picture },
    ]);
    const files = unzip(archive);
    expect(files['lugar.json'].toString('utf8')).toBe(
      '{"nombre":"Nuestra Señora"}',
    );
    expect(files['files/logo.jpg'].equals(picture)).toBe(true);
  });

  it('makes a valid empty archive', () => {
    expect(Object.keys(unzip(zip([])))).toEqual([]);
  });
});
