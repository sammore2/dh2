import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const text = fs.readFileSync('.agents/notes/srd-2.0-text.txt', 'utf8').replace(/\r\n/g, '\n');
const lines = text.split('\n');

fs.mkdirSync('data/srd', { recursive: true });

// ── 1. ARMORS (L6029 - L6168) ────────────────────────────────────────────────
export function extractArmors() {
  const armors = [];
  let tier = 1;

  for (let i = 6028; i < 6168; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith('TIER ')) {
      const m = line.match(/TIER (\d+)/);
      if (m) tier = parseInt(m[1], 10);
      continue;
    }
    // Match line: e.g. "Gambeson Armor5 / 113Flexible: +1 to Evasion"
    // Name + (Major / Severe) + Score + Feature
    const match = line.match(/^(.+?)(\d+)\s*\/\s*(\d+)(\d+)(.*)$/);
    if (match) {
      const name = match[1].trim();
      const baseMajor = parseInt(match[2], 10);
      const baseSevere = parseInt(match[3], 10);
      const baseScore = parseInt(match[4], 10);
      let featureRaw = match[5].trim();
      
      // Lookahead lines if feature wraps
      let nextIdx = i + 1;
      while (nextIdx < 6168 && lines[nextIdx] && !lines[nextIdx].match(/^(.+?)(\d+)\s*\/\s*(\d+)(\d+)/) && !lines[nextIdx].startsWith('TIER') && !lines[nextIdx].startsWith('Name') && !lines[nextIdx].startsWith('Thresholds') && !lines[nextIdx].startsWith('Base')) {
        featureRaw += ' ' + lines[nextIdx].trim();
        nextIdx++;
      }
      i = nextIdx - 1;

      let featureName = '';
      let featureText = featureRaw;
      if (featureRaw === '—' || featureRaw === '-') {
        featureName = '';
        featureText = '';
      } else if (featureRaw.includes(':')) {
        const parts = featureRaw.split(':');
        featureName = parts[0].trim();
        featureText = parts.slice(1).join(':').trim();
      }

      // Modifiers check
      const modifiers = { evasion: 0, traits: {}, thresholds: 0 };
      if (/([+-−–]\d+)\s*to\s*Evasion/i.test(featureText)) {
        const evMatch = featureText.match(/([+-−–]\d+)\s*to\s*Evasion/i);
        modifiers.evasion = parseInt(evMatch[1].replace(/[−–]/, '-'), 10);
      }
      for (const t of ['agility', 'strength', 'finesse', 'instinct', 'presence', 'knowledge']) {
        const re = new RegExp(`([+-−–]\\d+)\\s*to\\s*${t}`, 'i');
        if (re.test(featureText)) {
          const tMatch = featureText.match(re);
          modifiers.traits[t] = parseInt(tMatch[1].replace(/[−–]/, '-'), 10);
        }
      }

      armors.push({
        id: crypto.randomUUID(),
        name,
        type: 'armor',
        data: {
          tier,
          baseMajor,
          baseSevere,
          baseScore,
          modifiers,
          feature: { name: featureName, text: featureText },
          equipped: false,
          slotsMarked: 0,
          description: featureRaw !== '—' ? featureRaw : '',
        }
      });
    }
  }

  fs.writeFileSync('data/srd/armors.json', JSON.stringify(armors, null, 2));
  return armors;
}

// ── 2. WEAPONS (L4862 - L6003) ───────────────────────────────────────────────
export function extractWeapons() {
  const weapons = [];
  const traits = ['Agility', 'Strength', 'Finesse', 'Instinct', 'Presence', 'Knowledge'];
  const ranges = ['Melee', 'Very Close', 'Close', 'Far', 'Very Far'];
  let tier = 1;
  let category = 'primary';

  for (let i = 4861; i < 6003; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.includes('SECONDARY WEAPON TABLES')) {
      category = 'secondary';
      continue;
    }
    if (line.startsWith('TIER ')) {
      const m = line.match(/TIER (\d+)/);
      if (m) tier = parseInt(m[1], 10);
      continue;
    }

    // NameTraitRangeDamageBurdenFeature
    // Test for trait + range presence
    for (const tr of traits) {
      for (const rng of ranges) {
        const pattern = tr + rng;
        const pIdx = line.indexOf(pattern);
        if (pIdx > 0) {
          const name = line.slice(0, pIdx).trim();
          if (name === 'Name') continue; // header
          const rest = line.slice(pIdx + pattern.length).trim();
          // rest: DamageBurdenFeature, e.g. "d8 phyOne-HandedReliable: +1 to attack rolls"
          const dmgMatch = rest.match(/^(d\d+(?:\s*[+-]\s*\d+)?)\s*(phy|mag)(One-Handed|Two-Handed)(.*)$/);
          if (dmgMatch) {
            const rawDmg = dmgMatch[1];
            const damageType = dmgMatch[2];
            const burden = dmgMatch[3] === 'Two-Handed' ? 'two' : 'one';
            let featureRaw = dmgMatch[4].trim();

            let nextIdx = i + 1;
            while (nextIdx < 6003 && lines[nextIdx] && !traits.some(t => ranges.some(r => lines[nextIdx].includes(t + r))) && !lines[nextIdx].startsWith('TIER') && !lines[nextIdx].startsWith('SECONDARY') && !lines[nextIdx].startsWith('PRIMARY') && !lines[nextIdx].startsWith('Physical') && !lines[nextIdx].startsWith('Magic')) {
              featureRaw += ' ' + lines[nextIdx].trim();
              nextIdx++;
            }
            i = nextIdx - 1;

            const diceMatch = rawDmg.match(/d(\d+)/);
            const dice = diceMatch ? parseInt(diceMatch[1], 10) : 8;
            const flatMatch = rawDmg.match(/([+-])\s*(\d+)/);
            let flat = 0;
            if (flatMatch) {
              flat = parseInt(flatMatch[2], 10) * (flatMatch[1] === '-' ? -1 : 1);
            }

            let featureName = '';
            let featureText = featureRaw;
            if (featureRaw === '—' || featureRaw === '-') {
              featureName = '';
              featureText = '';
            } else if (featureRaw.includes(':')) {
              const p = featureRaw.split(':');
              featureName = p[0].trim();
              featureText = p.slice(1).join(':').trim();
            }

            weapons.push({
              id: crypto.randomUUID(),
              name,
              type: 'weapon',
              data: {
                tier,
                category,
                trait: tr.toLowerCase(),
                range: rng,
                dice,
                flat,
                damageType,
                burden,
                feature: { name: featureName, text: featureText },
                equipped: false,
                slot: 'inventory',
                description: featureRaw !== '—' ? featureRaw : '',
              }
            });
          }
        }
      }
    }
  }

  fs.writeFileSync('data/srd/weapons.json', JSON.stringify(weapons, null, 2));
  return weapons;
}

