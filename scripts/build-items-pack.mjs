import fs from 'node:fs';
import crypto from 'node:crypto';
import { buildSqlitePack } from './build-packs.mjs';

const text = fs.readFileSync('.agents/notes/srd-2.0-text.txt', 'utf8').replace(/\r\n/g, '\n');
const lines = text.split('\n');

export function buildItemsPack() {
  const items = [];

  // 1. Consumables (L6480 - L7098)
  for (let i = 6480; i < 7098; i++) {
    const line = lines[i].trim();
    // Entry format: Roll digits followed by Name, e.g. "01Stride PotionYou gain..."
    const m = line.match(/^(\d{2})([A-Z][a-zA-Z\s]+?)(You |Clear |When |Place |Choose |Make |This |Spend |A |An |Roll )/);
    if (m) {
      const name = m[2].trim();
      let desc = (m[3] + line.slice(m[0].length)).trim();
      let nextIdx = i + 1;
      while (nextIdx < 7098 && lines[nextIdx] && !lines[nextIdx].match(/^(\d{2})[A-Z]/) && !lines[nextIdx].startsWith('ROLL') && !lines[nextIdx].startsWith('Core Set') && !lines[nextIdx].startsWith('CONSUMABLES')) {
        desc += ' ' + lines[nextIdx].trim();
        nextIdx++;
      }
      i = nextIdx - 1;

      items.push({
        id: crypto.randomUUID(),
        name,
        type: 'consumable',
        data: {
          quantity: 1,
          description: desc,
        }
      });
    }
  }

  // 2. Loot items (L6169 - L6479)
  for (let i = 6169; i < 6479; i++) {
    const line = lines[i].trim();
    const m = line.match(/^(\d{2})([A-Z][a-zA-Z\s]+?)(You |A |An |This |When |Spend |Small |Heavy |Odd |Strange )/);
    if (m) {
      const name = m[2].trim();
      let desc = (m[3] + line.slice(m[0].length)).trim();
      let nextIdx = i + 1;
      while (nextIdx < 6479 && lines[nextIdx] && !lines[nextIdx].match(/^(\d{2})[A-Z]/) && !lines[nextIdx].startsWith('ROLL') && !lines[nextIdx].startsWith('LOOT') && !lines[nextIdx].startsWith('Core Set')) {
        desc += ' ' + lines[nextIdx].trim();
        nextIdx++;
      }
      i = nextIdx - 1;

      items.push({
        id: crypto.randomUUID(),
        name,
        type: 'equipment',
        data: {
          quantity: 1,
          description: desc,
        }
      });
    }
  }

  fs.writeFileSync('data/srd/items.json', JSON.stringify(items, null, 2));
  buildSqlitePack('packs/items.sqlite', 'Items & Loot (Daggerheart SRD 2.0)', items);
  return items;
}
