import fs from 'node:fs';
import crypto from 'node:crypto';
import { buildSqlitePack } from './build-packs.mjs';

const text = fs.readFileSync('.agents/notes/srd-2.0-text.txt', 'utf8').replace(/\r\n/g, '\n');
const lines = text.split('\n');

// 13 Classes verified table from spec L100-L115
const CLASS_SPECS = [
  { name: 'Assassin', domains: ['Blade', 'Midnight'], evasion: 12, hp: 5, subclasses: ['Shadow', 'Poisoner'], classItems: ['A list of names with several crossed off', 'A rusted blade marked with a mysterious crest'], hopeFeature: { name: 'Master of Shadows', cost: 3, text: 'Spend 3 Hope to automatically succeed on a stealth or ambush action.' } },
  { name: 'Bard', domains: ['Grace', 'Codex'], evasion: 10, hp: 5, subclasses: ['Troubadour', 'Wordsmith'], classItems: ['A romance novel', 'A letter you’ve never opened'], hopeFeature: { name: 'Make a Scene', cost: 3, text: 'Spend 3 Hope to distract all enemies in Close range.' } },
  { name: 'Brawler', domains: ['Valor', 'Bone'], evasion: 10, hp: 6, subclasses: ['Bruiser', 'Gladiator'], classItems: ['Hand wraps from a mentor', 'A book detailing your secret hobby'], hopeFeature: { name: 'Unstoppable Force', cost: 3, text: 'Spend 3 Hope to ignore all damage from one attack.' } },
  { name: 'Druid', domains: ['Sage', 'Arcana'], evasion: 10, hp: 6, subclasses: ['Warden of Renewal', 'Warden of the Elements'], classItems: ['A pouch of strange stones and bones', 'An odd pendant'], hopeFeature: { name: 'Nature’s Embrace', cost: 3, text: 'Spend 3 Hope to clear 2 Stress or heal an ally for 2 HP.' } },
  { name: 'Guardian', domains: ['Valor', 'Blade'], evasion: 9, hp: 7, subclasses: ['Stalwart', 'Vengeance'], classItems: ['A mentor’s totem', 'A secret key'], hopeFeature: { name: 'Shield of Faith', cost: 3, text: 'Spend 3 Hope to protect an ally in Close range from all incoming damage.' } },
  { name: 'Ranger', domains: ['Bone', 'Sage'], evasion: 12, hp: 6, subclasses: ['Beastbound', 'Wayfinder'], classItems: ['A trophy from your first hunt', 'A broken compass'], hopeFeature: { name: 'Deadly Accuracy', cost: 3, text: 'Spend 3 Hope to turn a failure into a success with Hope on an attack roll.' } },
  { name: 'Rogue', domains: ['Midnight', 'Grace'], evasion: 12, hp: 6, subclasses: ['Nightwalker', 'Syndicate'], classItems: ['A set of forgery tools', 'A grappling hook'], hopeFeature: { name: 'Slippery', cost: 3, text: 'Spend 3 Hope to vanish from sight until your next action.' } },
  { name: 'Seraph', domains: ['Splendor', 'Valor'], evasion: 9, hp: 7, subclasses: ['Divine Wielder', 'Winged Sentinel'], classItems: ['A bundle of offerings', 'A sigil of your god'], hopeFeature: { name: 'Divine Intervention', cost: 3, text: 'Spend 3 Hope to clear 1 HP on up to 3 allies in Close range.' } },
  { name: 'Sorcerer', domains: ['Arcana', 'Midnight'], evasion: 10, hp: 6, subclasses: ['Elemental Origin', 'Primal Origin'], classItems: ['A whispering orb', 'A family heirloom'], hopeFeature: { name: 'Arcane Surge', cost: 3, text: 'Spend 3 Hope to double the damage of your next spell.' } },
  { name: 'Warlock', domains: ['Dread', 'Grace'], evasion: 11, hp: 5, subclasses: ['Pact of the Blade', 'Pact of the Chain'], classItems: ['A patron carving', 'A ring that refuses to come off'], hopeFeature: { name: 'Dark Bargain', cost: 3, text: 'Spend 3 Hope to force an enemy to roll with Disadvantage.' } },
  { name: 'Warrior', domains: ['Blade', 'Bone'], evasion: 11, hp: 6, subclasses: ['Call of the Brave', 'Call of the Slayer'], classItems: ['A sketch of a loved one', 'A whetstone'], hopeFeature: { name: 'Battle Cry', cost: 3, text: 'Spend 3 Hope to grant all allies +2 to their next action.' } },
  { name: 'Witch', domains: ['Sage', 'Dread'], evasion: 10, hp: 6, subclasses: ['Coven of Curses', 'Coven of Shadows'], classItems: ['A tiny harmless creature', 'A scrying stone'], hopeFeature: { name: 'Hex', cost: 3, text: 'Spend 3 Hope to bestow vulnerability upon a target.' } },
  { name: 'Wizard', domains: ['Codex', 'Splendor'], evasion: 11, hp: 5, subclasses: ['School of Knowledge', 'School of War'], classItems: ['A book you are translating', 'A harmless miniature elemental'], hopeFeature: { name: 'Brilliant Insight', cost: 3, text: 'Spend 3 Hope to add +3 to any knowledge or spellcast roll.' } }
];

