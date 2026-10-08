interface ExportFeed {
  title: string;
  url: string;
  siteUrl: string | null;
}

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};
const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ESCAPES[char]);

const feedOutline = ({ title, url, siteUrl }: ExportFeed, indent: string) =>
  `${indent}<outline type="rss" text="${escape(title)}" title="${escape(title)}" xmlUrl="${escape(url)}"${
    siteUrl ? ` htmlUrl="${escape(siteUrl)}"` : ''
  } />`;

export default function buildOpml(
  groups: { name: string | null; feeds: ExportFeed[] }[],
  title: string
): string {
  const body = groups.flatMap(({ name, feeds }) =>
    name
      ? [
          `    <outline text="${escape(name)}" title="${escape(name)}">`,
          ...feeds.map((feed) => feedOutline(feed, '      ')),
          '    </outline>',
        ]
      : feeds.map((feed) => feedOutline(feed, '    '))
  );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<opml version="2.0">',
    `  <head><title>${escape(title)}</title></head>`,
    '  <body>',
    ...body,
    '  </body>',
    '</opml>',
    '',
  ].join('\n');
}
