export interface ImeiValidation {
  valid: boolean;
  message: string;
}

export function normalizeImei(imei: string): string {
  return imei.replace(/[^\d]/g, '');
}

export function isValidImei(imei: string): boolean {
  const digits = normalizeImei(imei);
  if (digits.length !== 15) return false;

  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let digit = parseInt(digits[i], 10);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

export function extractImeiFromText(text: string): string | null {
  if (!text) return null;

  const normalized = text.replace(/\s+/g, '').replace(/[-_.:/\\|()[\]{}]/g, '');
  const candidates = normalized.match(/\d{14,17}/g) || [];

  for (const candidate of candidates) {
    if (candidate.length === 15) {
      if (isValidImei(candidate)) return candidate;
      continue;
    }
    // Longer runs can embed the IMEI next to label digits, e.g. "IMEI1 356938…".
    const maxStart = candidate.length - 15;
    for (let start = 0; start <= maxStart; start++) {
      const slice = candidate.slice(start, start + 15);
      if (isValidImei(slice)) return slice;
    }
  }
  return null;
}

export function getImeiValidation(imei: string): ImeiValidation {
  const value = imei.trim();
  const digits = normalizeImei(value);

  if (!value) return { valid: false, message: '' };
  if (digits.length === 0) {
    return { valid: false, message: 'IMEI must contain numbers only.' };
  }
  if (digits.length < 15) {
    return { valid: false, message: `IMEI is ${15 - digits.length} digit(s) short.` };
  }
  if (digits.length > 15) {
    return { valid: false, message: `IMEI has ${digits.length - 15} extra digit(s).` };
  }
  if (isValidImei(digits)) {
    return { valid: true, message: 'Valid IMEI.' };
  }
  return { valid: false, message: 'IMEI checksum failed — check the digits.' };
}
