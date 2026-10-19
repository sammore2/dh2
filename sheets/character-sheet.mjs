import { LoomActorSheet, LoomHandlebarsMixin, dispatchRoll } from '/_loom/sdk/index.js';

export class DaggerheartCharacterSheet extends LoomHandlebarsMixin(LoomActorSheet) {
  static DEFAULT_OPTIONS = {
    id: 'character-sheet',
    classes: ['daggerheart', 'sheet', 'actor', 'character'],
    template: '/marketplace/rulesets/dh/templates/character-sheet.hbs',
    width: 760,
    height: 840,
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

    // Structure traits for rendering
    context.traits = {
      agility: { label: 'DH.Traits.Agility', value: sys.attributes?.agility ?? 0 },
      strength: { label: 'DH.Traits.Strength', value: sys.attributes?.strength ?? 0 },
      finesse: { label: 'DH.Traits.Finesse', value: sys.attributes?.finesse ?? 0 },
      instinct: { label: 'DH.Traits.Instinct', value: sys.attributes?.instinct ?? 0 },
      presence: { label: 'DH.Traits.Presence', value: sys.attributes?.presence ?? 0 },
      knowledge: { label: 'DH.Traits.Knowledge', value: sys.attributes?.knowledge ?? 0 },
    };

    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const html = this.element;
    if (!html) return;

    // Tab Navigation
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

    // Trait Roll Buttons (Duality Dice: 1d12 Hope + 1d12 Fear + Trait)
    const rollButtons = html.querySelectorAll('.dh-trait-roll-btn');
    rollButtons.forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const traitKey = btn.dataset.trait;
        const traitVal = this.document.systemData?.attributes?.[traitKey] || 0;
        const modStr = traitVal >= 0 ? `+${traitVal}` : `${traitVal}`;
        const formula = `2d12${modStr}`;

        await dispatchRoll({
          formula,
          actorId: this.document.id,
          meta: {
            system: 'Daggerheart',
            trait: traitKey,
            modifier: traitVal
          }
        });
      });
    });

    // Dot Pip Click Handlers (HP, Stress, Hope)
    const dotContainers = html.querySelectorAll('.dh-dots-container');
    dotContainers.forEach((container) => {
      const resource = container.dataset.resource;
      const pips = container.querySelectorAll('.dh-pip');

      pips.forEach((pip) => {
        pip.addEventListener('click', async (e) => {
          e.preventDefault();
          if (!this.isEditable) return;
          const index = parseInt(pip.dataset.index, 10);
          const currentVal = this.document.systemData?.[resource]?.value ?? 0;
          const newVal = (index + 1 === currentVal) ? index : index + 1;

          await this.document.update({
            [`systemData.${resource}.value`]: newVal
          });
        });
      });
    });
  }
}
