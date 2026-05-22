import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(String(password), salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password, passwordHash) {
  const [method, salt, storedHash] = String(passwordHash || "").split(":");
  if (method !== "scrypt" || !salt || !storedHash) {
    return false;
  }

  const calculated = scryptSync(String(password), salt, 64);
  const stored = Buffer.from(storedHash, "hex");
  return stored.length === calculated.length && timingSafeEqual(stored, calculated);
}
