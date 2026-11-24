# OutlierSim

An **unofficial** tool that turns an FRC game manual and reveal video into a playable 3D, single-player version of the game. A student drives one robot in a 3v3 match with AI partners and opponents, so they can feel cycle times, traffic and defense before their own robot exists. It runs in the browser from GitHub Pages.

Not affiliated with or endorsed by *FIRST*®.

## Play

Once Pages is enabled (Settings → Pages → Source: GitHub Actions), the site is published at `https://<owner>.github.io/OutlierSim/` on every merge to `main`. Link students straight to a game with `?game=<id>`, for example `https://<owner>.github.io/OutlierSim/?game=2027-<slug>`.

To watch a match between six bots instead of driving, pick **Watch 6 bots** in the menu or add `&watch=1` to the link. In spectator mode, `1`-`6` or `Tab` follow a robot (a panel says what it's doing), `C` cycles the sideline, overhead, chase and driver-station cameras, and `[` / `]` change the speed from 0.25x to 4x.

To see how likely each alliance is to win with a given setup, pick the robots, roles and strategy for each alliance in the watch menu, then press **Simulate match-ups** under **Win probability**. It plays up to 2,500 bot-vs-bot match-ups in the background (on every CPU core) and shows each alliance's win chance with a 95% range, scores, ranking points and a histogram of winning margins as it goes. You can then watch a typical match or an upset from the run.

Before a match you can set up each alliance in the menu: a robot type and role (score or defend) for every driver station, a strategy (balanced, max cycles, early endgame, aggressive), or one of the game's presets (for example _Specialists_ or _Shutdown defense_). Robots aren't perfect: with **Breakdowns** on, they can lose power for a few seconds or break down for the rest of the match, and bots sometimes get in each other's way. Rookie-level robots fail more often than elite ones.

Controls: WASD to drive (field-oriented from your driver station), ←/→ or Q/E to rotate, Space to score (auto-aims), G for the endgame action, R to eject a piece, F to switch the piece you ask a human player for (at stations that offer a choice), C to change camera, Esc to pause. A standard gamepad works too.

The menu's **Robot & field tuning** changes any robot type's speed, acceleration, mechanism times, endgame times and success chances, and failure rates, plus the human player stations, for you and the bots alike.

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
4. Verify it: `npm run plausibility -- --game <id>` checks that the bots can use every part of the field and plays every lineup preset at three difficulties against checks derived from the manual, then browser screenshots.

Games are built only from the manual and video, never from real match data, because the new season has no matches at kickoff. Past seasons are built the same blind way. If you want a comparison with real matches from The Blue Alliance, ask for it (`npm run calibrate`).

See `docs/ROADMAP.md` for current status and known gaps.
