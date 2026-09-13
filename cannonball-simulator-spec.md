# Cannonball Trajectory Simulator — Project Spec

## 1. Concept

A physics sandbox where the user configures a cannon shot — propellant charge, barrel angle, projectile properties, and environmental conditions — and watches an animated, physically accurate trajectory unfold, with rich real-time data output alongside it. The goal isn't just "compute where it lands," it's "show _why_ it lands there" — every force gets its own visible fingerprint in the data.

Difficulty is tunable: it works as a simple parabola demo, but the full model supports quadratic drag, altitude-dependent air density, wind fields, Magnus effect (spin), and even Coriolis effect for extreme-range shots.

---

## 2. Physics Model

### 2.1 Coordinate system

- Right-handed 3D: x = downrange, y = altitude, z = crosswind/lateral drift.
- Origin at muzzle exit. Ground plane at y = 0 (or a user-defined terrain height function later).

### 2.2 Forces modeled

| Force          | Always on? | Notes                                                                                 |
| -------------- | ---------- | ------------------------------------------------------------------------------------- |
| Gravity        | Yes        | `F_g = m * g`, g adjustable (fun toggle: Earth/Moon/Mars)                             |
| Quadratic drag | Yes        | `F_d = 0.5 * ρ * v_rel² * Cd * A`, opposing velocity _relative to wind_               |
| Wind           | Yes        | Vector (speed + direction), subtracted from velocity to get `v_rel`                   |
| Magnus (spin)  | Toggle     | `F_m = S * (ω × v)`, S derived from spin rate + radius + air density                  |
| Coriolis       | Toggle     | `a_c = -2Ω × v`, only matters past a few km — good "why did my shot drift" easter egg |

### 2.3 Muzzle velocity from propellant

Rather than hand-waving a velocity slider, derive it from charge mass so "more powder" has real consequences:

```
E_propellant = propellant_mass * energy_density * efficiency
v_muzzle = sqrt(2 * E_propellant / projectile_mass)
```

- `energy_density`: preset per propellant type (black powder ≈ 3 MJ/kg, smokeless ≈ 4.5 MJ/kg) — lets you offer a dropdown of "propellant types" as a nice touch.
- `efficiency`: 0–1 slider representing barrel length / gas losses — longer barrel = more efficiency, capped.
- Bonus: model barrel length's effect on efficiency with a simple saturating curve so there's a "sweet spot," not just monotonic gain.

### 2.4 Air density model

Two fidelity levels, pick one:

- **Simple:** barometric formula `ρ(h) = ρ₀ * exp(-h / H)`, H ≈ 8500 m.
- **Better:** ideal gas law using user-set temperature, pressure, and humidity — `ρ = P / (R_specific * T)`, with a humidity correction (moist air is _less_ dense). This makes "air density" a genuine derived output rather than an input, which is more satisfying.

### 2.5 Numerical integration

- RK4 (4th-order Runge-Kutta), fixed small timestep (e.g. 0.001–0.005s), not Euler — Euler visibly drifts and under-damps drag, which will look wrong to anyone checking energy conservation.
- Ground impact: don't just stop at the first y≤0 step — linearly interpolate between the last two steps for a precise impact time/position/velocity.
- Optionally offer adaptive timestep for performance if the sim runs live at 60fps alongside the animation.

---

## 3. Input Parameters

**Cannon**

- Elevation angle (0–90°)
- Azimuth / heading (0–360°) — needed once wind and Coriolis are in play
- Barrel length (affects efficiency)

**Projectile**

- Mass
- Diameter (→ cross-sectional area)
- Drag coefficient — either a manual Cd slider or shape presets (sphere, ogive, flat-nose)
- Spin rate (rpm) — only relevant if Magnus is toggled on

**Propellant**

- Charge mass
- Propellant type (preset energy densities)

**Environment**

- Wind speed + direction (single value, or optionally altitude-varying for realism)
- Air temperature
- Air pressure
- Humidity
- Launch altitude / elevation above sea level
- Latitude (for Coriolis)
- Gravity (Earth default, with fun alt-planet presets)

---

## 4. Outputs & Metrics

**Headline results**

- Max range, max height (apogee), time of flight, impact velocity, impact angle

**Time-series graphs** (the "rich data" part)

