import assert from 'node:assert/strict';
import { buildActionRoll, buildDamageFormula, maxDice } from '../lib/action-roll.mjs';

const exps = [{ name: 'Guarda Real', modifier: 2 }, { name: 'Trapaceiro', modifier: 3 }];
const target = { id: 'c1', name: 'Goblin' };

// Plain trait roll
let r = buildActionRoll({ traitKey: 'agility', traitMod: 3 });
assert.equal(r.formula, '2d12+3');
assert.equal(r.hopeSpent, 0);
assert.equal(r.meta.rollType, 'action');
assert.equal('difficulty' in r.meta, false);

// Negative modifier and no modifier
assert.equal(buildActionRoll({ traitKey: 'agility', traitMod: -1 }).formula, '2d12-1');
assert.equal(buildActionRoll({ traitKey: 'agility', traitMod: 0 }).formula, '2d12');

// Advantage / disadvantage add or subtract a d6
assert.equal(buildActionRoll({ traitKey: 'agility', traitMod: 1, choice: { advantage: 'adv' } }).formula, '2d12+1+1d6');
assert.equal(buildActionRoll({ traitKey: 'agility', traitMod: 1, choice: { advantage: 'dis' } }).formula, '2d12+1-1d6');

// Experiences cost 1 Hope each and add their modifier; the extra bonus adds too
r = buildActionRoll({ traitKey: 'strength', traitMod: 1, experiences: exps, choice: { experiences: [0, 1], bonus: '2', difficulty: '12' } });
assert.equal(r.formula, '2d12+8');
assert.equal(r.hopeSpent, 2);
assert.equal(r.meta.difficulty, 12);
assert.deepEqual(r.meta.experiences, ['Guarda Real', 'Trapaceiro']);

// Attack: weapon damage and the targets travel with the roll
r = buildActionRoll({ traitKey: 'agility', traitMod: 2, weapon: { name: 'Espada', damage: '2d8+1', damageType: 'physical' }, targets: [target] });
assert.equal(r.meta.weaponDamage, '2d8+1');
assert.deepEqual(r.meta.targets, ['c1']);
assert.deepEqual(r.meta.targetNames, ['Goblin']);

// Critical damage: maximum of the damage dice added (SRD: 2d8+1 -> 2d8+1+16)
assert.equal(maxDice('2d8+1'), 16);
assert.equal(maxDice('d6+2'), 6);
assert.equal(buildDamageFormula('2d8+1', { crit: true }), '2d8+1+16');
assert.equal(buildDamageFormula('2d8+1', { bonus: 3 }), '2d8+1+3');
assert.equal(buildDamageFormula('2d8+1', { crit: true, bonus: -1 }), '2d8+1-1+16');

console.log('action-roll: ok');

// Healing consumables: own formula wins, otherwise the SRD text is read
import { healFormula } from '../lib/action-roll.mjs';
assert.equal(healFormula({ data: { description: 'Clear 1d4+1 HP.' } }), '1d4+1');
assert.equal(healFormula({ data: { description: 'You can consume this moss during a rest to clear 1d10 HP or 1d10 Stress.' } }), '1d10');
assert.equal(healFormula({ data: { description: 'clear all HP and Stress' } }), '');
assert.equal(healFormula({ data: { heal: ' 2d4 ', description: 'Clear 1d4+1 HP.' } }), '2d4');
assert.equal(healFormula({ data: {} }), '');
