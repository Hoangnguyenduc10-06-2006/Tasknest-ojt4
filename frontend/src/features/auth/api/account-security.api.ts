import { requestJson } from '../../../shared/api/client';
import { authenticatedAccessToken, forgetSession } from './auth.api';
export const requestPasswordReset = (email: string) => requestJson('/api/identity/auth/forgot-password', {method:'POST', body:{email:email.trim().toLowerCase()}});
export const resetPassword = (token: string, newPassword: string, confirmPassword: string) => requestJson('/api/identity/auth/reset-password', {method:'POST',body:{token,newPassword,confirmPassword}});
export type DeviceSession = { id:string;user_agent:string|null;created_at:string;expires_at:string;last_seen_at:string;revoked_at:string|null };
export async function readSessions() {
  const accessToken=await authenticatedAccessToken();
  return requestJson<{data:{currentSessionId:string;items:DeviceSession[]}}>('/api/identity/auth/sessions',{accessToken});
}
export async function accountSecurityAction(path: string,body:unknown={}) {
  const accessToken=await authenticatedAccessToken();
  return requestJson(`/api/identity/auth/${path}`,{method:'POST',body,accessToken,csrf:true});
}
export function endLocalSession() { forgetSession(); window.location.assign('/login'); }
