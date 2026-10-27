import { Readable } from 'node:stream';
import { S3Client } from '@aws-sdk/client-s3';

/**
 * An S3Client whose requests never leave the process: a little in-memory
 * bucket behind the real SDK, so the real request building, streaming
 * uploads and signing are what the tests exercise.
 */
export function fakeS3Client(): { client: S3Client; objects: Map<string, { body: Buffer; type?: string }> } {
  const objects = new Map<string, { body: Buffer; type?: string }>();
  const client = new S3Client({
    region: 'auto',
    endpoint: 'https://fake-s3.test',
    forcePathStyle: true,
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
    requestHandler: {
      async handle(request: {
        method: string;
        path: string;
        headers: Record<string, string>;
        body?: unknown;
        query?: Record<string, string>;
      }) {
        // Path style: /<bucket>/<key>
        const key = decodeURIComponent(request.path.split('/').slice(2).join('/'));
        const reply = (statusCode: number, body: Buffer | string = '', headers: Record<string, string> = {}) => ({
          response: { statusCode, headers, body: Readable.from([Buffer.from(body)]) },
        });
        const notFound = () =>
          reply(404, '<Error><Code>NoSuchKey</Code><Message>none</Message></Error>', {
            'content-type': 'application/xml',
          });
        switch (request.method) {
          case 'PUT': {
            objects.set(key, { body: await toBuffer(request.body), type: request.headers['content-type'] });
            return reply(200, '', { etag: '"1"' });
          }
          case 'HEAD':
          case 'GET': {
            const object = objects.get(key);
            if (!object) return request.method === 'HEAD' ? reply(404) : notFound();
            const range = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range ?? request.headers.Range ?? '');
            const headers: Record<string, string> = { 'content-type': object.type ?? 'application/octet-stream' };
            if (range) {
              const start = Number(range[1]);
              const end = range[2] ? Number(range[2]) : object.body.length - 1;
              const slice = object.body.subarray(start, end + 1);
              headers['content-length'] = String(slice.length);
              headers['content-range'] = `bytes ${start}-${end}/${object.body.length}`;
              return reply(206, request.method === 'HEAD' ? '' : slice, headers);
            }
            headers['content-length'] = String(object.body.length);
            return reply(200, request.method === 'HEAD' ? '' : object.body, headers);
          }
          case 'DELETE':
            objects.delete(key);
            return reply(204);
          default:
            return reply(405);
        }
      },
    } as never,
  });
  return { client, objects };
}

async function toBuffer(body: unknown): Promise<Buffer> {
  if (body === undefined || body === null) return Buffer.alloc(0);
  if (Buffer.isBuffer(body)) return body;
  if (typeof body === 'string') return Buffer.from(body);
  if (body instanceof Uint8Array) return Buffer.from(body);
  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Buffer | string>) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
