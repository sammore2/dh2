import { SystemRegistry, defineSystem, dispatchRoll } from '/_loom/sdk/index.js';
import { DaggerheartCharacterSheet } from './sheets/character-sheet.mjs';
import { DaggerheartAdversarySheet } from './sheets/adversary-sheet.mjs';
import { DaggerheartItemSheet } from './sheets/item-sheet.mjs';

// ── Custom Actor Document Class ──────────────────────────────────────────────
class DaggerheartActor extends CONFIG.Actor.documentClass {
  prepareData() {
    return super.prepareData();
  }

  prepareDerivedData() {
    super.prepareDerivedData();
    const sys = this.systemData;
    if (!sys) return;

    // Isolate all calculated/derived data inside systemData.derived
    const agi = Number(sys.attributes?.agility || 0);
    const lvl = Number(sys.level || 1);
    const armorScore = Number(sys.armor?.score || 0);

    // Daggerheart SRD 2.0: Level scales thresholds
    const baseMajor = Number(sys.thresholds?.baseMajor || 7);
    const baseSevere = Number(sys.thresholds?.baseSevere || 14);

    sys.derived = {
      ...(sys.derived || {}),
      evasion: Number(sys.evasionBase || 8) + agi + Number(sys.evasionBonus || 0),
      armorScore: armorScore,
      thresholdMinorDesc: '1 HP',
      thresholdMajor: baseMajor + lvl + Number(sys.thresholds?.majorBonus || 0),
      thresholdSevere: baseSevere + lvl + Number(sys.thresholds?.severeBonus || 0),
    };
  }
}

CONFIG.Actor.documentClass = DaggerheartActor;

// ── Register Custom Handlebars Sheets ────────────────────────────────────────
const { sheets } = window.Loom;
if (sheets) {
  sheets.catalog('actor', 'character', DaggerheartCharacterSheet);
  sheets.catalog('actor', 'adversary', DaggerheartAdversarySheet);
  sheets.catalog('item', 'weapon', DaggerheartItemSheet);
  sheets.catalog('item', 'armor', DaggerheartItemSheet);
  sheets.catalog('item', 'domainCard', DaggerheartItemSheet);
  sheets.catalog('item', 'feature', DaggerheartItemSheet);
  sheets.catalog('item', 'consumable', DaggerheartItemSheet);
  sheets.catalog('item', 'equipment', DaggerheartItemSheet);
}

// ── System Registration ──────────────────────────────────────────────────────
SystemRegistry.register(defineSystem({
  id: 'dh',
  title: 'Daggerheart',
  version: '0.1.0',

  actorTypes: ['character', 'adversary', 'npc'],
  itemTypes: ['weapon', 'armor', 'domainCard', 'feature', 'consumable', 'equipment'],

  getDefaultData(type) {
    if (type === 'character') {
      return {
        pronouns: '',
        heritage: '',
        class: '',
        subclass: '',
        level: 1,
        tier: 1,
        evasionBase: 8,
        evasionBonus: 0,
        hp: { value: 0, max: 6 },
        stress: { value: 0, max: 6 },
        hope: { value: 2, max: 6 },
        attributes: {
          agility: 0,
          strength: 0,
          finesse: 0,
          instinct: 0,
          presence: 0,
          knowledge: 0,
        },
        armor: {
          score: 0,
          slots: 6,
          slotsMarked: 0,
        },
        thresholds: {
          baseMajor: 7,
          baseSevere: 14,
          majorBonus: 0,
          severeBonus: 0,
        },
        proficiency: 1,
        weapons: {
          primary: {
            name: '',
            trait: 'agility',
            range: 'Melee',
            damage: '1d8',
            damageType: 'physical',
            feature: '',
          },
          secondary: {
            name: '',
            trait: 'strength',
            range: 'Very Close',
            damage: '1d6',
            damageType: 'physical',
            feature: '',
          },
        },
        activeArmor: {
          name: '',
          baseThresholds: '7 / 14',
          baseScore: 0,
          feature: '',
        },
        hopeFeature: '',
        classFeature: '',
        experiences: [
          { name: '', modifier: 0 },
          { name: '', modifier: 0 },
          { name: '', modifier: 0 },
          { name: '', modifier: 0 },
          { name: '', modifier: 0 },
        ],
        gold: {
          handfuls: 0,
          bags: 0,
          chest: false,
        },
        inventoryNotes: '',
        notes: '',
      };
    }

    if (type === 'adversary') {
      return {
        tier: 1,
        difficulty: 10,
        hp: { value: 0, max: 6 },
        stress: { value: 0, max: 3 },
        thresholds: {
          major: 8,
          severe: 15,
        },
        motives: '',
        attacks: [],
        fearFeatures: '',
      };
    }

    return {};
  },

  prepareData(actor) {
    if (actor?.systemData) {
      actor.systemData.derived = {
        ...(actor.systemData.derived || {}),
      };
    }
  },
}));