import * as bcrypt from "bcryptjs";
import { AUTH } from "./constants";

// ========================================
// PASSWORD HASHING
// ========================================

/**
 * Hash a password using bcrypt
 * @param password - Plain text password
 * @returns Hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, AUTH.SALT_ROUNDS);
}

/**
 * Compare a plain text password with a hashed password
 * @param password - Plain text password
 * @param hashedPassword - Hashed password
 * @returns True if passwords match
 */
export async function comparePassword(
  password: string,
  hashedPassword: string,
): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword);
}

// ========================================
// PASSWORD VALIDATION
// ========================================

export interface PasswordValidationConfig {
  minLength?: number;
  requireLowercase?: boolean;
  requireUppercase?: boolean;
  requireNumber?: boolean;
  requireSpecialChar?: boolean;
  specialChars?: string;
}

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
  strength: "weak" | "fair" | "good" | "strong";
  score: number; // 0-100
}

const DEFAULT_CONFIG: Required<PasswordValidationConfig> = {
  minLength: 8,
  requireLowercase: true,
  requireUppercase: true,
  requireNumber: true,
  requireSpecialChar: true,
  specialChars: "@$!%*?&",
};

/**
 * Validate a password against configurable rules
 * @param password - Password to validate
 * @param config - Optional validation configuration
 * @returns Validation result with errors and strength
 */
export function validatePassword(
  password: string,
  config: PasswordValidationConfig = {},
): PasswordValidationResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const errors: string[] = [];
  let score = 0;

  // Length check
  if (password.length < cfg.minLength) {
    errors.push(`Password must be at least ${cfg.minLength} characters`);
  } else {
    score += 20;
    // Bonus for extra length
    if (password.length >= 12) score += 10;
    if (password.length >= 16) score += 10;
  }

  // Lowercase check
  if (cfg.requireLowercase && !/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  } else if (/[a-z]/.test(password)) {
    score += 15;
  }

  // Uppercase check
  if (cfg.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  } else if (/[A-Z]/.test(password)) {
    score += 15;
  }

  // Number check
  if (cfg.requireNumber && !/\d/.test(password)) {
    errors.push("Password must contain at least one number");
  } else if (/\d/.test(password)) {
    score += 15;
  }

  // Special character check
  const specialCharRegex = new RegExp(
    `[${cfg.specialChars.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}]`,
  );
  if (cfg.requireSpecialChar && !specialCharRegex.test(password)) {
    errors.push(
      `Password must contain at least one special character (${cfg.specialChars})`,
    );
  } else if (specialCharRegex.test(password)) {
    score += 15;
  }

  // Additional complexity checks
  const hasMultipleNumbers = (password.match(/\d/g) || []).length >= 2;
  const hasMultipleSpecial =
    (password.match(specialCharRegex) || []).length >= 2;
  const hasNoRepeatingChars = !/(.)\1{2,}/.test(password);

  if (hasMultipleNumbers) score += 5;
  if (hasMultipleSpecial) score += 5;
  if (hasNoRepeatingChars) score += 5;

  // Determine strength
  let strength: "weak" | "fair" | "good" | "strong";
  if (score < 40) strength = "weak";
  else if (score < 60) strength = "fair";
  else if (score < 80) strength = "good";
  else strength = "strong";

  return {
    valid: errors.length === 0,
    errors,
    strength,
    score: Math.min(score, 100),
  };
}

// ========================================
// PASSWORD GENERATION
// ========================================

export interface PasswordGenerationConfig {
  length?: number;
  includeLowercase?: boolean;
  includeUppercase?: boolean;
  includeNumbers?: boolean;
  includeSpecialChars?: boolean;
  specialChars?: string;
  excludeSimilar?: boolean; // Exclude similar characters like i, l, 1, L, o, 0, O
}

const DEFAULT_GEN_CONFIG: Required<PasswordGenerationConfig> = {
  length: 16,
  includeLowercase: true,
  includeUppercase: true,
  includeNumbers: true,
  includeSpecialChars: true,
  specialChars: "@$!%*?&",
  excludeSimilar: true,
};

/**
 * Generate a random password
 * @param config - Optional generation configuration
 * @returns Generated password
 */
export function generatePassword(
  config: PasswordGenerationConfig = {},
): string {
  const cfg = { ...DEFAULT_GEN_CONFIG, ...config };

  let lowercase = "abcdefghijklmnopqrstuvwxyz";
  let uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let numbers = "0123456789";
  let special = cfg.specialChars;

  // Exclude similar characters if requested
  if (cfg.excludeSimilar) {
    lowercase = lowercase.replace(/[ilo]/g, "");
    uppercase = uppercase.replace(/[ILO]/g, "");
    numbers = numbers.replace(/[01]/g, "");
  }

  let chars = "";
  const required: string[] = [];

  // Helper for secure random indices
  const getSecureRandomInt = (max: number) => {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0] % max;
  };

  if (cfg.includeLowercase) {
    chars += lowercase;
    required.push(lowercase[getSecureRandomInt(lowercase.length)]);
  }
  if (cfg.includeUppercase) {
    chars += uppercase;
    required.push(uppercase[getSecureRandomInt(uppercase.length)]);
  }
  if (cfg.includeNumbers) {
    chars += numbers;
    required.push(numbers[getSecureRandomInt(numbers.length)]);
  }
  if (cfg.includeSpecialChars) {
    chars += special;
    required.push(special[getSecureRandomInt(special.length)]);
  }

  if (chars.length === 0) {
    throw new Error("At least one character type must be included");
  }

  // Generate remaining characters
  const remainingLength = cfg.length - required.length;
  const randomChars = Array.from(
    { length: remainingLength },
    () => chars[getSecureRandomInt(chars.length)],
  );

  // Combine and shuffle using Fisher-Yates with secure random
  const allChars = [...required, ...randomChars];
  for (let i = allChars.length - 1; i > 0; i--) {
    const j = getSecureRandomInt(i + 1);
    [allChars[i], allChars[j]] = [allChars[j], allChars[i]];
  }

  return allChars.join("");
}

/**
 * Get password strength as a percentage
 * @param password - Password to check
 * @returns Strength score (0-100)
 */
export function getPasswordStrength(password: string): number {
  return validatePassword(password).score;
}
