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
2. GRASS STRIP LANDING — land on the strip at 4,200 m: under 46 KT, sink under 6, level.
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

## Verification (fill in as run)

- [ ] `MAKEFUN_OUTPUT_DIR=/tmp/flight-out node main.ts` exits 0, dossier.json parses
- [ ] Same build as user nobody: exit 0, entry in out dir, no new files in repo cwd
- [ ] Determinism: 3x capture, identical sha256s
- [ ] Caps: game/ files + bytes, index.html size, screenshot dims + sizes
- [ ] No external refs in game/ (grep http/https///host = 0); no Math.random in game/src
- [ ] Commit + push, HEAD sha recorded; GitHub About set (homepage + topics)
