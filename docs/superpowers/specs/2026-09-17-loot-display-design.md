# Loot art and display: design

Settled 2026-09-17. Rules from `docs/design.md` (Adventure: Loot); vocabulary from `CONTEXT.md`;
Loot pool from `docs/superpowers/specs/2026-09-16-quest-1-content-design.md`.

## Scope

The drop reveal after a Quest win, a collection screen, a rule that drops prefer Loot not yet
owned, and eight Loot images. Nothing changes in the save shape.

Deferred: Loot on the portrait; Achievements sharing the collection screen; per-monster pools.

Amended 2026-09-19 after play testing: per-monster pools are in. Each monster drops its own Loot, a
random drop from the Quest's pool felt arbitrary. Each Quest has eight items and seven monsters, so
the boss holds two and gives them in pool order. `rollLootFor` takes the first unowned id in pool
order, and rolls from the pool only once all of it is owned. The Quest's `lootPool` is still the
full eight, for the Trophy Case and the art check.

## Rules

### Owned Loot

`ownedLoot(save)` is the set of `loot` ids on won Encounter records. Nothing else stores ownership.

### Drops

`cast` gives the first id in the template's pool that is not yet owned, in pool order; once every
id in the pool is owned, it rolls from the whole pool. Retreats and empty pools drop nothing, as
today. Survival templates have empty
pools, so Survival never drops.

### Reveal

After a won Quest fight, the result screen shows, under the XP line, a framed panel with the
item's image, "You found the Star Hat!" (the name from `LOOT`), and a "New!" badge when the id was
not owned before this fight. Nothing shows after a Retreat, after a Survival fight, or when the
record's `loot` is null.

### Collection

The title gains a "Loot" button between Play/Continue and Survival. The Loot screen lists the
eight pool items in `LOOT` order as framed slots: owned items show the image in colour and the
name; unowned show the same image as a dark silhouette with a "?" and no name. A "Title" button,
focused so Enter returns. Heading "Loot" and a count line "3 of 8".

### Art

Eight prompts in `docs/art-style.md` with the Loot spec sentence (transparent PNG). Files at
`public/art/loot/<id>.png`. A missing file renders nothing in the reveal and an empty slot in the
grid, never a broken icon.

## Interfaces

`src/game/loot.ts`

```ts
export function ownedLoot(save: SaveData): Set<string>;
export function rollLootFor(save: SaveData, pool: string[], rng?: () => number): string | null; // prefers unowned
```

`src/game/play.ts`: `cast` uses `rollLootFor(data, template.lootPool, rng)` instead of `rollLoot`.

`src/ui/`

```ts
LootArt({ id })                                   // like MonsterArt, class "loot"
ResultScreen gains `loot?: { id: string; name: string; isNew: boolean }`
LootScreen({ save, onTitle })
TitleScreen gains `onLoot`
```

`App`: after `onFinish`, derive `loot` from the last record when `status` is Won and `questId`
is not the Survival id: `isNew` is true when `ownedLoot(saveBefore)` lacked the id, where
`saveBefore` is the save at Encounter start (App already holds `xpBefore`; keep the save too, or
compute owned from `save.encounters.slice(0, -1)`).

## Testing

Invariants written from the design:
1. Eight Quest wins from an empty collection own all eight ids, for any RNG.
2. A Survival win never drops Loot (roster pools are empty), regardless of ownership.
3. `rollLootFor` never returns an owned id while an unowned one remains in the pool.
4. The Loot screen shows exactly `ownedLoot(save).size` names.
5. The reveal appears only after a won Quest fight with a recorded drop.
