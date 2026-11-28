# Grand Finale pitch (CYE 2026, Dec 2)

- `HisaabAI_Pitch.pptx`: the deck. 8 slides for the 5-minute pitch, then 3 "For questions" slides.
  Speaker notes on every slide carry the script.
- `HisaabAI_Pitch.pdf`: the same deck without animations, as a backup and for submission.
- `../pitch.txt`: the full pitch, timings, Q&A answers and the stage checklist.

## Presenting

- Slides 1, 2, 4 to 8 build by themselves when they open. Slide 3 (the three money leaks) needs
  **four clicks**: one per leak, then the last line.
- Slide 5 is the live demo's backup: switch to the app here; if the Wi-Fi fails, talk over the slide.
- Before Dec 2, replace `[Team names, university]` on slide 8.

## Rebuilding after an edit

```bash
cd pitch/deck
npm install                                   # first time only
node capture.mjs <dir with ali.wav, goods.wav, ask-imran.wav>   # optional: fresh app screenshots
node assets.mjs                               # Urdu lettering and stamps (needs internet for the font)
NODE_PATH="$PWD/node_modules" node build.js   # lays out the slides
python animate.py                             # transitions and build animations
```

`capture.mjs` changes data: run it only against a scratch backend (see `frontend/e2e/voice.mjs`).
