const XML_DECLARATION_ENCODING = /^<\?xml[^>]*encoding=["']([\w.:-]+)["']/i;
const HEADER_CHARSET = /charset=["']?([\w.:-]+)/i;

function byteOrderMark(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return 'utf-16le';
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return 'utf-16be';
  return null;
}

function declaredCharset(bytes: Uint8Array, contentType: string | null): string | null {
  const fromHeader = contentType?.match(HEADER_CHARSET)?.[1];
  if (fromHeader) return fromHeader.toLowerCase();
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 256));
  return head.match(XML_DECLARATION_ENCODING)?.[1].toLowerCase() ?? null;
}

export default function decodeFeed(bytes: Uint8Array, contentType: string | null): string {
  const charset = byteOrderMark(bytes) ?? declaredCharset(bytes, contentType) ?? 'utf-8';

  if (charset === 'utf-8' || charset === 'utf8') {
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return new TextDecoder('windows-1252').decode(bytes);
    }
  }

  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}
