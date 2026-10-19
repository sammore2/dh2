import { LoomActorSheet, LoomHandlebarsMixin, dispatchRoll, showToast } from '/_loom/sdk/index.js';

export class DaggerheartCharacterSheet extends LoomHandlebarsMixin(LoomActorSheet) {
  static DEFAULT_OPTIONS = {
    id: 'character-sheet',
    classes: ['daggerheart', 'sheet', 'actor', 'character'],
    template: '/marketplace/rulesets/dh/templates/character-sheet.hbs',
    width: 820,
    height: 900,
    submitOnChange: true
  };

  async getData(options) {
    const context = await super.getData(options);
    const doc = this.document;
    const sys = doc.systemData || {};
    const derived = sys.derived || {};

    context.system = sys;
    context.derived = derived;
    context.isEditable = this.isEditable;

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
    const embeddedDomainItems = Array.from(doc.items || []).filter((i) => i.type === 'domainCard');
    const allDomainCards = [
      ...embeddedDomainItems.map((item) => ({
        id: item.id,
        isItem: true,
        name: item.name,
        domain: item.systemData?.domain || 'Blade',
        level: Number(item.systemData?.level || 1),
        cost: item.systemData?.cost || '',
        description: item.systemData?.description || '',
        inLoadout: item.systemData?.inLoadout !== false,
      })),
      ...(sys.domainCards || []).map((card, idx) => ({
        id: `inline-${idx}`,
        isItem: false,
        idx,
        name: card.name || `Carta ${idx + 1}`,
        domain: card.domain || 'Blade',
        level: Number(card.level || 1),
        cost: card.cost || '',
        description: card.description || '',
        inLoadout: card.inLoadout !== false,
      })),
    ];

    context.activeLoadout = allDomainCards.filter((c) => c.inLoadout);
    context.vaultCards = allDomainCards.filter((c) => !c.inLoadout);
    context.activeLoadoutCount = context.activeLoadout.length;

    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const html = this.element;
    if (!html) return;

    // ── Tab Navigation ───────────────────────────────────────────────────────
    const tabButtons = html.querySelectorAll('.dh-tab-btn');
    const tabPanes = html.querySelectorAll('.dh-tab-pane');

    tabButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const tabTarget = btn.dataset.tab;
        tabButtons.forEach((b) => b.classList.remove('active'));
        tabPanes.forEach((p) => p.classList.remove('active'));

        btn.classList.add('active');
        const targetPane = html.querySelector(`.dh-tab-pane[data-tab="${tabTarget}"]`);
        if (targetPane) targetPane.classList.add('active');
      });
    });

    // ── Trait Duality Roll Buttons ───────────────────────────────────────────
    const traitButtons = html.querySelectorAll('.dh-trait-score-btn');
    traitButtons.forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const traitKey = btn.dataset.trait;
        const traitVal = Number(this.document.systemData?.attributes?.[traitKey] || 0);
        await this._rollDuality(traitKey, traitVal);
      });
    });

    // ── Weapon Attack & Damage Rolls ─────────────────────────────────────────
    const weaponAtkButtons = html.querySelectorAll('[data-action="rollWeaponAttack"]');
    weaponAtkButtons.forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const slot = btn.dataset.slot;
        const weapon = this.document.systemData?.weapons?.[slot];
        const traitKey = weapon?.trait || 'agility';
        const traitVal = Number(this.document.systemData?.attributes?.[traitKey] || 0);
        const weaponName = weapon?.name || (slot === 'primary' ? 'Primary Weapon' : 'Secondary Weapon');

        await this._rollDuality(traitKey, traitVal, {
          name: weaponName,
          damage: weapon?.damage || '1d8',
          damageType: weapon?.damageType || 'physical',
        });
      });
    });

    const weaponDmgButtons = html.querySelectorAll('[data-action="rollWeaponDamage"]');
    weaponDmgButtons.forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const slot = btn.dataset.slot;
        const weapon = this.document.systemData?.weapons?.[slot];
        const dmgFormula = weapon?.damage || '1d8';
        const weaponName = weapon?.name || (slot === 'primary' ? 'Primary Weapon' : 'Secondary Weapon');
        const dmgType = weapon?.damageType || 'physical';

        await dispatchRoll({
          formula: dmgFormula,
          actorId: this.document.id,
          meta: {
            system: 'Daggerheart',
            rollType: 'damage',
            weapon: weaponName,
            damageType: dmgType,
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
          if (!this.isEditable) return;
          const index = parseInt(dot.dataset.index, 10);

          let path = '';
          let currentVal = 0;

          if (resource === 'hp') {
            path = 'systemData.hp.value';
            currentVal = Number(this.document.systemData?.hp?.value || 0);
          } else if (resource === 'stress') {
            path = 'systemData.stress.value';
            currentVal = Number(this.document.systemData?.stress?.value || 0);
          } else if (resource === 'hope') {
            path = 'systemData.hope.value';
            currentVal = Number(this.document.systemData?.hope?.value || 0);
          } else if (resource === 'proficiency') {
            path = 'systemData.proficiency';
            currentVal = Number(this.document.systemData?.proficiency || 1);
          } else if (resource === 'goldHandfuls') {
            path = 'systemData.gold.handfuls';
            currentVal = Number(this.document.systemData?.gold?.handfuls || 0);
          } else if (resource === 'goldBags') {
            path = 'systemData.gold.bags';
            currentVal = Number(this.document.systemData?.gold?.bags || 0);
          }

          if (path) {
            const newVal = (index + 1 === currentVal) ? index : index + 1;
            await this.document.update({ [path]: newVal });
          }
        });
      });
    });

    // Armor Slots Pips
    const armorSlotsGrid = html.querySelector('.dh-armor-pips-grid');
    if (armorSlotsGrid) {
      const armorPips = armorSlotsGrid.querySelectorAll('.dh-armor-pip');
      armorPips.forEach((pip) => {
        pip.addEventListener('click', async (e) => {
          e.preventDefault();
          if (!this.isEditable) return;
          const index = parseInt(pip.dataset.index, 10);
          const currentMarked = Number(this.document.systemData?.armor?.slotsMarked || 0);
          const newMarked = (index + 1 === currentMarked) ? index : index + 1;

          await this.document.update({
            'systemData.armor.slotsMarked': newMarked,
          });
        });
      });
    }

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
        await this.document.update({ 'systemData.hope.value': currentHope - 1 });

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

    // Add Domain Card
    const addCardBtns = html.querySelectorAll('[data-action="addDomainCard"]');
    addCardBtns.forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!this.isEditable) return;
        const currentCards = [...(this.document.systemData?.domainCards || [])];
        const activeCount = currentCards.filter((c) => c.inLoadout !== false).length;
        const inLoadout = activeCount < 5;

        currentCards.push({
          name: `Nova Carta de Domínio`,
          domain: 'Blade',
          level: 1,
          cost: '1 Hope',
          description: 'Descreva a habilidade ou feitiço da carta de domínio...',
          inLoadout,
        });

        await this.document.update({ 'systemData.domainCards': currentCards });
        notify(inLoadout ? 'Carta adicionada ao Loadout ativo!' : 'Carta guardada no Vault (Loadout já tem 5 cartas).', 'info');
      });
    });

    // Toggle Loadout vs Vault
    const toggleBtns = html.querySelectorAll('[data-action="toggleCardLoadout"]');
    toggleBtns.forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!this.isEditable) return;
        const idx = parseInt(btn.dataset.idx, 10);
        const cardId = btn.dataset.cardId;

        // If embedded item
        if (cardId && !cardId.startsWith('inline-')) {
          const item = this.document.items?.get ? this.document.items.get(cardId) : null;
          if (item) {
            const currentlyIn = item.systemData?.inLoadout !== false;
            if (!currentlyIn) {
              const activeCount = Array.from(this.document.items || []).filter((i) => i.type === 'domainCard' && i.systemData?.inLoadout !== false).length +
                (this.document.systemData?.domainCards || []).filter((c) => c.inLoadout !== false).length;
              if (activeCount >= 5) {
                notify('Limite máximo de 5 Cartas de Domínio no Loadout atingido!', 'warning');
                return;
              }
            }
            await item.update({ 'systemData.inLoadout': !currentlyIn });
            return;
          }
        }

        // Inline card
        const currentCards = [...(this.document.systemData?.domainCards || [])];
        if (!isNaN(idx) && currentCards[idx]) {
          const currentlyIn = currentCards[idx].inLoadout !== false;
          if (!currentlyIn) {
            const activeCount = currentCards.filter((c) => c.inLoadout !== false).length;
            if (activeCount >= 5) {
              notify('Limite máximo de 5 Cartas de Domínio no Loadout atingido!', 'warning');
              return;
            }
          }
          currentCards[idx] = { ...currentCards[idx], inLoadout: !currentlyIn };
          await this.document.update({ 'systemData.domainCards': currentCards });
        }
      });
    });

    // Delete Domain Card
    const deleteBtns = html.querySelectorAll('[data-action="deleteDomainCard"]');
    deleteBtns.forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!this.isEditable) return;
        const idx = parseInt(btn.dataset.idx, 10);
        const cardId = btn.dataset.cardId;

        if (cardId && !cardId.startsWith('inline-')) {
          const item = this.document.items?.get ? this.document.items.get(cardId) : null;
          if (item) {
            await item.delete();
            return;
          }
        }

        const currentCards = [...(this.document.systemData?.domainCards || [])];
        if (!isNaN(idx)) {
          currentCards.splice(idx, 1);
          await this.document.update({ 'systemData.domainCards': currentCards });
        }
      });
    });

    // Activate Domain Card (Spends Hope/Stress & Broadcasts to Chat)
    const activateBtns = html.querySelectorAll('[data-action="activateDomainCard"]');
    activateBtns.forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const idx = parseInt(btn.dataset.idx, 10);
        const cardId = btn.dataset.cardId;

        let card = null;
        if (cardId && !cardId.startsWith('inline-')) {
          const item = this.document.items?.get ? this.document.items.get(cardId) : null;
          if (item) {
            card = {
              name: item.name,
              domain: item.systemData?.domain,
              level: item.systemData?.level,
              cost: item.systemData?.cost,
              description: item.systemData?.description,
            };
          }
        } else if (!isNaN(idx)) {
          card = this.document.systemData?.domainCards?.[idx];
        }

        if (!card) return;

        const costStr = String(card.cost || '').toLowerCase();
        let hopeSpent = 0;
        let stressMarked = 0;

        // Detect Hope cost (e.g. "1 Hope", "2 Hope")
        const hopeMatch = costStr.match(/(\d+)\s*hope/);
        if (hopeMatch) {
          const needed = parseInt(hopeMatch[1], 10);
          const currentHope = Number(this.document.systemData?.hope?.value || 0);
          if (currentHope < needed) {
            notify(`Esperança insuficiente para ativar ${card.name}! Necessário: ${needed}`, 'warning');
            return;
          }
          await this.document.update({ 'systemData.hope.value': currentHope - needed });
          hopeSpent = needed;
        }

        // Detect Stress cost (e.g. "1 Stress", "2 Stress")
        const stressMatch = costStr.match(/(\d+)\s*stress/);
        if (stressMatch) {
          const added = parseInt(stressMatch[1], 10);
          const currentStress = Number(this.document.systemData?.stress?.value || 0);
          const maxStress = Number(this.document.systemData?.stress?.max || 6);
          if (currentStress + added > maxStress) {
            notify(`Estresse estourará o limite! Estresse atual: ${currentStress}/${maxStress}`, 'warning');
            return;
          }
          await this.document.update({ 'systemData.stress.value': currentStress + added });
          stressMarked = added;
        }

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

  // ── Helper: Duality Dice Roll Resolution ───────────────────────────────────
  async _rollDuality(traitKey, traitVal, weapon = null) {
    const modStr = traitVal >= 0 ? `+${traitVal}` : `${traitVal}`;
    const formula = `2d12${modStr}`;

    const meta = {
      system: 'Daggerheart',
      trait: traitKey.toUpperCase(),
      modifier: traitVal,
    };

    if (weapon) {
      if (typeof weapon === 'object' && weapon !== null) {
        meta.weapon = weapon.name;
        if (weapon.damage) meta.weaponDamage = weapon.damage;
        if (weapon.damageType) meta.damageType = weapon.damageType;
      } else {
        meta.weapon = String(weapon);
      }
    }

    await dispatchRoll({
      formula,
      actorId: this.document.id,
      meta,
    });
  }
}
