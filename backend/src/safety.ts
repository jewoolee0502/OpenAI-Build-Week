const MAX_BUNDLE_BYTES = 350_000;

const blockedTagPatterns = [
  /<\s*(?:iframe|frame|frameset|object|embed|base|form|input|textarea)\b/i,
  /<\s*link\b/i,
  /<\s*meta\b[^>]*http-equiv\s*=\s*["']?refresh/i,
  /<\s*script\b[^>]*\bsrc\s*=/i,
];

const blockedCapabilityPatterns = [
  /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\s*\(/,
  /\b(?:localStorage|sessionStorage|indexedDB|document\.cookie)\b/,
  /\b(?:window\.)?(?:open|postMessage)\s*\(/,
  /\b(?:eval|Function)\s*\(/,
  /\bimport\s*\(/,
  /\b(?:parent|top|opener)\s*\./,
];

const externalAttributePattern =
  /\b(?:src|href|action)\s*=\s*["']\s*(?:https?:|\/\/|javascript:|file:)/i;
const externalCssPattern = /url\s*\(\s*["']?\s*(?:https?:|\/\/|file:)/i;

export class UnsafeGameBundleError extends Error {
  public readonly statusCode = 422;

  public constructor(public readonly reasons: string[]) {
    super(`Generated game failed safety validation: ${reasons.join("; ")}`);
  }
}

export function validateAndHardenGameHtml(rawHtml: string): string {
  const html = rawHtml.trim().replace(/^```(?:html)?\s*/i, "").replace(/\s*```$/, "");
  const reasons: string[] = [];

  if (Buffer.byteLength(html, "utf8") > MAX_BUNDLE_BYTES) {
    reasons.push(`bundle exceeds ${MAX_BUNDLE_BYTES} bytes`);
  }
  if (!/<\s*html\b/i.test(html) || !/<\s*body\b/i.test(html)) {
    reasons.push("bundle must contain html and body elements");
  }
  if (!/<\s*script\b/i.test(html)) {
    reasons.push("bundle must contain inline game logic");
  }

  for (const pattern of blockedTagPatterns) {
    if (pattern.test(html)) reasons.push(`blocked HTML capability: ${pattern.source}`);
  }
  for (const pattern of blockedCapabilityPatterns) {
    if (pattern.test(html)) reasons.push(`blocked JavaScript capability: ${pattern.source}`);
  }
  if (externalAttributePattern.test(html)) reasons.push("external or executable URL detected");
  if (externalCssPattern.test(html)) reasons.push("external CSS asset detected");

  if (reasons.length > 0) throw new UnsafeGameBundleError(reasons);

  const csp = [
    "default-src 'none'",
    "script-src 'unsafe-inline'",
    "style-src 'unsafe-inline'",
    "img-src data: blob:",
    "media-src data: blob:",
    "connect-src 'none'",
    "font-src data:",
    "object-src 'none'",
    "frame-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");
  const securityHead = [
    `<meta http-equiv="Content-Security-Policy" content="${csp}">`,
    '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">',
  ].join("");

  if (/<\s*head\b[^>]*>/i.test(html)) {
    return html.replace(/<\s*head\b[^>]*>/i, (head) => `${head}${securityHead}`);
  }
  return html.replace(/<\s*html\b[^>]*>/i, (root) => `${root}<head>${securityHead}</head>`);
}

export function escapeHtmlText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderPublicGamePage(title: string, gameHtml: string): string {
  const escapedTitle = escapeHtmlText(title);
  const escapedSource = escapeHtmlText(gameHtml);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="referrer" content="no-referrer">
  <title>${escapedTitle} · ImagineLab</title>
  <style>
    *{box-sizing:border-box}html,body{margin:0;min-height:100%;background:#17152b;color:#fff;font-family:ui-rounded,system-ui,sans-serif}
    body{display:grid;grid-template-rows:auto 1fr}.bar{display:flex;align-items:center;gap:10px;padding:12px 18px;background:#211e3d;border-bottom:1px solid #38335e}
    .mark{display:grid;place-items:center;width:30px;height:30px;border-radius:10px;background:#8b5cf6;font-weight:900}.title{font-weight:800}.made{margin-left:auto;color:#c5bfdf;font-size:13px}
    .stage{min-height:0;padding:12px}.stage iframe{display:block;width:100%;height:100%;min-height:calc(100vh - 70px);border:0;border-radius:18px;background:#fff;box-shadow:0 20px 70px #090714}
  </style>
</head>
<body>
  <header class="bar"><span class="mark">✦</span><span class="title">${escapedTitle}</span><span class="made">Made with ImagineLab</span></header>
  <main class="stage"><iframe title="${escapedTitle}" sandbox="allow-scripts" referrerpolicy="no-referrer" srcdoc="${escapedSource}"></iframe></main>
</body>
</html>`;
}
