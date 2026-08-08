import { describe, it, expect } from 'vitest';
import {
  normalizeSubModels,
  isModelMatch,
  findBestMatchingRateCard,
} from '../modelMatching';

describe('modelMatching utility', () => {
  it('correctly normalizes slash-separated models and strips brand prefix', () => {
    const tokens = normalizeSubModels('VIVO Y12 / Y15 / Y17 / U10', 'VIVO');
    expect(tokens).toEqual(['Y12', 'Y15', 'Y17', 'U10']);
  });

  it('matches model when removing one of four sub-models', () => {
    const input = 'VIVO Y12 / Y15 / Y17'; // U10 removed
    const cardModel = 'VIVO Y12 / Y15 / Y17 / U10';
    expect(isModelMatch(input, cardModel, 'VIVO')).toBe(true);
  });

  it('matches single model against grouped model', () => {
    expect(isModelMatch('VIVO Y12', 'VIVO Y12 / Y15 / Y17 / U10', 'VIVO')).toBe(true);
    expect(isModelMatch('VIVO U10', 'VIVO Y12 / Y15 / Y17 / U10', 'VIVO')).toBe(true);
  });

  it('does not match non-overlapping models', () => {
    expect(isModelMatch('VIVO Y20', 'VIVO Y12 / Y15 / Y17 / U10', 'VIVO')).toBe(false);
  });

  it('finds best matching rate card amongst multiple cards', () => {
    const cards = [
      { id: '1', brand: 'VIVO', model: 'VIVO Y12 / Y15 / Y17 / U10' },
      { id: '2', brand: 'VIVO', model: 'VIVO Y20 / Y30' },
    ];

    const match1 = findBestMatchingRateCard(cards, 'VIVO', 'VIVO Y12 / Y15 / Y17');
    expect(match1?.id).toBe('1');

    const match2 = findBestMatchingRateCard(cards, 'VIVO', 'VIVO Y30');
    expect(match2?.id).toBe('2');

    const matchNone = findBestMatchingRateCard(cards, 'VIVO', 'VIVO X100');
    expect(matchNone).toBeNull();
  });
});
