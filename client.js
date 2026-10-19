import { SystemRegistry, defineSystem } from '/_loom/sdk/index.js';
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
    // to prevent the "stuck field" database persistence bug
    const agi = Number(sys.attributes?.agility || 0);
    const lvl = Number(sys.level || 1);

    sys.derived = {
      ...(sys.derived || {}),
      evasion: 8 + agi,
      armorScore: Number(sys.armor?.score || 0),
      thresholdMajor: 7 + lvl,
      thresholdSevere: 14 + lvl,
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
        level: 1,
        tier: 1,
        class: '',
        subclass: '',
        ancestry: '',
        community: '',
        hp: { value: 6, max: 6 },
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
          slots: 0,
          slotsMarked: 0,
        },
        notes: '',
      };
    }

    if (type === 'adversary') {
      return {
        tier: 1,
        difficulty: 10,
        hp: { value: 6, max: 6 },
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

  // Client-side generic prepare hook
  prepareData(actor) {
    if (actor?.systemData) {
      actor.systemData.derived = {
        ...(actor.systemData.derived || {}),
      };
    }
  },
}));