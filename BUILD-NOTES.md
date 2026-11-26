# Copperwing Ridge — build notes

Entry for make.fun `best-flight-game-20261126-0057` ("Make the best flight game", $500, top 50 paid).
PREP ONLY — parent submits after the quota reset. Repo: https://github.com/axzss/best-flight-game-20261126-0057

## What it is

A bush-plane flight game in a pseudo-3D chase view over a seeded golden valley.
Plain Canvas 2D, no libraries, no network, WebAudio synth only. All code written
fresh in this session; the kit starter was used only as a structural model
(file layout, main.ts hand-in pattern, ?shot= staging).

- `game/src/config.js` — tuning + palette (1280x800 logical field, 1/60s fixed step)
- `game/src/random.js` — seeded mulberry32 RNG; no Math.random anywhere in game/src
- `game/src/terrain.js` — valley profile (seeded sine sums), field patchwork, trees,
  river, wall heights, ring placement, runway flattening
- `game/src/physics.js` — flight model: throttle, pitch/roll, turn drag, stall, fuel burn
- `game/src/missions.js` — 3 missions, ring passing/scoring, landing judgement, clock
- `game/src/input.js` — keyboard + mouse steering, one-shot action flags
- `game/src/audio.js` — WebAudio engine hum, ring chime, touchdown, crash, warnings
- `game/src/render.js` — chase projection, sky/ridges/ground/walls/runway/rings/trees,
  the copper plane (PK-CWR), lit instrument panel, HUD, title/pause/over screens
- `game/src/shots.js` — autopilot staging for ?shot=start|play|runway|end
- `game/src/main.js` — boot + fixed-step loop, attract mode on the title screen

## Missions (keys 1/2/3 on title/over screens)

1. RING RUN — fly all 10 rings; centre bonus, fuel bonus at the end.
2. GRASS STRIP LANDING — land on the strip at 4,200 m: under 74 KT, sink under 6, level.
3. TIMED COURSE — 8 rings against a 75 s clock; every ring buys 9 s.

Depth: throttle discipline (fuel burns with throttle), hard banks bleed speed,
a slow wing stalls and drops, a low approach on final is judged, not warned about.

## Shots (1280x800 JPEG q85, seed 1)

- `1-cover.jpg` — ?shot=play: mid-flight, ring 4 ahead, HUD + panel lit.
- `2-title.jpg` — ?shot=start: title + 3 mission cards over a live attract flight.
- `3-runway.jpg` — ?shot=runway: final approach, strip + windsock ahead.
- `4-end.jpg` — ?shot=end: "LANDED — WELCOME TO COPPERWING FIELD", score 564.

## Fixes made during visual review

- Autopilot pull-up blocked landing (floor 9 vs landing check at ground+3.5) — added
  a landing-aware floor; landing trigger moved to z >= strip start (undershoot
  short of the threshold is a crash, not a judged landing).
- Approach now follows the terrain ahead (ground rises into the flattened strip).
- BAND_LENGTH 50 -> 25 + hairline band edges: near ground was one flat slab.
- Ring label/guide hidden on title/over screens (collided with overlay text).
- PULL UP / STALL / LOW FUEL warnings only while actually flying (title screen
  showed PULL UP through the title); PULL UP suppressed on a lined-up final.
- Compass tape range narrowed (-80..80) so edge labels are not clipped.
- Panel labels moved fully inside the panel (were clipped at its top edge).
- End screen detail line is mission-aware ("Touchdown at 57 KT" for landing).
- Landing banner speed limit was stated in internal units, not displayed knots:
  the banner said "UNDER 46 KT" but the HUD shows speed x1.6, so the real
  limit (RUNWAY.maxSpeed 46) is 74 KT displayed — the end shot celebrated a
  57 KT touchdown under a "46 KT" banner. Fixed in render.js only: the banner
  now derives the limit from the threshold, `Math.round(RUNWAY.maxSpeed * 1.6)`
  = 74 KT; sink wording untouched (vertical speed is displayed raw, same units
  as the threshold). No logic, threshold, physics or other file changed.
  Shots 3 and 4 re-rendered; 1 and 2 byte-identical.

