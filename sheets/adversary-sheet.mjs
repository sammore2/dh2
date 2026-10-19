import { LoomActorSheet, LoomHandlebarsMixin, dispatchRoll, showToast } from '/_loom/sdk/index.js';

export class DaggerheartAdversarySheet extends LoomHandlebarsMixin(LoomActorSheet) {
  static DEFAULT_OPTIONS = {
    id: 'adversary-sheet',
    classes: ['daggerheart', 'sheet', 'actor', 'adversary'],
    template: '/marketplace/rulesets/dh/templates/adversary-sheet.hbs',
    width: 680,
    height: 780,
    submitOnChange: true
  };

  async getData(options) {
    const context = await super.getData(options);
    const doc = this.document;
    const sys = doc.systemData || {};

    context.system = sys;
    context.isEditable = this.isEditable;
    context.attacks = sys.attacks || [];
    context.fearFeatures = sys.fearFeatures || [];

    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const html = this.element;
    if (!html) return;

    // ── Interactive HP & Stress Dots ─────────────────────────────────────────
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
          }

          if (path) {
            const newVal = (index + 1 === currentVal) ? index : index + 1;
            await this.document.update({ [path]: newVal });
          }
        });
      });
    });

    // ── Roll Adversary Attack Damage ─────────────────────────────────────────
    const rollDmgButtons = html.querySelectorAll('[data-action="rollAdversaryDamage"]');
    rollDmgButtons.forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const idx = parseInt(btn.dataset.index, 10);
        const attack = this.document.systemData?.attacks?.[idx];
        if (!attack) return;

        const formula = attack.damage || '1d8';
        const name = attack.name || 'Adversary Attack';
        const damageType = attack.damageType || 'physical';

        await dispatchRoll({
          formula,
          actorId: this.document.id,
          meta: {
            system: 'Daggerheart',
            rollType: 'damage',
            weapon: `${this.document.name}: ${name}`,
            damageType,
            feature: attack.feature || '',
          },
        });
      });
    });

    // ── Broadcast Fear Feature to Chat ───────────────────────────────────────
    const fearFeatureButtons = html.querySelectorAll('[data-action="broadcastFearFeature"]');
    fearFeatureButtons.forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const idx = parseInt(btn.dataset.index, 10);
        const feat = this.document.systemData?.fearFeatures?.[idx];
        if (!feat) return;

        const cost = feat.cost || 1;
        const name = feat.name || 'Fear Feature';
        const desc = feat.description || '';

        // If GM Fear Tracker exists or toast
        if (showToast) {
          showToast(`Habilidade de Medo ativada: ${name} (Custo: ${cost} Medo)`, 'info');
        }

        // Post announcement to chat if available
        if (window.Loom?.api?.post) {
          await window.Loom.api.post('/chat', {
            content: `
              <div class="dh-roll-card dh-fear-feature-card">
                <div class="dh-card-header">
                  <div class="dh-card-title-group">
                    <span class="dh-card-crest">🔮</span>
                    <span class="dh-card-title">${this.document.name} — ${name}</span>
                  </div>
                  <span class="dh-card-dc">Custo: ${cost} Medo</span>
                </div>
                <div class="dh-outcome-desc" style="margin-top: 8px;">${desc}</div>
              </div>
            `,
          }).catch(() => {});
        }
      });
    });

    // ── Add / Delete Attacks ─────────────────────────────────────────────────
    const addAttackBtn = html.querySelector('[data-action="addAttack"]');
    if (addAttackBtn) {
      addAttackBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!this.isEditable) return;
        const currentAttacks = [...(this.document.systemData?.attacks || [])];
        currentAttacks.push({
          name: `Ataque ${currentAttacks.length + 1}`,
          range: 'Melee',
          damage: '1d8+2',
          damageType: 'physical',
          feature: '',
        });
        await this.document.update({ 'systemData.attacks': currentAttacks });
      });
    }

    const deleteAttackBtns = html.querySelectorAll('[data-action="deleteAttack"]');
    deleteAttackBtns.forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!this.isEditable) return;
        const idx = parseInt(btn.dataset.index, 10);
        const currentAttacks = [...(this.document.systemData?.attacks || [])];
        currentAttacks.splice(idx, 1);
        await this.document.update({ 'systemData.attacks': currentAttacks });
      });
    });

    // ── Add / Delete Fear Features ───────────────────────────────────────────
    const addFearBtn = html.querySelector('[data-action="addFearFeature"]');
    if (addFearBtn) {
      addFearBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!this.isEditable) return;
        const currentFeats = [...(this.document.systemData?.fearFeatures || [])];
        currentFeats.push({
          name: `Habilidade de Medo ${currentFeats.length + 1}`,
          cost: 1,
          description: '',
        });
        await this.document.update({ 'systemData.fearFeatures': currentFeats });
      });
    }

    const deleteFearBtns = html.querySelectorAll('[data-action="deleteFearFeature"]');
    deleteFearBtns.forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!this.isEditable) return;
        const idx = parseInt(btn.dataset.index, 10);
        const currentFeats = [...(this.document.systemData?.fearFeatures || [])];
        currentFeats.splice(idx, 1);
        await this.document.update({ 'systemData.fearFeatures': currentFeats });
      });
    });
  }
}
