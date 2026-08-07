# Board Game: Early Win Detection and Winner Celebration

Date: 2026-08-07
Status: Approved by user, ready for implementation planning

## 1. Problem

Today the Board Game mode only ends when the board is fully depleted (every
color's remaining count reaches 0). The user wants the game to end earlier,
the moment a player has mathematically secured the win, using their own
example: with 4 tiles per color (24 total) and 2 players, the game should
end and award the winner as soon as they reach 13 correct matches, since no
other player could possibly catch up from there.

There is also no celebration when a game ends. The user wants a winner
announcement with a "popup balloon" visual and a cheer sound.

## 2. Early win detection ("mathematical clinch")

After every **Matched** outcome, in addition to the existing board-empty
check, also check whether *any* player (not only the one who just matched)
has already secured an unbeatable lead: their score exceeds the best
possible final score of every other player, assuming a single rival
claimed every tile still left on the board.

Formula, computed once per `confirmMatched()` call using the just-updated
state, checked for every player:

```
boardRemaining = sum of every color's updated remaining count
for each player p:
  bestRival(p) = the highest score among every player OTHER than p
  p has clinched if p.score > bestRival(p) + boardRemaining
clinched   = true if ANY player has clinched
boardEmpty = boardRemaining === 0
end the game (go to the "ended" step) if clinched OR boardEmpty
```

**Checking every player, not just the one who just matched, is load-bearing
for 3+ players.** An earlier draft of this formula checked only the active
player. That is correct for 2 players (the active player's own score is
the only one that can change the gap), but breaks for 3: a rival's match
still shrinks `boardRemaining` without raising the leader's own best
challenger, so the leader can cross the clinch threshold on a turn that
isn't theirs, and an active-player-only check would miss it.

Worked counter-example: 3 players, scores 5 / 3 / 1, 2 tiles left on the
board. Not yet clinched: the leader's bar is `bestRival(5) + boardRemaining
= 3 + 2 = 5`, and `5 > 5` is false. Now the third player (score 1) matches:
their score becomes 2, `boardRemaining` drops to 1. The leader did not
act, but their bar just changed to `3 + 1 = 4`, and `5 > 4` is now true.
An active-player-only check would only re-evaluate the player who just
matched (score 2 against a bar of `5 + 1 = 6`, not clinched) and never
notice the leader crossed their own threshold. Checking every player on
every match closes this: the very next `confirmMatched()` call, regardless
of whose turn it was, re-evaluates everyone and catches it.

Because `p.score > bestRival(p) + boardRemaining` requires a strict `>`,
at most one player can ever satisfy it (anyone who does is, by
definition, the unique highest scorer), so "who clinched" and "who the
recap displays as winner" can never disagree, and a clinch can never
coincide with a tie. The existing tie-handling on the "ended" screen
(joint winners, no arbitrary tiebreak) is unaffected and still only
reachable through the board-empty path.

`boardRemaining === 0` is a simpler, equivalent way to compute what the
prior code got from `COLORS.every(c => remaining[c] === 0)`, since every
count is already floored at 0, so this subsumes the existing board-empty
check rather than running alongside a separate copy of it.

Worked check against the user's example: 24 total tiles, 2 players, active
player just reached 13. Whatever the other player currently has, call it
`Y`, the amount still unclaimed is `24 - 13 - Y`. The clinch formula becomes
`13 > Y + (24 - 13 - Y)`, which simplifies to `13 > 11`, always true,
independent of `Y`. It fires at exactly 13, matching the example exactly.

## 3. Winner celebration

**Trigger:** once, when `step` transitions to `"ended"`, and only when
there is a **sole** winner (`winners.length === 1`). A tie is not
celebrated, matching the existing "no arbitrary tiebreak" stance, since
there is no single person to celebrate for.

**Visual:** a new component, `apps/web/src/components/Celebration.tsx`,
mounted on top of the existing "Game over" screen content (not replacing
it). Two effects, both built with Framer Motion (already a project
dependency, already used by `Dice.tsx`, so no new package):
- 8 small balloon shapes (colored circles or rounded rectangles with a
  short string beneath, using the game's existing color tokens for
  variety) rise from the bottom of the screen and fade out, staggered so
  they do not all move in lockstep.
- A confetti burst: roughly 30 to 40 small colored pieces originate near
  the top center and scatter outward and downward with rotation, also
  staggered.

Both render inside a `fixed inset-0 pointer-events-none overflow-hidden`
container so they never block clicking "Play again" / "New players" and
never cause a layout shift or scrollbar. The component removes itself
(unmounts, not just fades to invisible) after about 3 seconds, driven by a
timeout in the mounting page, not by the component polling its own
animation state.

**Sound:** one new function in `apps/web/src/lib/sound.ts`, `playCheer()`,
following the exact conventions already established there (lazy shared
`AudioContext`, try/catch around every Web Audio call so a failure never
breaks gameplay, no external audio file). Unlike the existing dice sounds
(noise-burst based, for a percussive "clack"), this is tonal: a short
ascending arpeggio of 4 to 5 bright tones using oscillators, giving a
"ta-da" fanfare feel distinct from the dice rattle and landing knock.

**Wiring:** in `apps/web/src/app/board/page.tsx`, a `useEffect` keyed on
`step` fires `playCheer()` and flips a local `showCelebration` boolean to
true the moment `step` becomes `"ended"` and there is a sole winner; a
timeout inside that same effect flips it back to false (and the effect's
cleanup clears that timeout if the user navigates away first, e.g. via
"Play again" before the 3 seconds elapse). `<Celebration />` renders
conditionally on `showCelebration`.

## 4. Scope

Board Game mode only. Quick Play (`apps/web/src/app/local/page.tsx`) has no
cumulative "winner" concept across a session (its recap lists every round
played, not a running score), so there is nothing for either the
early-win check or the celebration to attach to there. Not touched.

## 5. Files affected

- Modify: `apps/web/src/app/board/page.tsx` (win-check formula, celebration
  trigger effect and mount point)
- Create: `apps/web/src/components/Celebration.tsx`
- Modify: `apps/web/src/lib/sound.ts` (add `playCheer()`)

No backend changes. No new dependencies. No database changes.

## 6. Error handling / edge cases

- Sound failure (blocked autoplay, no audio hardware, etc.): silently
  no-ops, exactly like the existing dice sounds, never blocks the win
  screen from showing.
- If the active player's clinch coincides with the board also emptying on
  that same tile (both conditions true at once), the outcome is identical
  either way: that one game ends, `step` becomes `"ended"`. No special
  handling needed.
- "Play again (same players)" and "New players" already exist and are
  unaffected; a fresh game always resets `showCelebration` to false along
  with everything else, so the celebration cannot bleed into a new game.

## 7. Out of scope

- No celebration or early-win logic for Quick Play (see Section 4).
- No celebration for ties.
- No persistence of "games won" across sessions; this is purely a
  same-session, client-only feature, consistent with the rest of Board
  Game mode.

## 8. Amendments during implementation

Three things were added or changed beyond what this spec originally
called for, all decided during code review rather than planned upfront:

- **The clinch formula changed from active-player-only to all-players.**
  Covered in full in Section 2; the version originally in this document
  was found to under-detect in 3-player games and has been corrected in
  place rather than left as a historical artifact, since a wrong formula
  in the design of record would mislead the next reader more than it
  would inform them.
- **`prefers-reduced-motion` support.** `Celebration` calls Framer
  Motion's `useReducedMotion()` and renders nothing when it is set,
  instead of playing the 44-element burst. Not in the original visual
  design; added because a full-viewport animation of that scale is
  exactly the class of motion that causes vestibular discomfort for users
  with that OS-level preference set. The winner announcement text and the
  cheer sound are unaffected, so reduced-motion users still get the win
  confirmation, just not the decorative burst.
- **`<Celebration />` is a sibling of the "ended" screen's spacing
  wrapper, not a child inside it.** The original plan nested it inside
  the `space-y-6` container alongside the heading and recap card. That
  caused a measured 24px layout shift: Tailwind's `space-y-*` utility
  applies its margin based on DOM sibling order, not layout
  participation, so a `position: fixed` element still counts as a
  sibling for that selector even though it takes up no visual space
  itself. Moving it outside the spacing container (as a sibling wrapped
  in a Fragment) removes it from that sibling count entirely.

Two small, unplanned additions also shipped in the same work, requested
mid-implementation rather than specified upfront: escalating streak
emojis on the playing screen's player cards (fire at streak 2-3, double
fire at 4-6, a rocket at 7+), and an "ended early" acknowledgement in the
Game over recap text distinguishing a clinched win from one that ran the
board all the way empty.
