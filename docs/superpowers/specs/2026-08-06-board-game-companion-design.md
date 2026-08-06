# Board Game Companion Design Spec

Date: 2026-08-06
Status: Approved by user, ready for implementation planning

## 1. Problem

The user has a physical board game: a board of hidden colored tiles (the six
colors already used by the dice: red, black, blue, green, yellow, white).
Play works like this:

1. The active player rolls a color die.
2. They pick one tile off the physical board.
3. If the tile matches the rolled color, they keep it (score +1) and roll
   again. Their turn continues indefinitely as long as they keep matching.
4. The moment they pick wrong, their turn ends and passes to the next player.
5. The game ends when the board has no tiles left. Whoever holds the most
   correctly-matched tiles wins.

This turn structure, where one player rolls repeatedly until they miss and
the number of turns varies per player instead of a fixed "round" where
everyone acts once, does not fit Quick Play's model (every player taps
exactly once per round, then the round ends). The app also cannot observe
the physical board: it has no way to know what tile a player actually
picked. This spec defines a new mode that works *with* those constraints
instead of against them.

## 2. Goals / non-goals

**Goals**
- Provide a trustworthy, unpredictable dice roll (server-generated, same
  trust principle as the rest of the app: never client-computed).
- Track whose turn it is, each player's running score, and their current
  streak, purely from the group self-reporting "matched" or "missed" after
  each roll (the app cannot verify the physical pick itself).
- Model the board's remaining tile count per color, so the app can
  auto-detect an impossible roll (a color with zero tiles left) and
  auto-detect when the game is over (board fully depleted).

