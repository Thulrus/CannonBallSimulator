# Cannonball Trajectory Simulator

A physics sandbox for cannon shots. Configure the charge, barrel, projectile and weather, then watch an animated, physically modelled flight with live data showing _why_ the shot lands where it does.

Built from [`cannonball-simulator-spec.md`](cannonball-simulator-spec.md), scoped to a polished 2D experience (no 3D view).

## Features

- **Physics:** RK4 integration with interpolated ground impact. Models gravity (Earth / Moon / Mars / Jupiter), quadratic drag relative to the wind, Magnus lift from spin, and Coriolis.
- **Interior ballistics:** muzzle velocity comes from charge mass and propellant energy density. Barrel efficiency peaks at a real sweet spot (in calibres).
- **Atmosphere:** layered ISA profile anchored to your measured temperature, pressure and humidity, with ideal-gas density (humid air is lighter). Simple barometric model also available.
- **Flight view:** animated side and top-down canvas with a ghost trail, force-vector overlay, vacuum-parabola overlay, 1:1 scale toggle, muzzle flash and impact particles. Scrubbable playback.
- **Data:**
  - Summary stats with plain-language insights.
  - Seven synced time-series charts: altitude, downrange vs vacuum, velocity components, forces, energy, drift, and Mach with air density.
  - Live gauges and an energy-budget bar.
  - Impact map relative to the still-air aim point.
- **Analysis:**
  - Sensitivity sweep over any of eight inputs, run in a Web Worker, with a vacuum comparison.
  - Multi-shot compare with overlays.
  - CSV export.
  - Shareable URL for any configuration.
- **Presets:** M1857 Napoleon, Mons Meg, M777 howitzer, the Paris Gun, and a Napoleon on the Moon. Each shows the historical figures to compare against.
- **Metric and imperial units**, plus keyboard shortcuts:

  | Key     | Action       |
  | ------- | ------------ |
  | `F`     | Fire         |
  | `Space` | Play / pause |
  | `P`     | Pin shot     |
  | `V`     | Toggle view  |
  | `←` `→` | Scrub        |

### How well do the presets match history?

| Preset               | Model                               | Historical                    |
| -------------------- | ----------------------------------- | ----------------------------- |
| Napoleon 12-pdr @ 5° | 440 m/s · 1.7 km                    | ≈440 m/s · ≈1.5 km            |
| M777 @ 45°           | 821 m/s · 24.9 km                   | ≈827 m/s · ≈24 km             |
| Paris Gun @ 52°      | 1,596 m/s · 125 km · apogee 42.5 km | ≈1,640 m/s · ≈130 km · ≈42 km |

Drag coefficients are flat (no Mach-dependent G1/G7 tables yet), so treat these as sanity checks rather than firing tables.

## Getting started

Requires Node 20+.

```bash
npm install
npm run dev        # http://localhost:5173
```

| Script                            | What it does                              |
| --------------------------------- | ----------------------------------------- |
| `npm run dev`                     | Vite dev server with hot reload           |
| `npm run build`                   | Typecheck and production build to `dist/` |
| `npm run preview`                 | Serve the production build                |
| `npm test`                        | Physics test suite (Vitest)               |
| `npm run test:watch`              | Tests in watch mode                       |
| `npm run test:coverage`           | Coverage report for `src/physics`         |
| `npm run typecheck`               | TypeScript project check                  |
| `npm run lint`                    | oxlint                                    |
| `npm run format` / `format:check` | Prettier                                  |

### VS Code

Open the folder and run **Tasks: Run Task** (or `Ctrl+Shift+B` to start the dev server). Tasks are grouped by prefix:

- **Dev** starts the dev server.
- **Build** creates or previews the production bundle.
- **Test** runs the suite once, in watch mode, or with coverage.
- **Check** runs typecheck, lint and format check. **Check: All (pre-push)** runs the same gates as CI.
- **Fix** formats all files.
- **Setup** runs a clean install.

`launch.json` has two debug configurations: the app in Chrome and the current test file. Recommended extensions are listed in `.vscode/extensions.json`.

## Project layout

```
src/
  physics/           Pure TypeScript, no UI imports, unit-tested in isolation
    vec3.ts            3-vector maths (x downrange, y up, z right)
    atmosphere.ts      ISA layers, moist-air density, speed of sound
    ballistics.ts      Charge → muzzle velocity, barrel efficiency curve
    forces.ts          Gravity, drag, wind, Magnus, Coriolis
    integrator.ts      RK4 stepper
    simulate.ts        Full flight, impact/apogee refinement, vacuum reference
    sweep.ts           Sensitivity sweeps
    csv.ts             Time-series export
    physics.test.ts    Analytic-parabola, energy-conservation and force-direction tests
  data/              Presets: cannons, propellants, projectile shapes, defaults
  workers/           Simulation and sweep Web Workers (keep the UI responsive)
  lib/               Units, playback clock, share links, colours, useSimulation hook
  components/
    ControlPanel/      Grouped, collapsible inputs
    TrajectoryCanvas/  Canvas renderer, scales, particles
    Flight/            Playback bar, live readout, impact map
    DataPanel/         Summary, charts, sweep, compare, export tabs
    PresetSelector/
    ui/                Slider, toggle, compass dial and other primitives
```

## Physics notes

- **Frame:** right-handed, with x downrange along the azimuth, y up and z to the shooter's right. The origin is at the muzzle and the ground is the plane y = 0.
- **Drag:** `F = −½ ρ Cd A |v_rel| v_rel`, where `v_rel = v − wind`.
- **Magnus:** `F = ½ ρ A r Cm (ω × v_rel)`. This is pure Magnus lift; rifled spin drift (yaw of repose) is not modelled.
- **Coriolis:** `a = −2 Ω × v`, with Ω projected into the firing frame from latitude and azimuth.
- **Wind:** uses the meteorological convention, so the direction is where the wind blows _from_.

## Roadmap (spec stretch goals)

- G1/G7 Mach-dependent drag tables
- Terrain and target practice ("solve for elevation")
- Altitude-varying wind (shear)
- Sound effects
