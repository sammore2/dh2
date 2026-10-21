import { resolveDamage, applyDamageToActor, applyHealToActor } from '../lib/damage.mjs';
import { evaluateDuality, extractDualityFromRoll } from '../lib/duality.mjs';
import { TRAIT_LABELS, buildDamageFormula, maxDice } from '../lib/action-roll.mjs';
import { askDamageRoll } from '../lib/roll-dialog.mjs';
import { currentTargets, loadTarget } from '../lib/targets.mjs';
import { damageApplier } from '../lib/settings.mjs';
import { dispatchRoll, showToast, showSelectDialog } from '/_loom/sdk/index.js';

/** Escapes HTML attributes safely. */
function safeAttr(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const OUTCOME_TITLES = {
  CRITICAL: 'Sucesso Crítico!',
  SUCCESS_WITH_HOPE: 'Sucesso com Esperança',
  SUCCESS_WITH_FEAR: 'Sucesso com Medo',
  FAILURE_WITH_HOPE: 'Falha com Esperança',
  FAILURE_WITH_FEAR: 'Falha com Medo',
  HOPE_DOMINANT: 'com Esperança',
  FEAR_DOMINANT: 'com Medo',
};

const OUTCOME_DESCRIPTIONS = {
  CRITICAL: 'Sucesso Crítico! A ação é bem-sucedida com um bônus: ganhe 1 Esperança e limpe 1 Estresse.',
  SUCCESS_WITH_HOPE: 'Sucesso! Você ganha 1 Esperança e o holofote continua com os jogadores.',
  SUCCESS_WITH_FEAR: 'Sucesso com custo ou complicação: o Mestre ganha 1 Medo e assume o holofote.',
  FAILURE_WITH_HOPE: 'Falha com consequência leve: você ganha 1 Esperança e o holofote vai para o Mestre.',
  FAILURE_WITH_FEAR: 'Falha com consequência grave: o Mestre ganha 1 Medo e assume o holofote.',
  HOPE_DOMINANT: 'O dado de Esperança foi maior: ganhe 1 Esperança.',
  FEAR_DOMINANT: 'O dado de Medo foi maior: o Mestre ganha 1 Medo.',
};

const CARD_CLASS = {
  CRITICAL: 'dh-card-crit',
  SUCCESS_WITH_HOPE: 'dh-card-hope-success',
  SUCCESS_WITH_FEAR: 'dh-card-fear-success',
  FAILURE_WITH_HOPE: 'dh-card-hope-failure',
  FAILURE_WITH_FEAR: 'dh-card-fear-failure',
  HOPE_DOMINANT: 'dh-card-hope-success',
  FEAR_DOMINANT: 'dh-card-fear-success',
};

const targetLine = (meta) => (meta.targetNames?.length ? `Alvo: ${meta.targetNames.join(', ')}` : 'Sem alvo');

/**
 * Intercepts default roll card rendering: action rolls (duality dice) and damage rolls.
 * An attack that lands carries the "Rolar Dano" button in the card itself.
 */
export function renderDaggerheartRollCard(roll, esc, original) {
  const meta = roll?.meta || {};
  if (meta.system !== 'Daggerheart') return original(roll, esc);
  if (meta.rollType === 'damage') return renderDamageCard(roll, meta);
  if (meta.rollType === 'heal') return renderHealCard(roll, meta);
  if (meta.rollType !== 'action') return original(roll, esc);

  const dual = extractDualityFromRoll(roll);
  if (!dual) return original(roll, esc);

  const total = Number(roll.total);
  const dc = Number.isFinite(meta.difficulty) ? meta.difficulty : null;
  // The total comes from the roller (it already holds the d6 of advantage and every modifier)
  const res = evaluateDuality(dual.hope, dual.fear, total - dual.hope - dual.fear, 0, dc);
  const key = res.outcome;
  const hit = dc === null ? null : key === 'CRITICAL' || key.startsWith('SUCCESS');

  const advDie = (roll.terms || []).find((t) => t.kind === 'dice' && t.faces === 6);
  const modifier = Number(meta.modifier || 0);
  const trait = TRAIT_LABELS[String(meta.trait).toLowerCase()] || meta.trait || '';
  const title = meta.weapon ? `${meta.weapon} (${trait})` : trait;
  const outcomeTitle = key === 'HOPE_DOMINANT' || key === 'FEAR_DOMINANT' ? `${total} ${OUTCOME_TITLES[key]}` : OUTCOME_TITLES[key];
  const badgeClass = key === 'CRITICAL' ? 'dh-badge-crit' : res.hopeGain ? 'dh-badge-hope' : 'dh-badge-fear';
  const actorId = safeAttr(roll.actorId || '');
  const notes = [
    meta.advantage === 'adv' ? 'Vantagem' : meta.advantage === 'dis' ? 'Desvantagem' : '',
    ...(meta.experiences || []).map((n) => `Experiência: ${n}`),
  ].filter(Boolean);

  const isHeal = meta.damageType === 'heal';
  let actions = '';
  if (meta.weaponDamage) {
    actions = hit === false
      ? `<div class="dh-outcome-desc">${isHeal ? 'A magia falhou: sem cura.' : 'O ataque errou: sem dano.'}</div>`
      : `<div class="dh-card-actions">
          <button type="button" class="dh-card-btn dh-btn-damage" data-action="dh-roll-damage"
            data-formula="${safeAttr(meta.weaponDamage)}" data-type="${safeAttr(meta.damageType || 'physical')}"
            data-weapon="${safeAttr(meta.weapon || '')}" data-actor-id="${actorId}" data-crit="${key === 'CRITICAL' && !isHeal ? '1' : ''}"
            data-targets="${safeAttr((meta.targets || []).join(','))}" data-target-names="${safeAttr((meta.targetNames || []).join(', '))}">
            ${isHeal ? 'Rolar Cura' : key === 'CRITICAL' ? 'Rolar Dano Crítico' : 'Rolar Dano'} (${safeAttr(meta.weaponDamage)})
          </button>
        </div>`;
  }

  return `
<div class="dh-roll-card ${CARD_CLASS[key]}" data-actor-id="${actorId}">
  <div class="dh-card-header">
    <div class="dh-card-title-group">
      <span class="dh-card-crest">⚔️</span>
      <span class="dh-card-title">${safeAttr(title)}</span>
    </div>
    ${dc !== null ? `<span class="dh-card-dc">Dificuldade ${dc}</span>` : ''}
  </div>
  <div class="dh-outcome-desc">${safeAttr(targetLine(meta))}</div>
  <div class="dh-dice-container">
    <div class="dh-die-slot dh-hope-slot ${dual.hope > dual.fear ? 'is-winner' : ''}">
      <span class="dh-die-label">Esperança</span><span class="dh-die-val">${dual.hope}</span>
    </div>
    <span class="dh-dice-vs">+</span>
    <div class="dh-die-slot dh-fear-slot ${dual.fear > dual.hope ? 'is-winner' : ''}">
      <span class="dh-die-label">Medo</span><span class="dh-die-val">${dual.fear}</span>
    </div>
    ${advDie ? `<span class="dh-dice-vs">${advDie.subtotal < 0 ? '−' : '+'}</span><div class="dh-modifier-tag">d6 ${advDie.rolls[0]}</div>` : ''}
    ${modifier !== 0 ? `<span class="dh-dice-vs">${modifier > 0 ? '+' : '−'}</span><div class="dh-modifier-tag">${Math.abs(modifier)}</div>` : ''}
  </div>
  ${notes.length ? `<div class="dh-outcome-desc">${safeAttr(notes.join(' · '))}</div>` : ''}
  <div class="dh-outcome-banner">
    <div class="dh-outcome-badge ${badgeClass}">${outcomeTitle}</div>
    <div class="dh-roll-total"><span class="dh-total-num">${total}</span></div>
  </div>
  <div class="dh-outcome-desc">${OUTCOME_DESCRIPTIONS[key]}</div>
  ${actions}
</div>
  `.trim();
}

/** Damage card: the total, who it hits, and the button that applies it. */
function renderDamageCard(roll, meta) {
  const total = Number(roll.total ?? 0);
  const targets = safeAttr((meta.targets || []).join(','));
  return `
<div class="dh-roll-card dh-damage-card" data-actor-id="${safeAttr(roll.actorId || '')}">
  <div class="dh-card-header">
    <div class="dh-card-title-group">
      <span class="dh-card-crest">💥</span>
      <span class="dh-card-title">${safeAttr(meta.weapon || 'Dano')} — Dano${meta.crit ? ' Crítico' : ''}</span>
    </div>
    <span class="dh-modifier-tag">${safeAttr((meta.damageType === 'magic' ? 'mágico' : 'físico').toUpperCase())}</span>
  </div>
  <div class="dh-outcome-desc">${safeAttr(targetLine(meta))}</div>
  <div class="dh-outcome-banner" style="margin: 12px 0;">
    <div class="dh-roll-total">
      <span class="dh-total-num">${total}</span>
      <span class="dh-total-formula">${safeAttr(roll.formula || '')}</span>
    </div>
  </div>
  ${damageApplier() === 'gm' && !window.Loom?.user?.isGM
    ? '<div class="dh-outcome-desc">O Mestre aplica o dano.</div>'
    : `<div class="dh-card-actions">
        <button type="button" class="dh-card-btn dh-btn-damage" data-action="dh-apply-damage" data-damage="${total}" data-targets="${targets}">
          ⚡ ${meta.targets?.length ? 'Aplicar Dano' : 'Aplicar ao alvo selecionado'}
        </button>
      </div>`}
</div>
  `.trim();
}

/** Healing card: same scheme as damage. The button only shows after the roll; with no target it heals the one who rolled. */
function renderHealCard(roll, meta) {
  const total = Number(roll.total ?? 0);
  const actorId = safeAttr(roll.actorId || '');
  return `
<div class="dh-roll-card dh-damage-card" data-actor-id="${actorId}">
  <div class="dh-card-header">
    <div class="dh-card-title-group">
      <span class="dh-card-crest">💚</span>
      <span class="dh-card-title">${safeAttr(meta.weapon || 'Cura')} — Cura</span>
    </div>
    <span class="dh-modifier-tag">HP</span>
  </div>
  <div class="dh-outcome-desc">${safeAttr(meta.targetNames?.length ? targetLine(meta) : 'Sem alvo: cura quem rolou')}</div>
  <div class="dh-outcome-banner" style="margin: 12px 0;">
    <div class="dh-roll-total">
      <span class="dh-total-num">${total}</span>
      <span class="dh-total-formula">${safeAttr(roll.formula || '')}</span>
    </div>
  </div>
  ${damageApplier() === 'gm' && !window.Loom?.user?.isGM
    ? '<div class="dh-outcome-desc">O Mestre aplica a cura.</div>'
    : `<div class="dh-card-actions">
        <button type="button" class="dh-card-btn dh-btn-damage" data-action="dh-apply-heal" data-amount="${total}"
          data-targets="${safeAttr((meta.targets || []).join(','))}" data-actor-id="${actorId}">
          💚 Aplicar Cura
        </button>
      </div>`}
</div>
  `.trim();
}

/** Applies damage to one target token: armor prompt (characters), then marks HP on the actor or the token. */
async function applyDamageTo(target, damage, notify) {
  const { actor, save } = target;
  const sys = actor.systemData || {};
  const derived = sys.derived || {};
  const major = Number(derived.thresholdMajor ?? sys.thresholds?.major ?? 7);
  const severe = Number(derived.thresholdSevere ?? sys.thresholds?.severe ?? 14);

  const armorItem = Array.from(actor.items || []).find((i) => i.type === 'armor' && i.data?.equipped) || null;
  const armorScore = Math.min(12, Number(derived.armorScore ?? (armorItem ? Number(armorItem.data?.baseScore ?? 0) + Number(sys.bonus?.armorScore ?? 0) : 0)));
  const freeSlots = armorItem && armorScore > 0 ? Math.max(0, armorScore - Number(armorItem.data?.slotsMarked ?? 0)) : 0;

  const base = resolveDamage(damage, { major, severe }, 0);
  let slots = 0;
  if (freeSlots > 0 && base.baseHpToMark > 0) {
    const options = [{ value: '0', label: `Não gastar armadura (${base.baseHpToMark} HP marcados)` }];
    for (let n = 1; n <= Math.min(freeSlots, base.baseHpToMark); n++) {
      options.push({ value: String(n), label: `Gastar ${n} slot${n > 1 ? 's' : ''} de armadura (${base.baseHpToMark - n} HP)` });
    }
    const choice = await showSelectDialog(
      `Mitigação de Armadura — ${target.name}`,
      `Dano recebido: ${damage} (${base.baseSeverity}). Limiares: Major ${major} / Severe ${severe}. Quantos slots marcar?`,
      options,
    );
    slots = Number(choice) || 0;
  }

  const finalRes = resolveDamage(damage, { major, severe }, slots);
  const result = await applyDamageToActor(actor, finalRes, armorItem, save ? { saveActor: save } : {});
  notify(`${target.name} sofreu ${damage} de dano [${finalRes.baseSeverity}]: ${result.hpMarked} HP marcado(s)`
    + (slots > 0 ? ` (${slots} slot(s) de armadura)` : '') + ` [HP: ${result.currentHp}/${result.maxHp}]`, 'info');
}

/** Applies `damage` to the given target tokens (or, with none, to whoever is targeted/controlled now). */
async function applyCardDamage(ids, damage, notify) {
  if (!ids.length) ids = currentTargets().map((t) => t.id);
  let targets = (await Promise.all(ids.map((id) => loadTarget(id).catch(() => null)))).filter(Boolean);
  if (!targets.length) {
    const controlled = window.Loom?.canvas?.getControlledActors?.() || [];
    targets = controlled.slice(0, 1).map((a) => ({ name: a.name, actor: a, save: null }));
  }
  if (!targets.length) {
    notify('Nenhum alvo: mire um token no mapa e clique de novo.', 'warning');
    return false;
  }
  try {
    for (const t of targets) await applyDamageTo(t, damage, notify);
    return true;
  } catch (err) {
    notify(`Não foi possível aplicar o dano (${err?.message || err}). O Mestre pode aplicar pelo botão do card.`, 'error');
    return false;
  }
}

/** Clears HP on the targets; with no target at all it heals the character that rolled. */
async function applyCardHeal(ids, amount, actorId, notify) {
  if (!ids.length) ids = currentTargets().map((t) => t.id);
  let targets = (await Promise.all(ids.map((id) => loadTarget(id).catch(() => null)))).filter(Boolean);
  const self = actorId ? window.Loom?.actors?.get?.(actorId) : null;
  if (!targets.length && self) targets = [{ name: self.name, actor: self, save: null }];
  if (!targets.length) {
    notify('Nenhum alvo: mire um token no mapa e clique de novo.', 'warning');
    return false;
  }
  try {
    for (const t of targets) {
      const r = await applyHealToActor(t.actor, amount, t.save ? { saveActor: t.save } : {});
      notify(`${t.name} recuperou ${r.cleared} HP [HP marcado: ${r.currentHp}/${r.maxHp}]`, 'success');
    }
    return true;
  } catch (err) {
    notify(`Não foi possível aplicar a cura (${err?.message || err}). O Mestre pode aplicar pelo botão do card.`, 'error');
    return false;
  }
}

/** Global chat delegation for the buttons in roll cards. */
export function registerChatCardListeners() {
  document.addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-action]');
    if (!btn) return;
    const notify = (msg, type = 'info') => showToast(msg, type);

    if (btn.dataset.action === 'dh-roll-damage') {
      const { formula, type, weapon, actorId, targetNames } = btn.dataset;
      if (!formula) return;
      const heal = type === 'heal';
      const crit = btn.dataset.crit === '1';
      // Targets set on the map after the attack still count when the attack carried none
      const ids = (btn.dataset.targets || '').split(',').filter(Boolean);
      const live = ids.length ? [] : currentTargets();
      const picked = await askDamageRoll({
        title: `${weapon || (heal ? 'Cura' : 'Dano')} — ${heal ? 'cura' : 'dano'}`,
        formula,
        crit,
        maxBonus: crit ? maxDice(formula) : 0,
        targetName: targetNames || live.map((t) => t.name).join(', '),
        heal,
      });
      if (!picked) return;
      dispatchRoll({
        formula: buildDamageFormula(picked.formula, { crit, bonus: picked.bonus }),
        actorId,
        meta: {
          system: 'Daggerheart',
          rollType: heal ? 'heal' : 'damage',
          weapon,
          damageType: type || 'physical',
          crit,
          targets: ids.length ? ids : live.map((t) => t.id),
          targetNames: ids.length ? (targetNames || '').split(', ').filter(Boolean) : live.map((t) => t.name),
        },
      });
    } else if (btn.dataset.action === 'dh-apply-damage') {
      const ids = (btn.dataset.targets || '').split(',').filter(Boolean);
      if (await applyCardDamage(ids, Number(btn.dataset.damage) || 0, notify)) {
        btn.disabled = true;
        btn.textContent = '✔ Dano aplicado';
      }
    } else if (btn.dataset.action === 'dh-apply-heal') {
      const ids = (btn.dataset.targets || '').split(',').filter(Boolean);
      if (await applyCardHeal(ids, Number(btn.dataset.amount) || 0, btn.dataset.actorId, notify)) {
        btn.disabled = true;
        btn.textContent = '✔ Cura aplicada';
      }
    }
  });
}