**Non-goals (explicit, per user's choice of the ephemeral architecture)**
- No database persistence for this mode. A page refresh loses the in-progress
  game. This was chosen over the alternative (persisted, `/verify`-integrated,
  matching Quick Play's rigor) for faster delivery; the user made this choice
  knowingly after the trade-off was presented.
- No `/verify` page integration for these rolls: there is nothing persisted
  to verify against later.
- No seed-commitment/reveal ceremony for the roll. Quick Play and online
  rooms publish a SHA-256 commitment before revealing a seed so a *stored*
  result can be independently re-derived later. Nothing is stored here, so
  that ceremony has no verification target; it would just be theater.
  Instead the roll is a plain, immediate, cryptographically-random server
  pick.
- No multi-device/online play. Single device, physical board, pass-and-play,
  same spirit as Quick Play.

## 3. User flow

### Setup
Same shape as Quick Play's setup step: player count (2 to 3), optional
player names. One new field: **tiles per color**, a positive integer from 1
to 50 (the upper bound was added during code review to keep a game
finishable), applied evenly across all 6 colors (e.g. entering 6 means 6
tiles of each color, 36 total on the board). Default suggestion: 6.

### Playing
One player is "active" at a time, starting with player 1 (turn order is
simple round-robin thereafter).

1. The active player taps **Roll**.
2. The dice plays its existing spin animation, sound, and fixed ~2s timing
   (all reused as-is, see Section 6), fed by a new roll result from the
   server.
3. When it settles:
   - **If the rolled color's remaining count is already 0:** auto-resolve as
     a miss. No confirmation needed, since there is nothing on the board
     that could match. Show a brief "No {color} left, miss!" message, then
     pass the turn.
   - **Otherwise:** show **"Matched" / "Missed"** for the group to report
     what actually happened on the physical board.
     - **Matched:** that color's remaining count drops by 1; active player's
       score +1 and streak +1; **Roll** re-enables for the *same* player.
     - **Missed:** active player's streak resets to 0; turn passes to the
       next player (wrapping around); **Roll** enables for the new player.
4. If every color's remaining count reaches 0, the game ends automatically
   (see Section 4): this is the real "board is empty" win condition. A
   manual **End game** control is always available too, as an override for
   miscounts or players who want to stop early.

### Layout (playing screen): "Layout B", as chosen by the user
Top to bottom:
- Player score cards in a row (one per player). The active player's card is
  highlighted; it shows a streak badge (e.g. "streak 3") only when their
  current streak is greater than 0.
- The Dice component plus Roll button, centered. (Originally scoped as
  smaller than Quick Play's dice since the scoreboard now shares the screen;
  shipped at the same size since the layout read fine as-is during testing.
  The `Dice` component has no size prop today, so revisit this only if the
  shared size turns out to actually crowd the screen in practice.)
- Match/Missed buttons, shown only while a roll is awaiting confirmation
  (hidden during the auto-resolved dead-color case, and hidden once
  confirmed until the next roll).
- A "tiles left on board" strip: 6 colored chips, one per color, each
  showing its live remaining count. A chip at 0 is visually dimmed (it
  explains why that color would auto-miss).
- **End game**, always available, same placement and style as Quick Play's.

### End of game
Recap screen, same spirit as Quick Play's "Game over" recap: final scores
per player, sorted descending. If multiple players share the top score, all
of them are shown as joint winners (no arbitrary tiebreak). No per-roll
history is available, since nothing was persisted; just the final tally.

### Losing the game to a refresh
Because state is client-only, accidentally reloading or navigating away
mid-game loses everything. To reduce that risk cheaply (no backend needed),
register a `beforeunload` handler while a game is in the "playing" step,
prompting the browser's native "leave this page?" confirmation. Removed when
the game ends or the player returns to setup.

## 4. State model (client-side only, React state in the page component)

No new Prisma models. Everything lives in the new page's component state,
mirroring the shape Quick Play already uses for its own client state:

- `players`: `{ name: string; score: number; streak: number }[]`
- `activePlayerIndex: number`
- `tilesPerColor: number` (the setup input)
- `remaining: Record<ColorName, number>`, starts at `tilesPerColor` for
  every color, only ever decremented on a "Matched" outcome
- `phase: DicePhase` ("neutral" | "spinning" | "settled"), reuses the exact
  type already defined by the `Dice` component
- `rolledColor: ColorName | null`, the just-rolled color awaiting a
  Matched/Missed decision (null while auto-resolving a dead color or while
  idle)
- `step: "setup" | "playing" | "ended"`

Game-over detection: after every "Matched" outcome, check whether every
color's remaining count is 0; if so, transition straight to `"ended"`.

## 5. Backend API

One new, fully stateless endpoint:

```
POST /api/board/roll
-> 200 { color: ColorName }
```

No request body, no auth, no persistence. Implementation: pick a uniformly
random index via Node's `crypto.randomInt(0, 6)` into the existing shared
`COLORS` array (`apps/server/src/shared/colors.ts`), the same array Quick
Play and online rooms already use, so color spelling and order can never
drift between modes. This keeps the "the color always comes from the
server, never computed client-side" trust principle intact without
pretending there's a commitment to verify later.

New file: `apps/server/src/routes/board.ts`, registered in
`apps/server/src/index.ts` next to the existing route registrations
(`app.use("/api/board", boardRoutes)`, public, no auth, same tier as
`/api/local`).

## 6. Reused building blocks (nothing new needed here)

- `Dice` component (`apps/web/src/components/Dice.tsx`): phase-driven spin
  animation, sound (rattle plus landing knock), unchanged.
- `TapButton` (`apps/web/src/components/TapButton.tsx`): reused with an
  explicit `label="Roll"` (not the default "Play"; the physical pick, not a
  tap, is what "playing" means here).
- `Card`, `Badge`, `Button`, `Input` from `apps/web/src/components/ui.tsx`.
- `COLOR_HEX`, `COLOR_TEXT_ON`, `colorLabel` from
  `apps/web/src/lib/colors.ts`.
- `apps/web/src/lib/sound.ts`: no changes, already generic.
- `api` helper (`apps/web/src/lib/api.ts`) for the one new fetch call.

## 7. New files

- `apps/web/src/app/board/page.tsx`: the mode itself (setup, playing, and
  ended steps, same structural pattern as `apps/web/src/app/local/page.tsx`
  but with the streak/turn-passing model from Section 3 instead of
  round-based turns).
- `apps/server/src/routes/board.ts`: the one roll endpoint.

## 8. Navigation / discoverability

- `apps/web/src/components/Nav.tsx`: add a `"Board Game"` link at `/board`,
  placed immediately after "Quick Play" (same visibility tier: public, no
  auth required, unlike Lobby/History/Profile).
- `apps/web/src/app/page.tsx` (homepage hero): add a second CTA next to the
  existing "Play on this device" button, pointing at `/board`.

## 9. Error handling

- Roll request fails (network/server error): same pattern already used in
  Quick Play. Show an inline error message, reset `phase` to `"neutral"`,
  let the player tap Roll again.
- `tilesPerColor` input: must be a positive integer; invalid input blocks
  starting the game with an inline validation message (same treatment as
  Quick Play's existing setup validation).

## 10. Explicitly out of scope for this spec

- Database persistence, `/verify` integration, and cross-device play (see
  Section 2 non-goals): all deliberately deferred, not overlooked.
- Editing/undoing a mis-tapped Matched/Missed after the fact. If the group
  mis-reports an outcome, they can only carry on or use "End game" and
  start over; no correction UI is included in this pass.
- Per-color custom tile counts (uneven board stocking): setup only takes one
  number applied to all 6 colors, per the user's choice.
