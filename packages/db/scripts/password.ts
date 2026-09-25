const MIN_LENGTH = 12;

export function validateOwnerPassword(password: string): string | null {
  if (password.length < MIN_LENGTH)
    return `La contraseña debe tener al menos ${MIN_LENGTH} caracteres.`;
  return null;
}
