/**
 * @fileoverview Daggerheart SRD 2.0 — Duality Dice Engine (Pure ESM)
 * Implements deterministic duality dice evaluation (Hope & Fear 2d12)
 * adhering to ES2023+ functional standards and zero side-effects.
 */

/**
 * @typedef {'CRITICAL' | 'SUCCESS_WITH_HOPE' | 'SUCCESS_WITH_FEAR' | 'FAILURE_WITH_HOPE' | 'FAILURE_WITH_FEAR' | 'HOPE_DOMINANT' | 'FEAR_DOMINANT'} DualityOutcome
 */

/**
 * @typedef {Object} DualityResult
 * @property {number} hope - Rolled value of Hope Die (1-12)
 * @property {number} fear - Rolled value of Fear Die (1-12)
 * @property {number} traitMod - Trait modifier applied
 * @property {number} situationalMod - Additional bonus/penalty
 * @property {number} total - Final roll sum
 * @property {boolean} isCritical - True if hope === fear (matching doubles)
 * @property {DualityOutcome} outcome - Semantic outcome identifier
 * @property {number} hopeGain - Hope points awarded to the player
 * @property {number} fearGain - Fear points awarded to the GM
 * @property {number} stressClear - Stress points that may be cleared
 * @property {string} labelKey - Localization key for outcome
 * @property {string} badgeClass - CSS class for visual presentation
 */

/**
 * Evaluates a Duality Dice roll per Daggerheart SRD 2.0 specifications.
 * 
 * @param {number} hope - Value of the Hope Die (1-12)
 * @param {number} fear - Value of the Fear Die (1-12)
 * @param {number} [traitMod=0] - Trait modifier
 * @param {number} [situationalMod=0] - Situational bonus or penalty
 * @param {number|null} [targetDC=null] - Difficulty class, if known
 * @returns {DualityResult} Evaluated duality outcome
 */
export function evaluateDuality(hope, fear, traitMod = 0, situationalMod = 0, targetDC = null) {
  const hopeVal = Number(hope) || 0;
  const fearVal = Number(fear) || 0;
  const tMod = Number(traitMod) || 0;
  const sMod = Number(situationalMod) || 0;
  const total = hopeVal + fearVal + tMod + sMod;

  // Rule: Matching numbers on Hope and Fear is a Critical Success
  if (hopeVal === fearVal && hopeVal > 0) {
    return {
      hope: hopeVal,
      fear: fearVal,
      traitMod: tMod,
      situationalMod: sMod,
      total,
      isCritical: true,
      outcome: 'CRITICAL',
      hopeGain: 1,
      fearGain: 0,
      stressClear: 1,
      labelKey: 'DH.Duality.CriticalSuccess',
      badgeClass: 'dh-critical',
    };
  }

  // With explicit target DC
  if (targetDC !== null && targetDC !== undefined) {
    const dc = Number(targetDC);
    const isSuccess = total >= dc;

    if (isSuccess) {
      if (hopeVal > fearVal) {
        return {
          hope: hopeVal,
          fear: fearVal,
          traitMod: tMod,
          situationalMod: sMod,
          total,
          isCritical: false,
          outcome: 'SUCCESS_WITH_HOPE',
          hopeGain: 1,
          fearGain: 0,
          stressClear: 0,
          labelKey: 'DH.Duality.SuccessWithHope',
          badgeClass: 'dh-success-hope',
        };
      }
      return {
        hope: hopeVal,
        fear: fearVal,
        traitMod: tMod,
        situationalMod: sMod,
        total,
        isCritical: false,
        outcome: 'SUCCESS_WITH_FEAR',
        hopeGain: 0,
        fearGain: 1,
        stressClear: 0,
        labelKey: 'DH.Duality.SuccessWithFear',
        badgeClass: 'dh-success-fear',
      };
    }

    // Failure branch
    if (hopeVal > fearVal) {
      return {
        hope: hopeVal,
        fear: fearVal,
        traitMod: tMod,
        situationalMod: sMod,
        total,
        isCritical: false,
        outcome: 'FAILURE_WITH_HOPE',
        hopeGain: 1,
        fearGain: 0,
        stressClear: 0,
        labelKey: 'DH.Duality.FailureWithHope',
        badgeClass: 'dh-failure-hope',
      };
    }
    return {
      hope: hopeVal,
      fear: fearVal,
      traitMod: tMod,
      situationalMod: sMod,
      total,
      isCritical: false,
      outcome: 'FAILURE_WITH_FEAR',
      hopeGain: 0,
      fearGain: 1,
      stressClear: 0,
      labelKey: 'DH.Duality.FailureWithFear',
      badgeClass: 'dh-failure-fear',
    };
  }

  // Without Target DC (Standard Open Duality Check)
  if (hopeVal > fearVal) {
    return {
      hope: hopeVal,
      fear: fearVal,
      traitMod: tMod,
      situationalMod: sMod,
      total,
      isCritical: false,
      outcome: 'HOPE_DOMINANT',
      hopeGain: 1,
      fearGain: 0,
      stressClear: 0,
      labelKey: 'DH.Duality.HopeDie',
      badgeClass: 'dh-hope-dominant',
    };
  }

  return {
    hope: hopeVal,
    fear: fearVal,
    traitMod: tMod,
    situationalMod: sMod,
    total,
    isCritical: false,
    outcome: 'FEAR_DOMINANT',
    hopeGain: 0,
    fearGain: 1,
    stressClear: 0,
    labelKey: 'DH.Duality.FearDie',
    badgeClass: 'dh-fear-dominant',
  };
}

