import { LoomItemSheet, LoomHandlebarsMixin } from '/_loom/sdk/index.js';

export class DaggerheartItemSheet extends LoomHandlebarsMixin(LoomItemSheet) {
  static DEFAULT_OPTIONS = {
    id: 'item-sheet',
    classes: ['daggerheart', 'sheet', 'item'],
    template: '/marketplace/rulesets/dh/templates/item-sheet.hbs',
    width: 520,
    height: 600,
    submitOnChange: true
  };

  async getData(options) {
    const context = await super.getData(options);
    const doc = this.document;
    const sys = doc.systemData || {};

    context.system = sys;
    context.isEditable = this.isEditable;

    return context;
  }
}
