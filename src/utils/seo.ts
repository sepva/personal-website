import type { ContentItem } from "../shared";
import type { Logger } from "./logger";

const BASE_URL = "https://seppevanswegenoven.be";
const DEFAULT_SITE_TITLE = "Seppe Vanswegenoven";
const DEFAULT_SITE_DESCRIPTION =
    "Personal website of Seppe Vanswegenoven. Get to know more about my work, fun (AI) projects, and academic achievements.";
const SHAREABLE_TABLES = ["academic", "work", "projects"] as const;

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");

const toIsoDate = (value?: string): string | null => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
};

const upsertTag = (html: string, pattern: RegExp, tag: string): string => {
  if (pattern.test(html)) {
    return html.replace(pattern, tag);
  }
  return html.replace("</head>", `  ${tag}\n</head>`);
};

const upsertCanonical = (html: string, canonicalUrl: string): string =>
  upsertTag(
    html,
    /<link\s+rel="canonical"[^>]*>/i,
    `<link rel="canonical" href="${canonicalUrl}" />`
  );

const upsertMeta = (html: string, nameOrProp: string, content: string): string =>
  upsertTag(
    html,
    new RegExp(
      `<meta\\s+(?:name|property)="${nameOrProp}"[^>]*>`,
      "i"
    ),
    `<meta ${nameOrProp.startsWith("og:") ? "property" : "name"}="${nameOrProp}" content="${content}" />`
  );

const injectShareableJsonLd = (html: string, jsonLd: string): string => {
  const scriptTag =
    `<script type="application/ld+json" id="shareable-jsonld">${jsonLd}</script>`;
  const existing =
    /<script[^>]*id="shareable-jsonld"[^>]*>[\s\S]*?<\/script>/i;
  if (existing.test(html)) {
    return html.replace(existing, scriptTag);
  }
  return html.replace("</head>", `  ${scriptTag}\n</head>`);
};

const buildShareableSummary = (contentItem: ContentItem): string => {
  const title = escapeHtml(contentItem.title || DEFAULT_SITE_TITLE);
  const description = escapeHtml(
    contentItem.description || DEFAULT_SITE_DESCRIPTION
  );
  const date = contentItem.date ? escapeHtml(contentItem.date) : "";
  const tags = contentItem.tags?.length
    ? escapeHtml(contentItem.tags.join(", "))
    : "";
  const link = contentItem.link ? escapeHtml(contentItem.link) : "";

  return `
    <main class="shareable-content" role="main">
      <header>
        <h1>${title}</h1>
      </header>
      <p>${description}</p>
      ${date ? `<p><strong>Date:</strong> ${date}</p>` : ""}
      ${tags ? `<p><strong>Tags:</strong> ${tags}</p>` : ""}
      ${link ? `<p><a href="${link}" rel="noopener noreferrer">View link</a></p>` : ""}
    </main>
  `;
};

const injectShareableContent = (
  baseHtml: string,
  params: {
    canonicalUrl: string;
    title: string;
    description: string;
    imageUrl: string;
    jsonLd: string;
    bodyHtml: string;
  }
): string => {
  let html = baseHtml;
  html = upsertTag(
    html,
    /<title>.*?<\/title>/i,
    `<title>${params.title}</title>`
  );
  html = upsertMeta(html, "description", params.description);
  html = upsertCanonical(html, params.canonicalUrl);
  html = upsertMeta(html, "og:type", "website");
  html = upsertMeta(html, "og:title", params.title);
  html = upsertMeta(html, "og:description", params.description);
  html = upsertMeta(html, "og:url", params.canonicalUrl);
  html = upsertMeta(html, "og:image", params.imageUrl);
  html = upsertMeta(html, "twitter:card", "summary_large_image");
  html = upsertMeta(html, "twitter:title", params.title);
  html = upsertMeta(html, "twitter:description", params.description);
  html = upsertMeta(html, "twitter:image", params.imageUrl);
  html = injectShareableJsonLd(html, params.jsonLd);

  const appContainerPattern = /<div\s+id="app">[\s\S]*?<\/div>/i;
  if (appContainerPattern.test(html)) {
    html = html.replace(
      appContainerPattern,
      `<div id="app">${params.bodyHtml}</div>`
    );
  }
  return html;
};

const buildShareableJsonLd = (
  contentItem: ContentItem,
  canonicalUrl: string
): string => {
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: contentItem.title || DEFAULT_SITE_TITLE,
    description: contentItem.description || DEFAULT_SITE_DESCRIPTION,
    url: canonicalUrl,
    author: {
      "@type": "Person",
      name: DEFAULT_SITE_TITLE,
      url: BASE_URL
    },
    image: `${BASE_URL}/CV_picture.jpeg`
  };

  const isoDate = toIsoDate(contentItem.date);
  if (isoDate) {
    jsonLd.datePublished = isoDate;
  }

  return JSON.stringify(jsonLd);
};

export const buildShareableHtml = (
  baseHtml: string,
  contentItem: ContentItem,
  canonicalUrl: string
): string => {
  const title = escapeHtml(
    contentItem.title
      ? `${contentItem.title} | ${DEFAULT_SITE_TITLE}`
      : DEFAULT_SITE_TITLE
  );
  const description = escapeHtml(
    contentItem.description || DEFAULT_SITE_DESCRIPTION
  );
  const bodyHtml = buildShareableSummary(contentItem);
  const jsonLd = buildShareableJsonLd(contentItem, canonicalUrl);
  const imageUrl = `${BASE_URL}/CV_picture.jpeg`;

  return injectShareableContent(baseHtml, {
    canonicalUrl,
    title,
    description,
    imageUrl,
    jsonLd,
    bodyHtml
  });
};

export const buildSitemapXml = (urls: string[]) => {
  const entries = urls
    .map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${entries}\n` +
    `</urlset>`;
};

export const fetchShareableLinks = async (env: Env, logger: Logger) => {
  const links = new Set<string>();

  for (const table of SHAREABLE_TABLES) {
    try {
      const { results } = await env.DB.prepare(
        `SELECT shareable_link FROM ${table} WHERE shareable_link IS NOT NULL AND shareable_link != ''`
      ).all();

      for (const row of results as Array<{ shareable_link?: string }>) {
        if (row.shareable_link) {
          links.add(row.shareable_link);
        }
      }
    } catch (error) {
      logger.warn(
        'sitemap_query_failed',
        'Failed to load shareable links for sitemap',
        { table, error },
        'api'
      );
    }
  }

  return [...links];
};

export const getBaseIndexHtml = async (
  request: Request,
  env: Env
): Promise<string | null> => {
  // @ts-expect-error - ASSETS is automatically provided by Cloudflare Workers
  if (!env.ASSETS) {
    return null;
  }
  const assetUrl = new URL("/index.html", request.url);
  // @ts-expect-error - ASSETS.fetch is the standard way to serve static files
  const response = await env.ASSETS.fetch(new Request(assetUrl));
  if (!response.ok) {
    return null;
  }
  return response.text();
};

export const getSeoDefaults = () => ({
  baseUrl: BASE_URL,
  siteTitle: DEFAULT_SITE_TITLE,
  siteDescription: DEFAULT_SITE_DESCRIPTION
});
