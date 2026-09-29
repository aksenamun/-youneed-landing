/**
 * Public task page for https://www.youneed.lt/task/{listingId}
 *
 * Reads active rows from public.listings with the Supabase publishable key.
 * Row Level Security already limits anonymous reads to status = active.
 * listing_photos is not publicly readable, so images are included only when
 * that existing policy returns them.
 *
 * TODO: iOS Universal Links and Android App Links.
 * The app scheme "youneed" exists in the YouNeed app (app.json) and is used
 * only for youneed://auth-confirmed and youneed://reset-password. There is no
 * confirmed task route, associated domain, or Android intent filter. Do not
 * invent a custom scheme path. The "Open in YouNeed" CTA stays on the
 * canonical web URL so Universal Links and App Links can use it later.
 */

const CANONICAL_ORIGIN = 'https://www.youneed.lt';

const SUPABASE_URL = (
  process.env.SUPABASE_URL || 'https://rmjavihkusnwdalwzlmt.supabase.co'
).replace(/\/$/, '');

const SUPABASE_PUBLISHABLE_KEY =
  process.env.SUPABASE_ANON_KEY ||
  'sb_publishable_zwR1kDFTjxbeQ5WBYmzw3g_UqkUfKNX';

const LISTING_COLUMNS = [
  'id',
  'title',
  'description',
  'category',
  'subcategory',
  'status',
  'budget',
  'currency',
  'country',
  'municipality',
  'city',
  'district',
  'location_name',
].join(',');

const LISTING_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PAGE_STYLES = `
:root{--bg:#f7f7f4;--ink:#111;--muted:#686868;--card:#fff;--line:#e8e8e3;--green:#063318}
*{box-sizing:border-box}
body{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:var(--bg);color:var(--ink)}
a{text-decoration:none;color:inherit}
.nav{height:76px;display:flex;align-items:center;max-width:760px;margin:auto;padding:0 24px}
.logo{font-size:24px;font-weight:800;letter-spacing:-1px}
.logo span{font-weight:400;color:var(--green)}
main{max-width:760px;margin:0 auto;padding:12px 24px 72px}
.panel{background:var(--card);border:1px solid var(--line);border-radius:28px;padding:28px}
.gallery{display:grid;gap:12px;margin:-8px -8px 22px}
.gallery img{width:100%;max-height:440px;object-fit:cover;border-radius:18px;background:#eee;display:block}
.meta{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px}
.pill{display:inline-flex;align-items:center;padding:7px 11px;border-radius:999px;background:#eef6f1;color:var(--green);font-size:13px;font-weight:600}
h1{font-size:clamp(34px,6vw,52px);line-height:1.02;letter-spacing:-1.8px;margin:0 0 18px}
.facts{display:flex;flex-direction:column;gap:8px;margin:0 0 22px;color:var(--muted);font-size:16px}
.facts b{color:var(--ink);font-weight:600}
.description{font-size:17px;line-height:1.6;margin:0}
.description p{margin:0 0 14px}
.description p:last-child{margin-bottom:0}
.actions{display:flex;flex-direction:column;gap:12px;margin-top:28px}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:14px 18px;border-radius:13px;font-weight:700;font-size:15px;border:1px solid transparent}
.primary{background:#111;color:#fff}
.stores{display:flex;gap:12px;flex-wrap:wrap}
.store{flex:1;border:1px solid #dcdcd5;background:#fff;color:#9a9a9a;cursor:not-allowed;pointer-events:none}
.fallback{margin:4px 0 0;color:var(--muted);font-size:14px;line-height:1.5}
.empty{padding:48px 8px 24px}
.empty h1{font-size:clamp(36px,6vw,56px);letter-spacing:-2px}
.empty p{color:var(--muted);font-size:18px;line-height:1.5;max-width:460px}
footer{border-top:1px solid var(--line);padding:28px 24px;color:var(--muted);font-size:13px}
.foot{max-width:760px;margin:auto}
@media(max-width:800px){
  .panel{padding:22px 18px;border-radius:22px}
  .stores{flex-direction:column}
}
`;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isListingId(value) {
  return typeof value === 'string' && LISTING_ID_PATTERN.test(value);
}

