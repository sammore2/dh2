/**
 * @fileoverview Daggerheart SRD 2.0 — Custom Roll Card Renderer
 * Intercepts Loom's renderRollCard to provide rich, thematic chat cards
 * featuring Duality Dice (Hope & Fear), Critical Outcomes, and Interactive Actions.
 */

import { extractDualityFromRoll } from '../lib/duality.mjs';
import { resolveDamage, applyDamageToActor } from '../lib/damage.mjs';
import { dispatchRoll, showToast, showSelectDialog } from '/_loom/sdk/index.js';

/**
 * Escapes HTML attributes safely.
 * @param {string} str
 * @returns {string}
 */
function safeAttr(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Localizes a key if Loom i18n is available, otherwise returns fallback.
 * @param {string} key
 * @param {string} [fallback]
 * @returns {string}
 */
function localize(key, fallback = '') {
  if (typeof window !== 'undefined' && window.Loom?.i18n?.localize) {
    const text = window.Loom.i18n.localize(key);
    if (text && text !== key) return text;
  }
  return fallback || key;
}

/**
 * Renders a Daggerheart Duality Roll chat card.
 * @param {Object} roll - The Loom roll object
 * @param {Function} esc - The engine text escaper
 * @param {Function} original - The base renderer fallback
 * @returns {string} HTML string
 */
export function renderDaggerheartRollCard(roll, esc, original) {
  const meta = roll?.meta || {};
  const isDh = meta.system === 'Daggerheart' || meta.system === 'dh';

  if (!isDh) {
    return original(roll, esc);
  }

  // Handle Weapon Damage Rolls
  if (meta.rollType === 'damage') {
    return renderDamageRollCard(roll, esc);
  }

  // Handle Duality Action Rolls
  const duality = extractDualityFromRoll(roll);
  if (!duality) {
    return original(roll, esc);
  }

  const title = meta.weapon 
    ? `${safeAttr(meta.weapon)} — ${safeAttr(meta.trait || 'Attack')}`
    : `${safeAttr(meta.trait || 'Duality')} Check`;

  const actorId = safeAttr(meta.actorId || roll.actorId || '');
  const outcomeText = getOutcomeDescription(duality.outcome);

  return `
<div class="dh-roll-card dh-duality-card" data-actor-id="${actorId}">
  <!-- Card Header -->
  <div class="dh-card-header">
    <div class="dh-card-title-group">
      <span class="dh-card-crest">⚔</span>
      <span class="dh-card-title">${title}</span>
    </div>
    ${meta.difficulty ? `<span class="dh-card-dc">DC ${safeAttr(meta.difficulty)}</span>` : ''}
  </div>

  <!-- Duality Dice Arena -->
  <div class="dh-duality-arena">
    <!-- Hope Die -->
    <div class="dh-die-container dh-die-hope ${duality.hope >= duality.fear ? 'dh-dominant' : ''}">
      <span class="dh-die-label">${localize('DH.Duality.HopeDie', 'HOPE')}</span>
      <div class="dh-die-shape">
        <span class="dh-die-value">${duality.hope}</span>
      </div>
    </div>

    <!-- Center VS / Modifiers -->
    <div class="dh-duality-center">
      <div class="dh-total-display">
        <span class="dh-total-label">TOTAL</span>
        <span class="dh-total-value">${duality.total}</span>
      </div>
      <div class="dh-modifier-tag">
        ${duality.traitMod >= 0 ? `+${duality.traitMod}` : duality.traitMod} ${safeAttr(meta.trait || '')}
      </div>
    </div>

    <!-- Fear Die -->
    <div class="dh-die-container dh-die-fear ${duality.fear > duality.hope ? 'dh-dominant' : ''}">
      <span class="dh-die-label">${localize('DH.Duality.FearDie', 'FEAR')}</span>
      <div class="dh-die-shape">
        <span class="dh-die-value">${duality.fear}</span>
      </div>
    </div>
  </div>

  <!-- Outcome Banner -->
  <div class="dh-outcome-banner ${duality.badgeClass}">
    <div class="dh-outcome-title">
      ${duality.isCritical ? '✦ ' : ''}${localize(duality.labelKey, duality.outcome)}${duality.isCritical ? ' ✦' : ''}
    </div>
    <div class="dh-outcome-desc">${outcomeText}</div>
  </div>

  <!-- Interactive Action Buttons -->
  <div class="dh-card-actions">
    ${duality.hopeGain > 0 ? `
      <button type="button" class="dh-card-btn dh-btn-hope" data-action="dh-claim-hope" data-actor-id="${actorId}">
        ${localize('DH.Duality.ClaimHope', `+${duality.hopeGain} Hope`)}
      </button>
    ` : ''}

    ${duality.stressClear > 0 ? `
      <button type="button" class="dh-card-btn dh-btn-stress" data-action="dh-clear-stress" data-actor-id="${actorId}">
        ${localize('DH.Duality.ClearStress', 'Clear 1 Stress')}
      </button>
    ` : ''}

    ${meta.weaponDamage ? `
      <button type="button" class="dh-card-btn dh-btn-damage" data-action="dh-roll-damage" data-formula="${safeAttr(meta.weaponDamage)}" data-type="${safeAttr(meta.damageType || 'physical')}" data-actor-id="${actorId}">
        ${localize('DH.Duality.RollDamage', 'Roll Damage')} (${safeAttr(meta.weaponDamage)})
      </button>
    ` : ''}
  </div>
</div>
  `.trim();
}

/**
 * Renders weapon damage rolls.
 */
function renderDamageRollCard(roll, esc) {
  const meta = roll?.meta || {};
  const total = roll.total ?? 0;
  const dmgType = safeAttr(meta.damageType || 'physical');
  const actorId = safeAttr(meta.actorId || roll.actorId || '');
  const weapon = safeAttr(meta.weapon || 'Weapon');

  return `
<div class="dh-roll-card dh-damage-card" data-actor-id="${actorId}">
  <div class="dh-card-header">
    <div class="dh-card-title-group">
      <span class="dh-card-crest">💥</span>
      <span class="dh-card-title">${weapon} Damage</span>
    </div>
    <span class="dh-damage-type-badge ${dmgType}">${dmgType.toUpperCase()}</span>
  </div>

  <div class="dh-damage-total-box">
    <span class="dh-damage-total-number">${total}</span>
    <span class="dh-damage-formula">${safeAttr(roll.formula || '')}</span>
  </div>

  <div class="dh-threshold-reference">
    <span class="dh-ref-item">Minor: 1 HP</span>
    <span class="dh-ref-sep">•</span>
    <span class="dh-ref-item">Major: 2 HP</span>
    <span class="dh-ref-sep">•</span>
    <span class="dh-ref-item">Severe: 3 HP</span>
  </div>

  <!-- Apply Damage Button -->
  <div class="dh-card-actions">
    <button type="button" class="dh-card-btn dh-btn-damage" data-action="dh-apply-damage" data-damage="${total}">
      🎯 ${localize('DH.Combat.ApplyDamage', 'Aplicar Dano ao Alvo')}
    </button>
  </div>
</div>
  `.trim();
}

/**
 * Returns user-facing outcome text according to SRD 2.0.
 * @param {string} outcome
 * @returns {string}
 */
function getOutcomeDescription(outcome) {
  switch (outcome) {
    case 'CRITICAL':
      return 'Doubles rolled! Automatic Critical Success. Take +1 Hope or clear 1 Stress!';
    case 'SUCCESS_WITH_HOPE':
      return 'The action succeeds, and you gain 1 Hope!';
    case 'SUCCESS_WITH_FEAR':
      return 'The action succeeds, but the GM gains 1 Fear (or introduces a complication).';
    case 'FAILURE_WITH_HOPE':
      return 'The action fails, but you gain 1 Hope for your effort.';
    case 'FAILURE_WITH_FEAR':
      return 'The action fails and the GM makes a hard move and gains 1 Fear.';
    case 'HOPE_DOMINANT':
      return 'Hope Die is dominant (+1 Hope).';
    case 'FEAR_DOMINANT':
      return 'Fear Die is dominant (GM gains 1 Fear).';
    default:
      return '';
  }
}

/**
 * Initializes global click handlers for chat card interactive buttons.
 */
export function registerChatCardListeners() {
  if (typeof document === 'undefined') return;

  document.addEventListener('click', async (e) => {
    const target = e.target.closest('[data-action^="dh-"]');
    if (!target) return;

    const action = target.dataset.action;
    const actorId = target.dataset.actorId;

    if (!actorId) return;

    // Fetch Actor from Loom game state
    const actor = window.Loom?.game?.actors?.get
      ? window.Loom.game.actors.get(actorId)
      : (window.Loom?.actors?.get ? window.Loom.actors.get(actorId) : null);

    const notify = (msg, type = 'info') => {
      if (typeof showToast === 'function') {
        showToast(msg, type);
      } else if (window.Loom?.showToast) {
        window.Loom.showToast(msg, type);
      }
    };

    if (action === 'dh-claim-hope') {
      if (!actor) {
        notify('Ator não encontrado.', 'error');
        return;
      }
      const currentHope = Number(actor.systemData?.hope?.value || 0);
      const maxHope = Number(actor.systemData?.hope?.max || 6);
      if (currentHope < maxHope) {
        await actor.update({ 'systemData.hope.value': currentHope + 1 });
        notify('+1 Esperança adicionada à ficha!', 'success');
      } else {
        notify('Esperança já está no máximo!', 'warning');
      }
    } else if (action === 'dh-clear-stress') {
      if (!actor) {
        notify('Ator não encontrado.', 'error');
        return;
      }
      const currentStress = Number(actor.systemData?.stress?.value || 0);
      if (currentStress > 0) {
        await actor.update({ 'systemData.stress.value': currentStress - 1 });
        notify('1 Estresse aliviado!', 'success');
      } else {
        notify('Personagem não possui Estresse marcado!', 'info');
      }
    } else if (action === 'dh-roll-damage') {
      const formula = target.dataset.formula;
      const dmgType = target.dataset.type || 'physical';
      const doRoll = typeof dispatchRoll === 'function' ? dispatchRoll : window.Loom?.dispatchRoll;

      if (formula && doRoll) {
        await doRoll({
          formula,
          actorId,
          meta: {
            system: 'Daggerheart',
            rollType: 'damage',
            damageType: dmgType,
          },
        });
      }
    } else if (action === 'dh-apply-damage') {
      const damage = Number(target.dataset.damage) || 0;

      // 1. Identify target actor: Controlled actors -> User targets -> Dialog fallback
      let targetActor = null;
      const controlled = window.Loom?.canvas?.getControlledActors?.() || [];
      if (controlled.length > 0) {
        targetActor = controlled[0];
      } else if (window.Loom?.user?.targets && window.Loom.user.targets.size > 0) {
        const targetToken = Array.from(window.Loom.user.targets)[0];
        targetActor = targetToken?.actor || window.Loom?.game?.actors?.get?.(targetToken?.actorId);
      }

      // Fallback: If no target selected, select from world actors
      if (!targetActor) {
        const actorsMap = window.Loom?.game?.actors || [];
        const actorOptions = [];
        if (actorsMap.forEach) {
          actorsMap.forEach((a) => {
            actorOptions.push({ value: a.id, label: a.name || 'Sem Nome' });
          });
        }
        if (actorOptions.length > 0 && typeof showSelectDialog === 'function') {
          const selectedId = await showSelectDialog('Selecionar Alvo', 'Quem receberá este dano?', actorOptions);
          if (selectedId) {
            targetActor = window.Loom?.game?.actors?.get?.(selectedId);
          }
        }
      }

      if (!targetActor) {
        notify('Nenhum alvo selecionado. Mire ou selecione um token no mapa!', 'warning');
        return;
      }

      // 2. Resolve thresholds
      const sys = targetActor.systemData || {};
      const derived = sys.derived || {};
      const major = Number(derived.thresholdMajor || sys.thresholds?.major || sys.thresholds?.baseMajor || 7);
      const severe = Number(derived.thresholdSevere || sys.thresholds?.severe || sys.thresholds?.baseSevere || 14);
      const availableArmorSlots = Math.max(0, Number(sys.armor?.slots || 6) - Number(sys.armor?.slotsMarked || 0));

      const baseResolution = resolveDamage(damage, { major, severe }, 0);

      // 3. Armor mitigation prompt if target has available armor slots and base severity > 0
      let slotsToSpend = 0;
      if (availableArmorSlots > 0 && baseResolution.baseHpToMark > 0 && typeof showSelectDialog === 'function') {
        const options = [
          { value: '0', label: `Não gastar armadura (${baseResolution.baseHpToMark} HP marcados)` }
        ];
        if (availableArmorSlots >= 1 && baseResolution.baseHpToMark >= 1) {
          options.push({ value: '1', label: `Gastar 1 Slot de Armadura (${Math.max(0, baseResolution.baseHpToMark - 1)} HP)` });
        }
        if (availableArmorSlots >= 2 && baseResolution.baseHpToMark >= 2) {
          options.push({ value: '2', label: `Gastar 2 Slots de Armadura (${Math.max(0, baseResolution.baseHpToMark - 2)} HP)` });
        }
        if (availableArmorSlots >= 3 && baseResolution.baseHpToMark >= 3) {
          options.push({ value: '3', label: `Gastar 3 Slots de Armadura (${Math.max(0, baseResolution.baseHpToMark - 3)} HP)` });
        }

        const choice = await showSelectDialog(
          `Mitigação de Armadura — ${targetActor.name}`,
          `Dano recebido: ${damage} (${baseResolution.baseSeverity}). Limiares: Major ${major} / Severe ${severe}. Escolha quantos slots marcar:`,
          options
        );
        slotsToSpend = choice !== null && choice !== undefined ? Number(choice) : 0;
      }

      // 4. Apply damage to actor
      const finalResolution = resolveDamage(damage, { major, severe }, slotsToSpend);
      const result = await applyDamageToActor(targetActor, finalResolution);

      const msg = `${targetActor.name} sofreu ${damage} de dano [${finalResolution.baseSeverity}]: ` +
        `${result.hpMarked} HP marcado(s)` +
        (slotsToSpend > 0 ? ` (${slotsToSpend} slot(s) de armadura gasto(s))` : '') +
        `! [HP: ${result.currentHp}/${result.maxHp}]`;

      notify(msg, 'info');

      // Floating text on canvas if available
      if (window.Loom?.canvas?.showFloatingText) {
        window.Loom.canvas.showFloatingText(targetActor, `-${result.hpMarked} HP`, '#ef4444');
      }
    }
  });
}
