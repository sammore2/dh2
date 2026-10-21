// Tokens the user has targeted on the map: they ride along with a roll and receive its damage.
import { api } from '/_loom/sdk/index.js';
import { setPath } from './save-actor.mjs';

const actorOf = (cast) => (cast.actorId ? window.Loom?.actors?.get?.(cast.actorId) : null);

/** Targeted tokens as { id, name, difficulty } (difficulty prefills the roll dialog when the target is an adversary). */
export function currentTargets() {
  return Array.from(window.Loom?.user?.targets ?? []).map((c) => {
    const data = (c.isLinked && actorOf(c)?.systemData) || c.systemData || actorOf(c)?.systemData || {};
    return { id: c.id, name: c.name || actorOf(c)?.name || 'Alvo', difficulty: data.difficulty ?? null };
  });
}

/**
 * Loads a target token as what the damage engine needs: an actor-like object plus how to save it.
 * A linked token is its actor; an unlinked one (usual for adversaries) keeps its own data on the token.
 */
export async function loadTarget(castId) {
  const cast = await api.get(`/cast/${castId}`);
  if (!cast) return null;
  const actor = cast.isLinked && cast.actorId ? (actorOf(cast) ?? await api.get(`/actors/${cast.actorId}`)) : null;
  if (actor) return { name: cast.name || actor.name, actor, save: null };

  const systemData = cast.systemData || {};
  return {
    name: cast.name || 'Alvo',
    actor: { id: cast.id, name: cast.name, systemData, items: [] },
    // The token PUT replaces systemData as a whole, so send it complete with the patch applied.
    save: async (_actor, patch) => {
      const next = { systemData: JSON.parse(JSON.stringify(systemData)) };
      for (const [key, value] of Object.entries(patch)) setPath(next, key, value);
      await api.put(`/cast/${cast.id}`, { systemData: next.systemData });
    },
  };
}
