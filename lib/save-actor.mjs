// Persists an actor patch through the API, the way wod20th and srd5e do.
// Patch keys may be dotted ('systemData.hp.value') or top-level ('name', 'avatarUrl').
// The server stores systemData as a whole, so the helper sends the full object with the patch applied,
// without the derived values (they are recalculated on load and must never be persisted).
// The open sheet refreshes when the `actor.updated` event arrives, so the response is not written back to the document.

import { api } from '/_loom/sdk/index.js';

export function setPath(obj, path, value) {
  const keys = path.split('.');
  let node = obj;
  keys.slice(0, -1).forEach((key, i) => {
    if (node[key] === undefined || node[key] === null) node[key] = /^\d+$/.test(keys[i + 1]) ? [] : {};
    node = node[key];
  });
  node[keys.at(-1)] = value;
}

export async function saveActor(actor, patch) {
  const systemData = JSON.parse(JSON.stringify(actor.systemData || {}));
  delete systemData.derived;
  const body = {};
  let touchedSystemData = false;

  for (const [key, value] of Object.entries(patch)) {
    if (key === 'systemData') {
      Object.assign(systemData, value);
      touchedSystemData = true;
    } else if (key.startsWith('systemData.')) {
      setPath(systemData, key.slice('systemData.'.length), value);
      touchedSystemData = true;
    } else {
      body[key] = value;
    }
  }

  if (touchedSystemData) body.systemData = systemData;
  await api.put(`/actors/${actor.id}`, body);
}
