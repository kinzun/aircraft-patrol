# Dusk sim 与 Dusk Patrol 的飞行提示词

@vib3coded 在两款模型的飞行演示对比帖下，直接回复了名为 **Dusk sim** 的完整提示词。[作者的 Dusk sim 提示词](https://x.com/vib3coded/status/2124245472307024120) · [飞行演示对比](https://x.com/vib3coded/status/2124245249786855836)

作者在更早的演示中使用了 **Dusk Patrol** 这个名字。两份提示词对画面、飞行、座舱和验收的要求相同，文字差异只有游戏名称、开头 `Prompt` 的大小写和空白排版。本项目起步时用的参考文本将名称简写为 **Patrol**。下文收录较早的 Dusk Patrol 正文。[作者的 Dusk Patrol 提示词](https://x.com/vib3coded/status/2122472450734559504) · [最初的飞行演示](https://x.com/vib3coded/status/2122472401124401585)

## 英文提示词

Build "Dusk Patrol": a pixel-art fighter-jet flying toy that runs in the browser as one self-contained HTML file. No libraries and no image assets: raw WebGL2 for the world, Canvas 2D for the cockpit, everything drawn by code. Google Fonts are the only external resource (a pixel display face for the title, a monospace face for hints). This should feel like a polished indie game demo, not a tech test, so spend your effort on how it looks and how it feels to fly.

LOOK
- Render at a low internal resolution (about 340 px tall) and upscale with nearest-neighbour so pixels stay crisp. Limited palette, ordered 4x4 Bayer dithering between tones, no anti-aliasing, no smooth gradients.
- Setting: lake country in autumn at the last light of day. Warm low sun, violet shadows, peach clouds, haze toward the horizon that is gold toward the sun and lilac away from it.

WORLD
- Generate a seamlessly tiling height field at load (use web workers and show a progress bar), then ray-march it per pixel in a fragment shader so any camera angle works.
- Water: depth bands from pale turquoise shallows to navy, animated foam along shores, short white glints, sky reflection at low angles and a glitter path under the sun.
- Land: sand, pale meadows, forest in patches of orange, crimson and gold with scattered dark conifers, grey-violet rock, snow on the highest peaks, subtle terraced shading, long baked shadows.
- A layer of puffy cumulus below cruise altitude, shaded in stepped tones, casting shadows on the ground. Sky gradient with a large sun disc and thin high streaks.

AIRCRAFT
- An original twin-engine, twin-tail fighter: pointed dark radome, gold-tinted bubble canopy, cropped delta wings, canted fins with red caps, glowing nozzles, grey and slate splinter camouflage. Low-poly mesh, flat-shaded in three tones, with a one-pixel dark outline.
- Thin white vapour trails from the wingtips, twin afterburner plumes with a white core, the jet's shadow on ground and clouds, spray and a wake when skimming water.

CAMERAS AND CONTROLS
- Three views cycled with Space, blending smoothly over about a second: top-down (north up), chase, and cockpit.
- Mouse steers. In the top view the jet flies toward the cursor; in chase and cockpit the cursor's offset from centre sets turn and climb or dive. Click: barrel roll. Hold: afterburner. Right click or F: fire a missile. Left and right buttons must work together.
- Arcade flight: it cannot crash, it pulls up on its own before terrain, and it flies lazy S-turns until the player first moves the mouse. Add touch controls with on-screen buttons.

COCKPIT
- A hand-plotted pixel instrument panel where every reading is real: airspeed, artificial horizon, altimeter with digits, turn and slip, heading, vertical speed, an amber ground-mapping radar with a sweep, engine gauges, a clock showing local time, warning lamps, a throttle lever that follows the afterburner.
- A head-up display whose pitch ladder sits exactly on the real horizon outside, with heading tape, speed, altitude, G, radar height, missile count and warnings.

MISSILES
- Four on the wings; each leaves its rail when fired and re-arms after a few seconds. They fly with a flame and a smoke trail to where the nose points, or to the ground ahead when flying level.
- Impact: flash, fireball, lingering smoke and an expanding shock ring; a scorch with embers on land, a column of spray and foam on water.

INTERFACE
- All text in English: a title card, one quiet strip of control hints with a missile counter, and a sound toggle. Sound is synthesised with Web Audio and off by default.

QUALITY BAR
- Smooth on an integrated GPU; drop internal resolution automatically if frames get slow.
- Before you call it done, run it in a headless browser, screenshot all three views plus a missile strike, and fix whatever looks wrong. Simulate several minutes of random flying and input to confirm there are no errors.