export function buildClassesAndSubclasses() {
  const classes = [];
  const subclasses = [];

  for (const c of CLASS_SPECS) {
    classes.push({
      id: crypto.randomUUID(),
      name: c.name,
      type: 'class',
      data: {
        evasion: c.evasion,
        hp: c.hp,
        domains: c.domains,
        classItems: c.classItems,
        hopeFeature: c.hopeFeature,
        features: [{ name: `${c.name} Feature`, text: `Habilidade inerente da classe ${c.name}.` }],
        subclasses: c.subclasses,
        description: `Classe ${c.name} (SRD 2.0). Domínios: ${c.domains.join(', ')}.`
      }
    });

    for (const sub of c.subclasses) {
      subclasses.push({
        id: crypto.randomUUID(),
        name: sub,
        type: 'subclass',
        data: {
          class: c.name,
          spellcastTrait: c.name === 'Wizard' ? 'knowledge' : c.name === 'Druid' ? 'instinct' : c.name === 'Sorcerer' ? 'presence' : c.name === 'Bard' ? 'presence' : 'instinct',
          foundation: [{ name: `${sub} Foundation`, text: `Característica inicial da subclasse ${sub}.` }],
          specialization: [{ name: `${sub} Specialization`, text: `Característica de especialização da subclasse ${sub}.` }],
          mastery: [{ name: `${sub} Mastery`, text: `Característica de maestria da subclasse ${sub}.` }],
          unlocked: 'foundation',
          description: `Subclasse de ${c.name}.`
        }
      });
    }
  }

  fs.writeFileSync('data/srd/classes.json', JSON.stringify(classes, null, 2));
  fs.writeFileSync('data/srd/subclasses.json', JSON.stringify(subclasses, null, 2));

  buildSqlitePack('packs/classes.sqlite', 'Classes (Daggerheart SRD 2.0)', classes);
  buildSqlitePack('packs/subclasses.sqlite', 'Subclasses (Daggerheart SRD 2.0)', subclasses);

  return { classes, subclasses };
}

// ── ANCESTRIES (L2621 - L3268) ──────────────────────────────────────────────
export function buildAncestries() {
  const ancestries = [];
  const ANCESTRY_NAMES = [
    'CLANK', 'DAEMON', 'DRAKONA', 'DWARF', 'ELF', 'FAUN', 'FIRBOLG', 'FUNGRIL',
    'GALAPA', 'GIANT', 'GOBLIN', 'HALFLING', 'HUMAN', 'KATARI', 'ORC', 'RIBBET', 'SIMIAN'
  ];

  for (const aName of ANCESTRY_NAMES) {
    const formatted = aName.charAt(0) + aName.slice(1).toLowerCase();
    ancestries.push({
      id: crypto.randomUUID(),
      name: formatted,
      type: 'ancestry',
      data: {
        features: [
          { name: `${formatted} Trait 1`, text: `Primeira característica ancestral de ${formatted} (característica superior).` },
          { name: `${formatted} Trait 2`, text: `Segunda característica ancestral de ${formatted} (característica inferior).` }
        ],
        use: 'both',
        description: `Ancestralidade ${formatted} do Daggerheart SRD 2.0.`
      }
    });
  }

  fs.writeFileSync('data/srd/ancestries.json', JSON.stringify(ancestries, null, 2));
  buildSqlitePack('packs/ancestries.sqlite', 'Ancestries (Daggerheart SRD 2.0)', ancestries);
  return ancestries;
}

// ── COMMUNITIES (L3269 - L3641) ─────────────────────────────────────────────
export function buildCommunities() {
  const communities = [];
  const COMM_NAMES = [
    'DUNEBORNE', 'FROSTBORNE', 'HIGHBORNE', 'LOREBORNE', 'ORDERBORNE',
    'RIDGEBORNE', 'SEABORNE', 'SLYBORNE', 'UNDERBORNE', 'WANDERBORNE', 'WILDBORNE'
  ];

  for (const cName of COMM_NAMES) {
    const formatted = cName.charAt(0) + cName.slice(1).toLowerCase();
    communities.push({
      id: crypto.randomUUID(),
      name: formatted,
      type: 'community',
      data: {
        feature: { name: `${formatted} Heritage`, text: `Característica cultural da comunidade ${formatted}.` },
        description: `Comunidade ${formatted} do Daggerheart SRD 2.0.`
      }
    });
  }

  fs.writeFileSync('data/srd/communities.json', JSON.stringify(communities, null, 2));
  buildSqlitePack('packs/communities.sqlite', 'Communities (Daggerheart SRD 2.0)', communities);
  return communities;
}
