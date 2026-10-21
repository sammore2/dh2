import assert from 'node:assert/strict';
import { addGold } from '../lib/gold.mjs';

// 9 handfuls + 1 (click index 9) -> 0 handfuls, 1 bag
let r = addGold({ handfuls: 9, bags: 0, chest: 0 }, 'handfuls', 9);
assert.equal(r.ok, true);
assert.deepEqual(r.gold, { handfuls: 0, bags: 1, chest: 0 });

// 9 bags + 1 (click index 9 on bags) -> 0 handfuls, 0 bags, 1 chest
r = addGold({ handfuls: 5, bags: 9, chest: 0 }, 'bags', 9);
assert.equal(r.ok, true);
assert.deepEqual(r.gold, { handfuls: 5, bags: 0, chest: 1 });

// 9 handfuls + 1 when bags is 9 and chest is 0 -> roll all the way to chest
r = addGold({ handfuls: 9, bags: 9, chest: 0 }, 'handfuls', 9);
assert.equal(r.ok, true);
assert.deepEqual(r.gold, { handfuls: 0, bags: 0, chest: 1 });

// Full: handfuls 9, bags 9, chest 1 -> clicking 10th handful refuses
r = addGold({ handfuls: 9, bags: 9, chest: 1 }, 'handfuls', 9);
assert.equal(r.ok, false);
assert.match(r.reason, /Ouro cheio/);

// Full: bags 9, chest 1 -> clicking 10th bag refuses
r = addGold({ handfuls: 0, bags: 9, chest: 1 }, 'bags', 9);
assert.equal(r.ok, false);
assert.match(r.reason, /Ouro cheio/);

// Toggle unmarking
r = addGold({ handfuls: 5, bags: 2, chest: 1 }, 'handfuls', 4);
assert.deepEqual(r.gold, { handfuls: 4, bags: 2, chest: 1 });

console.log('gold ok');