function isSecretSupabaseKey(key) {
  if (/sb_secret_/i.test(key)) return true;

  const parts = String(key).split('.');
  if (parts.length !== 3) return false;

  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf8')
    );
    return payload.role === 'service_role';
  } catch {
    return false;
  }
}

function readListingId(req) {
  const queryId = req.query && req.query.id;
  const fromQuery = Array.isArray(queryId) ? queryId[0] : queryId;
  if (typeof fromQuery === 'string' && fromQuery.trim()) {
    return fromQuery.trim();
  }

  const rawUrl = req.url || '';
  const pathname = rawUrl.split('?')[0];
  const match = pathname.match(/\/(?:api\/)?task\/([^/]+)\/?$/);
  if (!match) return '';

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return '';
  }
}

function plainText(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function metaText(value, fallback) {
  const clean = plainText(value);
  if (!clean) return fallback;
  if (clean.length <= 180) return clean;
  return `${clean.slice(0, 177).trimEnd()}...`;
}

function formatBudget(budget, currency) {
  if (budget == null || budget === '') return '';

  const amount = Number(budget);
  if (!Number.isFinite(amount) || amount <= 0) return '';

  const formatted = Number.isInteger(amount)
    ? String(amount)
    : amount.toFixed(2);
  const normalized = String(currency ?? '').trim().toUpperCase();

  if (normalized === 'EUR' || normalized === '€') return `€${formatted}`;
  if (normalized === 'USD' || normalized === '$') return `$${formatted}`;

  const prefix = String(currency ?? '').trim();
  return prefix ? `${prefix} ${formatted}` : formatted;
}

function formatLocation(listing) {
  const city = plainText(listing.city);
  const district = plainText(listing.district);
  const municipality = plainText(listing.municipality);
  const locationName = plainText(listing.location_name);
  const country = plainText(listing.country);
  const parts = [];

  if (city) parts.push(city);
  if (district && district !== city) parts.push(district);
  if (
    municipality &&
    municipality !== city &&
    municipality !== district
  ) {
    parts.push(municipality);
  }
  if (!parts.length && locationName) parts.push(locationName);
  if (country && !parts.includes(country)) parts.push(country);

  return parts.join(', ');
}

function formatCategory(listing) {
  const category = plainText(listing.category);
  const subcategory = plainText(listing.subcategory);
  if (category && subcategory) return `${category} · ${subcategory}`;
  return category || subcategory;
}

function descriptionHtml(description) {
  const text = String(description ?? '').trim();
  if (!text) return '';

  return text
    .split(/\n{2,}/)
    .map((paragraph) => {
      const html = escapeHtml(paragraph).replace(/\n/g, '<br>');
      return `<p>${html}</p>`;
    })
    .join('');
}

function isPublicListingImage(url) {
  if (typeof url !== 'string' || !url) return false;

  try {
    const parsed = new URL(url);
    const supabaseHost = new URL(SUPABASE_URL).host;
    return parsed.protocol === 'https:' && parsed.host === supabaseHost;
  } catch {
    return false;
  }
}

function publicImageUrls(photos) {
  if (!Array.isArray(photos)) return [];

  return photos
    .slice()
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
    .map((photo) => photo && photo.photo_url)
    .filter(isPublicListingImage);
}

function canonicalTaskUrl(id) {
  return `${CANONICAL_ORIGIN}/task/${id}`;
}

function layout({
  documentTitle,
  socialTitle,
  description,
  url,
  image,
  robots,
  body,
}) {
  const shareTitle = socialTitle || documentTitle;
  const imageTags = image
    ? `<meta property="og:image" content="${escapeHtml(image)}">
<meta name="twitter:image" content="${escapeHtml(image)}">`
    : '';
  const card = image ? 'summary_large_image' : 'summary';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(documentTitle)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="${escapeHtml(robots)}">
<link rel="canonical" href="${escapeHtml(url)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${escapeHtml(url)}">
<meta property="og:title" content="${escapeHtml(shareTitle)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:site_name" content="YouNeed">
${imageTags}
<meta name="twitter:card" content="${card}">
<meta name="twitter:title" content="${escapeHtml(shareTitle)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<style>${PAGE_STYLES}</style>
</head>
<body>
<header class="nav"><a class="logo" href="/">YouNeed<span>.app</span></a></header>
<main>${body}</main>
<footer><div class="foot">© 2026 YouNeed.app</div></footer>
</body>
</html>`;
}

function renderNotFoundPage() {
  return layout({
    documentTitle: 'Task not found — YouNeed',
    socialTitle: 'Task not found — YouNeed',
    description: 'This YouNeed task is not available.',
    url: CANONICAL_ORIGIN,
    image: '',
    robots: 'noindex',
    body: `<section class="panel empty">
<h1>This task is not available.</h1>
<p>It may have been removed, or it is not public.</p>
<div class="actions"><a class="btn primary" href="/">Back to YouNeed</a></div>
</section>`,
  });
}

function renderMethodNotAllowedPage() {
  return layout({
    documentTitle: 'Method not allowed — YouNeed',
    socialTitle: 'Method not allowed — YouNeed',
    description: 'Open this YouNeed task link in a browser.',
    url: CANONICAL_ORIGIN,
    image: '',
    robots: 'noindex',
    body: `<section class="panel empty">
<h1>Open this link in a browser.</h1>
<p>This page can only be viewed, not submitted.</p>
<div class="actions"><a class="btn primary" href="/">Back to YouNeed</a></div>
</section>`,
  });
}

function renderUnavailablePage() {
  return layout({
    documentTitle: 'Task unavailable — YouNeed',
    socialTitle: 'Task unavailable — YouNeed',
    description: 'This YouNeed task could not be loaded right now.',
    url: CANONICAL_ORIGIN,
    image: '',
    robots: 'noindex',
    body: `<section class="panel empty">
<h1>This task could not be loaded.</h1>
<p>Please try again in a moment. You can also continue on the YouNeed homepage.</p>
<div class="actions"><a class="btn primary" href="/">Back to YouNeed</a></div>
</section>`,
  });
}

function renderTaskPage(listing, photos) {
  const id = listing.id;
  const url = canonicalTaskUrl(id);
  const title = plainText(listing.title) || 'YouNeed task';
  const summary = metaText(
    listing.description,
    'View this task on YouNeed.'
  );
  const location = formatLocation(listing);
  const budget = formatBudget(listing.budget, listing.currency);
  const category = formatCategory(listing);
  const images = publicImageUrls(photos);
  const description = descriptionHtml(listing.description);

  const pills = category
    ? `<div class="meta"><span class="pill">${escapeHtml(category)}</span></div>`
    : '';
  const facts = [
    location
      ? `<div>Location · <b>${escapeHtml(location)}</b></div>`
      : '',
    budget ? `<div>Budget · <b>${escapeHtml(budget)}</b></div>` : '',
  ]
    .filter(Boolean)
    .join('');
  const gallery = images.length
    ? `<div class="gallery">${images
        .map(
          (image, index) =>
            `<img src="${escapeHtml(image)}" alt="${escapeHtml(
              index === 0 ? title : `${title} photo ${index + 1}`
            )}">`
        )
        .join('')}</div>`
    : '';
  const descriptionBlock = description
    ? `<div class="description">${description}</div>`
    : '';

  const body = `<article class="panel">
${gallery}
${pills}
<h1>${escapeHtml(title)}</h1>
${facts ? `<div class="facts">${facts}</div>` : ''}
${descriptionBlock}
<div class="actions">
<!--
  TODO: iOS Universal Links and Android App Links.
  Confirmed app scheme: youneed
  Confirmed routes: youneed://auth-confirmed and youneed://reset-password
  No confirmed task deep link exists. Do not invent one.
  Keep this CTA on the canonical web URL.
-->
<a class="btn primary" href="${escapeHtml(url)}">Open in YouNeed</a>
<div class="stores">
<!--
  TODO: App Store button.
  No public App Store URL exists in the YouNeed app repository.
  eas.json only has App Store Connect ascAppId 6812508405, which is not a store link.
  Button stays disabled until a real apps.apple.com URL exists.
-->
<span class="btn store" aria-disabled="true">App Store</span>
<!--
  TODO: Google Play button.
  No Google Play URL exists in the YouNeed app repository.
  Button stays disabled until a real play.google.com URL exists.
-->
<span class="btn store" aria-disabled="true">Google Play</span>
</div>
<p class="fallback">If the YouNeed app is not installed, you can continue on the web and view this task here.</p>
</div>
</article>`;

  return layout({
    documentTitle: `${title} — YouNeed`,
    socialTitle: title,
    description: summary,
    url,
    image: images[0] || '',
    robots: 'index,follow',
    body,
  });
}

async function supabaseGet(pathAndQuery) {
  if (isSecretSupabaseKey(SUPABASE_PUBLISHABLE_KEY)) {
    throw new Error('Refusing to use a Supabase secret key');
  }

  const response = await fetch(`${SUPABASE_URL}${pathAndQuery}`, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase request failed with ${response.status}`);
  }

  return response.json();
}

