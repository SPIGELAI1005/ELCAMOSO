# Drive Shift Persona

**Status:** V1 UI shipped (cockpit stages + Shift moods).  
**Last updated:** 2026-10-17

## Concept

The tach **ladder + Shift** control adapts to the Sound Profile’s character.

| Kind | Ladder | Shift cycle | Binding |
| --- | --- | --- | --- |
| Virtual-transmission cars (Muscle, GT V8, …) | Real gears 1…N | Classic · City · Touring · Sport | `shiftMapPreset` (powertrain) |
| Thematic machines (Rocket, Time Machine, boats, jets, …) | Playful **stages** (Lift / Burn / …) | Profile-specific moods | `driveMoodByProfile[id]` |

Modes are **memorable and funny** on purpose: eras for Time Machine, Nice List for Santa, Hover Drive for Rocket. Combustion cars stay familiar.

## UX language

- Keep the **Shift** button for every persona (universal control).
- Stage names appear on the big tach readout and as short ticks on the ladder.
- Up / Down: real paddles on VT cars; stage nudge (short hold) on thematic personas.
- Stop remains the single Drive stop on the gear row.

## Code

- Catalog + resolve: `src/lib/drive/drive-shift-persona.ts`
- Cockpit wiring: `src/components/drive/DriveCockpit.tsx`, `cockpitSecondaryView`
- Settings: `driveMoodByProfile` in `sanitizeSettings`

## Future

- Soft audio / visual response to mood id (without OEM / dashboard clutter).
- Symphony / World / Fusion packs can add pack-specific personas when needed.
