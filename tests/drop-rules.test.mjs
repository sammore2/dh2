import assert from 'node:assert/strict';
import { checkDrop } from '../lib/drop-rules.mjs';

const it = (type, name, data = {}, id = name) => ({ id, type, name, data });
const bard = it('class', 'Bard', { domains: ['Grace', 'Codex'] });
const actor = (items = [], level = 1, derived = {}) => ({ level, items, derived: { domains: ['Grace', 'Codex'], ...derived } });
const drop = (type, name, data, a) => checkDrop(type, { name, data }, a);

// class / subclass / community: one only
assert.equal(drop('class', 'Bard', {}, actor()).ok, true);
assert.match(drop('class', 'Wizard', {}, actor([bard])).reason, /já tem uma classe/);
assert.equal(drop('subclass', 'Troubadour', { class: 'Bard' }, actor()).ok, false);
assert.equal(drop('subclass', 'School of Knowledge', { class: 'Wizard' }, actor([bard])).ok, false);
assert.equal(drop('subclass', 'Troubadour', { class: 'bard' }, actor([bard])).patch.unlocked, 'foundation');
assert.equal(drop('community', 'Highborne', {}, actor([it('community', 'Loreborne')])).ok, false);

// mixed ancestry
let r = drop('ancestry', 'Elf', {}, actor());
assert.equal(r.patch.use, 'both');
const human = it('ancestry', 'Human', { use: 'both' });
r = drop('ancestry', 'Elf', {}, actor([human]));
assert.equal(r.patch.use, 'bottom');
assert.equal(r.updates[0].data.use, 'top');
assert.equal(drop('ancestry', 'Orc', {}, actor([human, it('ancestry', 'Elf')])).ok, false);

// weapons: tier, hands, inventory
assert.equal(drop('weapon', 'Longsword', { tier: 2, category: 'primary' }, actor()).ok, false);
assert.equal(drop('weapon', 'Sword', { tier: 1, category: 'primary', burden: 'one' }, actor()).patch.slot, 'primary');
const shield = it('weapon', 'Shield', { slot: 'secondary', burden: 'one' });
const greatsword = { tier: 1, category: 'primary', burden: 'two' };
assert.equal(drop('weapon', 'Greatsword', greatsword, actor([shield])).patch.slot, 'inventory');
const inv = [it('weapon', 'a', { slot: 'inventory' }), it('weapon', 'b', { slot: 'inventory' })];
assert.match(drop('weapon', 'Greatsword', greatsword, actor([shield, ...inv])).reason, /Inventário de armas cheio/);
r = drop('weapon', 'Staff', { tier: 1, category: 'primary', burden: 'one', damageType: 'mag' }, actor());
assert.equal(r.patch.slot, 'inventory');
assert.ok(r.warn);
assert.equal(drop('weapon', 'Staff', { tier: 1, category: 'primary', burden: 'one', damageType: 'mag' }, actor([], 1, { spellcastTrait: 'presence' })).patch.slot, 'primary');

// armor swap
const old = it('armor', 'Gambeson', { equipped: true, slotsMarked: 2 });
r = drop('armor', 'Chainmail', { tier: 1 }, actor([old]));
assert.deepEqual([r.patch.equipped, r.patch.slotsMarked, r.updates[0].data.equipped], [true, 0, false]);
assert.equal(drop('armor', 'Plate', { tier: 3 }, actor([], 5)).ok, true);
assert.equal(drop('armor', 'Plate', { tier: 3 }, actor([], 2)).ok, false);

// domain cards
assert.equal(drop('domainCard', 'X', { domain: 'Grace', level: 1 }, actor()).ok, false);
assert.equal(drop('domainCard', 'X', { domain: 'Blade', level: 1 }, actor([bard])).ok, false);
assert.equal(drop('domainCard', 'X', { domain: 'Grace', level: 2 }, actor([bard])).ok, false);
const five = Array.from({ length: 5 }, (_, i) => it('domainCard', 'c' + i, { inLoadout: true }));
r = drop('domainCard', 'X', { domain: 'Grace', level: 1 }, actor([bard, ...five]));
assert.equal(r.patch.inLoadout, false);
assert.ok(r.warn);

// consumables merge
r = drop('consumable', 'Potion', { quantity: 2 }, actor([it('consumable', 'Potion', { quantity: 1 }, 'p1')]));
assert.deepEqual([r.skipCreate, r.updates[0].id, r.updates[0].data.quantity], [true, 'p1', 3]);
console.log('drop-rules ok');
