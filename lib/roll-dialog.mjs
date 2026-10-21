// Roll dialogs: what the player can add before the dice leave (SRD "Apply extra dice and modifiers").
import { LoomDialog } from '/_loom/sdk/index.js';
import { signed } from './action-roll.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const FIELD = 'width:100%;box-sizing:border-box;background:var(--color-bg-surface);border:1px solid var(--color-border);color:var(--color-text-primary);border-radius:4px;padding:0.35rem 0.5rem;font-size:0.9rem;';
const LABEL = 'display:flex;flex-direction:column;gap:0.25rem;color:var(--color-text-secondary);font-size:0.85rem;';

function box(html) {
  const el = document.createElement('div');
  el.style.cssText = 'display:flex;flex-direction:column;gap:0.75rem;padding:0.5rem;box-sizing:border-box;';
  el.innerHTML = html;
  return el;
}

// Cancel and closing the window both end up as null
const ask = (title, content, confirmLabel, read) => LoomDialog.wait({
  window: { title },
  content,
  width: 380,
  buttons: [
    { action: 'cancel', label: 'Cancelar', variant: 'ghost', callback: () => null },
    { action: 'confirm', label: confirmLabel, variant: 'primary', default: true, callback: read },
  ],
}).then((r) => r ?? null, () => null);

/**
 * Action roll dialog (trait, attack, spellcast).
 * Resolves to { advantage, experiences:number[], bonus, difficulty, damage?, damageType? } or null.
 */
export function askActionRoll({ title, traitLabel, traitMod, experiences = [], hope = 0, difficulty = null, targetName = '', askDamage = false }) {
  const exps = experiences.map((e, i) => `
    <label style="display:flex;gap:0.5rem;align-items:center;color:var(--color-text-primary);font-size:0.9rem;">
      <input type="checkbox" data-exp="${i}" ${hope <= 0 ? 'disabled' : ''}> ${esc(e.name)} (${signed(e.modifier)}) <small style="opacity:.7">1 Esperança</small>
    </label>`).join('');
  const el = box(`
    <div style="color:var(--color-text-primary);font-size:1rem;"><b>${esc(traitLabel)}</b> ${signed(Number(traitMod) || 0)}
      ${targetName ? `<div style="font-size:0.85rem;opacity:.8">Alvo: ${esc(targetName)}</div>` : ''}</div>
    <label style="${LABEL}">Vantagem
      <select name="adv" style="${FIELD}"><option value="none">Normal</option><option value="adv">Vantagem (+1d6)</option><option value="dis">Desvantagem (−1d6)</option></select>
    </label>
    ${exps ? `<div style="${LABEL}">Experiências <small>(gastam Esperança: você tem ${hope})</small>${exps}</div>` : ''}
    <label style="${LABEL}">Bônus extra<input name="bonus" type="number" value="0" style="${FIELD}"></label>
    <label style="${LABEL}">Dificuldade<input name="dc" type="number" value="${difficulty ?? ''}" placeholder="sem dificuldade" style="${FIELD}"></label>
    ${askDamage ? `
      <label style="${LABEL}">Dano ou cura da magia (opcional)<input name="dmg" type="text" placeholder="ex.: 2d6+3" style="${FIELD}"></label>
      <label style="${LABEL}">Efeito<select name="dtype" style="${FIELD}"><option value="magic">Dano mágico</option><option value="physical">Dano físico</option><option value="heal">Cura (limpa HP)</option></select></label>` : ''}
  `);

  // Each Experience spends a Hope: stop offering them once the Hope runs out
  const boxes = [...el.querySelectorAll('[data-exp]')];
  boxes.forEach((b) => b.addEventListener('change', () => {
    const used = boxes.filter((x) => x.checked).length;
    boxes.forEach((x) => { x.disabled = !x.checked && used >= hope; });
  }));

  const field = (name) => el.querySelector(`[name=${name}]`);
  return ask(title, el, 'Rolar', () => ({
    advantage: field('adv').value,
    experiences: boxes.filter((b) => b.checked).map((b) => Number(b.dataset.exp)),
    bonus: field('bonus').value,
    difficulty: field('dc').value,
    damage: field('dmg')?.value.trim() ?? '',
    damageType: field('dtype')?.value,
  }));
}

/** Damage roll dialog. Resolves to { formula, bonus } or null. */
export function askDamageRoll({ title, formula, crit = false, maxBonus = 0, targetName = '', heal = false }) {
  const el = box(`
    ${targetName ? `<div style="color:var(--color-text-primary);font-size:0.9rem;">Alvo: ${esc(targetName)}</div>` : ''}
    <label style="${LABEL}">${heal ? 'Cura (HP)' : 'Dano'}<input name="formula" type="text" value="${esc(formula)}" style="${FIELD}"></label>
    <label style="${LABEL}">Bônus extra<input name="bonus" type="number" value="0" style="${FIELD}"></label>
    ${crit ? `<div style="color:var(--color-text-primary);font-size:0.85rem;">Crítico: soma +${maxBonus} (valor máximo dos dados)</div>` : ''}
  `);
  return ask(title, el, heal ? 'Rolar cura' : 'Rolar dano', () => ({
    formula: el.querySelector('[name=formula]').value.trim() || formula,
    bonus: el.querySelector('[name=bonus]').value,
  }));
}
