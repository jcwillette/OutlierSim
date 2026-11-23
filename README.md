# OutlierSim

An **unofficial** tool that turns an FRC game manual and reveal video into a playable 3D, single-player version of the game. A student drives one robot in a 3v3 match with AI partners and opponents, so they can feel cycle times, traffic and defense before their own robot exists. It runs in the browser from GitHub Pages.

Not affiliated with or endorsed by *FIRST*®.

## Play

Once Pages is enabled (Settings → Pages → Source: GitHub Actions), the site is published at `https://<owner>.github.io/OutlierSim/` on every merge to `main`. Link students straight to a game with `?game=<id>`, for example `https://<owner>.github.io/OutlierSim/?game=2027-<slug>`.

Controls: WASD to drive (field-oriented from your driver station), ←/→ or Q/E to rotate, Space to score (auto-aims), G for the endgame action, C to change camera, Esc to pause. A standard gamepad works too.

## Develop

```bash
npm install
npm run dev        # local dev server
npm test           # unit + headless match tests
```

## Generating a new game

Open the repo in Claude Code and give it the manual PDF and the reveal video. Upload the video file, because YouTube links are usually blocked in cloud sessions. The `frc-game-from-manual` skill in `.claude/skills/` covers the whole pipeline:

1. Ingest the manual and video.
2. Fill in an extraction checklist where every value cites the manual.
3. Generate `src/games/<year>-<slug>/`.
4. Verify it with headless bot matches and browser screenshots.

Games are built only from the manual and video, never from real match data, because the new season has no matches at kickoff. Past seasons are built the same blind way. If you want a comparison with real matches from The Blue Alliance, ask for it (`npm run calibrate`).

See `docs/ROADMAP.md` for current status and known gaps.
