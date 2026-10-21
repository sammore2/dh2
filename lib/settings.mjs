// System settings (Configurações do Mundo -> Daggerheart).
const MODULE = 'dh';

export function registerSettings() {
  try {
    window.Loom?.settings?.register(MODULE, 'damageApplier', {
      name: 'Quem aplica o dano',
      hint: 'O dano só é aplicado no botão "Aplicar Dano" do card, depois da rolagem. Jogador: quem rolou também vê o botão. Mestre: só o Mestre vê o botão.',
      scope: 'world',
      config: true,
      type: String,
      default: 'player',
      choices: { player: 'Jogador e Mestre', gm: 'Só o Mestre' },
    });
  } catch {
    // Already registered
  }
}

/** 'player' (default) or 'gm' */
export function damageApplier() {
  try {
    return window.Loom?.settings?.get(MODULE, 'damageApplier') === 'gm' ? 'gm' : 'player';
  } catch {
    return 'player';
  }
}
