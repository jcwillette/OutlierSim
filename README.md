# OutlierSim

An **unofficial** tool that turns an FRC game manual and reveal video into a playable 3D, single-player version of the game. A student drives one robot in a 3v3 match with AI partners and opponents, so they can feel cycle times, traffic and defense before their own robot exists. It runs in the browser from GitHub Pages.

Not affiliated with or endorsed by *FIRST*®.

## Play

Once Pages is enabled (Settings → Pages → Source: GitHub Actions), the game is published at `https://<owner>.github.io/OutlierSim/` on every merge to `main`.

## Develop

```bash
npm install
npm run dev        # local dev server
npm test           # unit + headless match tests
```

## Generating a new game

Open the repo in Claude Code and give it the manual PDF and the reveal video (a file or link). The `frc-game-from-manual` skill in `.claude/skills/` covers the whole pipeline. See `docs/ROADMAP.md` for current status.
