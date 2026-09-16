# Number Wizard

A math-practice game for one learner, wrapped in a Dungeons & Dragons-style adventure. This glossary is the project's vocabulary; keep implementation out of it.

## Language

### People

**Player**:
The learner at the screen. Today that is one person, Noah.
_Avoid_: user, student, kid, learner

**Guide**:
The adult who reviews Attempt history offline and adjusts the Learning Plan.
_Avoid_: parent, admin, teacher

**Character**:
The Player's in-game hero. One Character per Player.
_Avoid_: avatar, hero, profile

### Learning

**Skill**:
One of the four math areas, in a fixed chain: multiplication table (0 to 12), multi-digit multiplication, powers and exponents, long division with remainders. Each Skill builds on the one before it.
_Avoid_: topic, focus area, subject, concept, unit

**Problem**:
A single math question with one correct final answer, drawn from one Skill. Multi-digit multiplication and long division Problems also require Work.
_Avoid_: question, exercise, item

**Work**:
The intermediate values the Player enters on the way to a final answer: partial products for multiplication, the divide-multiply-subtract-bring-down steps for division. Work is checked for correctness alongside the final answer.
_Avoid_: scratch, steps, showing work

**Fact**:
The smallest thing the Player can master within a Skill. In the multiplication table a Fact is one commutative pair (3×4 and 4×3 are the same Fact), so there are 91. In the other three Skills a Fact is a Tier.
_Avoid_: item, card, question

**Tier**:
A size class of Problem within a Skill, such as 2-digit by 1-digit multiplication or 3-digit by 2-digit division. Each Tier has its own speed threshold and is mastered and reviewed like any other Fact.
_Avoid_: difficulty, level, band, stage

**Attempt**:
One Player answer to one Problem, including how long it took and whether it was correct. The unit of everything recorded about learning.
_Avoid_: response, result, answer record

**Mastered**:
The state of a Fact whose last three Attempts were all correct, with all Work correct, and each faster than the Skill's speed threshold (four seconds for the multiplication table). One wrong, slow, or Glancing Blow Attempt returns it to Learning.
_Avoid_: known, learned, complete

**Learning**:
The state of any Fact that is not Mastered.
_Avoid_: unknown, weak, in progress

**Due**:
A Mastered Fact whose spaced-repetition date has arrived. Encounters serve Due Facts before anything else.
_Avoid_: scheduled, stale, expired

**Ready**:
The state of a Skill in which at least 80% of its Facts are Mastered. Ready is a signal to the Guide; only the Learning Plan unlocks the next Skill.
_Avoid_: complete, passed, finished

**Review**:
A Problem served from an earlier Skill to keep it fresh after the Player has moved on.
_Avoid_: refresher, recap, spaced practice

**Learning Plan**:
A small settings file the Guide imports into the game, produced offline with AI help from Attempt history. It decides which Skills are unlocked, what to emphasise, and may list explicit Problems to serve. It never contains story.
_Avoid_: curriculum, lesson plan, config

**Export**:
The JSON file the game produces on request: every Attempt with timestamps, its Encounter, and Character state. The Guide's raw material.
_Avoid_: save, backup, dump, log

### Adventure

**Quest**:
A hand-authored story arc themed on one Skill: several Encounters joined by comic-panel story beats. The campaign is a linear sequence of Quests. Quests are content in the repo, never imported at runtime.
_Avoid_: level, chapter, mission, campaign

**Encounter**:
A short combat scene within a Quest in which each Problem is one Spell. The unit of a play session. Monster HP is set per Encounter in Quest data.
_Avoid_: battle, fight, round, session, level

**Spell**:
The Character's attack, cast by answering a Problem. Its outcome is a Hit, a Glancing Blow, or a Miss.
_Avoid_: attack, strike, turn

**Hit**:
The outcome of a correct Attempt with all Work correct: the monster takes damage.
_Avoid_: success, correct, point

**Glancing Blow**:
The outcome of a correct final answer with some Work wrong: half damage, and the wrong Work cells are shown.
_Avoid_: partial credit, weak hit

**Critical Hit**:
A Hit whose Attempt was faster than the Skill's speed threshold. Deals double damage.
_Avoid_: crit, bonus, speed bonus

**Miss**:
The outcome of an incorrect Attempt: the Character loses HP.
_Avoid_: failure, mistake, wrong

**Retreat**:
How an Encounter ends when the Character's HP reaches zero. The Player keeps all XP earned; the monster heals. Nothing is ever lost.
_Avoid_: defeat, death, game over, loss

**Level**:
The Character's rank, reached by accumulating XP. Each Level raises max HP by one, to a cap. The only meaning of "level" in this project.
_Avoid_: rank, tier, stage

**Title**:
The name attached to a band of Levels, such as Apprentice, Adept, Wizard. The visible face of Level.
_Avoid_: rank, class

**Loot**:
A cosmetic item the Character keeps, such as a hat or a staff skin, dropped at random from the Quest's Loot pool when an Encounter is won. Loot never affects combat.
_Avoid_: reward, drop, item, gear

**Achievement**:
A trophy awarded for a mastery milestone or a notable feat, shown in the trophy case.
_Avoid_: badge, medal, trophy

**Map**:
The world map that fills in one region per completed Quest. Regions whose Quest's Skill is not yet unlocked are Fogged.
_Avoid_: overworld, progress bar

**Fogged**:
The state of a Map region whose Quest cannot start because its Skill is locked. Only the Learning Plan lifts Fog.
_Avoid_: locked, hidden, greyed out

**Survival**:
A timed run of back-to-back Encounters against the same monster: five minutes, full HP each fight, no story. The score is the number of Encounters won before the clock ends; the fight in progress at the buzzer ends as a Retreat. The only place a clock is shown.
_Avoid_: challenge mode, time attack, endless mode

**Free Roam**:
An Encounter in a completed Map region with no story, following the normal Problem selection rules. Where Review happens once a Quest is done.
_Avoid_: practice mode, sandbox, endless mode
