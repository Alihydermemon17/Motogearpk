/**
 * OAuth (Google) callback inspection for the storefront.
 *
 * Supabase Auth finishes an implicit-flow sign-in by redirecting back to
 * `redirectTo` with the session in the URL fragment. When the exchange is
 * refused instead, it redirects back with an OAuth error payload:
 *
 *   /account?error=access_denied&error_description=...
 *   /account#error=access_denied&error_description=...
 *
 * The storefront router matches routes on `pathname` only and never reads the
 * query or the fragment, and `ProtectedRoute` immediately rewrites the URL to
 * `/login?required=1` when the session is missing. Between those two behaviours
 * a failed sign-in used to end on the plain login form with no explanation at
 * all - which reads to the shop owner as "the callback is not working".
 *
 * This module captures that payload once, before anything can navigate away
 * from it, turns it into a message a person can act on, and later scrubs the
 * one-shot credentials out of the address bar.
 */

/** Query/fragment keys that only ever belong to the auth handshake. */
const AUTH_PARAM_KEYS = [
  'access_token',
  'refresh_token',
  'expires_in',
  'expires_at',
  'token_type',
  'provider_token',
  'provider_refresh_token',
  'code',
  'state',
  'code_verifier',
  'error',
  'error_description',
  'error_code',
  'error_uri',
  'sb_flow_id',
  'iss',
] as const;

/**
 * Reads `error` / `error_description` / `error_code` from the query or the
 * fragment - implicit-flow failures arrive in the fragment, Supabase's
 * redirect-URL rejections arrive in the query.
 */
function readErrorPayload(): { code: string; description: string } | null {
  const sources = [window.location.hash.replace(/^#/, ''), window.location.search.replace(/^\?/, '')];
  let code = '';
  let description = '';
  let errorValue = '';
  for (const source of sources) {
    if (!source) continue;
    const params = new URLSearchParams(source);
    errorValue = params.get('error') ?? errorValue;
    description = params.get('error_description') ?? description;
    code = params.get('error_code') ?? code;
  }
  if (!errorValue && !description && !code) return null;
  return { code: [code, errorValue].filter(Boolean).join(' '), description };
}

/** Turns a raw GoTrue/Google error into copy the shop owner can act on. */
function describe(code: string, description: string): string {
  const c = code.toLowerCase();
  const d = description.toLowerCase();
  let message: string;

  if (c.includes('access_denied') || d.includes('access_denied') || d.includes('denied') || d.includes('cancel')) {
    message = 'Google sign-in was cancelled. Sign in again whenever you are ready.';
  } else if (d.includes('redirect') || c.includes('redirect') || d.includes('unauthorized') || d.includes('not allowed')) {
    message = 'Google sign-in returned to an address this project does not allow yet. Add this site\'s URL to the Redirect URLs list in the Supabase Authentication settings, then try again.';
  } else if (c.includes('identity_already_exists')) {
    message = 'An account already exists for this Google address. Sign in with Google again, or use the email form below.';
  } else if (c.includes('provider_email_needs_verification')) {
    message = 'Google did not share a verified email address for this account. Confirm the address with Google, then try again.';
  } else if (c.includes('over_email_send_rate_limit') || c.includes('rate_limit')) {
    message = 'Too many sign-in attempts. Wait a minute, then try again.';
  } else if (c.includes('session_not_found') || d.includes('expired') || d.includes('state')) {
    message = 'The Google sign-in link expired before it finished. Try again.';
  } else {
    message = 'Google sign-in could not be completed. Try again, or use the email form below.';
  }

  // Keep the provider's own wording visible: it is what distinguishes a user
  // cancelling consent from a misconfigured redirect URL.
  const detail = description.trim();
  if (detail && !message.includes(detail)) {
    return `${message} (${detail.slice(0, 180)})`;
  }
  return message;
}

/**
 * Reads any OAuth failure out of the current URL.
 *
 * Must be called during the *first* render of the auth provider: `ProtectedRoute`
 * rewrites the address to `/login?required=1` as soon as it learns there is no
 * session, and by then these parameters are gone. auth-js has already captured
 * the URL at module-import time, so reading it here is safe.
 */
export function readOAuthCallbackIssue(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const payload = readErrorPayload();
    if (!payload) return null;
    return describe(payload.code, payload.description);
  } catch {
    return null;
  }
}

/**
 * Removes one-shot auth credentials and error payloads from the address bar
 * once auth-js has finished with them, so a refresh cannot replay a spent code
 * and a copied link never carries an access token.
 *
 * Params that the storefront owns (such as `required=1`) are left untouched.
 */
export function clearOAuthCallbackParams(): void {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    let changed = false;

    for (const key of AUTH_PARAM_KEYS) {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key);
        changed = true;
      }
    }

    const hash = url.hash.replace(/^#/, '');
    if (hash) {
      const hashParams = new URLSearchParams(hash);
      let hashChanged = false;
      for (const key of AUTH_PARAM_KEYS) {
        if (hashParams.has(key)) {
          hashParams.delete(key);
          hashChanged = true;
        }
      }
      if (hashChanged) {
        const rest = hashParams.toString();
        url.hash = rest ? `#${rest}` : '';
        changed = true;
      }
    }

    if (changed) {
      window.history.replaceState(window.history.state, '', url.toString());
    }
  } catch {
    // Never let address-bar cleanup break a page.
  }
}
