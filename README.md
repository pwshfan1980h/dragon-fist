# Dragon Fist

A canvas martial-arts arcade game set in Harbor City's warehouse district.
Clear three waves, head east, and defeat the Iron Mantis.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. `npm test` runs the combat, animation,
and game-loop tests; `npm run build` creates a production build in `dist`.

| Action | Keys |
| --- | --- |
| Move | Left / Right or A / D |
| Jump | Up, W, or Space |
| Punch | J or Z |
| Kick | K or X |
| Dodge | Shift or L |
| Duck under knives | Down or S |
| Pause / resume | P or Escape |
| Toggle sound | M |
| Start / replay | Enter or the Start game button |

Touch controls appear on small screens and touch devices. A dodge follows your
facing direction, grants brief invulnerability, and recharges in 1.2 seconds.
Orange markers show enemy attack windups. Strike during their recovery, or
interrupt their windup with a hit. Follow-up attacks can be queued near the end
of the current move. Hits within 1.8 seconds build a combo with up to a 4× score
multiplier. Clearing either of the first two waves restores two health and adds twelve
seconds. You have three lives; high scores are saved in this browser.

Visuals are drawn procedurally, with no image assets required. Display fonts load
from Google Fonts with local fallbacks. Reduced-motion preferences disable rain
animation, impact flashes, and camera shake. Leaving the window pauses combat.
