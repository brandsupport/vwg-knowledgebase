# VWG Knowledge Rush — Playable Prototype

Open `index.html` in a modern browser. The prototype references the sprite pack already in the repository at `Knowledge_rush_assets/VWG_Knowledge_Rush_Clean_Sprites_FrameFixed/`.

## Controls
- Left / Right arrows (or A / D): change lane
- Up arrow / Space: jump
- Down arrow: slide
- P: pause/resume
- Touch buttons are available in the side panel.

## Included
- Responsive HTML5 Canvas three-lane runner
- Original Alex PNG sprites for idle, four-frame run, jump, slide, fall and get-up states
- Road scenery, VWG token pickups, obstacles, score and lives
- Checkpoint question flow with answer feedback, pause and restart
- Keyboard and touch controls
- Checkpoint questions grounded in articles from `data/site_data.json` (article IDs 2, 6, 8, 16, 20, and 24 at the time this prototype was updated)

## Art QA still required
The prototype now loads the original Alex sprite files from `Knowledge_rush_assets`; it no longer uses the vector-drawn character. Some supplied run-frame crops were previously identified as imperfect, so inspect the run animation in motion and adjust frame crop/position or timing if needed. Do not redraw or replace Alex artwork.

## Validation status
The sprite integration and question-source updates are committed to the PR branch. Browser gameplay QA is still required for image loading, sprite scale/alignment, animation transitions, collision behavior, quiz flow, desktop/mobile layouts and the deployed page. Do not merge/deploy until these checks pass.
