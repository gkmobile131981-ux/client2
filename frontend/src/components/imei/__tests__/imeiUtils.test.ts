import { describe, expect, it } from 'vitest';
import {
  extractImeiFromText,
  getImeiValidation,
  isValidImei,
  normalizeImei,
} from '../imeiUtils';

describe('isValidImei', () => {
  it('accepts a valid 15-digit IMEI', () => {
    expect(isValidImei('356938035643809')).toBe(true);
  });

  it('rejects a bad checksum', () => {
    expect(isValidImei('356938035643800')).toBe(false);
  });

  it('rejects wrong length', () => {
    expect(isValidImei('35693803564380')).toBe(false);
    expect(isValidImei('3569380356438090')).toBe(false);
  });

  it('rejects empty and non-numeric input', () => {
    expect(isValidImei('')).toBe(false);
    expect(isValidImei('abcdefghijklmno')).toBe(false);
  });

  it('ignores separators', () => {
    expect(isValidImei('356938-03-564380-9')).toBe(true);
  });
});

describe('extractImeiFromText', () => {
  it('extracts a plain IMEI string', () => {
    expect(extractImeiFromText('356938035643809')).toBe('356938035643809');
  });

  it('extracts an IMEI from a label', () => {
    expect(extractImeiFromText('IMEI: 356938035643809')).toBe('356938035643809');
  });

  it('extracts an IMEI with separators', () => {
    expect(extractImeiFromText('356938-03-564380-9')).toBe('356938035643809');
  });

  it('extracts a full *#06# style payload', () => {
    expect(
      extractImeiFromText('IMEI1: 356938035643809 IMEI2: 356938035643817')
    ).toBe('356938035643809');
  });

  it('returns null when no valid IMEI is present', () => {
    expect(extractImeiFromText('123456789012345')).toBeNull();
    expect(extractImeiFromText('no barcode here')).toBeNull();
    expect(extractImeiFromText('')).toBeNull();
  });

  it('extracts the valid candidate when multiple numeric runs exist', () => {
    expect(
      extractImeiFromText('Serial: 12AB34 IMEI: 356938035643809')
    ).toBe('356938035643809');
  });
});

describe('normalizeImei', () => {
  it('strips all non-digit characters', () => {
    expect(normalizeImei('35-6938 0356 43809')).toBe('356938035643809');
  });
});

describe('getImeiValidation', () => {
  it('returns empty message for empty input', () => {
    expect(getImeiValidation('')).toEqual({ valid: false, message: '' });
  });

  it('reports a short IMEI', () => {
    expect(getImeiValidation('3569380356438').valid).toBe(false);
    expect(getImeiValidation('3569380356438').message).toContain('2 digit');
  });

  it('reports a checksum failure', () => {
    expect(getImeiValidation('356938035643800')).toEqual({
      valid: false,
      message: 'IMEI checksum failed — check the digits.',
    });
  });

  it('accepts a valid IMEI', () => {
    expect(getImeiValidation('356938035643809')).toEqual({
      valid: true,
      message: 'Valid IMEI.',
    });
  });
});
