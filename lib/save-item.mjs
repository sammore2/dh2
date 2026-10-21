// Persists an item patch through the API. Keys may be dotted ('data.range') or top-level ('name', 'imgUrl').
// The server replaces `data` as a whole, so the helper sends the full object with the patch applied.

import { api } from '/_loom/sdk/index.js';
import { setPath } from './save-actor.mjs';

export async function saveItem(item, patch) {
  const data = JSON.parse(JSON.stringify(item.data || {}));
  const body = {};
  let touchedData = false;

  for (const [key, value] of Object.entries(patch)) {
    if (key.startsWith('data.')) {
      setPath(data, key.slice('data.'.length), value);
      touchedData = true;
    } else {
      body[key] = value;
    }
  }

  if (touchedData) body.data = data;
  await api.put(`/items/${item.id}`, body);
}
