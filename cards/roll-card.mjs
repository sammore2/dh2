import { resolveDamage, applyDamageToActor } from '../lib/damage.mjs';
import { api, dispatchRoll, showToast, showSelectDialog } from '/_loom/sdk/index.js';

/**
 * Escapes HTML attributes safely.
 * @param {string} str
 * @returns {string}
 */
function safeAttr(str) {
  if (!str) return '';
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Helper to localize strings or fallback.
 */
function localize(key, fallback = '') {
  return window.Loom?.i18n?.localize ? window.Loom.i18n.localize(key) : (fallback || key);
}

/**
 * Intercepts default roll card rendering to present rich Daggerheart Duality Dice details,
 * or weapon damage cards with inline Apply Damage actions.
 */
export function renderDaggerheartRollCard(roll, esc, original) {
  const meta = roll?.meta || {};
  if (meta.system !== 'Daggerheart') {
    return original(roll, esc);
  }

  // Handle Weapon Damage Cards
  if (meta.rollType === 'damage') {
    return renderWeaponDamageCard(roll, meta);
  }

  const isDuality = roll.meta?.isDuality;
  if (!isDuality) {
    return original(roll, esc);
  }

  const { hope, fear, isCrit, isSuccessWithHope, isSuccessWithFear, isFailureWithHope, isFailureWithFear, dc } = roll.meta;
  const trait = meta.trait || '';
  const modifier = Number(meta.modifier || 0);
  const modStr = modifier !== 0 ? (modifier > 0 ? `+${modifier}` : `${modifier}`) : '';
  const total = Number(roll.total ?? (hope + fear + modifier));

  // Visual cues
  const cardBorderClass = isCrit
    ? 'dh-card-crit'
    : isSuccessWithHope
    ? 'dh-card-hope-success'
    : isSuccessWithFear
    ? 'dh-card-fear-success'
    : isFailureWithHope
    ? 'dh-card-hope-failure'
    : 'dh-card-fear-failure';

  const badgeClass = isCrit
    ? 'dh-badge-crit'
    : (isSuccessWithHope || isFailureWithHope)
    ? 'dh-badge-hope'
    : 'dh-badge-fear';

  const outcomeTitle = isCrit
    ? localize('DH.Duality.CriticalSuccess', 'Critical Success!')
    : isSuccessWithHope
    ? localize('DH.Duality.SuccessHope', 'Success with Hope')
    : isSuccessWithFear
    ? localize('DH.Duality.SuccessFear', 'Success with Fear')
    : isFailureWithHope
    ? localize('DH.Duality.FailureHope', 'Failure with Hope')
    : localize('DH.Duality.FailureFear', 'Failure with Fear');

  const outcomeDesc = getOutcomeDescription({ isCrit, isSuccessWithHope, isSuccessWithFear, isFailureWithHope, isFailureWithFear });

  const actorId = safeAttr(roll.actorId || '');

  return `
<div class="dh-roll-card ${cardBorderClass}" data-actor-id="${actorId}">
  <!-- Header: Trait & Target DC -->
  <div class="dh-card-header">
    <div class="dh-card-title-group">
      <span class="dh-card-crest">⚔️</span>
      <span class="dh-card-title">${trait} ${localize('DH.Roll.Check', 'Check')}</span>
    </div>
    ${dc ? `<span class="dh-card-dc">DC ${dc}</span>` : ''}
  </div>

  <!-- Dice Breakdown: Hope (White/Gold) vs Fear (Dark/Purple) -->
  <div class="dh-dice-container">
    <div class="dh-die-slot dh-hope-slot ${hope > fear ? 'is-winner' : ''}">
      <span class="dh-die-label">${localize('DH.Duality.Hope', 'Hope')}</span>
      <span class="dh-die-val">${hope}</span>
    </div>
    <span class="dh-dice-vs">+</span>
    <div class="dh-die-slot dh-fear-slot ${fear > hope ? 'is-winner' : ''}">
      <span class="dh-die-label">${localize('DH.Duality.Fear', 'Fear')}</span>
      <span class="dh-die-val">${fear}</span>
    </div>
    ${modifier !== 0 ? `
      <span class="dh-dice-vs">${modifier > 0 ? '+' : '-'}</span>
      <div class="dh-modifier-tag">${Math.abs(modifier)}</div>
    ` : ''}
  </div>

  <!-- Outcome Banner & Total -->
  <div class="dh-outcome-banner">
    <div class="dh-outcome-badge ${badgeClass}">${outcomeTitle}</div>
    <div class="dh-roll-total">
      <span class="dh-total-num">${total}</span>
      <span class="dh-total-formula">(${hope} + ${fear}${modStr})</span>
    </div>
  </div>

  <!-- Narrative Outcome Description -->
  <div class="dh-outcome-desc">${outcomeDesc}</div>

  <!-- Optional Weapon Damage Action Button -->
  ${meta.weaponDamage ? `
    <div class="dh-card-actions">
      <button type="button" class="dh-card-btn dh-btn-damage" data-action="dh-roll-damage" data-formula="${safeAttr(meta.weaponDamage)}" data-type="${safeAttr(meta.damageType || 'physical')}" data-actor-id="${actorId}">
        ${localize('DH.Duality.RollDamage', 'Roll Damage')} (${safeAttr(meta.weaponDamage)})
      </button>
    </div>
  ` : ''}
</div>
  `.trim();
}

/**
 * Renders a specialized damage card with threshold info and apply button.
 */
function renderWeaponDamageCard(roll, meta) {
  const total = Number(roll.total ?? 0);
  const weapon = safeAttr(meta.weapon || 'Arma');
  const dmgType = safeAttr(meta.damageType || 'physical');
  const actorId = safeAttr(roll.actorId || '');

  return `
<div class="dh-roll-card dh-damage-card" data-actor-id="${actorId}">
  <div class="dh-card-header">
    <div class="dh-card-title-group">
      <span class="dh-card-crest">💥</span>
      <span class="dh-card-title">${weapon} — ${localize('DH.Combat.Damage', 'Dano')}</span>
    </div>
    <span class="dh-modifier-tag">${dmgType.toUpperCase()}</span>
  </div>

  <div class="dh-outcome-banner" style="margin: 12px 0;">
    <div class="dh-roll-total">
      <span class="dh-total-num">${total}</span>
      <span class="dh-total-formula">${roll.formula || ''}</span>
    </div>
  </div>

  <!-- Quick Damage Severity Reference (SRD 2.0) -->
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
      ⚡ ${localize('DH.Combat.ApplyDamage', 'Aplicar Dano ao Alvo')}
    </button>
  </div>
</div>
  `.trim();
}

/**
 * Returns user-facing outcome text according to SRD 2.0.
 */
function getOutcomeDescription(flags) {
  if (flags.isCrit) {
    return localize('DH.Duality.CritDesc', 'Sucesso Crítico! A ação foi brilhantemente bem-sucedida. O jogador limpa 1 Estresse ou ganha 1 Esperança adicional.');
  }
  if (flags.isSuccessWithHope) {
    return localize('DH.Duality.SuccessHopeDesc', 'Sucesso! Você supera o desafio e ganha 1 Esperança.');
  }
  if (flags.isSuccessWithFear) {
    return localize('DH.Duality.SuccessFearDesc', 'Sucesso com Consequência! A ação foi bem-sucedida, mas o Mestre ganha 1 Medo ou introduz uma complicação.');
  }
  if (flags.isFailureWithHope) {
    return localize('DH.Duality.FailureHopeDesc', 'Falha com Esperança. A ação falha ou encontra um revés, mas você ganha 1 Esperança.');
  }
  if (flags.isFailureWithFear) {
    return localize('DH.Duality.FailureFearDesc', 'Falha com Medo! A ação falha gravemente e o Mestre ganha 1 Medo.');
  }
  return '';
}

/**
 * Global chat delegation for interactive buttons in roll cards.
 */
export function registerChatCardListeners() {
  document.addEventListener('click', async (event) => {
    const target = event.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;

    // Roll damage formula from chat card
    if (action === 'dh-roll-damage') {
      const formula = target.dataset.formula;
      const dmgType = target.dataset.type || 'physical';
      const actorId = target.dataset.actorId;
      if (!formula) return;

      await dispatchRoll({
        formula,
        actorId,
        meta: {
          system: 'Daggerheart',
          rollType: 'damage',
          damageType: dmgType,
        },
      });
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

      const notify = (msg, type = 'info') => {
        if (typeof showToast === 'function') showToast(msg, type);
        else if (window.Loom?.showToast) window.Loom.showToast(msg, type);
      };

      if (!targetActor) {
        notify('Nenhum alvo selecionado. Mire ou selecione um token no mapa!', 'warning');
        return;
      }

      // 2. Resolve thresholds & equipped armor (SRD 2.0 T8)
      const sys = targetActor.systemData || {};
      const derived = sys.derived || {};
      const major = Number(derived.thresholdMajor ?? sys.thresholds?.major ?? 7);
      const severe = Number(derived.thresholdSevere ?? sys.thresholds?.severe ?? 14);

      // Find equipped armor item (null for adversaries or unarmored characters)
      const armorItem = (targetActor.items || []).find((i) => i.type === 'armor' && i.data?.equipped) || null;
      const armorScore = Math.min(12, Number(derived.armorScore ?? (armorItem ? (Number(armorItem.data?.baseScore ?? 0) + Number(sys.bonus?.armorScore ?? 0)) : 0)));
      const slotsMarked = Number(armorItem?.data?.slotsMarked ?? 0);
      const availableArmorSlots = armorItem && armorScore > 0 ? Math.max(0, armorScore - slotsMarked) : 0;

      const baseResolution = resolveDamage(damage, { major, severe }, 0);

      // 3. Armor mitigation prompt if target has equipped armor with available slots and baseHpToMark > 0 (L6025)
      let slotsToSpend = 0;
      if (availableArmorSlots > 0 && baseResolution.baseHpToMark > 0 && typeof showSelectDialog === 'function') {
        const options = [
          { value: '0', label: `Não gastar armadura (${baseResolution.baseHpToMark} HP marcados)` }
        ];
        const maxSpend = Math.min(availableArmorSlots, baseResolution.baseHpToMark);
        for (let n = 1; n <= maxSpend; n++) {
          options.push({
            value: String(n),
            label: `Gastar ${n} Slot${n > 1 ? 's' : ''} de Armadura (${baseResolution.baseHpToMark - n} HP)`,
          });
        }

        const choice = await showSelectDialog(
          `Mitigação de Armadura — ${targetActor.name}`,
          `Dano recebido: ${damage} (${baseResolution.baseSeverity}). Limiares: Major ${major} / Severe ${severe}. Escolha quantos slots marcar:`,
          options
        );
        slotsToSpend = choice !== null && choice !== undefined ? Number(choice) : 0;
      }

      // 4. Apply damage to actor & spend armor slots on item if equipped
      const finalResolution = resolveDamage(damage, { major, severe }, slotsToSpend);
      const result = await applyDamageToActor(targetActor, finalResolution, armorItem);

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
