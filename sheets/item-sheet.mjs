import { LoomItemSheet, LoomHandlebarsMixin, showToast } from '/_loom/sdk/index.js';
import { saveItem } from '../lib/save-item.mjs';
import { wireFieldSave } from '../lib/field-save.mjs';

export class DaggerheartItemSheet extends LoomHandlebarsMixin(LoomItemSheet) {
  // Size goes in `position` (the mixin ignores loose width/height); the template goes in PARTS
  static DEFAULT_OPTIONS = { position: { width: 520, height: 600 } };
  static PARTS = { main: { template: '/marketplace/rulesets/dh/templates/item-sheet.hbs' } };

  constructor(props) {
    super({
      ...props,
      // Must match the key windowManager.open uses (`item-sheet-${itemId}`)
      id: props.id || `item-sheet-${props.itemId}`,
      documentId: props.itemId,
      title: props.title || 'Item',
      showFooter: false,
      classes: ['daggerheart', 'sheet', 'item', 'cs-window'],
    });
  }

  // Saves through the API, then reloads: the WebSocket echo can be late or never reach whoever saved.
  async _save(patch) {
    try {
      await saveItem(this.document, patch);
      await this._reloadDocument();
    } catch (err) {
      showToast(`Erro ao salvar: ${err?.message || err}`, 'error');
    }
  }

  _editImage() {
    const item = this.document;
    const { windowManager, windows } = window.Loom || {};
    if (windowManager?.open && windows?.FilePickerWindow) {
      windowManager.open('file-picker', windows.FilePickerWindow, {
        current: item.imgUrl || '',
        type: 'image',
        onSelect: (url) => this._save({ imgUrl: url }),
      });
    }
  }

  // Plain form fields are saved here: the base sheet does not save them. An item keeps its fields in `data`.
  _onRender() {
    this.element?.querySelector('[data-edit="imgUrl"]')?.addEventListener('click', (e) => {
      e.preventDefault();
      this._editImage();
    });
    // "+ entry" buttons append an empty {name,text} to a list (class features, subclass tiers)
    this.element?.querySelectorAll('[data-add-entry]').forEach((btn) => {
      btn.onclick = () => {
        if (this.isEditable === false) return;
        const key = btn.dataset.addEntry;
        this._save({ [`data.${key}`]: [...(this.document.data?.[key] ?? []), { name: '', text: '' }] });
      };
    });
    wireFieldSave(this, (name, value) => {
      if (name === 'name' || name.startsWith('data.')) this._save({ [name]: value });
    });
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    context.system = this.document.data || {};
    context.isEditable = this.isEditable;

    return context;
  }
}
