import { LoomActorSheet, LoomHandlebarsMixin, api, dispatchRoll, showToast } from '/_loom/sdk/index.js';
import { attachSideTabs, detachSideTabs } from '../lib/side-tabs.mjs';
import { saveActor } from '../lib/save-actor.mjs';
import { DaggerheartLevelUpDialog } from './level-up-dialog.mjs';
import { DaggerheartItemSheet } from './item-sheet.mjs';
import { hasLegacyData, planLegacyMigration } from '../lib/migrate-legacy.mjs';
import { checkDrop } from '../lib/drop-rules.mjs';
import { addGold } from '../lib/gold.mjs';
import { wireFieldSave } from '../lib/field-save.mjs';
import { TRAIT_LABELS, buildActionRoll, buildDamageFormula, healFormula } from '../lib/action-roll.mjs';
import { askActionRoll, askDamageRoll } from '../lib/roll-dialog.mjs';
import { currentTargets } from '../lib/targets.mjs';

/** Pip rows in the sheet and the document path each one writes. */
const DOT_RESOURCE_PATHS = {
  hp: 'systemData.hp.value',
  stress: 'systemData.stress.value',
  hope: 'systemData.hope.value',
  goldHandfuls: 'systemData.gold.handfuls',
  goldBags: 'systemData.gold.bags',
  goldChest: 'systemData.gold.chest',
};

/** Damage dice = Proficiency; the fixed modifier is not multiplied (SRD 2.0). */
const weaponDamage = (w, prof) => {
  const flat = Number(w.data?.flat ?? 0);
  return `${prof}d${w.data?.dice ?? 6}${flat ? (flat > 0 ? '+' : '') + flat : ''}`;
};

/** Value read when a pip row's field is missing (other rows read 0). */
const DOT_FALLBACKS = { proficiency: 1 };

export class DaggerheartCharacterSheet extends LoomHandlebarsMixin(LoomActorSheet) {
  // Size goes in `position` (the mixin ignores loose width/height); the template goes in PARTS
  static DEFAULT_OPTIONS = { position: { width: 840, height: 980 } };
  static PARTS = { main: { template: '/marketplace/rulesets/dh/templates/character-sheet.hbs' } };

