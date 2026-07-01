import { parseCsvPhones } from './csv-phones.util';

describe('parseCsvPhones', () => {
  it('should return empty result for empty input', () => {
    const result = parseCsvPhones('');
    expect(result).toEqual({
      phones: [],
      total: 0,
      valid: 0,
      invalid: 0,
      duplicates: 0,
      invalidSamples: [],
    });
  });

  it('should return empty result when input has only blank lines', () => {
    const result = parseCsvPhones('\n\n   \n');
    expect(result.total).toBe(0);
  });

  it('should parse CSV with recognized phone header (comma delimiter)', () => {
    const csv = 'name,phone\nJoão,11999999999\nMaria,11888888888';
    const result = parseCsvPhones(csv);
    expect(result.total).toBe(2);
    expect(result.valid).toBe(2);
    expect(result.phones).toEqual(['11999999999', '11888888888']);
    expect(result.invalid).toBe(0);
    expect(result.duplicates).toBe(0);
  });

  it('should parse CSV with semicolon delimiter when it is more frequent', () => {
    const csv = 'name;telefone\nJoão;11999999999';
    const result = parseCsvPhones(csv);
    expect(result.phones).toEqual(['11999999999']);
  });

  it('should treat single-column CSV without header as phone list', () => {
    const csv = '11999999999\n11888888888';
    const result = parseCsvPhones(csv);
    expect(result.total).toBe(2);
    expect(result.phones).toEqual(['11999999999', '11888888888']);
  });

  it('should count invalid phones and keep samples', () => {
    const csv = 'phone\nabc\n123';
    const result = parseCsvPhones(csv);
    expect(result.invalid).toBe(2);
    expect(result.valid).toBe(0);
    expect(result.invalidSamples.length).toBe(2);
    expect(result.invalidSamples[0]).toEqual({ line: 2, value: 'abc' });
  });

  it('should count duplicates after normalization', () => {
    const csv = 'phone\n(11) 99999-9999\n11999999999';
    const result = parseCsvPhones(csv);
    expect(result.valid).toBe(1);
    expect(result.duplicates).toBe(1);
    expect(result.phones).toEqual(['11999999999']);
  });

  it('should strip BOM and handle quoted values with embedded delimiter', () => {
    const csv = '﻿name,phone\n"Doe, John",11999999999';
    const result = parseCsvPhones(csv);
    expect(result.phones).toEqual(['11999999999']);
  });
});
