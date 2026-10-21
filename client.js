import { SystemRegistry, defineSystem, dispatchRoll, getWraps } from '/_loom/sdk/index.js';
import { DaggerheartCharacterSheet } from './sheets/character-sheet.mjs';
import { DaggerheartAdversarySheet } from './sheets/adversary-sheet.mjs';
import { DaggerheartItemSheet } from './sheets/item-sheet.mjs';
import { renderDaggerheartRollCard, registerChatCardListeners } from './cards/roll-card.mjs';
import { initFearTracker } from './lib/fear-tracker.mjs';
import { deriveCharacter } from './lib/derive.mjs';

// ── Custom Actor Document Class ──────────────────────────────────────────────
class DaggerheartActor extends CONFIG.Actor.documentClass {
  prepareData() {
    return super.prepareData();
  }

  prepareDerivedData() {
    super.prepareDerivedData();
    if (this.type === 'character' && this.systemData) {
      this.systemData.derived = deriveCharacter(this.systemData, this.items ?? []);
    }
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
  for (const t of ['class', 'subclass', 'ancestry', 'community']) sheets.catalog('item', t, DaggerheartItemSheet);
  sheets.catalog('item', 'consumable', DaggerheartItemSheet);
  sheets.catalog('item', 'equipment', DaggerheartItemSheet);
}

// ── Intercept Roll Cards (Duality Dice & Daggerheart Theme) ──────────────────
const wraps = getWraps();
if (wraps?.renderRollCard) {
  wraps.renderRollCard.wrap((original, roll, esc) => {
    return renderDaggerheartRollCard(roll, esc, original);
  });
}

// Global click delegation for interactive chat card buttons
registerChatCardListeners();

// ── GM Fear Tracker HUD ──────────────────────────────────────────────────────
try {
  initFearTracker();
} catch (err) {
  console.warn('FearTracker init delayed:', err);
}

// ── System Registration ──────────────────────────────────────────────────────
SystemRegistry.register(defineSystem({
  id: 'dh',
  title: 'Daggerheart',
  version: '0.1.0',

  actorTypes: ['character', 'adversary', 'npc'],
  itemTypes: ['weapon', 'armor', 'domainCard', 'class', 'subclass', 'ancestry', 'community', 'consumable', 'equipment', 'feature'],

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
          { name: '', modifier: 2 },
          { name: '', modifier: 2 },
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
        role: 'Standard',
        hp: { value: 0, max: 6 },
        stress: { value: 0, max: 3 },
        thresholds: {
          major: 8,
          severe: 15,
        },
        motives: '',
        attacks: [
          { name: 'Attack 1', range: 'Melee', damage: '1d8+2', damageType: 'physical', feature: '' }
        ],
        fearFeatures: [
          { name: 'Special Ability', cost: 1, description: '' }
        ],
        experiences: [
          { name: '', modifier: 0 }
        ],
      };
    }

    const none = { name: '', text: '' };
    const items = {
      class: { evasion: 10, hp: 6, domains: ['', ''], classItems: ['', ''], hopeFeature: { name: '', cost: 3, text: '' }, features: [], subclasses: [], description: '' },
      subclass: { class: '', spellcastTrait: '', foundation: [], specialization: [], mastery: [], unlocked: 'foundation', description: '' },
      ancestry: { features: [{ ...none }, { ...none }], use: 'both', description: '' },
      community: { feature: { ...none }, description: '' },
      weapon: { tier: 1, category: 'primary', trait: 'agility', range: 'Melee', dice: 8, flat: 0, damageType: 'phy', burden: 'one', feature: { ...none }, equipped: false, slot: 'inventory', description: '' },
      armor: { tier: 1, baseMajor: 5, baseSevere: 11, baseScore: 3, modifiers: { evasion: 0, traits: {}, thresholds: 0 }, feature: { ...none }, equipped: false, slotsMarked: 0, description: '' },
      domainCard: { domain: '', level: 1, type: 'ability', recallCost: 1, text: '', inLoadout: true },
      consumable: { quantity: 1, description: '' },
      equipment: { quantity: 1, description: '' },
    };
    return items[type] ?? {};
  },

  // The sheet runs ONLY this hook when a system registers it (the Loom core never reaches DaggerheartActor.prepareDerivedData),
  // so the derived values have to be computed here.
  prepareData(actor) {
    if (actor?.type === 'character' && actor.systemData) {
      actor.systemData.derived = deriveCharacter(actor.systemData, actor.items ?? []);
    }
  },
}));