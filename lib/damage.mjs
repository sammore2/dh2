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

/**
 * Calculates raw severity from damage and thresholds.
 * 
 * @param {number} damage - Incoming damage
 * @param {number} majorThreshold - Major threshold (marks 2 HP)
 * @param {number} severeThreshold - Severe threshold (marks 3 HP)
 * @returns {{ severity: DamageSeverity, hpToMark: number, badgeClass: string, labelKey: string }}
 */
export function calculateBaseSeverity(damage, majorThreshold, severeThreshold) {
  const dmg = Math.max(0, Number(damage) || 0);
  const major = Number(majorThreshold) || 7;
  const severe = Number(severeThreshold) || 14;

  if (dmg <= 0) {
    return {
      severity: 'NONE',
      hpToMark: 0,
      badgeClass: 'dh-sev-none',
      labelKey: 'DH.Thresholds.None',
    };
  }

  if (dmg < major) {
    return {
      severity: 'MINOR',
      hpToMark: 1,
      badgeClass: 'dh-sev-minor',
      labelKey: 'DH.Thresholds.Minor',
    };
  }

  if (dmg < severe) {
    return {
      severity: 'MAJOR',
      hpToMark: 2,
      badgeClass: 'dh-sev-major',
      labelKey: 'DH.Thresholds.Major',
    };
  }

  return {
    severity: 'SEVERE',
    hpToMark: 3,
    badgeClass: 'dh-sev-severe',
    labelKey: 'DH.Thresholds.Severe',
  };
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

  let finalSeverity = 'NONE';
  let badgeClass = 'dh-sev-none';
  let labelKey = 'DH.Thresholds.None';

  if (finalHp === 1) {
    finalSeverity = 'MINOR';
    badgeClass = 'dh-sev-minor';
    labelKey = 'DH.Thresholds.Minor';
  } else if (finalHp === 2) {
    finalSeverity = 'MAJOR';
    badgeClass = 'dh-sev-major';
    labelKey = 'DH.Thresholds.Major';
  } else if (finalHp >= 3) {
    finalSeverity = 'SEVERE';
    badgeClass = 'dh-sev-severe';
    labelKey = 'DH.Thresholds.Severe';
  }

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
 * 
 * @param {Object} actor - The target actor document
 * @param {DamageResolution} resolution - The resolved damage object
 * @returns {Promise<{ hpMarked: number, armorMarked: number, currentHp: number, maxHp: number }>}
 */
export function applyDamageToActor(actor, resolution) {
  if (!actor) throw new Error('Target actor is required');

  const sys = actor.systemData || {};
  const currentHp = Number(sys.hp?.value || 0);
  const maxHp = Number(sys.hp?.max || 6);
  const newHp = Math.min(maxHp, currentHp + resolution.finalHpToMark);

  const updates = {
    'systemData.hp.value': newHp,
  };

  let newSlotsMarked = 0;
  if (resolution.armorSlotsSpent > 0 && sys.armor) {
    const currentSlotsMarked = Number(sys.armor.slotsMarked || 0);
    const maxSlots = Number(sys.armor.slots || 6);
    newSlotsMarked = Math.min(maxSlots, currentSlotsMarked + resolution.armorSlotsSpent);
    updates['systemData.armor.slotsMarked'] = newSlotsMarked;
  }

  return actor.update(updates).then(() => ({
    hpMarked: resolution.finalHpToMark,
    armorMarked: resolution.armorSlotsSpent,
    currentHp: newHp,
    maxHp,
  }));
}
