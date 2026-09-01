/**
 * Server-side allowlist HTML sanitizer for CMS page content.
 *
 * The dashboard content field may contain rich text (headings, lists, links,
 * etc.) which the public page renders as HTML. Rather than pulling in a
 * browser-sanitizer dependency (DOMPurify etc., which assume a DOM and don't
 * run in an RSC/Node context for free), this parser walks the markup with a
 * strict tag/attribute allowlist and rebuilds it, escaping anything it doesn't
 * recognize.
 *
 * Security model: content is authored by ADMIN/MANAGEMENT only (the /pages
 * PUT endpoint is guarded by RolesGuard). This sanitizer is defense-in-depth
 * so that a <script>, an event-handler attribute, or a `javascript:` URL can
 * never survive into the page even if a lower-privilege actor ever edits it.
 */

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "blockquote",
  "a",
  "img",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "caption",
  "sup",
  "sub",
  "code",
  "pre",
  "hr",
  "span",
]);

/** Attribute allowlist per element. Global attrs apply to every tag. */
const GLOBAL_ATTRS = new Set(["class", "id", "style"]);
const TAG_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "title", "target", "rel"]),
  img: new Set(["src", "alt", "title", "width", "height", "loading"]),
  td: new Set(["colspan", "rowspan"]),
  th: new Set(["colspan", "rowspan", "scope"]),
  ol: new Set(["start", "type"]),
};

const VOID_TAGS = new Set(["br", "hr", "img"]);

/** Full escape — used for attribute values, where any `&` must be escaped. */
function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escape text nodes while preserving valid HTML entities the author wrote
 *  (`&amp;`, `&#39;`, `&nbsp;` …) so they aren't double-escaped. Only a stray
 *  `&` that doesn't start a known entity is turned into `&amp;`. */
function escText(text: string): string {
  return text
    .replace(/&(?!(?:#[0-9]+|[a-z][a-z0-9]*);)/gi, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** True if a URL scheme like `javascript:` or `data:`(non-image) is unsafe. */
function isSafeUrl(value: string): boolean {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (trimmed.startsWith("/")) return true; // relative or absolute-path URL
  if (trimmed.startsWith("#")) return true; // in-page anchor
  if (trimmed.startsWith("mailto:")) return true;
  if (trimmed.startsWith("tel:")) return true;
  return false;
}

function allowedAttrs(tag: string, attrs: Record<string, string>): Record<string, string> {
  const allowed = new Set(TAG_ATTRS[tag] ?? []);
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(attrs)) {
    const lower = name.toLowerCase();
    if (!allowed.has(lower) && !GLOBAL_ATTRS.has(lower)) continue;
    if (lower === "class" || lower === "id") continue; // strip class/id by default
    if (lower === "style") continue; // strip inline styles (CSS injection surface)
    // Link/image URLs must be safe.
    if (lower === "href" || lower === "src" || lower === "action") {
      if (!isSafeUrl(value)) continue;
    }
    if (lower.startsWith("on")) continue; // no event handlers
    out[lower] = esc(value);
  }
  return out;
}

/** Parse `html` into [{text}|{open,attrs}|{close}] tokens via a regex walk. */
type Token =
  | { type: "text"; value: string }
  | { type: "open"; tag: string; attrs: Record<string, string>; selfClose: boolean }
  | { type: "close"; tag: string };

function tokenize(html: string): Token[] {
  const tokens: Token[] = [];
  const re = /<!--[\s\S]*?-->|<\/?([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (m.index > last) tokens.push({ type: "text", value: html.slice(last, m.index) });
    last = m.index + m[0].length;
    const full = m[0];
    if (full.startsWith("<!--")) {
      // Comments dropped.
      continue;
    }
    const isClose = full.startsWith("</");
    const rawTag = m[1].toLowerCase();
    if (isClose) {
      tokens.push({ type: "close", tag: rawTag });
      continue;
    }
    const attrsRaw = m[2] ?? "";
    const selfClose = /\/\s*$/.test(full);
    // Parse attributes: name[="value"] pairs (quoted or unquoted).
    const attrs: Record<string, string> = {};
    const attrRe = /([a-zA-Z][a-zA-Z0-9:_-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
    let am: RegExpExecArray | null;
    while ((am = attrRe.exec(attrsRaw)) !== null) {
      const name = am[1].toLowerCase();
      const value = am[2] ?? am[3] ?? am[4] ?? "";
      attrs[name] = value;
    }
    tokens.push({ type: "open", tag: rawTag, attrs, selfClose });
  }
  if (last < html.length) tokens.push({ type: "text", value: html.slice(last) });
  return tokens;
}

/** Rebuild a safe HTML string from the token stream. */
export function sanitizeHtml(html: string): string {
  const tokens = tokenize(html);
  const out: string[] = [];
  const stack: string[] = [];
  let suppressed = 0; // >0 while inside a dropped (unknown) container element

  for (const token of tokens) {
    // While suppressing a dropped subtree (e.g. <script>…</script>), ignore
    // everything — text, nested opens/closes — until the subtree closes.
    if (suppressed > 0) {
      if (token.type === "open" && !VOID_TAGS.has(token.tag)) suppressed++;
      else if (token.type === "close") suppressed--;
      continue;
    }

    if (token.type === "text") {
      out.push(escText(token.value));
      continue;
    }

    if (token.type === "open") {
      const isAllowed = ALLOWED_TAGS.has(token.tag);
      if (!isAllowed) {
        // Drop the element; if it's a non-void container, drop its whole
        // subtree too (e.g. <script>, <style>).
        if (!VOID_TAGS.has(token.tag)) suppressed = 1;
        continue;
      }
      const safeAttrs = allowedAttrs(token.tag, token.attrs);
      const attrStr = Object.entries(safeAttrs)
        .map(([k, v]) => `${k}="${v}"`)
        .join(" ");
      if (VOID_TAGS.has(token.tag)) {
        out.push(`<${token.tag}${attrStr ? " " + attrStr : ""}/>`);
      } else {
        out.push(`<${token.tag}${attrStr ? " " + attrStr : ""}>`);
        stack.push(token.tag);
      }
      continue;
    }

    // close
    const idx = stack.lastIndexOf(token.tag);
    if (idx === -1) continue; // unmatched close — drop
    // Close the tag and any still-open descendants above it.
    while (stack.length > idx) out.push(`</${stack.pop()}>`);
  }
  // Close any tags left open.
  while (stack.length) out.push(`</${stack.pop()}>`);
  return out.join("");
}
