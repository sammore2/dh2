/**
 * @fileoverview Daggerheart SRD 2.0 — Damage & Armor Threshold Resolution Engine (Pure ESM)
 * Implements deterministic damage threshold evaluation and armor mitigation.
 */

/**
 * @typedef {'NONE' | 'MINOR' | 'MAJOR' | 'SEVERE'} DamageSeverity
 */

/**
 * @typedef {Object} DamageResolution
 * @property {number} rawDamage - Original damage value rolled
 * @property {number} majorThreshold - Target's Major threshold
 * @property {number} severeThreshold - Target's Severe threshold
 * @property {DamageSeverity} baseSeverity - Severity before armor mitigation
 * @property {number} baseHpToMark - Base HP marked before mitigation (0, 1, 2, or 3)
 * @property {number} armorSlotsSpent - Number of armor slots spent
 * @property {DamageSeverity} finalSeverity - Severity after armor mitigation
 * @property {number} finalHpToMark - Final HP marked on target
 * @property {string} labelKey - Localization key
 * @property {string} badgeClass - CSS class for visual presentation
 */

/** Severity info indexed by HP marked (0 to 3). */
const SEVERITY_BY_HP = [
  { severity: 'NONE', badgeClass: 'dh-sev-none', labelKey: 'DH.Thresholds.None' },
  { severity: 'MINOR', badgeClass: 'dh-sev-minor', labelKey: 'DH.Thresholds.Minor' },
  { severity: 'MAJOR', badgeClass: 'dh-sev-major', labelKey: 'DH.Thresholds.Major' },
  { severity: 'SEVERE', badgeClass: 'dh-sev-severe', labelKey: 'DH.Thresholds.Severe' },
];

export function calculateBaseSeverity(damage, majorThreshold, severeThreshold) {
  const dmg = Math.max(0, Number(damage) || 0);
  const major = Number(majorThreshold) || 7;
  const severe = Number(severeThreshold) || 14;

  let hpToMark = 3;
  if (dmg <= 0) hpToMark = 0;
  else if (dmg < major) hpToMark = 1;
  else if (dmg < severe) hpToMark = 2;

  return { ...SEVERITY_BY_HP[hpToMark], hpToMark };
}

/**
 * Resolves damage against target thresholds and applies armor slot mitigation.
 * Per Daggerheart SRD 2.0:
 * Each armor slot marked reduces incoming damage severity by one step.
 * Severe (3 HP) -> Major (2 HP) -> Minor (1 HP) -> None (0 HP).
 * 
 * @param {number} damage - Incoming rolled damage
 * @param {Object} thresholds - Target thresholds { major, severe }
 * @param {number} [armorSlotsSpent=0] - Number of armor slots the target opts to spend
 * @returns {DamageResolution}
 */
export function resolveDamage(damage, thresholds, armorSlotsSpent = 0) {
  const major = Number(thresholds?.major || thresholds?.baseMajor || 7);
  const severe = Number(thresholds?.severe || thresholds?.baseSevere || 14);
  const base = calculateBaseSeverity(damage, major, severe);

  const slots = Math.max(0, Math.min(3, Number(armorSlotsSpent) || 0));
  const finalHp = Math.max(0, base.hpToMark - slots);
  const { severity: finalSeverity, badgeClass, labelKey } = SEVERITY_BY_HP[finalHp];

  return {
    rawDamage: Math.max(0, Number(damage) || 0),
    majorThreshold: major,
    severeThreshold: severe,
    baseSeverity: base.severity,
    baseHpToMark: base.hpToMark,
    armorSlotsSpent: slots,
    finalSeverity,
    finalHpToMark: finalHp,
    labelKey,
    badgeClass,
  };
}

/**
 * Applies calculated damage and armor expenditure to an Actor document.
 * If armorItem is passed (SRD 2.0 item armor), updates slotsMarked on the item via API.
 * 
 * @param {Object} actor - The target actor document
 * @param {DamageResolution} resolution - The resolved damage object
 * @param {Object|null} [armorItem=null] - The equipped armor item if character
 * @param {Object} [deps] - Optional dependency injection for testing outside Loom
 * @returns {Promise<{ hpMarked: number, armorMarked: number, currentHp: number, maxHp: number }>}
 */
export async function applyDamageToActor(actor, resolution, armorItem = null, deps = {}) {
  if (!actor) throw new Error('Target actor is required');

  const saveActorFn = deps.saveActor || (await import('./save-actor.mjs')).saveActor;
  const apiObj = deps.api || (await import('/_loom/sdk/index.js')).api;

  const sys = actor.systemData || {};
  const currentHp = Number(sys.hp?.value || 0);
  const maxHp = Number(sys.derived?.hpMax ?? sys.hp?.max ?? 6);
  const newHp = Math.min(maxHp, currentHp + resolution.finalHpToMark);

  // Spend armor slots on the equipped armor item
  if (resolution.armorSlotsSpent > 0 && armorItem) {
    const curMarked = Number(armorItem.data?.slotsMarked || 0);
    const newMarked = curMarked + resolution.armorSlotsSpent;
    await apiObj.put(`/items/${armorItem.id}`, {
      data: { ...armorItem.data, slotsMarked: newMarked }
    });
  }

  await saveActorFn(actor, { 'systemData.hp.value': newHp });

  return {
    hpMarked: resolution.finalHpToMark,
    armorMarked: resolution.armorSlotsSpent,
    currentHp: newHp,
    maxHp,
  };
}
