export interface PasswordValidation {
  valid: boolean;
  errors: string[];
}

/**
 * Validates password complexity.
 * Rules: min 8 chars, 1 uppercase, 1 lowercase, 1 digit.
 */
export function validatePassword(password: string): PasswordValidation {
  const errors: string[] = [];
  if (!password || password.length < 8) errors.push("At least 8 characters");
  if (!/[A-Z]/.test(password)) errors.push("At least one uppercase letter");
  if (!/[a-z]/.test(password)) errors.push("At least one lowercase letter");
  if (!/[0-9]/.test(password)) errors.push("At least one number");
  return { valid: errors.length === 0, errors };
}
