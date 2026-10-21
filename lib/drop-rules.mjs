// Pure drop rules (SRD 2.0): what happens when a compendium entry is dropped on a character.
// actor = { level, items: [{ id, type, name, data }], derived: { domains, spellcastTrait } }
// Result: { ok:false, reason } or { ok:true, patch, warn?, updates?: [{ id, data }], skipCreate? }
// `updates` are changes to items already on the actor (unequip armor, ancestry top/bottom, merged quantity).

const tierOf = (level) => (level <= 1 ? 1 : level <= 4 ? 2 : level <= 7 ? 3 : 4);
const same = (a, b) => String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase();
const no = (reason) => ({ ok: false, reason });

export function checkDrop(type, source, actor) {
  const data = typeof source.data === 'string' ? JSON.parse(source.data) : { ...(source.data ?? {}) };
  const items = actor.items ?? [];
  const ofType = (t) => items.filter((i) => i.type === t);
  const level = Number(actor.level ?? 1);
  const ok = (patch, extra) => ({ ok: true, patch, ...extra });

  switch (type) {
    case 'class':
      return ofType('class').length ? no('Esta ficha já tem uma classe') : ok(data);

    case 'subclass': {
      const cls = ofType('class')[0];
      if (!cls) return no('Arraste uma classe antes da subclasse');
      if (ofType('subclass').length) return no('Esta ficha já tem uma subclasse');
      if (!same(data.class, cls.name)) return no(`Esta subclasse é de ${data.class}, não de ${cls.name}`);
      return ok({ ...data, unlocked: 'foundation' });
    }

    case 'ancestry': {
      const have = ofType('ancestry');
      if (have.length >= 2) return no('A ficha já tem duas ancestralidades');
      if (!have.length) return ok({ ...data, use: 'both' });
      // mixed ancestry: first keeps the top feature, the new one gives the bottom feature
      return ok({ ...data, use: 'bottom' }, { updates: [{ id: have[0].id, data: { ...have[0].data, use: 'top' } }] });
    }

    case 'community':
      return ofType('community').length ? no('Esta ficha já tem uma comunidade') : ok(data);

    case 'weapon': {
      if (Number(data.tier ?? 1) > tierOf(level)) return no('Arma de tier maior que o do personagem');
      const weapons = ofType('weapon');
      const slotOf = (w) => w.data?.slot ?? 'inventory';
      const hands = weapons.filter((w) => slotOf(w) !== 'inventory').reduce((n, w) => n + (w.data?.burden === 'two' ? 2 : 1), 0);
      const need = data.burden === 'two' ? 2 : 1;
      const slotFree = !weapons.some((w) => slotOf(w) === data.category);
      const magicBlocked = data.damageType === 'mag' && !actor.derived?.spellcastTrait;
      if (slotFree && hands + need <= 2 && !magicBlocked) return ok({ ...data, slot: data.category, equipped: true });
      if (weapons.filter((w) => slotOf(w) === 'inventory').length >= 2) return no('Inventário de armas cheio');
      return ok({ ...data, slot: 'inventory', equipped: false }, magicBlocked ? { warn: 'Arma mágica sem traço de Spellcast: foi para o inventário' } : {});
    }

    case 'armor': {
      if (Number(data.tier ?? 1) > tierOf(level)) return no('Armadura de tier maior que o do personagem');
      const updates = ofType('armor').filter((a) => a.data?.equipped).map((a) => ({ id: a.id, data: { ...a.data, equipped: false } }));
      return ok({ ...data, equipped: true, slotsMarked: 0 }, { updates });
    }

    case 'domainCard': {
      if (!ofType('class').length) return no('Arraste uma classe antes das cartas de domínio');
      if (Number(data.level ?? 1) > level) return no('Carta de nível maior que o do personagem');
      if (!(actor.derived?.domains ?? []).some((d) => same(d, data.domain))) return no('Carta de domínio fora dos domínios da classe');
      const inLoadout = ofType('domainCard').filter((c) => c.data?.inLoadout !== false).length < 5;
      return ok({ ...data, inLoadout }, inLoadout ? {} : { warn: 'Loadout cheio: a carta foi para o Vault' });
    }

    case 'consumable':
    case 'equipment': {
      const dup = ofType(type).find((i) => i.name === source.name);
      if (!dup) return ok(data);
      const quantity = Number(dup.data?.quantity ?? 1) + Number(data.quantity ?? 1);
      return ok(data, { skipCreate: true, updates: [{ id: dup.id, data: { ...dup.data, quantity } }] });
    }

    default:
      return ok(data);
  }
}
