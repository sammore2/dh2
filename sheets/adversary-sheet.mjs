import { LoomActorSheet, LoomHandlebarsMixin } from '/_loom/sdk/index.js';

export class DaggerheartAdversarySheet extends LoomHandlebarsMixin(LoomActorSheet) {
  static DEFAULT_OPTIONS = {
    id: 'adversary-sheet',
    classes: ['daggerheart', 'sheet', 'actor', 'adversary'],
    template: '/marketplace/rulesets/dh/templates/adversary-sheet.hbs',
    width: 600,
    height: 700,
    submitOnChange: true
  };

  async getData(options) {
    const context = await super.getData(options);
    const doc = this.document;
    const sys = doc.systemData || {};

    context.system = sys;
    context.isEditable = this.isEditable;
    context.attacks = sys.attacks || [];

    return context;
  }
}
