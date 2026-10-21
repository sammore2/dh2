/**
 * Builds Daggerheart action and damage rolls from what the roll dialog collected (SRD "Action Rolls", "Critical Damage").
 * Pure: no Loom imports, so it runs under node.
 */

export const TRAIT_LABELS = {
  agility: 'Agilidade', strength: 'Força', finesse: 'Destreza',
  instinct: 'Instinto', presence: 'Presença', knowledge: 'Conhecimento',
};

export const signed = (n) => (n < 0 ? `-${-n}` : `+${n}`);

/**
 * @param {object} p
 * @param {string} p.traitKey
 * @param {number} p.traitMod
 * @param {{name:string, modifier:number}[]} p.experiences  the list the dialog showed (indexes in `choice.experiences` point here)
 * @param {{advantage?:string, experiences?:number[], bonus?:number|string, difficulty?:number|string|null}} p.choice
 * @param {{name?:string, damage?:string, damageType?:string}|null} p.weapon
 * @param {{id:string, name:string}[]} p.targets
 * @returns {{formula:string, meta:object, hopeSpent:number}}
 */
export function buildActionRoll({ traitKey, traitMod = 0, experiences = [], choice = {}, weapon = null, targets = [] }) {
  const picked = (choice.experiences ?? []).map((i) => experiences[i]).filter(Boolean);
  const flat = Number(traitMod) + picked.reduce((n, e) => n + (Number(e.modifier) || 0), 0) + (Number(choice.bonus) || 0);
  const adv = choice.advantage === 'adv' || choice.advantage === 'dis' ? choice.advantage : 'none';
  // Advantage adds a d6 to the total, disadvantage subtracts one (SRD)
  const formula = '2d12' + (flat ? signed(flat) : '') + (adv === 'adv' ? '+1d6' : adv === 'dis' ? '-1d6' : '');

  const meta = {
    system: 'Daggerheart',
    rollType: 'action',
    trait: traitKey,
    modifier: flat,
    advantage: adv,
    experiences: picked.map((e) => e.name),
    targets: targets.map((t) => t.id),
    targetNames: targets.map((t) => t.name),
  };
  const dc = choice.difficulty === '' || choice.difficulty == null ? NaN : Number(choice.difficulty);
  if (Number.isFinite(dc)) meta.difficulty = dc;
  if (weapon?.name) meta.weapon = weapon.name;
  if (weapon?.damage) {
    meta.weaponDamage = weapon.damage;
    meta.damageType = weapon.damageType || 'physical';
  }
  return { formula, meta, hopeSpent: picked.length };
}

/**
 * The healing formula of a consumable: its own `data.heal`, or the "Clear 1d4+1 HP" of its SRD text. '' when it heals nothing.
 * (Sweet Moss clears "1d10 HP or 1d10 Stress": the formula is the HP one, the choice stays with the table.)
 */
export function healFormula(item) {
  const own = String(item?.data?.heal ?? '').trim();
  if (own) return own;
  const m = /clears?\s+(\d*d\d+(?:[+-]\d+)?|\d+)\s*(?:HP|Hit Points?)/i.exec(String(item?.data?.description ?? ''));
  return m ? m[1] : '';
}

/** Highest possible total of the dice in a formula: "2d8+1" -> 16 (the critical damage bonus). */
export function maxDice(formula) {
  return [...String(formula).matchAll(/(\d*)d(\d+)/gi)].reduce((n, m) => n + (Number(m[1]) || 1) * Number(m[2]), 0);
}

/** The damage formula that actually gets rolled: the base, plus the dialog bonus, plus the max dice on a critical. */
export function buildDamageFormula(formula, { crit = false, bonus = 0 } = {}) {
  const b = Number(bonus) || 0;
  return `${formula}${b ? signed(b) : ''}${crit ? `+${maxDice(formula)}` : ''}`;
}
