import assert from 'node:assert/strict';
import { processLevelUp } from '../lib/level-up.mjs';

// Level 1 to 2 transition:
// Tier milestone: +1 Proficiency (1 -> 2), +1 Experience (+2)
// Advancements: +1 HP, +1 Stress
const sys1 = {
  level: 1,
  proficiency: 1,
  experiences: [{ name: 'Soldier', modifier: 2 }, { name: 'Scholar', modifier: 2 }],
  bonus: { hp: 0, stress: 0 },
  advancements: {},
  marks: { traits: [] },
  attributes: { agility: 1, strength: 0 }
};

let res = processLevelUp(sys1, [
  { type: 'hp', tierKey: 'tier2' },
  { type: 'stress', tierKey: 'tier2' }
]);
assert.equal(res.ok, true);
assert.equal(res.patch['systemData.level'], 2);
assert.equal(res.patch['systemData.proficiency'], 2); // milestone +1
assert.equal(res.patch['systemData.bonus'].hp, 1);
assert.equal(res.patch['systemData.bonus'].stress, 1);
assert.equal(res.patch['systemData.experiences'].length, 3); // gained milestone exp

// Level 4 to 5 transition:
// Tier 3 milestone: clears trait marks, +1 proficiency, +1 exp
const sys4 = {
  level: 4,
  proficiency: 2,
  experiences: [{ name: '', modifier: 2 }],
  marks: { traits: ['agility', 'strength'] },
  advancements: {},
};
res = processLevelUp(sys4, [
  { type: 'hp', tierKey: 'tier3' },
  { type: 'evasion', tierKey: 'tier3' }
]);
assert.equal(res.ok, true);
assert.equal(res.patch['systemData.level'], 5);
assert.equal(res.patch['systemData.proficiency'], 3);
assert.deepEqual(res.patch['systemData.marks'].traits, []); // Cleared marks on Tier 3!

// Proficiency advancement choice costs 2 choices
res = processLevelUp(sys4, [
  { type: 'proficiency', tierKey: 'tier3' }
]);
assert.equal(res.ok, true);
assert.equal(res.patch['systemData.proficiency'], 4); // 2 + 1 (milestone) + 1 (choice)

// Traits marking validation: cannot pick marked trait in same tier
const sysTrait = {
  level: 2,
  proficiency: 2,
  marks: { traits: ['agility'] },
  advancements: {},
  attributes: { agility: 1, strength: 0, finesse: 0 }
};
res = processLevelUp(sysTrait, [
  { type: 'traits', tierKey: 'tier2', payload: { trait1: 'agility', trait2: 'strength' } },
  { type: 'hp', tierKey: 'tier2' }
]);
assert.equal(res.ok, false);
assert.match(res.reason, /já marcado/);

// Valid trait advancement increases attributes and adds marks
res = processLevelUp(sysTrait, [
  { type: 'traits', tierKey: 'tier2', payload: { trait1: 'strength', trait2: 'finesse' } },
  { type: 'hp', tierKey: 'tier2' }
]);
assert.equal(res.ok, true);
assert.deepEqual(res.patch['systemData.marks'].traits, ['agility', 'strength', 'finesse']);
assert.equal(res.patch['systemData.attributes'].strength, 1);
assert.equal(res.patch['systemData.attributes'].finesse, 1);

console.log('level-up ok');
