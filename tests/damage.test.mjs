import assert from 'node:assert/strict';
import { calculateBaseSeverity, resolveDamage, applyDamageToActor } from '../lib/damage.mjs';

// Base severity
assert.equal(calculateBaseSeverity(0, 7, 14).hpToMark, 0);
assert.equal(calculateBaseSeverity(5, 7, 14).hpToMark, 1);
assert.equal(calculateBaseSeverity(7, 7, 14).hpToMark, 2);
assert.equal(calculateBaseSeverity(12, 7, 14).hpToMark, 2);
assert.equal(calculateBaseSeverity(14, 7, 14).hpToMark, 3);
assert.equal(calculateBaseSeverity(25, 7, 14).hpToMark, 3);

// Mitigation with armor slots
const thresholds = { major: 7, severe: 14 };

// Minor (1 HP) mitigated by 1 slot -> 0 HP
let res = resolveDamage(5, thresholds, 1);
assert.equal(res.baseHpToMark, 1);
assert.equal(res.finalHpToMark, 0);
assert.equal(res.armorSlotsSpent, 1);

// Severe (3 HP) mitigated by 2 slots -> 1 HP (Minor)
res = resolveDamage(15, thresholds, 2);
assert.equal(res.baseHpToMark, 3);
assert.equal(res.finalHpToMark, 1);
assert.equal(res.finalSeverity, 'MINOR');

// Severe (3 HP) mitigated by 3 slots -> 0 HP (None)
res = resolveDamage(15, thresholds, 3);
assert.equal(res.finalHpToMark, 0);
assert.equal(res.finalSeverity, 'NONE');

// No slots spent
res = resolveDamage(15, thresholds, 0);
assert.equal(res.finalHpToMark, 3);
assert.equal(res.finalSeverity, 'SEVERE');

// Test applyDamageToActor with mocked deps (SRD 2.0 item armor updates)
const fakeActor = {
  id: 'act1',
  systemData: { hp: { value: 1, max: 6 } }
};
const fakeArmor = {
  id: 'arm1',
  data: { slotsMarked: 1, baseScore: 3 }
};
let putCalled = null;
let savedActor = null;
const fakeDeps = {
  saveActor: async (act, patch) => { savedActor = patch; },
  api: { put: async (path, body) => { putCalled = { path, body }; } }
};

const applied = await applyDamageToActor(fakeActor, res, fakeArmor, fakeDeps);
assert.equal(applied.hpMarked, 3);
assert.equal(applied.currentHp, 4);
assert.equal(savedActor['systemData.hp.value'], 4);
assert.equal(putCalled, null); // 0 slots spent

// Spend 2 slots on armor
const mitigatedRes = resolveDamage(15, thresholds, 2);
const applied2 = await applyDamageToActor(fakeActor, mitigatedRes, fakeArmor, fakeDeps);
assert.equal(applied2.hpMarked, 1);
assert.equal(applied2.armorMarked, 2);
assert.equal(putCalled.path, '/items/arm1');
assert.equal(putCalled.body.data.slotsMarked, 3);

console.log('damage ok');
