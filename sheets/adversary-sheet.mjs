import { LoomActorSheet, LoomHandlebarsMixin, dispatchRoll, showToast } from '/_loom/sdk/index.js';
import { saveActor } from '../lib/save-actor.mjs';
import { wireFieldSave } from '../lib/field-save.mjs';

export class DaggerheartAdversarySheet extends LoomHandlebarsMixin(LoomActorSheet) {
  static DEFAULT_OPTIONS = { position: { width: 840, height: 920 } };
  static PARTS = { main: { template: '/marketplace/rulesets/dh/templates/adversary-sheet.hbs' } };

  constructor(props) {
    super({
      ...props,
      id: props.id || `actor-sheet-${props.actorId}`,
      documentId: props.actorId,
      title: props.title || 'Adversário',
      showFooter: false,
      classes: ['daggerheart', 'sheet', 'actor', 'adversary', 'cs-window'],
    });
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const doc = this.document;
    const sys = doc.systemData || {};

    context.system = sys;
    context.isEditable = this.isEditable;
    context.attacks = sys.attacks || [];
    context.fearFeatures = sys.fearFeatures || [];
    context.portrait = doc.avatarUrl || '/icons/svg/adventurer.svg';

    return context;
  }

  async _save(patch) {
    await saveActor(this.document, patch);
    await this._reloadDocument();
  }

  _editPortrait() {
    const actor = this.document;
    const { windowManager, windows } = window.Loom || {};
    if (typeof window.Loom?.openPortraitEditor === 'function' && actor.id) {
      window.Loom.openPortraitEditor(actor);
      return;
    }
    if (windowManager?.open && windows?.FilePickerWindow) {
      windowManager.open('file-picker', windows.FilePickerWindow, {
        current: actor.avatarUrl || '',
        type: 'image',
        onSelect: (url) => this._save({ avatarUrl: url }),
      });
    }
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const html = this.element;
    if (!html) return;

    // Window banner art support
    const art = this.document?.avatarUrl;
    html.classList.add('window-has-banner');
    html.style.setProperty('--window-banner-url', art ? `url("${art}")` : 'none');

    html.querySelector('[data-portrait-edit]')?.addEventListener('click', (e) => {
      e.preventDefault();
      this._editPortrait();
    });

    // Plain form fields are saved here
    wireFieldSave(this, (name, value) => {
      if (name === 'name' || name.startsWith('systemData.')) this._save({ [name]: value });
    });

    // ── Interactive HP & Stress Dots ─────────────────────────────────────────
    const dotsRows = html.querySelectorAll('.dh-dots-row');
    dotsRows.forEach((row) => {
      const resource = row.dataset.resource;
      const dots = row.querySelectorAll('.dh-dot');

      dots.forEach((dot) => {
        dot.addEventListener('click', async (e) => {
          e.preventDefault();
          if (this.isEditable === false) return;
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
            await this._save({ [path]: newVal });
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
        const name = attack.name || 'Ataque';
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
        const name = feat.name || 'Habilidade de Medo';
        const desc = feat.description || '';

        if (showToast) {
          showToast(`Habilidade ativada: ${name} (Custo: ${cost} Medo)`, 'info');
        }

        if (window.Loom?.api?.post) {
          await window.Loom.api.post('/chat', {
            content: `
              <div class="dh-roll-card dh-fear-feature-card">
                <div class="dh-card-header">
                  <div class="dh-card-title-group">
                    <span class="dh-card-crest"><i class="fa-solid fa-skull"></i></span>
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
    html.querySelector('[data-action="addAttack"]')?.addEventListener('click', async (e) => {
      e.preventDefault();
      if (this.isEditable === false) return;
      const currentAttacks = [...(this.document.systemData?.attacks || [])];
      currentAttacks.push({
        name: `Ataque ${currentAttacks.length + 1}`,
        range: 'Melee',
        damage: '1d8+2',
        damageType: 'physical',
        feature: '',
      });
      await this._save({ 'systemData.attacks': currentAttacks });
    });

    html.querySelectorAll('[data-action="deleteAttack"]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (this.isEditable === false) return;
        const idx = parseInt(btn.dataset.index, 10);
        const currentAttacks = [...(this.document.systemData?.attacks || [])];
        currentAttacks.splice(idx, 1);
        await this._save({ 'systemData.attacks': currentAttacks });
      });
    });

    // ── Add / Delete Fear Features ───────────────────────────────────────────
    html.querySelector('[data-action="addFearFeature"]')?.addEventListener('click', async (e) => {
      e.preventDefault();
      if (this.isEditable === false) return;
      const currentFeats = [...(this.document.systemData?.fearFeatures || [])];
      currentFeats.push({
        name: `Habilidade de Medo ${currentFeats.length + 1}`,
        cost: 1,
        description: '',
      });
      await this._save({ 'systemData.fearFeatures': currentFeats });
    });

    html.querySelectorAll('[data-action="deleteFearFeature"]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (this.isEditable === false) return;
        const idx = parseInt(btn.dataset.index, 10);
        const currentFeats = [...(this.document.systemData?.fearFeatures || [])];
        currentFeats.splice(idx, 1);
        await this._save({ 'systemData.fearFeatures': currentFeats });
      });
    });
  }
}
