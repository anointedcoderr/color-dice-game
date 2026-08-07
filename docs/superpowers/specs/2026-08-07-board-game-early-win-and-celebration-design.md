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
check, also check whether the active player has already secured an
unbeatable lead: their new score exceeds the best possible final score of
every other player, assuming that player claimed every single tile still
left on the board.

Formula, computed once per `confirmMatched()` call using the just-updated
state:

```
boardRemaining = sum of every color's updated remaining count
activeScore    = the active player's updated score
maxOtherScore  = the highest current score among every OTHER player
clinched       = activeScore > maxOtherScore + boardRemaining
boardEmpty     = boardRemaining === 0
end the game (go to the "ended" step) if clinched OR boardEmpty
```

This subsumes the existing board-empty check (`boardRemaining === 0` is a
simpler, equivalent way to compute the same condition the current code
gets from `COLORS.every(c => remaining[c] === 0)`, since every count is
already floored at 0).

Worked check against the user's example: 24 total tiles, 2 players, active
player just reached 13. Whatever the other player currently has, call it
`Y`, the amount still unclaimed is `24 - 13 - Y`. The clinch formula becomes
`13 > Y + (24 - 13 - Y)`, which simplifies to `13 > 11`, always true,
independent of `Y`. It fires at exactly 13, matching the example exactly.

This also generalizes correctly to 3 players (a player clinches once no
single rival, even if they somehow claimed every remaining tile, could
reach or exceed the leader) and to any tile count, not just 4-per-color.

A clinch can never coincide with a tie (it requires a strict `>`), so the
existing tie-handling on the "ended" screen (joint winners, no arbitrary
tiebreak) is unaffected and still only reachable through the board-empty
path.

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
