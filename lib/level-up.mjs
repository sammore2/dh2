// Pure level up engine (SRD 2.0 L4704-L4787)
import { SLOTS } from './advancement-table.mjs';

export function tierForLevel(lvl) {
  if (lvl <= 1) return 1;
  if (lvl <= 4) return 2;
  if (lvl <= 7) return 3;
  return 4;
}

/**
 * Calculates level up transition from level to level + 1.
 * @param {Object} actorSystem - Character systemData
 * @param {Array} choices - Array of 2 choices (or 1 choice if cost === 2)
 * Each choice object:
 *  - type: 'traits' | 'hp' | 'stress' | 'experiences' | 'domain' | 'evasion' | 'subclass' | 'proficiency'
 *  - tierKey: 'tier2' | 'tier3' | 'tier4'
 *  - payload?: { trait1, trait2 } | { expIdx1, expIdx2 } | { nextTier: 'specialization' | 'mastery' }
 * @returns {{ ok: boolean, patch?: Object, reason?: string }}
 */
export function processLevelUp(actorSystem, choices = []) {
  const curLevel = Number(actorSystem.level ?? 1);
  if (curLevel >= 10) return { ok: false, reason: 'Nível máximo atingido (10).' };

  const nextLevel = curLevel + 1;
  const targetTier = tierForLevel(nextLevel);
  const targetTierKey = `tier${targetTier}`;

  // Validate choice count (either 2 choices costing 1, or 1 choice costing 2)
  let totalCost = 0;
  for (const c of choices) {
    const cost = (c.type === 'proficiency') ? 2 : 1;
    totalCost += cost;
  }
  if (totalCost !== 2) {
    return { ok: false, reason: 'É necessário escolher exatamente 2 avanços (ou 1 avanço que custe 2).' };
  }

  // Clone state
  const adv = JSON.parse(JSON.stringify(actorSystem.advancements || {}));
  const marks = JSON.parse(JSON.stringify(actorSystem.marks || { traits: [] }));
  const bonus = JSON.parse(JSON.stringify(actorSystem.bonus || { hp: 0, stress: 0, evasion: 0, armorScore: 0, thresholds: 0 }));
  const experiences = JSON.parse(JSON.stringify(actorSystem.experiences || []));
  let proficiency = Number(actorSystem.proficiency ?? 1);

  // 1. Tier milestones at level 2, 5, 8
  if (nextLevel === 2 || nextLevel === 5 || nextLevel === 8) {
    proficiency += 1;
    experiences.push({ name: '', modifier: 2 });
    // Tier 3 and 4 clear trait marks
    if (nextLevel === 5 || nextLevel === 8) {
      marks.traits = [];
    }
  }

  // 2. Validate and apply choices
  for (const c of choices) {
    const tierKey = c.tierKey || targetTierKey;
    const tierNum = parseInt(tierKey.replace('tier', ''), 10);
    if (tierNum > targetTier) {
      return { ok: false, reason: `Opção de ${tierKey} não permitida no Tier ${targetTier}.` };
    }

    const maxSlots = SLOTS[tierKey]?.[c.type] ?? 0;
    const currentUsed = adv[tierKey]?.[c.type] ?? 0;
    if (currentUsed >= maxSlots) {
      return { ok: false, reason: `Sem caixas livres para ${c.type} em ${tierKey}.` };
    }

    if (!adv[tierKey]) adv[tierKey] = {};
    adv[tierKey][c.type] = currentUsed + 1;

    switch (c.type) {
      case 'traits': {
        const { trait1, trait2 } = c.payload || {};
        if (!trait1 || !trait2 || trait1 === trait2) {
          return { ok: false, reason: 'Selecione 2 atributos distintos.' };
        }
        if (marks.traits.includes(trait1) || marks.traits.includes(trait2)) {
          return { ok: false, reason: 'Atributo já marcado no tier atual.' };
        }
        marks.traits.push(trait1, trait2);
        // Note: Attribute increase (+1) will be applied directly to attributes
        break;
      }
      case 'hp':
        bonus.hp = (bonus.hp || 0) + 1;
        break;
      case 'stress':
        bonus.stress = (bonus.stress || 0) + 1;
        break;
      case 'evasion':
        bonus.evasion = (bonus.evasion || 0) + 1;
        break;
      case 'experiences': {
        const { expIdx1, expIdx2 } = c.payload || {};
        if (expIdx1 !== undefined && experiences[expIdx1]) experiences[expIdx1].modifier += 1;
        if (expIdx2 !== undefined && experiences[expIdx2]) experiences[expIdx2].modifier += 1;
        break;
      }
      case 'proficiency':
        proficiency += 1;
        break;
      case 'domain':
        // Player will gain an extra domain card from compendium
        break;
      case 'subclass':
        // Subclass progression handled via item update
        break;
      default:
        break;
    }
  }

  const patch = {
    'systemData.level': nextLevel,
    'systemData.proficiency': proficiency,
    'systemData.advancements': adv,
    'systemData.marks': marks,
    'systemData.bonus': bonus,
    'systemData.experiences': experiences,
  };

  // If traits were chosen, bump attributes
  const attributes = JSON.parse(JSON.stringify(actorSystem.attributes || {}));
  const traitChoices = choices.filter((c) => c.type === 'traits');
  for (const tc of traitChoices) {
    const { trait1, trait2 } = tc.payload || {};
    if (trait1) attributes[trait1] = (attributes[trait1] || 0) + 1;
    if (trait2) attributes[trait2] = (attributes[trait2] || 0) + 1;
  }
  if (traitChoices.length) {
    patch['systemData.attributes'] = attributes;
  }

  return { ok: true, patch, nextLevel };
}
