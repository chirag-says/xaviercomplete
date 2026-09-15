/**
 * GET /embed/turnstile — the Cloudflare challenge, and nothing else.
 *
 * Cloudflare ships no React Native SDK, so the app renders the widget the only
 * way it can: as a real web page inside a WebView. This is that page. It carries
 * no SXCCAA content, no navigation and no links — a blank card with a challenge
 * on it — because it is the one surface in the system that exists to be loaded
 * by something other than a browser.
 *
 * On success it calls `window.ReactNativeWebView.postMessage(...)`. The app
 * reads that, dismisses the WebView, and sends the token in its JSON body
 * exactly as the website's form does. `src/lib/turnstile.ts` is untouched and
 * cannot tell the difference.
 *
 * ## Why a route handler rather than a page
 *
 * This document needs its own `<html>`, and in the App Router only a *root*
 * layout may render one. `src/app/layout.tsx` already is that root, and it wraps
 * every page in the site's fonts, header and footer — none of which belong in a
 * challenge WebView. A route handler returns the exact bytes instead, with no
 * layout above it.
 *
 * ## The CSP nonce
 *
 * The middleware mints a per-request nonce and passes it in as `x-nonce`. Both
 * script tags carry it, because `script-src` here is
 * `'self' 'nonce-…' 'strict-dynamic'` — without the nonce the inline bridge is
 * refused and the WebView sits blank with no console anyone will ever read.
 * Cloudflare's own host is already in `script-src` and `frame-src` for the
 * website's login form, so no header changes were needed for any of this.
 *
 * `frame-ancestors 'none'` does not interfere: a WebView loading this as its
 * top-level document is not framing it.
 *
 * ## This is the most fragile component in the app
 *
 * A browser control running in a non-browser, against a third party who can
 * change it without telling us. The mitigations are real and written down in the
 * plan's §2.3: `minSupportedVersion` from `GET /config` can force an upgrade on
 * a build that stops working; this page reports failure rather than hanging; and
 * the rate limits are the control of record — 3/hour and 5/day per address,
 * 10/hour per connection — so removing Turnstile outright would still bound the
 * damage. It raises an attacker's cost; it is not what stops them.
 */

import { NextResponse } from 'next/server';

import { turnstileSiteKey } from '@/lib/turnstile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Minimal escaping for the one value interpolated into an attribute. */
function attr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function page(siteKey: string | null, nonce: string): string {
  const style = `
    html,body{margin:0;padding:0;height:100%;background:#fff;color:#111;
      font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
    .wrap{min-height:100%;display:flex;flex-direction:column;align-items:center;
      justify-content:center;gap:16px;padding:24px;box-sizing:border-box}
    .note{font-size:14px;line-height:20px;color:rgba(17,17,17,.55);text-align:center;margin:0}
    .err{font-size:14px;line-height:20px;color:#8b2332;text-align:center;margin:0}
  `;

  if (!siteKey) {
    /*
     * No site key configured. Said plainly rather than rendering an empty box: a
     * blank WebView is indistinguishable from a hung one, and the app cannot
     * tell them apart either. The bridge still fires so the app closes the sheet
     * and shows its own error instead of waiting out the timeout.
     */
    return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Security check</title>
<style nonce="${nonce}">${style}</style></head>
<body><div class="wrap"><p class="err">The security check is not configured on this server.</p></div>
<script nonce="${nonce}">
(function(){var b=window.ReactNativeWebView;
if(b&&b.postMessage)b.postMessage(JSON.stringify({status:'error',reason:'not_configured'}));})();
</script></body></html>`;
  }

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Security check</title>
<style nonce="${nonce}">${style}</style></head>
<body>
<div class="wrap">
  <div id="challenge" class="cf-turnstile"
       data-sitekey="${attr(siteKey)}"
       data-callback="__sxcDone"
       data-error-callback="__sxcFail"
       data-expired-callback="__sxcFail"
       data-theme="light"></div>
  <p class="note" id="note">Checking that you are a person&hellip;</p>
  <p class="err" id="error" hidden>Couldn&rsquo;t load the security check. Close this and try again.</p>
</div>

<script nonce="${nonce}">
(function(){
  var sent=false;
  function post(p){
    if(sent)return; sent=true;
    var b=window.ReactNativeWebView;
    if(b&&typeof b.postMessage==='function')b.postMessage(JSON.stringify(p));
  }
  function fail(reason){
    var e=document.getElementById('error'); if(e)e.hidden=false;
    var n=document.getElementById('note'); if(n)n.hidden=true;
    post({status:'error',reason:reason||'widget_error'});
  }
  // Named on window because Turnstile resolves its callbacks by string name.
  window.__sxcDone=function(token){post({status:'ok',token:token});};
  window.__sxcFail=fail;
  // If nothing has happened in twenty seconds it is not going to. Reporting
  // that beats a WebView that sits there indefinitely with no way out.
  setTimeout(function(){ if(!sent) fail('timeout'); },20000);
})();
</script>
<script nonce="${nonce}" src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
</body></html>`;
}

export async function GET(request: Request): Promise<NextResponse> {
  const nonce = request.headers.get('x-nonce') ?? '';

  return new NextResponse(page(turnstileSiteKey(), nonce), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Per-request nonce means this document is never reusable.
      'Cache-Control': 'no-store, max-age=0',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  }) as NextResponse;
}
