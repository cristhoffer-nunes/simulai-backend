/**
 * Minimum password composition, enforced server-side on every password the user chooses (first
 * access and recovery). Same four rules lawsuits-management uses; the frontend mirrors them only
 * as a UX hint.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export function isStrongPassword(password: string): boolean {
  return (
    password.length >= PASSWORD_MIN_LENGTH &&
    password.length <= PASSWORD_MAX_LENGTH &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}
