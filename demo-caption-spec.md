# FINALDEMO.mp4 — caption spec

Source video: `~/Documents/FINALDEMO.mp4` (3320x2160, 22.57s). Re-shot hero
demo. This is the working spec for wiring its caption overlay.

## Caption model (CONFIRMED)

- **Question captions** sit at the TOP of the frame, same top pill as
  before.
- **Reply captions** are thought bubbles pinned ABOVE-AND-TO-THE-RIGHT of
  Peeky's orange cursor, at its position in the frame (detected from the
  video, since the cursor is a known orange `#fd8a02`). Cursor is
  parked/stable during each reply window, so a fixed position per bubble
  works.
- Question texts confirmed as the lease set (below).

## Timeline (seconds, measured on the final export)

| Beat | Phase | Start | End | Caption |
|------|-------|-------|-----|---------|
| 1 | you ask | 2.13 | 4.51 | question (text TBD) |
| 1 | thinking / loading | 4.52 | 5.41 | dots |
| 1 | reply bubble ON cursor | 5.42 | 6.51 | "Done" |
| 2 | you ask | 6.52 | 8.90 | question (text TBD) |
| 2 | thinking / loading | 8.91 | 10.04 | dots |
| 2 | cursor flying to price | 10.04 | 11.40 | (nothing) |
| 2 | reply bubble ON cursor @ price | 11.40 | 13.07 | "It's $2,450" |
| 2 | cursor flies back | 13.08 | 14.68 | (nothing) |
| 3 | you ask | 14.68 | 16.89 | question (text TBD) |
| 3 | (no reply) | 16.89 | 22.56 | nothing (clip ends) |

Notes on exact frames:
- Beat 1 "Done" bubble appears at 5.42, last frame 6.51 (gone at 6.52 as
  beat 2 question starts).
- Beat 2 "It's $2,450" bubble appears at 11.40 when the cursor reaches the
  price, last frame 13.07 (gone at 13.08 as the cursor begins flying back).
- Cursor positions to detect for the reply bubbles: at t=5.42 ("Done") and
  t=11.40 ("It's $2,450", at the rent line).

## Confirmed

- Question texts (top pill):
  - Beat 1: "Can you open up my lease agreement?"
  - Beat 2: "What's the monthly rent?"
  - Beat 3: "Is there a section about pets?"
- Reply bubbles (above-right of cursor):
  - Beat 1: "Done"
  - Beat 2: "It's $2,450"

## Still open

- Beat 3 has a question (14.68-16.89) then no reply for ~5.7s to the end.
  Assuming intentional trail-off unless told otherwise.
