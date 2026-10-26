import { PasswordResetTokenType } from './ports/password-reset-token.port';

/** Frontend page that consumes both first-access and recovery links. */
export function buildAccessUrl(frontendUrl: string, token: string): string {
  return `${frontendUrl}/redefinir-senha?token=${encodeURIComponent(token)}`;
}

/** "1 hora", "3 dias" — for email copy. */
export function humanizeTtl(ttlSeconds: number): string {
  const hours = Math.round(ttlSeconds / 3600);
  if (hours < 24) return hours <= 1 ? '1 hora' : `${hours} horas`;
  const days = Math.round(hours / 24);
  return days === 1 ? '1 dia' : `${days} dias`;
}

/** An account that never set a password gets a first-access link even from "forgot password". */
export function linkTypeFor(mustChangePassword: boolean): PasswordResetTokenType {
  return mustChangePassword ? 'first_access' : 'recovery';
}
