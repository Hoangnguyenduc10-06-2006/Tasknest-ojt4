export function isAccountEmail(value: string): boolean {
  const email = value.trim().toLowerCase();
  const at = email.indexOf('@');
  return email.length <= 255 && at > 0 && at <= 64
    && /^[a-z0-9_+&*-]+(?:\.[a-z0-9_+&*-]+)*@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(email);
}
export function isAccountPassword(value: string): boolean {
  return Array.from(value).length >= 8 && new TextEncoder().encode(value).length <= 72;
}