async function loadPublicListing(id) {
  const params = new URLSearchParams({
    id: `eq.${id}`,
    status: 'eq.active',
    select: LISTING_COLUMNS,
    limit: '1',
  });
  const rows = await supabaseGet(`/rest/v1/listings?${params.toString()}`);
  const listing = Array.isArray(rows) ? rows[0] : null;

  if (
    !listing ||
    listing.status !== 'active' ||
    String(listing.id).toLowerCase() !== id
  ) {
    return null;
  }

  let photos = [];
  try {
    const photoParams = new URLSearchParams({
      listing_id: `eq.${id}`,
      select: 'photo_url,sort_order',
      order: 'sort_order.asc',
    });
    const photoRows = await supabaseGet(
      `/rest/v1/listing_photos?${photoParams.toString()}`
    );
    photos = Array.isArray(photoRows) ? photoRows : [];
  } catch {
    photos = [];
  }

  return { listing, photos };
}

function contentSecurityPolicy() {
  const imageHost = new URL(SUPABASE_URL).host;
  return [
    "default-src 'none'",
    "style-src 'unsafe-inline'",
    `img-src https://${imageHost}`,
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}

function sendHtml(res, status, html, cacheControl) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', cacheControl);
  res.setHeader('Content-Security-Policy', contentSecurityPolicy());
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.end(html);
}

async function handler(req, res) {
  const method = req.method || 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    sendHtml(res, 405, renderMethodNotAllowedPage(), 'no-store');
    return;
  }

  const id = readListingId(req).toLowerCase();
  if (!isListingId(id)) {
    sendHtml(res, 404, renderNotFoundPage(), 'no-store');
    return;
  }

  try {
    const result = await loadPublicListing(id);
    if (!result) {
      sendHtml(res, 404, renderNotFoundPage(), 'no-store');
      return;
    }

    sendHtml(
      res,
      200,
      renderTaskPage(result.listing, result.photos),
      'public, max-age=60'
    );
  } catch (error) {
    const message = error && error.message ? error.message : 'unknown';
    if (!message.includes(SUPABASE_PUBLISHABLE_KEY)) {
      console.error('Public task page failed:', message);
    }
    sendHtml(res, 503, renderUnavailablePage(), 'no-store');
  }
}

handler.renderTaskPage = renderTaskPage;
handler.renderNotFoundPage = renderNotFoundPage;
handler.isListingId = isListingId;
handler.formatBudget = formatBudget;
handler.formatLocation = formatLocation;
handler.escapeHtml = escapeHtml;
handler.isSecretSupabaseKey = isSecretSupabaseKey;

module.exports = handler;
