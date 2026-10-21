import assert from 'node:assert/strict';
import { deriveCharacter } from '../lib/derive.mjs';

let d = deriveCharacter({ level: 1 }, []);
assert.deepEqual([d.evasion, d.hpMax, d.thresholdMajor, d.thresholdSevere], [0, 6, 1, 2]);

const bard = { type: 'class', data: { evasion: 10, hp: 5, domains: ['Grace', 'Codex'] } };
const gambeson = { type: 'armor', data: { equipped: true, baseMajor: 5, baseSevere: 11, baseScore: 3, modifiers: { evasion: 1 } } };
d = deriveCharacter({ level: 1 }, [bard, gambeson]);
assert.deepEqual([d.evasion, d.hpMax, d.thresholdMajor, d.thresholdSevere, d.armorScore], [11, 5, 6, 12, 3]);

d = deriveCharacter({ level: 1, bonus: { armorScore: 20 } }, [gambeson]);
assert.equal(d.armorScore, 12);

// level 0 stored as 0 must not fall back to 1
assert.equal(deriveCharacter({ level: 0 }, []).thresholdMajor, 0);
console.log('derive ok');
