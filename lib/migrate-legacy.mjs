// Pure legacy migration logic (SRD 2.0 T10b)
// Reads old actor fields and generates embedded items to create via API.

export function parseDamageString(dmgStr = '') {
  const match = String(dmgStr).match(/(\d*)d(\d+)\s*([+-]\s*\d+)?/i);
  if (!match) return { dice: 8, flat: 0 };
  const dice = parseInt(match[2], 10) || 8;
  let flat = 0;
  if (match[3]) {
    flat = parseInt(match[3].replace(/\s+/g, ''), 10) || 0;
  }
  return { dice, flat };
}

export function parseDamageType(dt = '') {
  const s = String(dt).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (s.includes('mag')) return 'mag';
  return 'phy';
}

/**
 * Checks if actor has legacy data that can be migrated.
 */
export function hasLegacyData(actorSystem) {
  if (actorSystem?.legacyMigrated) return false;
  const pName = actorSystem?.weapons?.primary?.name;
  const sName = actorSystem?.weapons?.secondary?.name;
  const aName = actorSystem?.activeArmor?.name;
  const cards = actorSystem?.domainCards;
  return Boolean(
    (pName && pName.trim()) ||
    (sName && sName.trim()) ||
    (aName && aName.trim()) ||
    (Array.isArray(cards) && cards.length > 0)
  );
}

/**
 * Generates items list to post for the actor.
 * @param {Object} actorSystem - Character systemData
 * @returns {Array<{ name: string, type: string, data: Object }>}
 */
export function planLegacyMigration(actorSystem = {}) {
  const items = [];

  // 1. Primary weapon
  const wp = actorSystem?.weapons?.primary;
  if (wp?.name && wp.name.trim()) {
    const { dice, flat } = parseDamageString(wp.damage);
    items.push({
      name: wp.name.trim(),
      type: 'weapon',
      data: {
        category: 'primary',
        slot: 'primary',
        equipped: true,
        tier: 1,
        trait: wp.trait || 'agility',
        range: wp.range || 'Melee',
        dice,
        flat,
        damageType: parseDamageType(wp.damageType),
        burden: 'one',
        feature: { name: '', text: wp.feature || '' },
        description: wp.feature || '',
      }
    });
  }

  // 2. Secondary weapon
  const ws = actorSystem?.weapons?.secondary;
  if (ws?.name && ws.name.trim()) {
    const { dice, flat } = parseDamageString(ws.damage);
    items.push({
      name: ws.name.trim(),
      type: 'weapon',
      data: {
        category: 'secondary',
        slot: 'secondary',
        equipped: true,
        tier: 1,
        trait: ws.trait || 'strength',
        range: ws.range || 'Very Close',
        dice,
        flat,
        damageType: parseDamageType(ws.damageType),
        burden: 'one',
        feature: { name: '', text: ws.feature || '' },
        description: ws.feature || '',
      }
    });
  }

  // 3. Active Armor
  const aa = actorSystem?.activeArmor;
  if (aa?.name && aa.name.trim()) {
    const th = actorSystem?.thresholds || {};
    const arm = actorSystem?.armor || {};
    items.push({
      name: aa.name.trim(),
      type: 'armor',
      data: {
        equipped: true,
        tier: 1,
        baseMajor: Number(th.baseMajor ?? 7),
        baseSevere: Number(th.baseSevere ?? 14),
        baseScore: Number(arm.score ?? 0),
        slotsMarked: Number(arm.slotsMarked ?? 0),
        feature: { name: '', text: aa.feature || '' },
        modifiers: { evasion: 0, traits: {}, thresholds: 0 },
        description: aa.feature || '',
      }
    });
  }

  // 4. Domain cards
  const cards = actorSystem?.domainCards || [];
  for (const c of cards) {
    if (!c.name) continue;
    items.push({
      name: c.name,
      type: 'domainCard',
      data: {
        domain: c.domain || 'Blade',
        level: Number(c.level ?? 1),
        type: 'ability',
        recallCost: 1,
        text: c.description || '',
        inLoadout: c.inLoadout !== false,
      }
    });
  }

  return items;
}
