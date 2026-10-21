// Pure gold arithmetic (SRD 2.0 L7099-L7111).
// gold = { handfuls: 0..10, bags: 0..10, chest: 0..1 }
// category = 'handfuls' | 'bags' | 'chest'
// Returns { ok: true, gold } or { ok: false, reason }

export function addGold(currentGold = {}, category, targetIndex) {
  let handfuls = Number(currentGold.handfuls ?? 0);
  let bags = Number(currentGold.bags ?? 0);
  let chest = Number(currentGold.chest ?? 0);

  // If user clicked to toggle an existing pip off
  if (category === 'handfuls') {
    const newVal = targetIndex + 1 === handfuls ? targetIndex : targetIndex + 1;
    if (newVal < 10) {
      return { ok: true, gold: { handfuls: newVal, bags, chest } };
    }
    // Reached 10 handfuls -> promote to bag
    if (bags + 1 < 10) {
      return { ok: true, gold: { handfuls: 0, bags: bags + 1, chest } };
    }
    // Reached 10 bags -> promote to chest
    if (chest + 1 <= 1) {
      return { ok: true, gold: { handfuls: 0, bags: 0, chest: 1 } };
    }
    return { ok: false, reason: 'Ouro cheio: gaste ou guarde antes de ganhar mais.' };
  }

  if (category === 'bags') {
    const newVal = targetIndex + 1 === bags ? targetIndex : targetIndex + 1;
    if (newVal < 10) {
      return { ok: true, gold: { handfuls, bags: newVal, chest } };
    }
    // Reached 10 bags -> promote to chest
    if (chest + 1 <= 1) {
      return { ok: true, gold: { handfuls, bags: 0, chest: 1 } };
    }
    return { ok: false, reason: 'Ouro cheio: gaste ou guarde antes de ganhar mais.' };
  }

  if (category === 'chest') {
    const newVal = targetIndex + 1 === chest ? targetIndex : targetIndex + 1;
    return { ok: true, gold: { handfuls, bags, chest: Math.min(1, newVal) } };
  }

  return { ok: true, gold: { handfuls, bags, chest } };
}
