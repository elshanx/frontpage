import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import { fetchFeed, isPrivateAddress } from './fetch.ts';

type Handler = (req: IncomingMessage, res: ServerResponse) => void;
const RSS = '<rss><channel><title>T</title></channel></rss>';
const redirect =
  (status: number, to: string): Handler =>
  (_req, res) => {
    res.writeHead(status, { Location: to });
    res.end();
  };
const status =
  (code: number): Handler =>
  (_req, res) => {
    res.writeHead(code);
    res.end();
  };

const routes: Record<string, Handler> = {
  '/feed': (req, res) => {
    if (req.headers['if-none-match'] === '"v1"') {
      res.writeHead(304);
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/rss+xml; charset=utf-8', ETag: '"v1"' });
    res.end(RSS);
  },
  '/moved': redirect(301, '/moved-again'),
  '/moved-again': redirect(308, '/feed'),
  '/temporary': redirect(302, '/feed'),
  '/loop': redirect(302, '/loop'),
  '/gone': status(404),
  '/down': status(503),
  '/slow': () => {},
  '/huge': (_req, res) => {
    res.writeHead(200);
    res.end(Buffer.alloc(5 * 1024 * 1024 + 1, 'a'));
  },
};

const server = createServer((req, res) => (routes[req.url ?? ''] ?? status(404))(req, res));
let origin = '';
const local = { allowPrivateHosts: true };

before(async () => {
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => {
  server.closeAllConnections();
  server.close();
});

test('isPrivateAddress covers loopback, private, link-local and mapped ranges', () => {
  [
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '::1',
    '::',
    'fe80::1',
    'fd00::1',
    '::ffff:127.0.0.1',
    '::ffff:10.0.0.1',
    '240.0.0.1',
    '64:ff9b::7f00:1',
    '64:ff9b::a9fe:a9fe',
    '2002:7f00:1::',
    '2002:c0a8:101::1',
  ].forEach((ip) => assert.equal(isPrivateAddress(ip), true, ip));
  ['8.8.8.8', '104.16.0.1', '2606:4700::1', '64:ff9b::808:808', '2002:808:808::1'].forEach((ip) =>
    assert.equal(isPrivateAddress(ip), false, ip)
  );
});

test('fetches a feed and returns caching headers', async () => {
  const result = await fetchFeed(`${origin}/feed`, local);
  assert.equal(result.kind, 'ok');
  if (result.kind !== 'ok') return;
  assert.equal(result.body, RSS);
  assert.equal(result.etag, '"v1"');
  assert.equal(result.movedPermanently, false);
});

test('sends conditional headers and reports not-modified', async () => {
  const result = await fetchFeed(`${origin}/feed`, { ...local, etag: '"v1"' });
  assert.equal(result.kind, 'not-modified');
});

test('follows redirects and only flags all-permanent chains as moved', async () => {
  const moved = await fetchFeed(`${origin}/moved`, local);
  assert.equal(moved.kind, 'ok');
  if (moved.kind === 'ok') {
    assert.equal(moved.finalUrl, `${origin}/feed`);
    assert.equal(moved.movedPermanently, true);
  }
  const temporary = await fetchFeed(`${origin}/temporary`, local);
  assert.equal(temporary.kind === 'ok' && temporary.movedPermanently, false);
});

test('classifies failures', async () => {
  const cases: [string, string, boolean][] = [
    ['/loop', 'redirect-loop', false],
    ['/gone', 'http', true],
    ['/down', 'http', false],
    ['/huge', 'too-large', false],
  ];
  await Promise.all(
    cases.map(async ([path, kind, permanent]) => {
      const result = await fetchFeed(`${origin}${path}`, local);
      assert.equal(result.kind, 'error', path);
      if (result.kind !== 'error') return;
      assert.equal(result.error.kind, kind, path);
      assert.equal(result.error.permanent, permanent, path);
    })
  );
});

test('times out slow servers', async () => {
  const started = Date.now();
  const result = await fetchFeed(`${origin}/slow`, { ...local, timeoutMs: 200 });
  assert.equal(result.kind === 'error' && result.error.kind, 'timeout');
  assert.ok(Date.now() - started < 2000);
});

test('blocks private hosts and bad URLs by default', async () => {
  const blocked = await fetchFeed(`${origin}/feed`);
  assert.equal(blocked.kind === 'error' && blocked.error.kind, 'blocked-host');
  const invalid = await fetchFeed('not a url');
  assert.equal(invalid.kind === 'error' && invalid.error.kind, 'invalid-url');
  const ftp = await fetchFeed('ftp://example.com/feed');
  assert.equal(ftp.kind === 'error' && ftp.error.kind, 'invalid-url');
});
