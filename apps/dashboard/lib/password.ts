const MIN_LENGTH = 12;

export function validateNewPassword(
  password: string,
  confirmation: string,
): string | null {
  if (password.length < MIN_LENGTH)
    return `La contraseña debe tener al menos ${MIN_LENGTH} caracteres.`;
  if (password !== confirmation) return "Las contraseñas no coinciden.";
  return null;
}
