/**
 * Utility functions for normalizing phone model strings and matching rate cards,
 * especially for slash-separated model combinations (e.g. "VIVO Y12 / Y15 / Y17 / U10").
 */

export function normalizeSubModels(modelStr: string, brandStr?: string): string[] {
  if (!modelStr) return [];
  let m = modelStr.trim().toUpperCase();

  if (brandStr) {
    const b = brandStr.trim().toUpperCase();
    if (m.startsWith(b + ' ')) {
      m = m.substring(b.length + 1).trim();
    }
  }

  // Split by slash ('/') and clean each sub-model token
  return m
    .split('/')
    .map((s) => {
      let sub = s.trim();
      if (brandStr) {
        const b = brandStr.trim().toUpperCase();
        if (sub.startsWith(b + ' ')) {
          sub = sub.substring(b.length + 1).trim();
        }
      }
      return sub;
    })
    .filter(Boolean);
}

export function isModelMatch(inputModel: string, cardModel: string, brand?: string): boolean {
  if (!inputModel || !cardModel) return false;
  const inputNorm = inputModel.trim().toUpperCase();
  const cardNorm = cardModel.trim().toUpperCase();

  // 1. Exact full string match
  if (inputNorm === cardNorm) return true;

  // 2. Token overlap check between slash-separated models
  const inputTokens = normalizeSubModels(inputModel, brand);
  const cardTokens = normalizeSubModels(cardModel, brand);

  if (inputTokens.length === 0 || cardTokens.length === 0) return false;

  const tokenMatch =
    inputTokens.some((it) => cardTokens.includes(it)) ||
    cardTokens.some((ct) => inputTokens.includes(ct));

  if (tokenMatch) return true;

  // 3. Fallback: check if sub-tokens are contained inside the other model string
  for (const it of inputTokens) {
    if (it.length >= 2 && cardNorm.includes(it)) return true;
  }
  for (const ct of cardTokens) {
    if (ct.length >= 2 && inputNorm.includes(ct)) return true;
  }

  return false;
}

export function findBestMatchingRateCard<T extends { brand: string; model: string }>(
  cards: T[],
  brand: string,
  model: string
): T | null {
  if (!brand.trim() || !model.trim()) return null;
  const brandUpper = brand.trim().toUpperCase();
  const modelUpper = model.trim().toUpperCase();

  // Filter rate cards belonging to the specified brand
  const brandCards = cards.filter((rc) => rc.brand.trim().toUpperCase() === brandUpper);
  if (brandCards.length === 0) return null;

  // Rank 1: Exact model match
  const exactCard = brandCards.find((rc) => rc.model.trim().toUpperCase() === modelUpper);
  if (exactCard) return exactCard;

  // Rank 2: Highest sub-model token overlap
  const inputTokens = normalizeSubModels(model, brand);
  let bestCard: T | null = null;
  let maxScore = 0;

  for (const card of brandCards) {
    const cardTokens = normalizeSubModels(card.model, brand);
    let matchCount = 0;

    for (const it of inputTokens) {
      if (cardTokens.includes(it)) {
        matchCount++;
      }
    }

    if (matchCount > maxScore) {
      maxScore = matchCount;
      bestCard = card;
    }
  }

  if (bestCard && maxScore > 0) {
    return bestCard;
  }

  // Rank 3: Substring fallback
  for (const card of brandCards) {
    if (isModelMatch(model, card.model, brand)) {
      return card;
    }
  }

  return null;
}
