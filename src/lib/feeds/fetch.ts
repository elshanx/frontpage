import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import { decodeFeed } from './decode.ts';

const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;
const MAX_BYTES = 5 * 1024 * 1024;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const PERMANENT_REDIRECTS = new Set([301, 308]);
const USER_AGENT = 'FrontpageReader/1.0 (RSS reader)';
const ACCEPT =
  'application/rss+xml, application/atom+xml, application/rdf+xml, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.5';

const PRIVATE_V4: [string, number][] = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 3],
];
const PRIVATE_V6: [string, number][] = [
  ['::', 127],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
];
const privateRanges = new BlockList();
PRIVATE_V4.forEach(([network, prefix]) => privateRanges.addSubnet(network, prefix, 'ipv4'));
PRIVATE_V6.forEach(([network, prefix]) => privateRanges.addSubnet(network, prefix, 'ipv6'));

export type FeedErrorKind =
  | 'invalid-url'
  | 'blocked-host'
  | 'dns'
  | 'timeout'
  | 'network'
  | 'http'
  | 'too-large'
  | 'redirect-loop'
  | 'not-a-feed';

export interface FeedError {
  kind: FeedErrorKind;
  message: string;
  status: number | null;
  permanent: boolean;
}

export type FetchResult =
  | {
      kind: 'ok';
      body: string;
      finalUrl: string;
      movedPermanently: boolean;
      etag: string | null;
      lastModified: string | null;
    }
  | { kind: 'not-modified'; finalUrl: string; movedPermanently: boolean }
  | { kind: 'error'; error: FeedError };

export interface FetchOptions {
  etag?: string | null;
  lastModified?: string | null;
  timeoutMs?: number;
  allowPrivateHosts?: boolean;
}

class FetchFailure extends Error {
  readonly feedError: FeedError;

  constructor(feedError: FeedError) {
    super(feedError.message);
    this.feedError = feedError;
  }
}

const failure = (
  kind: FeedErrorKind,
  message: string,
  permanent = false,
  status: number | null = null
) => new FetchFailure({ kind, message, permanent, status });

export function isPrivateAddress(ip: string): boolean {
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1];
  if (mapped) return isPrivateAddress(mapped);
  return privateRanges.check(ip, isIP(ip) === 6 ? 'ipv6' : 'ipv4');
}

async function assertPublicHost(url: URL) {
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host)
    ? [host]
    : (
        await lookup(host, { all: true }).catch(() => {
          throw failure('dns', `We couldn't find the server ${host}`);
        })
      ).map(({ address }) => address);
  // ponytail: checked before connecting, so DNS rebinding between lookup and fetch is still possible; pin resolved IPs via an undici dispatcher if this app ever runs inside a private network.
  if (addresses.some(isPrivateAddress)) {
    throw failure(
      'blocked-host',
      'Feeds on private or local network addresses are not allowed',
      true
    );
  }
}

function httpFailure(status: number): FetchFailure {
  if (status === 404) {
    return failure(
      'http',
      'The feed returned 404 Not Found. It may have moved or been removed',
      true,
      status
    );
  }
  if (status === 410) {
    return failure('http', 'The feed has been permanently removed (410 Gone)', true, status);
  }
  if (status === 429) {
    return failure(
      'http',
      "The feed's server is rate limiting requests (429). We'll retry later",
      false,
      status
    );
  }
  if (status >= 500) {
    return failure(
      'http',
      `The feed's server had an error (${status}). We'll retry later`,
      false,
      status
    );
  }
  return failure('http', `The feed's server refused the request (${status})`, false, status);
}

async function readLimited(response: Response): Promise<Uint8Array> {
  const tooLarge = failure('too-large', 'The feed is larger than 5 MB');
  if (Number(response.headers.get('content-length')) > MAX_BYTES) throw tooLarge;
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();

  const chunks: Uint8Array[] = [];
  let size = 0;
  const pump = async (): Promise<void> => {
    const { done, value } = await reader.read();
    if (done) return;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      throw tooLarge;
    }
    chunks.push(value);
    await pump();
  };
  await pump();
  return Buffer.concat(chunks);
}

function toFeedError(error: unknown): FeedError {
  if (error instanceof FetchFailure) return error.feedError;
  if (error instanceof Error && error.name === 'TimeoutError') {
    return {
      kind: 'timeout',
      message: 'The feed took longer than 10 seconds to respond',
      status: null,
      permanent: false,
    };
  }
  return {
    kind: 'network',
    message: "We couldn't connect to the feed's server",
    status: null,
    permanent: false,
  };
}

function parseUrl(raw: string, base?: URL): URL {
  let url: URL;
  try {
    url = new URL(raw.trim(), base);
  } catch {
    throw failure('invalid-url', "That doesn't look like a valid web address", true);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw failure('invalid-url', 'Only http and https feed addresses are supported', true);
  }
  return url;
}

export async function fetchFeed(rawUrl: string, options: FetchOptions = {}): Promise<FetchResult> {
  const signal = AbortSignal.timeout(options.timeoutMs ?? TIMEOUT_MS);
  const headers: Record<string, string> = { 'User-Agent': USER_AGENT, Accept: ACCEPT };
  if (options.etag) headers['If-None-Match'] = options.etag;
  if (options.lastModified) headers['If-Modified-Since'] = options.lastModified;

  const request = async (url: URL, hop: number, allPermanent: boolean): Promise<FetchResult> => {
    if (hop > MAX_REDIRECTS) throw failure('redirect-loop', 'The feed redirects too many times');
    if (!options.allowPrivateHosts) await assertPublicHost(url);
    const response = await fetch(url, { redirect: 'manual', signal, headers });

    if (REDIRECT_STATUSES.has(response.status)) {
      await response.body?.cancel();
      const location = response.headers.get('location');
      if (!location) throw httpFailure(response.status);
      return request(
        parseUrl(location, url),
        hop + 1,
        allPermanent && PERMANENT_REDIRECTS.has(response.status)
      );
    }

    const finalUrl = url.href;
    const movedPermanently = hop > 0 && allPermanent;
    if (response.status === 304) {
      await response.body?.cancel();
      return { kind: 'not-modified', finalUrl, movedPermanently };
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw httpFailure(response.status);
    }
    const bytes = await readLimited(response);
    return {
      kind: 'ok',
      body: decodeFeed(bytes, response.headers.get('content-type')),
      finalUrl,
      movedPermanently,
      etag: response.headers.get('etag'),
      lastModified: response.headers.get('last-modified'),
    };
  };

  try {
    return await request(parseUrl(rawUrl), 0, true);
  } catch (error) {
    return { kind: 'error', error: toFeedError(error) };
  }
}