// ── 3. DOMAIN CARDS (L18589+) ───────────────────────────────────────────────
export function extractDomainCards() {
  const cards = [];
  const domainHeaders = [
    'ARCANA DOMAIN', 'BLADE DOMAIN', 'BONE DOMAIN', 'CODEX DOMAIN', 'GRACE DOMAIN',
    'MIDNIGHT DOMAIN', 'SAGE DOMAIN', 'SPLENDOR DOMAIN', 'VALOR DOMAIN', 'DREAD DOMAIN'
  ];

  let currentDomain = 'Arcana';
  for (let i = 18588; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    for (const dh of domainHeaders) {
      if (line.startsWith(dh)) {
        currentDomain = dh.replace(' DOMAIN', '').trim();
      }
    }

    // A card title is in all-caps, followed on next line by "Level X <Domain> <Type>"
    if (i + 1 < lines.length && /^Level\s+(\d+)\s+([A-Za-z]+)\s+(Ability|Spell|Grimoire)/i.test(lines[i + 1].trim())) {
      const name = line;
      const headerLine = lines[i + 1].trim();
      const m = headerLine.match(/^Level\s+(\d+)\s+([A-Za-z]+)\s+(Ability|Spell|Grimoire)/i);
      const level = parseInt(m[1], 10);
      const domain = m[2];
      const type = m[3].toLowerCase();

      let recallCost = 1;
      let textLines = [];
      let nextIdx = i + 2;

      if (nextIdx < lines.length && lines[nextIdx].trim().startsWith('Recall Cost:')) {
        const rcMatch = lines[nextIdx].trim().match(/Recall Cost:\s*(\d+)/i);
        if (rcMatch) recallCost = parseInt(rcMatch[1], 10);
        nextIdx++;
      }

      while (nextIdx < lines.length) {
        const nextLine = lines[nextIdx].trim();
        // Check if next is another card title
        if (nextIdx + 1 < lines.length && /^Level\s+(\d+)\s+([A-Za-z]+)\s+(Ability|Spell|Grimoire)/i.test(lines[nextIdx + 1].trim())) {
          break;
        }
        if (domainHeaders.some(dh => nextLine.startsWith(dh))) {
          break;
        }
        if (nextLine) textLines.push(nextLine);
        nextIdx++;
      }

      i = nextIdx - 1;

      cards.push({
        id: crypto.randomUUID(),
        name,
        type: 'domainCard',
        data: {
          domain,
          level,
          type,
          recallCost,
          text: textLines.join('\n'),
          inLoadout: true,
        }
      });
    }
  }

  fs.writeFileSync('data/srd/domain-cards.json', JSON.stringify(cards, null, 2));
  return cards;
}

// ── SQLite Builder ───────────────────────────────────────────────────────────
export function buildSqlitePack(sqlitePath, packName, entries) {
  if (fs.existsSync(sqlitePath)) fs.unlinkSync(sqlitePath);
  const db = new DatabaseSync(sqlitePath);

  db.exec(`
    CREATE TABLE pack_meta (
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      locked INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      folderId TEXT,
      sortOrder INTEGER DEFAULT 0
    );
    CREATE TABLE entries (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      sortOrder INTEGER DEFAULT 0,
      imgUrl TEXT,
      data TEXT NOT NULL,
      folderId TEXT
    );
  `);

  db.prepare('INSERT INTO pack_meta (name, type, locked) VALUES (?, ?, ?)').run(packName, 'Item', 1);

  const insertStmt = db.prepare('INSERT INTO entries (id, name, type, sortOrder, imgUrl, data, folderId) VALUES (?, ?, ?, ?, ?, ?, ?)');

  db.exec('BEGIN TRANSACTION');
  for (let idx = 0; idx < entries.length; idx++) {
    const e = entries[idx];
    insertStmt.run(e.id, e.name, e.type, idx, e.imgUrl || '', JSON.stringify(e.data), null);
  }
  db.exec('COMMIT');
  db.close();
}