- Altitude vs. time
- Downrange distance vs. time
- Velocity vs. time (with vector components: vx, vy, vz)
- Drag force vs. time
- Kinetic energy, potential energy, and total energy vs. time (total should visibly bleed off due to drag — a nice sanity check and teaching moment)
- Lateral drift vs. time (from wind + Magnus + Coriolis)

**Comparative / analytical modes**

- **Vacuum overlay:** show the textbook no-drag parabola alongside the real trajectory on the same plot — makes the effect of drag viscerally obvious.
- **Sensitivity sweep:** hold everything fixed, vary one input (e.g. elevation angle 0–90°) and plot resulting range as a curve — instantly shows the "45° is only optimal without drag" result.
- **Multi-shot overlay:** fire several configured shots and compare trajectories on one chart.
- **CSV export** of the full time-series for anyone who wants to dig in externally.

---

## 5. Visualizations

- **Primary 2D side-view animation** — classic trajectory arc, animated in real time (or scrubbable), with a ghost trail.
- **3D view** (optional, bigger lift) — shows lateral wind drift, which a 2D side view can't. Even a simple top-down + side-view pair conveys this without full 3D.
- **Live gauge/readout panel** — current altitude, velocity, energy, forces acting, updating as the animation plays.
- **Force diagram overlay** — draw the instantaneous gravity/drag/wind/Magnus vectors on the projectile as it flies. Great for building intuition.
- **Impact map** — top-down grid showing where the shot landed relative to point-blank aim, useful once wind drift is in the mix.

---

## 6. UI/UX Layout

- **Left panel:** grouped, collapsible input sliders (Cannon / Projectile / Propellant / Environment), each with live numeric readout next to the slider.
- **Center:** trajectory visualization (2D by default, toggle to 3D/top-down).
- **Right or bottom panel:** tabbed data views — Summary stats / Time-series charts / Sensitivity sweep / Export.
- **Fire button** triggers the animated flight; scrub bar lets you replay or jump to any point in time.
- **Presets dropdown:** a few famous historical cannons (Napoleon 12-pounder, Paris Gun, a modern howitzer) with real specs pre-loaded — fun, and a good sanity check that the model behaves realistically at very different scales.
- **Unit toggle:** metric/imperial.

---

## 7. Recommended Tech Stack

Given this is a visually rich, interactive, slider-driven app — a web frontend is the right call over a Python desktop app.

- **Framework:** React + TypeScript (single-page app)
- **Physics engine:** plain TypeScript module, framework-agnostic — RK4 integrator + force functions, unit-tested independently of the UI so Claude Code can validate the physics in isolation
- **Charts:** Recharts or Chart.js for the time-series graphs
- **2D animation:** HTML5 Canvas (fast, simple) for the trajectory view
- **3D view (if pursued):** Three.js
- **State/inputs:** React state is plenty; no need for heavier state management given the scope

This also lines up well with a browser-based build if you want to reuse it standalone outside Claude Code, and Canvas/Three.js will feel familiar territory given your GLSL/WebGL2 generative art work.

---

## 8. Stretch Goals (post-MVP)

- Real ballistic-coefficient drag tables (G1/G7) for "historical accuracy" mode instead of a flat Cd
- Terrain: non-flat ground, target practice mode (hit a target at range X by solving for elevation)
- Altitude-varying wind profile (wind shear)
- Shareable configs via URL query params
- Sound + simple particle effects on firing (muzzle flash, ground impact puff)
- "Solve for angle" mode — given desired range, back out required elevation or charge

---

## 9. Suggested Module Structure (for Claude Code handoff)

```
/src
  /physics
    integrator.ts       // RK4 stepper
    forces.ts           // gravity, drag, wind, magnus, coriolis
    atmosphere.ts        // air density model
    ballistics.ts        // muzzle velocity from propellant
    simulate.ts           // ties it together, returns time-series
  /components
    ControlPanel/         // grouped sliders
    TrajectoryCanvas/      // 2D animated view
    TrajectoryCanvas3D/     // optional 3D view
    Charts/                  // time-series + sensitivity sweep charts
    SummaryStats/
    PresetSelector/
  /data
    propellantPresets.ts
    cannonPresets.ts
  App.tsx
```

Physics module should be pure functions with no UI dependencies, so it's independently testable (e.g. verify energy conservation in the no-drag case, verify vacuum trajectory matches the analytic parabola formula).
