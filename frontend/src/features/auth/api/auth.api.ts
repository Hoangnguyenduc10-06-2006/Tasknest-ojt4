import { ApiError, requestJson } from '../../../shared/api/client';
import { getSessionSnapshot, publishSession } from '../model/session.store';
import type { SessionUser } from '../model/session.store';
import type { RegisterHandler } from '../model/register.types';

type Envelope<T> = { success: boolean; data: T; message: string };
type Tokens = { accessToken: string; expiresIn: number; tokenType: 'Bearer'; sessionExpiresAt?: string; user?: SessionUser };
// Deliberately module memory only. Refresh token is an HttpOnly cookie owned by the server.
let accessToken: string | null = null;
let refreshFlight: Promise<void> | null = null;
let checkFlight: Promise<void> | null = null;
let expiresAt = 0;
let refreshAt = 0;
let generation = 0;
let loggingOut = false;
function acceptToken(tokens: Tokens) {
  if (!tokens.accessToken || !Number.isFinite(tokens.expiresIn) || tokens.expiresIn <= 0) throw new Error('Phản hồi phiên không hợp lệ.');
  accessToken = tokens.accessToken;
  expiresAt = Date.now() + tokens.expiresIn * 1000;
  const absolute = tokens.sessionExpiresAt ? Date.parse(tokens.sessionExpiresAt) : Infinity;
  if (Number.isFinite(absolute)) expiresAt = Math.min(expiresAt, absolute);
  if (expiresAt <= Date.now()) throw new ApiError(401, 'Phiên đăng nhập đã hết hạn.');
  // Final short-lived token stays usable until expiry; renewing early cannot extend the session.
  refreshAt = expiresAt - Date.now() > 30000 ? expiresAt - 30000 : expiresAt;
}
export function forgetSession() {
  generation++;
  accessToken = null; expiresAt = 0; refreshAt = 0;
  publishSession({ status: 'guest' });
}
export const getAccessToken = () => accessToken;

export const registerAccount: RegisterHandler = async (values) => {
  try { await requestJson('/api/identity/auth/register', { method: 'POST', body: values }); }
  catch (error) { if (!(error instanceof ApiError) || error.code !== 'EMAIL_NOT_VERIFIED') throw error; }
};
export async function login(email: string, password: string) {
  generation++;
  if (checkFlight) await checkFlight;
  const result = await requestJson<Envelope<Tokens>>('/api/identity/auth/login', {
    method: 'POST', body: { email: email.trim().toLowerCase(), password },
  });
  generation++;
  acceptToken(result.data);
  // Resolve the current identity from the protected endpoint, never from a local flag/JWT decode.
  await checkSession();
}
export function refreshSession(): Promise<void> {
  if (!refreshFlight) {
    const version = generation;
    const rotate = () => requestJson<Envelope<Tokens>>('/api/identity/auth/refresh-token', { method: 'POST', body: {}, csrf: true });
    // Serialize cookie rotation across tabs; otherwise two tabs may trigger replay detection.
    const request = (async () => {
      if (typeof navigator !== 'undefined' && navigator.locks) {
        let entered = false;
        try { return await navigator.locks.request('tasknest-refresh', () => { entered = true; return rotate(); }); }
        catch (error) {
          // Some embedded browsers expose Web Locks but deny access. Fall back ONLY before an HTTP request started.
          if (entered || !(error instanceof DOMException) || !['SecurityError', 'NotSupportedError'].includes(error.name)) throw error;
        }
      }
      return await rotate();
    })();
    refreshFlight = request.then((result) => { if (version === generation) acceptToken(result.data); })
      .finally(() => { refreshFlight = null; });
  }
  return refreshFlight;
}
export function checkSession(): Promise<void> {
  if (loggingOut) return Promise.resolve();
  if (!checkFlight) {
    const version = generation;
    checkFlight = (async () => {
      try {
        if (!accessToken || refreshAt <= Date.now()) await refreshSession();
        if (version !== generation) return;
        if (!accessToken) throw new Error('Không thể khôi phục phiên đăng nhập.');
        const result = await requestJson<Envelope<SessionUser>>('/api/identity/auth/session', { accessToken });
        if (version === generation) publishSession({ status: 'authenticated', user: result.data, expiresAt, refreshAt });
      } catch (error) {
        if (version !== generation) return;
        if (error instanceof ApiError && error.status === 401) forgetSession();
        else publishSession({ status: 'error', message: error instanceof ApiError
          ? `Không thể kiểm tra phiên đăng nhập (HTTP ${error.status}). Vui lòng thử lại.`
          : error instanceof Error ? error.message : 'Không thể kiểm tra phiên đăng nhập. Hãy kiểm tra kết nối và thử lại.' });
      }
    })().finally(() => { checkFlight = null; });
  }
  return checkFlight;
}
export async function logout() {
  loggingOut = true;
  generation++; // In-flight validation must not restore a session after logout.
  try {
    if (refreshFlight) await refreshFlight.catch(() => {});
    await requestJson('/api/identity/auth/logout', { method: 'POST', body: {}, csrf: true });
    forgetSession();
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      // A shared browser must stop receiving this account's notifications after logout.
      void navigator.serviceWorker.getRegistration('/').then(async registration => {
        if (!registration?.active?.scriptURL.endsWith('/tasknest-push.js')) return;
        const subscription = await registration.pushManager.getSubscription();
        await subscription?.unsubscribe();
      }).catch(() => {});
    }
    if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('tasknest-session');
      channel.postMessage('logout'); channel.close();
    }
  } finally { loggingOut = false; }
}
type VerifiedEmail = { email: string; verified: boolean };
const verificationFlights = new Map<string, Promise<Envelope<VerifiedEmail>>>();
// React StrictMode and repeated mounts may subscribe twice; consume a one-time token only once in flight.
export function verifyEmail(token: string): Promise<Envelope<VerifiedEmail>> {
  const existing = verificationFlights.get(token);
  if (existing) return existing;
  const flight = requestJson<Envelope<VerifiedEmail>>('/api/identity/auth/verify-email?token=' + encodeURIComponent(token))
    .then((response) => {
      if (response.data?.verified !== true || !response.data.email) throw new Error('Không thể xác nhận kết quả xác minh email.');
      return response;
    }).finally(() => { verificationFlights.delete(token); });
  verificationFlights.set(token, flight);
  return flight;
}
export const resendVerification = (email: string) => requestJson('/api/identity/auth/resend-verification', {
  method: 'POST', body: { email: email.trim().toLowerCase() },
});

export async function authenticatedAccessToken(expectedUserId?: string): Promise<string> {
  await checkSession();
  const session = getSessionSnapshot();
  if (session.status !== 'authenticated' || !accessToken || (expectedUserId && session.user.id !== expectedUserId)) throw new ApiError(401, 'Phiên đăng nhập không hợp lệ.');
  return accessToken;
}
export function updateSessionUser(user: SessionUser) {
  const session = getSessionSnapshot();
  if (accessToken && session.status === 'authenticated' && session.user.id === user.id) publishSession({ status: 'authenticated', user, expiresAt, refreshAt });
}