## Revision — banner knots fix (26 Nov, after commit 627dc97)

- [x] `MAKEFUN_OUTPUT_DIR=/tmp/mf-out-rev1 node main.ts` exits 0, dossier.json parses
  (keys: cover, images, schema, text)
- [x] Same build as user nobody (world-readable copy, /tmp/mf-out-nobody):
  exit 0, dossier parses, NO new files in the copy's cwd.
- [x] Determinism: capture run twice after the fix, identical sha256s:
  1-cover 57b40ff8309a… (UNCHANGED), 2-title 5d9eddf1ca4e… (UNCHANGED),
  3-runway 45521313b59a…, 4-end 29f369f98d06…
- [x] Visual check of re-rendered shots: banner reads "UNDER 74 KT, SINK UNDER 6";
  shot 4 shows "Touchdown at 57 KT" under the 74 KT limit — consistent, landing
  still reads as a success.
- [ ] NOT submitted — parent submits after the quota reset (prep only).

## Verification (all run 26 Nov, before commit 80997c0)

- [x] `MAKEFUN_OUTPUT_DIR=/tmp/flight-out node main.ts` exits 0, dossier.json parses
  (keys: cover, images, schema, text; 551,278 bytes, under the 1.5 MiB cap)
- [x] Same build as user nobody (world-readable copy, /tmp/flight-out-nobody):
  exit 0, game/ + screenshots/ + dossier.json in the out dir, NO new files in
  the repo cwd; dossier parses. (Direct nobody run from ~ failed only because
  /home/hatch is 0700 for other users — a VM permission artifact, not the entry.)
- [x] Two runs (root + nobody) byte-identical: `diff -r` clean.
- [x] Determinism: shots rendered 3x (4x after the seed fix), identical sha256s:
  1-cover 57b40ff8309a…, 2-title 5d9eddf1ca4e…, 3-runway 2cb0cfd931d1…,
  4-end 26897d90999b…
- [x] Caps: game/ 11 files, 72,259 bytes; index.html 858 bytes; screenshots
  1280x800 each, 77–115 KiB (all ≤ 256 KiB)
- [x] No external refs in game/ (grep http/https///host = 0, data: favicon only);
  no Math.random in game/src (0, incl. comments reworded; default seed is now
  fixed 1); no eval / new Function (0)
- [x] Live play-test in headless Chromium (Space to start, ArrowUp to climb):
  0 console errors after the data: favicon fix; game plays, HUD/panel live.
- [x] Commit + push, HEAD sha 80997c034dd9ac3379a9ea1b0abe3c69b2ae1533
- [x] GitHub About set: homepage https://make.fun/bounty/best-flight-game-20261126-0057
  (via GraphQL — REST PATCH silently dropped it; GraphQL read-back confirms),
  topics makefun, ai-agents, bounties, games; description as required.
  Repo created 2026-11-26T02:30:49Z (09:30 WIB), after the 07:57 WIB opening.
- [ ] NOT submitted — parent submits after the quota reset (prep only).

## Known quirks / risks

- GitHub's license detector reports the LICENSE as "Other"/NOASSERTION: the file
  is byte-identical to the kit starter's MIT text (SPDX line 1, MIT text after),
  differing only in the copyright holder. The make.fun requirement (line 1 =
  SPDX-License-Identifier: MIT, OSI-approved text) is met; the detector's
  reading is cosmetic.
- REST API still returns homepage_url null while GraphQL reads the homepage
  back correctly — likely a GitHub caching inconsistency; the About box on the
  repo page is fed by GraphQL and shows it.
- The end shot lands exactly on the threshold (z=4200); the strip runs ahead
  of the plane in the frame, which reads fine.
- Fuel on the landing sortie ends ~32%: the 4.2 km transit burns most of the
  tank, but the mission ends at touchdown, so it never bites. A player who
  dawdles on full throttle before the strip can run dry — by design.