  constructor(props) {
    super({
      ...props,
      // Must match the key windowManager.open uses (`actor-sheet-${actorId}`)
      id: props.id || `actor-sheet-${props.actorId}`,
      documentId: props.actorId,
      title: props.title || 'Personagem',
      showFooter: false,
      classes: ['daggerheart', 'sheet', 'actor', 'character', 'cs-window'],
    });
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const doc = this.document;
    const sys = doc.systemData || {};
    const derived = sys.derived || {};

    // Actors created before a field existed have no value for it; fall back to the defaults
    context.system = {
      ...sys,
      proficiency: sys.proficiency ?? DOT_FALLBACKS.proficiency,
      hp: { value: 0, max: 6, ...sys.hp },
      stress: { value: 0, max: 6, ...sys.stress },
      hope: { value: 2, max: 6, ...sys.hope },
    };
    context.derived = derived;
    context.isEditable = this.isEditable;
    // Loom's generic adventurer icon when the character has no image (same default as wod20th)
    context.portrait = doc.avatarUrl || '/icons/svg/adventurer.svg';

    // Structured traits with labels and paper-sheet subskills
    context.traits = {
      agility: {
        label: 'DH.Traits.Agility',
        subLabel: 'DH.Traits.Sub.Agility',
        value: Number(sys.attributes?.agility || 0),
      },
      strength: {
        label: 'DH.Traits.Strength',
        subLabel: 'DH.Traits.Sub.Strength',
        value: Number(sys.attributes?.strength || 0),
      },
      finesse: {
        label: 'DH.Traits.Finesse',
        subLabel: 'DH.Traits.Sub.Finesse',
        value: Number(sys.attributes?.finesse || 0),
      },
      instinct: {
        label: 'DH.Traits.Instinct',
        subLabel: 'DH.Traits.Sub.Instinct',
        value: Number(sys.attributes?.instinct || 0),
      },
      presence: {
        label: 'DH.Traits.Presence',
        subLabel: 'DH.Traits.Sub.Presence',
        value: Number(sys.attributes?.presence || 0),
      },
      knowledge: {
        label: 'DH.Traits.Knowledge',
        subLabel: 'DH.Traits.Sub.Knowledge',
        value: Number(sys.attributes?.knowledge || 0),
      },
    };

    // ── Domain Cards (Loadout vs Vault) ──────────────────────────────────────
    // Everything below reads from the embedded items (SRD model); the old inline fields are obsolete
    const items = Array.from(doc.items || []);
    const ofType = (t) => items.filter((i) => i.type === t);
    context.classItem = derived.classItem ?? null;
    context.subclassItem = derived.subclassItem ?? null;
    context.ancestryItem = derived.ancestryItem ?? null;
    context.communityItem = derived.communityItem ?? null;
    context.heritageText = [context.ancestryItem?.name, context.communityItem?.name].filter(Boolean).join(' / ');
    const weaponIn = (slot) => ofType('weapon').filter((w) => (w.data?.slot ?? 'inventory') === slot);
    context.weapons = { primary: weaponIn('primary')[0] ?? null, secondary: weaponIn('secondary')[0] ?? null, inventory: weaponIn('inventory').slice(0, 2) };
    context.armor = derived.armorItem ?? null;
    const card = (i) => ({ id: i.id, name: i.name, domain: i.data?.domain, level: i.data?.level, type: i.data?.type, recallCost: i.data?.recallCost, description: i.data?.text ?? '' });
    const cards = ofType('domainCard');
    context.loadout = cards.filter((c) => c.data?.inLoadout !== false).map(card);
    context.vault = cards.filter((c) => c.data?.inLoadout === false).map(card);
    const prof = Number(sys.proficiency ?? DOT_FALLBACKS.proficiency);
    context.weaponRows = ['primary', 'secondary'].map((slot) => {
      const w = context.weapons[slot];
      return { slot, w, damage: w && weaponDamage(w, prof) };
    });
    context.restMode = !!this._rest;
    context.hasLegacyData = hasLegacyData(sys);
    const feats = (list) => (list ?? []).filter((f) => f?.name || f?.text);
    const groups = [];
    const cls = context.classItem;
    if (cls) groups.push({ title: 'Classe: ' + cls.name, list: feats(cls.data?.features) });
    const sub = context.subclassItem;
    if (sub) {
      const u = sub.data?.unlocked ?? 'foundation';
      groups.push({ title: 'Subclasse: ' + sub.name, list: feats([...(sub.data?.foundation ?? []), ...(u !== 'foundation' ? sub.data?.specialization ?? [] : []), ...(u === 'mastery' ? sub.data?.mastery ?? [] : [])]) });
    }
    const ancestries = ofType('ancestry');
    for (const a of ancestries) {
      const f = a.data?.features ?? [];
      const use = a.data?.use ?? 'both';
      groups.push({ title: 'Ancestralidade: ' + a.name, list: feats(use === 'top' ? [f[0]] : use === 'bottom' ? [f[1]] : f), swap: ancestries.length === 2 });
    }
    if (context.communityItem) groups.push({ title: 'Comunidade: ' + context.communityItem.name, list: feats([context.communityItem.data?.feature]) });
    context.featureGroups = groups;
    context.hopeFeature = cls?.data?.hopeFeature?.name ? cls.data.hopeFeature : null;
    context.activeLoadout = context.loadout;
    context.vaultCards = context.vault;
    context.activeLoadoutCount = context.loadout.length;
    context.inventoryItems = [...ofType('consumable'), ...ofType('equipment')]
      .map((i) => ({ id: i.id, name: i.name, data: i.data, canUse: i.type === 'consumable' }));
    context.hpMax = derived.hpMax ?? 6;
    context.stressMax = derived.stressMax ?? 6;
    context.hopeMax = derived.hopeMax ?? 6;

    return context;
  }

