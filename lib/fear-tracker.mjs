/**
 * @fileoverview Daggerheart SRD 2.0 — GM Fear Tracker HUD (Pure ESM)
 * Manages the GM Fear currency pool (0 to 12 tokens) with interactive HUD,
 * persistence, and chat broadcast integration.
 */

import { showToast } from '/_loom/sdk/index.js';

const STORAGE_KEY = 'dh_gm_fear_tokens';
const MAX_FEAR = 12;

export class FearTracker {
  constructor() {
    this.tokens = this._loadFear();
    this.element = null;
    this.isCollapsed = false;
  }

  _loadFear() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored !== null ? Math.max(0, Math.min(MAX_FEAR, Number(stored))) : 2;
    } catch {
      return 2;
    }
  }

  _saveFear() {
    try {
      localStorage.setItem(STORAGE_KEY, String(this.tokens));
    } catch {
      // Ignore
    }
  }

  getTokens() {
    return this.tokens;
  }

  setTokens(val) {
    this.tokens = Math.max(0, Math.min(MAX_FEAR, Number(val) || 0));
    this._saveFear();
    this.render();
  }

  addFear(amount = 1) {
    if (this.tokens >= MAX_FEAR) {
      if (typeof showToast === 'function') {
        showToast('Reserva de Medo do Mestre já atingiu o limite de 12 tokens!', 'warning');
      }
      return this.tokens;
    }
    this.tokens = Math.min(MAX_FEAR, this.tokens + amount);
    this._saveFear();
    this.render();
    if (typeof showToast === 'function') {
      showToast(`+${amount} Medo adicionado! Reserva atual: ${this.tokens}/${MAX_FEAR}`, 'info');
    }
    return this.tokens;
  }

  spendFear(amount = 1, reason = 'Ação de Medo') {
    if (this.tokens < amount) {
      if (typeof showToast === 'function') {
        showToast(`Medo insuficiente! Necessário: ${amount}, Atual: ${this.tokens}`, 'warning');
      }
      return false;
    }
    this.tokens -= amount;
    this._saveFear();
    this.render();

    if (typeof showToast === 'function') {
      showToast(`${amount} Medo gasto [${reason}]! Reserva restante: ${this.tokens}/${MAX_FEAR}`, 'info');
    }

    // Announce to chat
    if (typeof window !== 'undefined' && window.Loom?.api?.post) {
      window.Loom.api.post('/chat', {
        content: `
          <div class="dh-roll-card dh-fear-spend-card">
            <div class="dh-card-header">
              <div class="dh-card-title-group">
                <span class="dh-card-crest">🔮</span>
                <span class="dh-card-title">Mestre gastou ${amount} Medo!</span>
              </div>
              <span class="dh-card-dc">Restante: ${this.tokens}/${MAX_FEAR}</span>
            </div>
            <div class="dh-outcome-desc">${reason}</div>
          </div>
        `,
      }).catch(() => {});
    }

    return true;
  }

  toggleCollapse() {
    this.isCollapsed = !this.isCollapsed;
    this.render();
  }

  render() {
    if (typeof document === 'undefined') return;

    let container = document.getElementById('dh-gm-fear-tracker');
    if (!container) {
      container = document.createElement('div');
      container.id = 'dh-gm-fear-tracker';
      container.className = 'dh-fear-tracker-hud';
      document.body.appendChild(container);
    }

    if (this.isCollapsed) {
      container.innerHTML = `
        <div class="dh-fear-mini-pill" title="Clique para expandir o Rastreador de Medo">
          <span class="dh-fear-mini-icon">🔮</span>
          <span class="dh-fear-mini-val">${this.tokens}/${MAX_FEAR}</span>
        </div>
      `;
      container.onclick = () => this.toggleCollapse();
      return;
    }

    container.onclick = null;
    let tokensHtml = '';
    for (let i = 0; i < MAX_FEAR; i++) {
      const active = i < this.tokens;
      tokensHtml += `<span class="dh-fear-token-pip ${active ? 'active' : ''}" data-index="${i}" title="Token ${i + 1}"></span>`;
    }

    container.innerHTML = `
      <div class="dh-fear-tracker-card">
        <div class="dh-fear-header">
          <div class="dh-fear-title">
            <span class="dh-fear-crest">🔮</span>
            <span>Medo do Mestre</span>
            <span class="dh-fear-counter">(${this.tokens}/${MAX_FEAR})</span>
          </div>
          <button type="button" class="dh-fear-btn-close" title="Minimizar">✕</button>
        </div>

        <div class="dh-fear-tokens-strip">
          ${tokensHtml}
        </div>

        <div class="dh-fear-controls">
          <button type="button" class="dh-fear-ctrl-btn" data-action="gain-fear" title="Adicionar 1 Medo">+1 Medo</button>
          <button type="button" class="dh-fear-ctrl-btn" data-action="spend-fear" title="Gastar 1 Medo">-1 Medo</button>
          <button type="button" class="dh-fear-ctrl-btn danger" data-action="reset-fear" title="Zerar Reserva">Zerar</button>
        </div>
      </div>
    `;

    // Event handlers
    const closeBtn = container.querySelector('.dh-fear-btn-close');
    if (closeBtn) closeBtn.onclick = () => this.toggleCollapse();

    const pips = container.querySelectorAll('.dh-fear-token-pip');
    pips.forEach((pip) => {
      pip.onclick = () => {
        const idx = parseInt(pip.dataset.index, 10);
        this.setTokens((idx + 1 === this.tokens) ? idx : idx + 1);
      };
    });

    const gainBtn = container.querySelector('[data-action="gain-fear"]');
    if (gainBtn) gainBtn.onclick = () => this.addFear(1);

    const spendBtn = container.querySelector('[data-action="spend-fear"]');
    if (spendBtn) spendBtn.onclick = () => this.spendFear(1, 'Interrupção ou Ação do Mestre');

    const resetBtn = container.querySelector('[data-action="reset-fear"]');
    if (resetBtn) resetBtn.onclick = () => this.setTokens(0);
  }
}

// Global Singleton
let fearTrackerInstance = null;
export function initFearTracker() {
  if (typeof window === 'undefined') return null;
  if (!fearTrackerInstance) {
    fearTrackerInstance = new FearTracker();
    fearTrackerInstance.render();
    window.DaggerheartFearTracker = fearTrackerInstance;
  }
  return fearTrackerInstance;
}
