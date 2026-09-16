export const HpHearts = ({ hp, maxHp }: { hp: number; maxHp: number }) => (
  <span className="hearts" role="img" aria-label={`${hp} of ${maxHp} hearts`}>
    {'♥'.repeat(hp)}{'♡'.repeat(maxHp - hp)}
  </span>
);

export const MonsterPips = ({ hp, maxHp }: { hp: number; maxHp: number }) => (
  <span className="pips" role="img" aria-label={`${hp} of ${maxHp} monster hit points`}>
    {'▮'.repeat(hp)}{'▯'.repeat(maxHp - hp)}
  </span>
);