/**
 * Extracts Hope and Fear dice from Loom roll terms or meta.
 * 
 * @param {Object} roll - The Loom roll result object
 * @returns {DualityResult|null}
 */
export function extractDualityFromRoll(roll) {
  if (!roll) return null;

  let hopeVal = null;
  let fearVal = null;

  // 1. Direct meta if available
  if (roll.meta?.hopeDie !== undefined && roll.meta?.fearDie !== undefined) {
    hopeVal = Number(roll.meta.hopeDie);
    fearVal = Number(roll.meta.fearDie);
  }

  // 2. Inspect roll terms
  if ((hopeVal === null || fearVal === null) && Array.isArray(roll.terms)) {
    for (const term of roll.terms) {
      const faces = term.faces || term.sides;
      if (faces === 12 && Array.isArray(term.rolls)) {
        if (term.rolls.length >= 2) {
          hopeVal = Number(term.rolls[0]);
          fearVal = Number(term.rolls[1]);
          break;
        } else if (hopeVal === null && term.rolls.length >= 1) {
          hopeVal = Number(term.rolls[0]);
        } else if (fearVal === null && term.rolls.length >= 1) {
          fearVal = Number(term.rolls[0]);
          break;
        }
      }
    }
  }

  // 3. Fallback: inspect dice array if term structure differs
  if ((hopeVal === null || fearVal === null) && Array.isArray(roll.dice)) {
    for (const d of roll.dice) {
      const faces = d.faces || d.sides;
      if (faces === 12 && Array.isArray(d.results)) {
        const vals = d.results.map((r) => (typeof r === 'object' && r !== null ? r.result : r));
        if (vals.length >= 2) {
          hopeVal = Number(vals[0]);
          fearVal = Number(vals[1]);
          break;
        }
      }
    }
  }

  if (hopeVal === null || fearVal === null || isNaN(hopeVal) || isNaN(fearVal)) {
    return null;
  }

  const traitMod = Number(roll.meta?.modifier || 0);
  const targetDC = (roll.meta?.difficulty !== undefined && roll.meta?.difficulty !== null)
    ? Number(roll.meta.difficulty)
    : null;

  return evaluateDuality(hopeVal, fearVal, traitMod, 0, targetDC);
}
