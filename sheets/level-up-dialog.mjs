import { BaseWindow, LoomHandlebarsMixin, showToast } from '/_loom/sdk/index.js';
import { SLOTS } from '../lib/advancement-table.mjs';
import { tierForLevel, processLevelUp } from '../lib/level-up.mjs';
import { saveActor } from '../lib/save-actor.mjs';

export class DaggerheartLevelUpDialog extends LoomHandlebarsMixin(BaseWindow) {
  static DEFAULT_OPTIONS = { position: { width: 500, height: 580 } };
  static PARTS = { main: { template: '/marketplace/rulesets/dh/templates/level-up.hbs' } };

  constructor(actor, options = {}) {
    super({
      ...options,
      id: `dh-level-up-${actor.id}`,
      title: `Subir de Nível — ${actor.name}`,
      showFooter: false,
      classes: ['daggerheart', 'dialog', 'level-up'],
    });
    this.actor = actor;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const sys = this.actor.systemData || {};
    const curLevel = Number(sys.level ?? 1);
    const nextLevel = Math.min(10, curLevel + 1);
    const targetTier = tierForLevel(nextLevel);
    const targetTierKey = `tier${targetTier}`;

    const adv = sys.advancements || {};
    const tierSlots = SLOTS[targetTierKey] || {};

    const OPT_DEFS = [
      { type: 'hp', label: '+1 Slot de HP', cost: 1 },
      { type: 'stress', label: '+1 Slot de Estresse', cost: 1 },
      { type: 'evasion', label: '+1 Evasão', cost: 1 },
      { type: 'domain', label: 'Carta de Domínio Adicional', cost: 1 },
      { type: 'subclass', label: 'Carta de Subclasse Melhorada', cost: 1 },
      { type: 'proficiency', label: '+1 Proficiência', cost: 2, cost2: true },
    ];

    context.currentLevel = curLevel;
    context.nextLevel = nextLevel;
    context.targetTier = targetTier;

    context.options = OPT_DEFS.map((opt) => {
      const max = tierSlots[opt.type] ?? 0;
      const used = adv[targetTierKey]?.[opt.type] ?? 0;
      return {
        ...opt,
        max,
        used,
        available: Math.max(0, max - used),
      };
    }).filter((opt) => opt.max > 0);

    return context;
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const html = this.element;
    if (!html) return;

    html.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
      this.close();
    });

    html.querySelector('[data-action="confirm"]')?.addEventListener('click', async () => {
      const checkedBoxes = Array.from(html.querySelectorAll('input[name="advOption"]:checked'));
      const sys = this.actor.systemData || {};
      const nextLevel = Number(sys.level ?? 1) + 1;
      const tierKey = `tier${tierForLevel(nextLevel)}`;

      const choices = checkedBoxes.map((cb) => ({
        type: cb.value,
        tierKey,
      }));

      const res = processLevelUp(sys, choices);
      if (!res.ok) {
        showToast(res.reason, 'warning');
        return;
      }

      await saveActor(this.actor, res.patch);
      showToast(`Parabéns! ${this.actor.name} subiu para o Nível ${nextLevel}!`, 'success');
      this.close();
    });
  }
}
