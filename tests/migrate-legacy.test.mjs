import assert from 'node:assert/strict';
import { parseDamageString, parseDamageType, hasLegacyData, planLegacyMigration } from '../lib/migrate-legacy.mjs';

// Parsing damage formulas
assert.deepEqual(parseDamageString('1d8+2'), { dice: 8, flat: 2 });
assert.deepEqual(parseDamageString('d10 - 1'), { dice: 10, flat: -1 });
assert.deepEqual(parseDamageString('2d6'), { dice: 6, flat: 0 });
assert.deepEqual(parseDamageString('invalid'), { dice: 8, flat: 0 });

assert.equal(parseDamageType('physical'), 'phy');
assert.equal(parseDamageType('Físico'), 'phy');
assert.equal(parseDamageType('magic'), 'mag');
assert.equal(parseDamageType('mágico'), 'mag');

// Legacy actor sample
const legacyActor = {
  weapons: {
    primary: {
      name: 'Espada Longa',
      damage: '1d8+2',
      damageType: 'physical',
      trait: 'agility',
      range: 'Melee',
      feature: 'Confiável'
    },
    secondary: {
      name: 'Adaga',
      damage: '1d4',
      damageType: 'físico',
      trait: 'finesse',
      range: 'Very Close',
      feature: ''
    }
  },
  activeArmor: {
    name: 'Cota de Malha',
    feature: 'Pesada'
  },
  thresholds: {
    baseMajor: 7,
    baseSevere: 14
  },
  armor: {
    score: 3,
    slotsMarked: 1
  },
  domainCards: [
    { name: 'Golpe Mortal', domain: 'Blade', level: 1, description: 'Causa dano extra.', inLoadout: true },
    { name: 'Escudo de Luz', domain: 'Splendor', level: 2, description: 'Protege aliados.', inLoadout: false }
  ]
};

assert.equal(hasLegacyData(legacyActor), true);

const itemsToCreate = planLegacyMigration(legacyActor);
assert.equal(itemsToCreate.length, 5); // 2 weapons, 1 armor, 2 cards

// Check primary weapon
const wp = itemsToCreate.find(i => i.name === 'Espada Longa');
assert.equal(wp.type, 'weapon');
assert.equal(wp.data.dice, 8);
assert.equal(wp.data.flat, 2);
assert.equal(wp.data.damageType, 'phy');
assert.equal(wp.data.slot, 'primary');
assert.equal(wp.data.equipped, true);

// Check armor
const arm = itemsToCreate.find(i => i.name === 'Cota de Malha');
assert.equal(arm.type, 'armor');
assert.equal(arm.data.baseMajor, 7);
assert.equal(arm.data.baseSevere, 14);
assert.equal(arm.data.baseScore, 3);
assert.equal(arm.data.slotsMarked, 1);

// Check cards
const c1 = itemsToCreate.find(i => i.name === 'Golpe Mortal');
assert.equal(c1.type, 'domainCard');
assert.equal(c1.data.inLoadout, true);
assert.equal(c1.data.recallCost, 1);

// When legacyMigrated is true, hasLegacyData is false
assert.equal(hasLegacyData({ ...legacyActor, legacyMigrated: true }), false);

console.log('migrate-legacy ok');