  onClose() {
    super.onClose?.();
    detachSideTabs(this);
  }

  // Saves through the API, then reloads: the WebSocket echo can be late or never reach whoever saved.
  // (document.update() only expands `system.*` keys, so `systemData.*` keys were sent to the server as-is and dropped.)
  async _save(patch) {
    try {
      await saveActor(this.document, patch);
      await this._reloadDocument();
    } catch (err) {
      showToast(`Erro ao salvar: ${err?.message || err}`, 'error');
    }
  }

  _onRender(context, options) {
    // The Loom base sheet does not always define _onRender
    super._onRender?.(context, options);
    const html = this.element;
    if (!html) return;

    // Plain form fields (name, level, attributes, notes...) are saved here: the base sheet does not save them
    wireFieldSave(this, (name, value) => {
      if (name === 'name' || name.startsWith('systemData.')) this._save({ [name]: value });
    });

    // The character art is the window banner: the core draws it behind the header and turns the title bar
    // (close, controls) into a transparent layer over it, so the bar reads as part of the sheet.
    const art = this.document?.avatarUrl;
    html.classList.add('window-has-banner');
    html.style.setProperty('--window-banner-url', art ? `url("${art}")` : 'none');

    // ── Tab Navigation ───────────────────────────────────────────────────────
    // The tab dock floats outside the window (lib/side-tabs.mjs). The active tab lives on the
    // instance because any update re-renders the sheet and would otherwise reset it to Combat.
    const tabButtons = html.querySelectorAll('.dh-tab-btn');
    const tabPanes = html.querySelectorAll('.dh-tab-pane');
    const showTab = (tab) => {
      this._activeTab = tab;
      tabButtons.forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
      tabPanes.forEach((p) => p.classList.toggle('active', p.dataset.tab === tab));
    };

    tabButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        showTab(btn.dataset.tab);
      });
    });
    showTab(this._activeTab || 'combat');
    attachSideTabs(this);
    this._attachDropListener();
    this._wireActions();

    html.querySelector('[data-action="levelUp"]')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (this.isEditable === false) return;
      new DaggerheartLevelUpDialog(this.document).render(true);
    });

    html.querySelector('[data-action="migrateLegacy"]')?.addEventListener('click', async (e) => {
      e.preventDefault();
      if (this.isEditable === false) return;
      const itemsToCreate = planLegacyMigration(this.document.systemData);
      if (!itemsToCreate.length) return showToast('Nenhum dado legado para migrar.', 'info');

      if (!window.confirm(`Deseja migrar ${itemsToCreate.length} itens antigos (armas, armadura, cartas) para itens embutidos?`)) return;

      const doc = this.document;
      for (const it of itemsToCreate) {
        await api.post(`/actors/${doc.id}/items`, {
          name: it.name,
          type: it.type,
          imgUrl: '',
          data: it.data,
        });
      }

      await this._save({ 'systemData.legacyMigrated': true });
      showToast(`Migração concluída! ${itemsToCreate.length} itens criados.`, 'success');
      await this._reloadDocument();
    });

    // ── Portrait: opens Loom's art editor ─────────────────────────────────────
    // Not data-action="pick-portrait": the base sheet handles that name by opening the file picker
    html.querySelector('[data-portrait-edit]')?.addEventListener('click', (e) => {
      e.preventDefault();
      this._editPortrait();
    });

    // ── Trait Duality Roll Buttons ───────────────────────────────────────────
    const traitButtons = html.querySelectorAll('.dh-trait-score-btn');
    traitButtons.forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const traitKey = btn.dataset.trait;
        const traitVal = this.document.systemData?.derived?.traitMod?.[traitKey] ?? Number(this.document.systemData?.attributes?.[traitKey] ?? 0);
        await this._rollDuality(traitKey, traitVal);
      });
    });

    // ── Weapon Attack & Damage Rolls ─────────────────────────────────────────
    const weaponOf = (slot) => {
      const w = Array.from(this.document.items || []).find((i) => i.type === 'weapon' && i.data?.slot === slot);
      if (!w) return null;
      const prof = Number(this.document.systemData?.proficiency ?? DOT_FALLBACKS.proficiency);
      return { name: w.name, trait: w.data.trait, damage: weaponDamage(w, prof), damageType: w.data.damageType === 'mag' ? 'magic' : 'physical' };
    };
    html.querySelectorAll('[data-action="rollWeaponAttack"]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const w = weaponOf(btn.dataset.slot);
        if (!w) return;
        const trait = w.trait || 'agility';
        const mod = this.document.systemData?.derived?.traitMod?.[trait] ?? 0;
        await this._rollDuality(trait, mod, { name: w.name, damage: w.damage, damageType: w.damageType });
      });
    });
    html.querySelectorAll('[data-action="rollWeaponDamage"]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const w = weaponOf(btn.dataset.slot);
        if (!w) return;
        const targets = currentTargets();
        dispatchRoll({
          formula: w.damage,
          actorId: this.document.id,
          meta: {
            system: 'Daggerheart', rollType: 'damage', weapon: w.name, damageType: w.damageType,
            targets: targets.map((t) => t.id), targetNames: targets.map((t) => t.name),
          },
        });
      });
    });

    // ── Interactive Dot / Pip Handlers ───────────────────────────────────────
    // HP, Stress, Hope, Proficiency, Gold Handfuls, Gold Bags
    const dotsRows = html.querySelectorAll('.dh-dots-row');
    dotsRows.forEach((row) => {
      const resource = row.dataset.resource;
      const dots = row.querySelectorAll('.dh-dot');

      dots.forEach((dot) => {
        dot.addEventListener('click', async (e) => {
          e.preventDefault();
          if (this.isEditable === false) return;
          const index = parseInt(dot.dataset.index, 10);

          if (resource === 'goldHandfuls' || resource === 'goldBags' || resource === 'goldChest') {
            const cat = resource === 'goldHandfuls' ? 'handfuls' : resource === 'goldBags' ? 'bags' : 'chest';
            const r = addGold(this.document.systemData?.gold ?? {}, cat, index);
            if (!r.ok) return showToast(r.reason, 'warning');
            await this._save({ 'systemData.gold': r.gold });
            return;
          }

          const path = DOT_RESOURCE_PATHS[resource];
          if (path) {
            const currentVal = Number(path.split('.').reduce((o, k) => o?.[k], this.document) ?? DOT_FALLBACKS[resource] ?? 0);
            const newVal = (index + 1 === currentVal) ? index : index + 1;
            dots.forEach((d, i) => d.classList.toggle('marked', i < newVal));
            await this._save({ [path]: newVal });
          }
        });
      });
    });

    // Armor Slots Pips (no armor, no pips: Armor Score is 0)
    html.querySelectorAll('.dh-armor-pip').forEach((pip) => {
      pip.addEventListener('click', async (e) => {
        e.preventDefault();
        if (this.isEditable === false) return;
        const armor = Array.from(this.document.items || []).find((i) => i.type === 'armor' && i.data?.equipped);
        if (!armor) return;
        const index = parseInt(pip.dataset.index, 10);
        const marked = Number(armor.data.slotsMarked ?? 0);
        await api.put('/items/' + armor.id, { data: { ...armor.data, slotsMarked: index + 1 === marked ? index : index + 1 } });
        await this._reloadDocument();
      });
    });

    // ── Experience Use Button (Spend 1 Hope) ──────────────────────────────────
    const useExpButtons = html.querySelectorAll('[data-action="useExperience"]');
    useExpButtons.forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const idx = parseInt(btn.dataset.index, 10);
        const exp = this.document.systemData?.experiences?.[idx];
        const currentHope = Number(this.document.systemData?.hope?.value || 0);

        if (currentHope <= 0) {
          if (window.Loom?.showToast) {
            window.Loom.showToast('Sem Esperança suficiente para usar a Experiência!', 'warning');
          }
          return;
        }

        // Spend 1 Hope
        await this._save({ 'systemData.hope.value': currentHope - 1 });

        if (window.Loom?.showToast) {
          window.Loom.showToast(`1 Esperança gasta! Adicione +${exp?.modifier || 0} (${exp?.name || 'Experiência'}) à sua rolagem!`, 'success');
        }
      });
    });

    // ── Domain Cards Loadout Handlers ────────────────────────────────────────
    const notify = (msg, type = 'info') => {
      if (typeof showToast === 'function') showToast(msg, type);
      else if (window.Loom?.showToast) window.Loom.showToast(msg, type);
    };

    // Delete Domain Card
    html.querySelectorAll('[data-action="deleteDomainCard"]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (this.isEditable === false) return;
        await api.delete('/items/' + btn.dataset.cardId);
        await this._reloadDocument();
      });
    });

    // Activate Domain Card (Spends Hope/Stress & Broadcasts to Chat)
    const activateBtns = html.querySelectorAll('[data-action="activateDomainCard"]');
    activateBtns.forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const cardId = btn.dataset.cardId;

        const item = Array.from(this.document.items || []).find((i) => i.id === cardId);
        const card = item && { name: item.name, domain: item.data?.domain, level: item.data?.level, cost: '', description: item.data?.text };
        if (!card) return;

        const costStr = String(card.cost || '').toLowerCase();
        const hopeNeeded = parseInt(costStr.match(/(\d+)\s*hope/)?.[1] || '0', 10);
        const stressAdded = parseInt(costStr.match(/(\d+)\s*stress/)?.[1] || '0', 10);

        // Check every cost before spending anything, so a failed check never loses Hope
        const currentHope = Number(this.document.systemData?.hope?.value || 0);
        if (currentHope < hopeNeeded) {
          notify(`Esperança insuficiente para ativar ${card.name}! Necessário: ${hopeNeeded}`, 'warning');
          return;
        }
        const currentStress = Number(this.document.systemData?.stress?.value || 0);
        const maxStress = Number(this.document.systemData?.stress?.max || 6);
        if (currentStress + stressAdded > maxStress) {
          notify(`Estresse estourará o limite! Estresse atual: ${currentStress}/${maxStress}`, 'warning');
          return;
        }

        const updates = {};
        if (hopeNeeded) updates['systemData.hope.value'] = currentHope - hopeNeeded;
        if (stressAdded) updates['systemData.stress.value'] = currentStress + stressAdded;
        if (Object.keys(updates).length) await this._save(updates);
        const hopeSpent = hopeNeeded;
        const stressMarked = stressAdded;

        notify(`Carta ativada: ${card.name}` + (hopeSpent ? ` (-${hopeSpent} Hope)` : '') + (stressMarked ? ` (+${stressMarked} Stress)` : ''), 'success');

        // Post chat message announcement
        if (window.Loom?.api?.post) {
          await window.Loom.api.post('/chat', {
            content: `
              <div class="dh-roll-card dh-domain-chat-card">
                <div class="dh-card-header">
                  <div class="dh-card-title-group">
                    <span class="dh-card-crest">🃏</span>
                    <span class="dh-card-title">${this.document.name} — ${card.name}</span>
                  </div>
                  <span class="dh-card-dc">${card.domain || 'Domínio'} (Nv.${card.level || 1})</span>
                </div>
                ${card.cost ? `<div class="dh-modifier-tag" style="margin: 6px 0;">Custo: ${card.cost}</div>` : ''}
                <div class="dh-outcome-desc">${card.description || ''}</div>
              </div>
            `,
          }).catch(() => {});
        }
      });
    });
  }

  // Row actions that change embedded items (data-act="..."); delegated once on the window root.
  _wireActions() {
    if (!this.element || this._actWired) return;
    this._actWired = true;
    this.element.addEventListener('click', async (e) => {
      const btn = e.target.closest?.('[data-act]');
      if (!btn || this.isEditable === false) return;
      e.preventDefault();
      const doc = this.document;
      const sys = doc.systemData ?? {};
      const d = sys.derived ?? {};
      const items = Array.from(doc.items || []);
      const item = items.find((i) => i.id === btn.dataset.id);
      const put = (it, data) => api.put('/items/' + it.id, { data: { ...it.data, ...data } });
      const stress = Number(sys.stress?.value ?? 0);
      const hands = (w) => (w.data?.burden === 'two' ? 2 : 1);
      try {
        switch (btn.dataset.act) {
          case 'rest':
            this._rest = !this._rest;
            break;
          case 'cast': {
            const trait = d.spellcastTrait;
            if (!trait) return showToast('Sem traço de Spellcast: arraste uma subclasse.', 'warning');
            return await this._rollDuality(trait, d.traitMod?.[trait] ?? 0, { name: item.name }, { spell: true });
          }
          case 'toVault':
            await put(item, { inLoadout: false });
            break;
          case 'toLoadout': {
            const cost = this._rest ? 0 : Number(item.data?.recallCost ?? 0);
            if (stress + cost > (d.stressMax ?? 6)) return showToast('Estresse estouraria o limite.', 'warning');
            const loadout = items.filter((i) => i.type === 'domainCard' && i.data?.inLoadout !== false);
            if (loadout.length >= 5) {
              const pick = await window.Loom.showSelectDialog('Loadout cheio', 'Qual carta vai ao Vault?', loadout.map((c) => ({ value: c.id, label: c.name })));
              const out = loadout.find((c) => c.id === pick);
              if (!out) return;
              await put(out, { inLoadout: false });
            }
            await put(item, { inLoadout: true });
            if (cost) await saveActor(doc, { 'systemData.stress.value': stress + cost });
            break;
          }
          case 'equipWeapon': {
            const slot = item.data?.category;
            const cur = items.find((i) => i.type === 'weapon' && i.data?.slot === slot);
            const held = items.filter((i) => i.type === 'weapon' && i !== cur && i !== item && (i.data?.slot ?? 'inventory') !== 'inventory');
            if (held.reduce((n, w) => n + hands(w), hands(item)) > 2) return showToast('Mãos insuficientes: guarde a outra arma antes.', 'warning');
            if (item.data?.damageType === 'mag' && !d.spellcastTrait) return showToast('Arma mágica exige traço de Spellcast.', 'warning');
            if (!window.confirm('Trocar de arma marca 1 Estresse. Confirmar?')) return;
            if (cur) await put(cur, { slot: 'inventory', equipped: false });
            await put(item, { slot, equipped: true });
            await saveActor(doc, { 'systemData.stress.value': Math.min(d.stressMax ?? 6, stress + 1) });
            break;
          }
          case 'qty':
            await put(item, { quantity: Math.max(0, Number(item.data?.quantity ?? 1) + Number(btn.dataset.delta)) });
            break;
          case 'editItem':
            new DaggerheartItemSheet({ itemId: item.id }).render(true);
            return;
          case 'createItem': {
            const type = btn.dataset.type || 'equipment';
            const defaultNames = {
              weapon: 'Nova Arma',
              armor: 'Nova Armadura',
              domainCard: 'Nova Carta de Domínio',
              equipment: 'Novo Item',
              consumable: 'Novo Consumível',
              feature: 'Nova Habilidade'
            };
            const defaultData = {
              weapon: { tier: 1, trait: 'agility', range: 'Melee', dice: 8, flat: 0, damageType: 'phy', burden: 'one', slot: 'inventory' },
              armor: { tier: 1, baseMajor: 5, baseSevere: 11, baseScore: 2, slotsMarked: 0, equipped: false },
              domainCard: { level: 1, domain: 'Blade', recallCost: 0, inLoadout: false, type: 'ability' },
              equipment: { quantity: 1 },
              consumable: { quantity: 1 }
            };
            // Created from the active-gear panels, so it lands there: free weapon slot / equipped armor (the panels only list those).
            if (type === 'weapon') {
              const taken = (s) => items.some((i) => i.type === 'weapon' && i.data?.slot === s);
              const slot = !taken('primary') ? 'primary' : !taken('secondary') ? 'secondary' : 'inventory';
              Object.assign(defaultData.weapon, { slot, category: slot === 'secondary' ? 'secondary' : 'primary', equipped: slot !== 'inventory' });
            }
            if (type === 'armor') defaultData.armor.equipped = !items.some((i) => i.type === 'armor' && i.data?.equipped);
            const created = await api.post(`/actors/${doc.id}/items`, {
              name: defaultNames[type] || 'Novo Item',
              type: type,
              imgUrl: '',
              data: defaultData[type] || {},
            });
            await this._reloadDocument();
            if (created?.id) {
              new DaggerheartItemSheet({ itemId: created.id }).render(true);
            }
            return;
          }
          case 'deleteItem':
            await api.delete('/items/' + item.id);
            break;
          case 'use': {
            const qty = Number(item.data?.quantity ?? 1);
            if (qty <= 0) return showToast(`Sem unidades de ${item.name}.`, 'warning');
            const heal = healFormula(item);
            if (heal) {
              // Healing items roll their cure; the card's button applies it to the target (or to who used it)
              const targets = currentTargets();
              const picked = await askDamageRoll({ title: `${item.name} — cura`, formula: heal, heal: true, targetName: targets.map((t) => t.name).join(', ') });
              if (!picked) return;
              dispatchRoll({
                formula: buildDamageFormula(picked.formula, { bonus: picked.bonus }),
                actorId: doc.id,
                meta: { system: 'Daggerheart', rollType: 'heal', weapon: item.name, damageType: 'heal', targets: targets.map((t) => t.id), targetNames: targets.map((t) => t.name) },
              });
            } else if (!window.confirm(`Usar ${item.name}?`)) {
              return;
            } else {
              await window.Loom?.api?.post?.('/chat', {
                content: `<div class="dh-roll-card dh-domain-chat-card"><div class="dh-card-header"><div class="dh-card-title-group"><span class="dh-card-crest">🧪</span><span class="dh-card-title">${doc.name} usou ${item.name}</span></div></div><div class="dh-outcome-desc">${item.data?.description ?? ''}</div></div>`,
              });
            }
            await put(item, { quantity: qty - 1 });
            break;
          }
          case 'hopeFeature': {
            const f = d.classItem?.data?.hopeFeature;
            const hope = Number(sys.hope?.value ?? 0);
            if (!f || hope < f.cost) return showToast('Esperança insuficiente.', 'warning');
            await saveActor(doc, { 'systemData.hope.value': hope - f.cost });
            showToast(`${f.name}: -${f.cost} Hope`, 'success');
            break;
          }
          case 'swapAncestry': {
            const [a, b] = items.filter((i) => i.type === 'ancestry');
            await put(a, { use: b.data?.use });
            await put(b, { use: a.data?.use });
            break;
          }
          default:
            return;
        }
        await this._reloadDocument();
      } catch (err) {
        showToast('Erro: ' + (err?.message || err), 'error');
      }
    });

    // Rows with data-drag-item-id can be dragged out (macro hotbar); the payload carries the actor so our own drop ignores it
    this.element.addEventListener('dragstart', (e) => {
      const row = e.target.closest?.('[data-drag-item-id]');
      if (!row) return;
      e.dataTransfer?.setData('text/plain', JSON.stringify({ type: 'Item', actorId: this.document.id, itemId: row.dataset.dragItemId, name: row.dataset.dragItemName || '' }));
    });
  }

  // Drop target for compendium entries (listener sits on the window root, which survives re-renders)
  _attachDropListener() {
    if (!this.element || this._hasDropListener) return;
    this._hasDropListener = true;
    this.element.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    });
    this.element.addEventListener('drop', (e) => void this._onDropItem(e));
  }

  async _onDropItem(event) {
    event.preventDefault();
    if (this.isEditable === false || !this.document) return;
    let payload;
    try {
      const raw = event.dataTransfer?.getData('application/json') || event.dataTransfer?.getData('text/plain');
      if (raw) payload = JSON.parse(raw);
    } catch { /* not ours */ }
    if (payload?.actorId === this.document.id) return; // dragged out of this very sheet
    const id = payload?.id || payload?.itemId;
    if (!payload?.data && !id) return;

    try {
      const source = payload.data ?? await api.get('/items/' + id);
      const doc = this.document;
      const result = checkDrop(source.type, source, {
        level: doc.systemData?.level,
        derived: doc.systemData?.derived,
        items: Array.from(doc.items || []).map((i) => ({ id: i.id, type: i.type, name: i.name, data: i.data })),
      });
      if (!result.ok) return showToast(result.reason, 'warning');

      for (const u of result.updates ?? []) await api.put('/items/' + u.id, { data: u.data });
      if (!result.skipCreate) {
        await api.post(`/actors/${doc.id}/items`, {
          name: source.name,
          type: source.type,
          imgUrl: source.imgUrl || source.img || '',
          data: result.patch,
        });
      }
      if (result.warn) showToast(result.warn, 'warning');
      await this._reloadDocument();
    } catch (err) {
      showToast('Erro ao soltar o item: ' + (err?.message || err), 'error');
    }
  }

  // Same flow as wod20th: Loom's portrait editor first, the file picker as the fallback.
  async _editPortrait() {
    const actor = this.document;
    if (this.isEditable === false || !actor) return;

    if (typeof window.Loom?.openPortraitEditor === 'function' && actor.id) {
      window.Loom.openPortraitEditor(actor);
      return;
    }

    const { windowManager, windows } = window.Loom || {};
    if (windowManager?.open && windows?.FilePickerWindow) {
      windowManager.open('file-picker', windows.FilePickerWindow, {
        current: actor.avatarUrl || '',
        type: 'image',
        onSelect: (path) => saveActor(actor, { avatarUrl: path, img: path }),
      });
    }
  }

  // ── Helper: Duality Dice Roll Resolution ───────────────────────────────────
  // Opens the roll dialog (advantage, Experiences, bonus, difficulty), then rolls. Targeted tokens ride along with the roll.
  // `spell` also asks for the spell's damage, since domain cards carry no damage of their own.
  async _rollDuality(traitKey, traitVal, weapon = null, { spell = false } = {}) {
    const doc = this.document;
    const hope = Number(doc.systemData?.hope?.value ?? 0);
    const experiences = (doc.systemData?.experiences ?? [])
      .filter((e) => e?.name)
      .map((e) => ({ name: e.name, modifier: Number(e.modifier) || 0 }));
    const targets = currentTargets();

    const choice = await askActionRoll({
      title: weapon?.name || TRAIT_LABELS[traitKey] || 'Rolagem',
      traitLabel: TRAIT_LABELS[traitKey] || traitKey,
      traitMod: traitVal,
      experiences,
      hope,
      difficulty: targets[0]?.difficulty ?? null,
      targetName: targets.map((t) => t.name).join(', '),
      askDamage: spell,
    });
    if (!choice) return;

    const attack = spell && choice.damage ? { name: weapon?.name, damage: choice.damage, damageType: choice.damageType } : weapon;
    const { formula, meta, hopeSpent } = buildActionRoll({ traitKey, traitMod: traitVal, experiences, choice, weapon: attack, targets });
    if (hopeSpent) await this._save({ 'systemData.hope.value': hope - hopeSpent });
    dispatchRoll({ formula, actorId: doc.id, meta });
  }
}
