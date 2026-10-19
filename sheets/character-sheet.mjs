import { LoomActorSheet, LoomHandlebarsMixin, dispatchRoll } from '/_loom/sdk/index.js';

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
        const weaponName = weapon?.name || (slot === 'primary' ? 'Arma Primária' : 'Arma Secundária');

        await this._rollDuality(traitKey, traitVal, weaponName);
      });
    });

    const weaponDmgButtons = html.querySelectorAll('[data-action="rollWeaponDamage"]');
    weaponDmgButtons.forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const slot = btn.dataset.slot;
        const weapon = this.document.systemData?.weapons?.[slot];
        const dmgFormula = weapon?.damage || '1d8';
        const weaponName = weapon?.name || (slot === 'primary' ? 'Arma Primária' : 'Arma Secundária');
        const dmgType = weapon?.damageType || 'físico';

        await dispatchRoll({
          formula: dmgFormula,
          actorId: this.document.id,
          meta: {
            system: 'Daggerheart',
            action: 'Dano',
            weapon: weaponName,
            type: dmgType,
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
  }

  // ── Helper: Duality Dice Roll Resolution ───────────────────────────────────
  async _rollDuality(traitKey, traitVal, weaponName = null) {
    const modStr = traitVal >= 0 ? `+${traitVal}` : `${traitVal}`;
    const formula = `2d12${modStr}`;

    const meta = {
      system: 'Daggerheart',
      trait: traitKey.toUpperCase(),
      modifier: traitVal,
    };

    if (weaponName) {
      meta.weapon = weaponName;
    }

    await dispatchRoll({
      formula,
      actorId: this.document.id,
      meta,
    });
  }
}
