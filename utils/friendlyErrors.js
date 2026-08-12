// Central friendly-error mapping for Report OS.
// Translates low-level network/auth failures into clear, human-readable
// messages so pages never surface raw technical jargon such as
// "fetch failed", "ENOTFOUND", or "getaddrinfo".

const NETWORK_ERROR_PATTERNS = [
  /fetch failed/i,
  /failed to fetch/i,
  /load failed/i,
  /network/i,
  /ENOTFOUND/i,
  /ECONNREFUSED/i,
  /ECONNRESET/i,
  /ETIMEDOUT/i,
  /EAI_AGAIN/i,
  /ENETUNREACH/i,
  /EHOSTUNREACH/i,
  /ERR_INTERNET_DISCONNECTED/i,
  /getaddrinfo/i,
  /lookup/i,
  /temporary failure/i,
];

const SESSION_ERROR_PATTERNS = [
  /authentication is required/i,
  /session has expired/i,
  /session expired/i,
  /no valid token/i,
  /not authenticated/i,
  /please sign in/i,
  /log in again/i,
];

// A response body that is not JSON (e.g. an HTML error or 404 page served
// where an API route was expected). The browser's raw SyntaxError text is
// never user-facing.
const RESPONSE_PARSE_ERROR_PATTERNS = [
  /unexpected token/i,
  /is not valid JSON/i,
  /unexpected end of JSON/i,
  /json.parse/i,
  /body is not readable/i,
  /<!doctype/i,
];

export const NETWORK_ERROR_MESSAGE =
  'Can\u2019t reach the server right now. Check your internet connection and try again.';

export const SESSION_ERROR_MESSAGE =
  'Your session has expired. Please sign in again.';

export const RESPONSE_PARSE_ERROR_MESSAGE =
  'The server returned an unexpected response. Please try again.';

/**
 * Determines whether an error originates from a network/connectivity problem.
 * Handles the nested error shapes produced by fetch (TypeError with a
 * `cause` containing the DNS/socket details) and by Supabase clients.
 */
export function isNetworkError(error) {
  if (!error) return false;
  const message = [
    error.message,
    error.code,
    error.name,
    error.cause?.message,
    error.cause?.code,
    error.cause?.cause?.message,
    error.error,
  ].filter(Boolean).join(' ');
  return NETWORK_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * Determines whether an error indicates a missing or expired session.
 */
export function isSessionError(error) {
  if (!error) return false;
  const message = [
    error.message,
    error.code,
    error.cause?.message,
    error.error,
  ].filter(Boolean).join(' ');
  return SESSION_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * Determines whether an error came from parsing a non-JSON response body
 * (e.g. an HTML error or 404 page was returned where JSON was expected).
 */
export function isResponseParseError(error) {
  if (!error) return false;
  const message = [
    error.message,
    error.code,
    error.name,
    error.cause?.message,
    error.error,
  ].filter(Boolean).join(' ');
  return RESPONSE_PARSE_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * Safely parses a fetch response as JSON. When the body is not JSON
 * (e.g. an HTML error page), returns a clear fallback payload instead of
 * throwing a raw SyntaxError that would surface browser jargon in the UI.
 *
 * @param {Response} response - Fetch Response object (not yet consumed).
 * @returns {Promise<{ok: boolean, status: number, data: *}>}
 */
export async function safeParseJsonResponse(response) {
  const status = response?.status ?? 0;
  const ok = Boolean(response?.ok);
  try {
    const data = await response.json();
    return { ok, status, data };
  } catch {
    return { ok, status, data: null, parseError: RESPONSE_PARSE_ERROR_MESSAGE };
  }
}

/**
 * Returns a clear, user-facing message for any error.
 *
 * - Network failures get a connectivity explanation (never raw DNS/fetch text).
 * - Session problems tell the user to sign in again.
 * - Non-JSON response bodies (HTML pages) get a neutral "unexpected response"
 *   message instead of the browser's raw JSON parse error.
 * - Server-provided messages that are already human-readable pass through.
 * - Everything else falls back to a neutral message so the UI never shows
 *   undefined, "[object Object]", or stack traces.
 */
export function friendlyErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback;

  if (isNetworkError(error)) return NETWORK_ERROR_MESSAGE;
  if (isSessionError(error)) return SESSION_ERROR_MESSAGE;
  if (isResponseParseError(error)) return RESPONSE_PARSE_ERROR_MESSAGE;

  const message = typeof error === 'string' ? error : error.message;
  if (typeof message !== 'string' || message.trim() === '') return fallback;

  const trimmed = message.trim();
  // Reject message shapes that are clearly not user-facing.
  if (trimmed.length > 240) return fallback;
  if (/^\[object /i.test(trimmed)) return fallback;
  if (/\{/.test(trimmed) && /}/.test(trimmed)) return fallback;
  if (/^Error: /i.test(trimmed)) return trimmed.replace(/^Error: /i, '');
  return trimmed;
}
