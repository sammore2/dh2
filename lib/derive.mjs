// Pure derivation of character values from the embedded items (SRD 2.0). Never persisted: lives in systemData.derived.
const TRAITS = ['agility', 'strength', 'finesse', 'instinct', 'presence', 'knowledge'];

export function deriveCharacter(sys, items = []) {
  const n = (v) => Number(v ?? 0);
  const level = n(sys.level ?? 1);
  const bonus = sys.bonus ?? {};
  const find = (type, ok = () => true) => items.find((i) => i.type === type && ok(i.data ?? {})) ?? null;
  const classItem = find('class');
  const armorItem = find('armor', (d) => d.equipped === true);
  const subclassItem = find('subclass');
  const mods = armorItem?.data.modifiers;

  return {
    classItem,
    subclassItem,
    ancestryItem: find('ancestry'),
    communityItem: find('community'),
    armorItem,
    hpMax: (classItem?.data.hp ?? 6) + n(bonus.hp),
    stressMax: 6 + n(bonus.stress),
    hopeMax: 6,
    evasion: n(classItem?.data.evasion) + n(bonus.evasion) + n(mods?.evasion),
    armorScore: Math.min(12, n(armorItem?.data.baseScore) + n(bonus.armorScore)),
    thresholdMajor: (armorItem ? n(armorItem.data.baseMajor) + level : level) + n(bonus.thresholds) + n(mods?.thresholds),
    thresholdSevere: (armorItem ? n(armorItem.data.baseSevere) + level : level * 2) + n(bonus.thresholds) + n(mods?.thresholds),
    traitMod: Object.fromEntries(TRAITS.map((t) => [t, n(sys.attributes?.[t]) + n(mods?.traits?.[t])])),
    spellcastTrait: subclassItem?.data.spellcastTrait || null,
    domains: classItem?.data.domains ?? [],
  };
}
