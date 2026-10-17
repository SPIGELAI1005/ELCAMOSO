import type { DriveState } from "@/lib/drive/model";
import type { SoundProfile } from "@/lib/sound/profiles";
import {
  SHIFT_MAP_PRESET_IDS,
  type ShiftMapPresetId,
} from "@/lib/powertrain/shift-presets";

/**
 * Drive Shift Persona
 * -------------------
 * Virtual-transmission cars keep real gears + Classic / City / Touring / Sport.
 * Everything else gets a playful “character”: thematic stages on the tach ladder
 * and a Shift cycle of memorable moods (eras, flight modes, holiday spirits…).
 *
 * Modes are UI + settings first. Audio can subscribe later via mood id.
 */

export type DriveShiftModeBinding = "shift-map" | "mood";

export interface DriveShiftMode {
  id: string;
  label: string;
}

export interface DriveShiftPersona {
  /** Ladder notches (2+). Null hides Stop/Down/Up/Shift row. */
  ladderCount: number | null;
  /** Big readout label: Gear, Stage, Era band, … */
  ladderNoun: string;
  simulatedCaption: string;
  /** Names for stages 1..n when not a classic gearbox. */
  stageNames: readonly string[] | null;
  modes: readonly DriveShiftMode[];
  modeBinding: DriveShiftModeBinding;
}

const CLASSIC_SHIFT_MODES: readonly DriveShiftMode[] = SHIFT_MAP_PRESET_IDS.map((id) => ({
  id,
  label: shiftMapLabel(id),
}));

function shiftMapLabel(id: ShiftMapPresetId): string {
  if (id === "legacy") return "Classic";
  if (id === "city") return "City";
  if (id === "touring") return "Touring";
  return "Sport";
}

function persona(
  partial: Omit<DriveShiftPersona, "modeBinding"> & {
    modeBinding?: DriveShiftModeBinding;
  },
): DriveShiftPersona {
  return {
    modeBinding: partial.modeBinding ?? "mood",
    ...partial,
  };
}

/** Combustion VT: real gears, standard shift maps. */
export const COMBUSTION_SHIFT_PERSONA: DriveShiftPersona = persona({
  ladderCount: null, // filled from transmission ratios at resolve time
  ladderNoun: "Gear",
  simulatedCaption: "Simulated gear · RPM",
  stageNames: null,
  modes: CLASSIC_SHIFT_MODES,
  modeBinding: "shift-map",
});

const BY_PROFILE: Record<string, DriveShiftPersona> = {
  "rocket-car": persona({
    ladderCount: 5,
    ladderNoun: "Stage",
    simulatedCaption: "Simulated thrust stage",
    stageNames: ["Lift", "Burn", "Coast", "Boost", "Escape"],
    modes: [
      { id: "rocket-accel", label: "Rocket Accel" },
      { id: "hover-drive", label: "Hover Drive" },
      { id: "flying", label: "Flying" },
      { id: "reentry", label: "Re-entry Chill" },
      { id: "ludicrous", label: "Ludicrous Burn" },
    ],
  }),
  "time-machine": persona({
    ladderCount: 5,
    ladderNoun: "Flux",
    simulatedCaption: "Simulated flux band",
    stageNames: ["Warm", "Ripple", "Fold", "Surge", "Paradox"],
    modes: [
      { id: "era-100bc", label: "100 BC" },
      { id: "era-1800", label: "1800" },
      { id: "era-1985", label: "1985" },
      { id: "era-2000", label: "2000" },
      { id: "era-2026", label: "2026" },
      { id: "era-2050", label: "2050" },
      { id: "era-3000", label: "3000" },
    ],
  }),
  "santa-sleigh": persona({
    ladderCount: 5,
    ladderNoun: "Ho",
    simulatedCaption: "Simulated sleigh spirit",
    stageNames: ["Trot", "Dash", "Roof", "Chimney", "Orbit"],
    modes: [
      { id: "nice-list", label: "Nice List" },
      { id: "naughty-list", label: "Naughty List" },
      { id: "cookie-boost", label: "Cookie Boost" },
      { id: "silent-night", label: "Silent Night" },
      { id: "rooftop-express", label: "Rooftop Express" },
    ],
  }),
  "space-ship": persona({
    ladderCount: 5,
    ladderNoun: "Deck",
    simulatedCaption: "Simulated warp deck",
    stageNames: ["Dock", "Impulse", "Cruise", "Warp", "Ludicrous"],
    modes: [
      { id: "impulse", label: "Impulse" },
      { id: "warp-tea", label: "Warp Tea" },
      { id: "cloak", label: "Cloak Mode" },
      { id: "red-alert", label: "Red Alert" },
      { id: "scenic-nebula", label: "Scenic Nebula" },
    ],
  }),
  ufo: persona({
    ladderCount: 4,
    ladderNoun: "Abduct",
    simulatedCaption: "Simulated hover band",
    stageNames: ["Hover", "Scan", "Beam", "Zap"],
    modes: [
      { id: "tourist", label: "Tourist Probe" },
      { id: "cow-lift", label: "Cow Lift" },
      { id: "disco-saucer", label: "Disco Saucer" },
      { id: "stealth-blob", label: "Stealth Blob" },
    ],
  }),
  "speed-boat": persona({
    ladderCount: 5,
    ladderNoun: "Hull",
    simulatedCaption: "Simulated plane band",
    stageNames: ["Idle", "Wake", "Plane", "Chop", "Spray"],
    modes: [
      { id: "dock-queen", label: "Dock Queen" },
      { id: "sunset-cruise", label: "Sunset Cruise" },
      { id: "spray-mode", label: "Spray Mode" },
      { id: "storm-chase", label: "Storm Chase" },
    ],
  }),
  "cruise-ship": persona({
    ladderCount: 4,
    ladderNoun: "Deck",
    simulatedCaption: "Simulated voyage band",
    stageNames: ["Harbor", "Glide", "Ballroom", "Midnight"],
    modes: [
      { id: "buffet-run", label: "Buffet Run" },
      { id: "pool-deck", label: "Pool Deck" },
      { id: "captain-wave", label: "Captain Wave" },
      { id: "iceberg-avoid", label: "Iceberg Avoid" },
    ],
  }),
  "jet-ski": persona({
    ladderCount: 5,
    ladderNoun: "Splash",
    simulatedCaption: "Simulated splash band",
    stageNames: ["Put", "Rip", "Carve", "Boost", "Wipeout"],
    modes: [
      { id: "tourist-wake", label: "Tourist Wake" },
      { id: "dolphin-mode", label: "Dolphin Mode" },
      { id: "spray-tan", label: "Spray Tan" },
      { id: "full-send", label: "Full Send" },
    ],
  }),
  submarine: persona({
    ladderCount: 5,
    ladderNoun: "Depth",
    simulatedCaption: "Simulated depth band",
    stageNames: ["Periscope", "Shallow", "Crush", "Abyss", "Ping"],
    modes: [
      { id: "tourist-tour", label: "Tourist Tour" },
      { id: "stealth-ping", label: "Stealth Ping" },
      { id: "kraken-watch", label: "Kraken Watch" },
      { id: "bubble-disco", label: "Bubble Disco" },
    ],
  }),
  "turbine-jet": persona({
    ladderCount: 5,
    ladderNoun: "Flight",
    simulatedCaption: "Simulated flight band",
    stageNames: ["Taxi", "Rotate", "Climb", "Cruise", "Afterburn"],
    modes: [
      { id: "economy", label: "Economy" },
      { id: "window-seat", label: "Window Seat" },
      { id: "turbulence-fun", label: "Turbulence Fun" },
      { id: "supersonic-snack", label: "Supersonic Snack" },
    ],
  }),
  helicopter: persona({
    ladderCount: 4,
    ladderNoun: "Rotor",
    simulatedCaption: "Simulated rotor band",
    stageNames: ["Spool", "Hover", "Transit", "Dash"],
    modes: [
      { id: "traffic-spy", label: "Traffic Spy" },
      { id: "roof-drop", label: "Roof Drop" },
      { id: "scenic-spin", label: "Scenic Spin" },
      { id: "evasion-cha-cha", label: "Evasion Cha-Cha" },
    ],
  }),
  "private-jet": persona({
    ladderCount: 4,
    ladderNoun: "Cabin",
    simulatedCaption: "Simulated cabin band",
    stageNames: ["Champagne", "Climb", "Whisper", "Touchdown"],
    modes: [
      { id: "boardroom", label: "Boardroom" },
      { id: "pajama-route", label: "Pajama Route" },
      { id: "wifi-flex", label: "Wi-Fi Flex" },
      { id: "skip-security", label: "Skip Security" },
    ],
  }),
  dragon: persona({
    ladderCount: 5,
    ladderNoun: "Wing",
    simulatedCaption: "Simulated wing beat",
    stageNames: ["Coil", "Leap", "Glide", "Dive", "Roar"],
    modes: [
      { id: "tourist-dragon", label: "Tourist Dragon" },
      { id: "hoard-patrol", label: "Hoard Patrol" },
      { id: "spicy-breath", label: "Spicy Breath" },
      { id: "nap-on-gold", label: "Nap on Gold" },
    ],
  }),
  "thunder-beast": persona({
    ladderCount: 5,
    ladderNoun: "Roar",
    simulatedCaption: "Simulated beast band",
    stageNames: ["Prowl", "Stomp", "Charge", "Howl", "Stampede"],
    modes: [
      { id: "gentle-giant", label: "Gentle Giant" },
      { id: "storm-pet", label: "Storm Pet" },
      { id: "lunch-mode", label: "Lunch Mode" },
      { id: "mythic-rage", label: "Mythic Rage" },
    ],
  }),
  tank: persona({
    ladderCount: 4,
    ladderNoun: "Track",
    simulatedCaption: "Simulated track band",
    stageNames: ["Creep", "Grind", "Push", "Breach"],
    modes: [
      { id: "parade", label: "Parade" },
      { id: "mud-spa", label: "Mud Spa" },
      { id: "fortress-mood", label: "Fortress Mood" },
      { id: "oops-curb", label: "Oops Curb" },
    ],
  }),
  "construction-monster": persona({
    ladderCount: 4,
    ladderNoun: "Job",
    simulatedCaption: "Simulated job band",
    stageNames: ["Idle", "Dig", "Lift", "Dump"],
    modes: [
      { id: "hard-hat", label: "Hard Hat" },
      { id: "coffee-break", label: "Coffee Break" },
      { id: "overtime", label: "Overtime" },
      { id: "demo-day", label: "Demo Day" },
    ],
  }),
  snowmobile: persona({
    ladderCount: 5,
    ladderNoun: "Trail",
    simulatedCaption: "Simulated trail band",
    stageNames: ["Flake", "Carve", "Boost", "Jump", "Powder"],
    modes: [
      { id: "hot-cocoa", label: "Hot Cocoa" },
      { id: "yeti-avoid", label: "Yeti Avoid" },
      { id: "powder-party", label: "Powder Party" },
      { id: "ice-road", label: "Ice Road" },
    ],
  }),
  "maglev-train": persona({
    ladderCount: 5,
    ladderNoun: "Mag",
    simulatedCaption: "Simulated maglev band",
    stageNames: ["Dock", "Levitate", "Slip", "Bullet", "Blink"],
    modes: [
      { id: "commuter-zen", label: "Commuter Zen" },
      { id: "quiet-car", label: "Quiet Car" },
      { id: "vending-dash", label: "Vending Dash" },
      { id: "missed-stop", label: "Missed Stop" },
    ],
  }),
  "high-speed-train": persona({
    ladderCount: 5,
    ladderNoun: "Rail",
    simulatedCaption: "Simulated rail band",
    stageNames: ["Platform", "Roll", "Express", "Sprint", "Whistle"],
    modes: [
      { id: "window-seat", label: "Window Seat" },
      { id: "snack-trolley", label: "Snack Trolley" },
      { id: "delay-denial", label: "Delay Denial" },
      { id: "final-call", label: "Final Call" },
    ],
  }),
  "steam-train": persona({
    ladderCount: 5,
    ladderNoun: "Steam",
    simulatedCaption: "Simulated steam band",
    stageNames: ["Hiss", "Chuff", "Pull", "Grade", "Whistle"],
    modes: [
      { id: "picnic-car", label: "Picnic Car" },
      { id: "coal-flex", label: "Coal Flex" },
      { id: "tunnel-yell", label: "Tunnel Yell" },
      { id: "heritage-flex", label: "Heritage Flex" },
    ],
  }),
  "horse-gallop": persona({
    ladderCount: 4,
    ladderNoun: "Gait",
    simulatedCaption: "Simulated gait",
    stageNames: ["Walk", "Trot", "Canter", "Gallop"],
    modes: [
      { id: "carrot-bribe", label: "Carrot Bribe" },
      { id: "parade-prance", label: "Parade Prance" },
      { id: "wild-west", label: "Wild West" },
      { id: "derby-day", label: "Derby Day" },
    ],
  }),
  "wild-west-carriage": persona({
    ladderCount: 4,
    ladderNoun: "Trail",
    simulatedCaption: "Simulated trail band",
    stageNames: ["Creep", "Clop", "Chase", "Stampede"],
    modes: [
      { id: "sheriff-wave", label: "Sheriff Wave" },
      { id: "bandit-gps", label: "Bandit GPS" },
      { id: "saloon-run", label: "Saloon Run" },
      { id: "sunset-dust", label: "Sunset Dust" },
    ],
  }),
  "romanian-85-carriage": persona({
    ladderCount: 4,
    ladderNoun: "Drum",
    simulatedCaption: "Simulated village band",
    stageNames: ["Pas", "Trap", "Hură", "Hai"],
    modes: [
      { id: "sunday-best", label: "Sunday Best" },
      { id: "market-day", label: "Market Day" },
      { id: "wedding-horn", label: "Wedding Horn" },
      { id: "midnight-serenade", label: "Midnight Serenade" },
    ],
  }),
  "wiesn-tractor": persona({
    ladderCount: 4,
    ladderNoun: "Gang",
    simulatedCaption: "Simulated Wiesn band",
    stageNames: ["Put", "Pull", "Prost", "Vollgas"],
    modes: [
      { id: "mass-cruise", label: "Maß Cruise" },
      { id: "brezn-boost", label: "Brezn Boost" },
      { id: "dirndl-drift", label: "Dirndl Drift" },
      { id: "last-call", label: "Last Call" },
    ],
  }),
  "laughing-machine": persona({
    ladderCount: 4,
    ladderNoun: "Giggle",
    simulatedCaption: "Simulated giggle band",
    stageNames: ["Heh", "Haha", "Wheeze", "LOL"],
    modes: [
      { id: "dad-joke", label: "Dad Joke" },
      { id: "tickle-turbo", label: "Tickle Turbo" },
      { id: "serious-face", label: "Serious Face" },
      { id: "audience-warm", label: "Audience Warm" },
    ],
  }),
  "farting-car": persona({
    ladderCount: 5,
    ladderNoun: "Pfft",
    simulatedCaption: "Simulated pfft band",
    stageNames: ["Polite", "Suspicious", "Blame", "Denial", "Symphony"],
    modes: [
      { id: "who-me", label: "Who, Me?" },
      { id: "window-down", label: "Window Down" },
      { id: "blame-dog", label: "Blame the Dog" },
      { id: "brass-section", label: "Brass Section" },
    ],
  }),
  "kazoo-kart": persona({
    ladderCount: 4,
    ladderNoun: "Buzz",
    simulatedCaption: "Simulated buzz band",
    stageNames: ["Toot", "Buzz", "Solo", "Encore"],
    modes: [
      { id: "parade-toot", label: "Parade Toot" },
      { id: "school-band", label: "School Band" },
      { id: "kazoo-solo", label: "Kazoo Solo" },
      { id: "volume-war", label: "Volume War" },
    ],
  }),
  "cyber-pulse": persona({
    ladderCount: 5,
    ladderNoun: "Grid",
    simulatedCaption: "Simulated grid band",
    stageNames: ["Boot", "Link", "Surge", "Overclock", "Glitch"],
    modes: [
      { id: "safe-mode", label: "Safe Mode" },
      { id: "neon-sprint", label: "Neon Sprint" },
      { id: "firewall-open", label: "Firewall Open" },
      { id: "mainframe-flex", label: "Mainframe Flex" },
    ],
  }),
  "neon-drive": persona({
    ladderCount: 4,
    ladderNoun: "Neon",
    simulatedCaption: "Simulated neon band",
    stageNames: ["Glow", "Pulse", "Strobe", "Burn"],
    modes: [
      { id: "night-market", label: "Night Market" },
      { id: "rainy-reflection", label: "Rainy Reflection" },
      { id: "club-exit", label: "Club Exit" },
      { id: "chrome-dream", label: "Chrome Dream" },
    ],
  }),
  "synthwave-drive": persona({
    ladderCount: 4,
    ladderNoun: "Wave",
    simulatedCaption: "Simulated wave band",
    stageNames: ["Vapor", "Grid", "Sunset", "Boss"],
    modes: [
      { id: "outrun", label: "Outrun" },
      { id: "vhs-tracking", label: "VHS Tracking" },
      { id: "arcade-queen", label: "Arcade Queen" },
      { id: "laser-sunset", label: "Laser Sunset" },
    ],
  }),
  "retro-arcade": persona({
    ladderCount: 4,
    ladderNoun: "Level",
    simulatedCaption: "Simulated level",
    stageNames: ["1-UP", "Coin", "Boss", "Continue"],
    modes: [
      { id: "easy-mode", label: "Easy Mode" },
      { id: "insert-coin", label: "Insert Coin" },
      { id: "pixel-perfect", label: "Pixel Perfect" },
      { id: "konami-ish", label: "Konami-ish" },
    ],
  }),
  "deep-bass-pulse": persona({
    ladderCount: 4,
    ladderNoun: "Sub",
    simulatedCaption: "Simulated sub band",
    stageNames: ["Thump", "Roll", "Drop", "Rumble"],
    modes: [
      { id: "club-floor", label: "Club Floor" },
      { id: "neighbor-test", label: "Neighbor Test" },
      { id: "sub-only", label: "Sub Only" },
      { id: "chest-massage", label: "Chest Massage" },
    ],
  }),
  "zen-drive": persona({
    ladderCount: 4,
    ladderNoun: "Breath",
    simulatedCaption: "Simulated breath band",
    stageNames: ["In", "Hold", "Out", "Still"],
    modes: [
      { id: "tea-garden", label: "Tea Garden" },
      { id: "soft-focus", label: "Soft Focus" },
      { id: "no-horn", label: "No Horn" },
      { id: "enlightenment-lite", label: "Enlightenment Lite" },
    ],
  }),
  "rain-drive": persona({
    ladderCount: 4,
    ladderNoun: "Drop",
    simulatedCaption: "Simulated rain band",
    stageNames: ["Drizzle", "Patter", "Sheet", "Storm"],
    modes: [
      { id: "window-down", label: "Window Down" },
      { id: "puddle-hunt", label: "Puddle Hunt" },
      { id: "cozy-cabin", label: "Cozy Cabin" },
      { id: "thunder-encore", label: "Thunder Encore" },
    ],
  }),
  "ocean-drive": persona({
    ladderCount: 4,
    ladderNoun: "Tide",
    simulatedCaption: "Simulated tide band",
    stageNames: ["Lap", "Roll", "Swell", "Break"],
    modes: [
      { id: "barefoot", label: "Barefoot" },
      { id: "salt-hair", label: "Salt Hair" },
      { id: "midnight-swim", label: "Midnight Swim" },
      { id: "lighthouse", label: "Lighthouse" },
    ],
  }),
  heartbeat: persona({
    ladderCount: 4,
    ladderNoun: "Beat",
    simulatedCaption: "Simulated beat band",
    stageNames: ["Rest", "Walk", "Run", "Sprint"],
    modes: [
      { id: "calm-pulse", label: "Calm Pulse" },
      { id: "first-date", label: "First Date" },
      { id: "gym-bro", label: "Gym Bro" },
      { id: "finale", label: "Finale" },
    ],
  }),
  "open-wind": persona({
    ladderCount: 4,
    ladderNoun: "Air",
    simulatedCaption: "Simulated air band",
    stageNames: ["Breeze", "Gust", "Gale", "Howl"],
    modes: [
      { id: "convertible", label: "Convertible" },
      { id: "kite-day", label: "Kite Day" },
      { id: "storm-front", label: "Storm Front" },
      { id: "whisper-road", label: "Whisper Road" },
    ],
  }),
  "storm-glider": persona({
    ladderCount: 5,
    ladderNoun: "Cell",
    simulatedCaption: "Simulated storm band",
    stageNames: ["Calm", "Charge", "Flash", "Roar", "Eye"],
    modes: [
      { id: "storm-chaser", label: "Storm Chaser" },
      { id: "cozy-thunder", label: "Cozy Thunder" },
      { id: "lightning-lap", label: "Lightning Lap" },
      { id: "eye-picnic", label: "Eye Picnic" },
    ],
  }),
  "formula-electric": persona({
    ladderCount: 5,
    ladderNoun: "Mode",
    simulatedCaption: "Simulated race mode",
    stageNames: ["Out", "Attack", "Qualify", "Push", "Overtake"],
    modes: [
      { id: "eco-point", label: "Eco Point" },
      { id: "qualifying", label: "Qualifying" },
      { id: "attack-mode", label: "Attack Mode" },
      { id: "last-lap", label: "Last Lap" },
    ],
  }),
};

const BY_CATEGORY: Partial<Record<SoundProfile["category"], DriveShiftPersona>> = {
  Future: persona({
    ladderCount: 5,
    ladderNoun: "Phase",
    simulatedCaption: "Simulated phase band",
    stageNames: ["Idle", "Spin", "Surge", "Peak", "Glitch"],
    modes: [
      { id: "future-lite", label: "Future Lite" },
      { id: "chrome-rush", label: "Chrome Rush" },
      { id: "soft-robot", label: "Soft Robot" },
      { id: "year-3000", label: "Year 3000" },
    ],
  }),
  Nautical: persona({
    ladderCount: 5,
    ladderNoun: "Knot",
    simulatedCaption: "Simulated knot band",
    stageNames: ["Dock", "Drift", "Plane", "Chop", "Spray"],
    modes: [
      { id: "harbor", label: "Harbor" },
      { id: "open-water", label: "Open Water" },
      { id: "party-wake", label: "Party Wake" },
      { id: "fog-horn", label: "Fog Horn" },
    ],
  }),
  Aviation: persona({
    ladderCount: 5,
    ladderNoun: "Flight",
    simulatedCaption: "Simulated flight band",
    stageNames: ["Taxi", "Climb", "Cruise", "Descend", "Flare"],
    modes: [
      { id: "window-seat", label: "Window Seat" },
      { id: "turbulence", label: "Turbulence Fun" },
      { id: "autopilot", label: "Autopilot Nap" },
      { id: "go-around", label: "Go Around" },
    ],
  }),
  Heritage: persona({
    ladderCount: 4,
    ladderNoun: "Era",
    simulatedCaption: "Simulated heritage band",
    stageNames: ["Idle", "Clop", "Pull", "Parade"],
    modes: [
      { id: "museum", label: "Museum Pace" },
      { id: "festival", label: "Festival" },
      { id: "grandpa", label: "Grandpa Mode" },
      { id: "encore", label: "Encore" },
    ],
  }),
  Playful: persona({
    ladderCount: 4,
    ladderNoun: "Gag",
    simulatedCaption: "Simulated gag band",
    stageNames: ["Setup", "Beat", "Punch", "Encore"],
    modes: [
      { id: "family-friendly", label: "Family Friendly" },
      { id: "chaos", label: "Chaos" },
      { id: "bit", label: "The Bit" },
      { id: "credits", label: "Credits Roll" },
    ],
  }),
  Nature: persona({
    ladderCount: 4,
    ladderNoun: "Air",
    simulatedCaption: "Simulated nature band",
    stageNames: ["Still", "Breathe", "Gust", "Wild"],
    modes: [
      { id: "picnic", label: "Picnic" },
      { id: "trail", label: "Trail" },
      { id: "storm-watch", label: "Storm Watch" },
      { id: "campfire", label: "Campfire" },
    ],
  }),
  Musical: persona({
    ladderCount: 4,
    ladderNoun: "Bar",
    simulatedCaption: "Simulated musical band",
    stageNames: ["Intro", "Verse", "Chorus", "Drop"],
    modes: [
      { id: "acoustic", label: "Acoustic" },
      { id: "club", label: "Club" },
      { id: "encore", label: "Encore" },
      { id: "silent-disco", label: "Silent Disco" },
    ],
  }),
};

const CONTINUOUS_FALLBACK: DriveShiftPersona = persona({
  ladderCount: 5,
  ladderNoun: "Stage",
  simulatedCaption: "Simulated stage",
  stageNames: ["Idle", "Flow", "Push", "Peak", "Send"],
  modes: [
    { id: "cruise", label: "Cruise" },
    { id: "playful", label: "Playful" },
    { id: "intense", label: "Intense" },
    { id: "chill", label: "Chill" },
  ],
});

export function resolveDriveShiftPersona(
  profile: SoundProfile,
  gearRatioCount?: number,
): DriveShiftPersona {
  if (profile.drivetrainMode === "virtual-transmission") {
    const count = Math.max(2, gearRatioCount ?? 6);
    return {
      ...COMBUSTION_SHIFT_PERSONA,
      ladderCount: count,
    };
  }
  return BY_PROFILE[profile.id] ?? BY_CATEGORY[profile.category] ?? CONTINUOUS_FALLBACK;
}

/** 0 = idle/N, 1..count = active stage from motion energy. */
export function motionStageIndex(state: DriveState, count: number): number {
  const kmh = state.speed * 3.6;
  if (kmh < 1.2 && state.throttle < 0.08 && state.load < 0.1) return 0;
  const energy = Math.max(
    state.load,
    state.throttle,
    Math.min(1, kmh / 110),
    state.regen > 0.2 ? state.regen * 0.85 : 0,
  );
  return Math.min(count, Math.max(1, Math.ceil(energy * count)));
}

export function stageDisplayValue(
  persona: DriveShiftPersona,
  activeStage: number,
): string {
  if (activeStage < 1) return "N";
  const names = persona.stageNames;
  if (names && names[activeStage - 1]) return names[activeStage - 1]!;
  return String(activeStage);
}

export function resolveActiveMoodId(
  persona: DriveShiftPersona,
  storedMoodId: string | undefined,
  shiftMapPreset: ShiftMapPresetId,
): string {
  if (persona.modeBinding === "shift-map") return shiftMapPreset;
  const known = persona.modes.some((m) => m.id === storedMoodId);
  return known && storedMoodId ? storedMoodId : (persona.modes[0]?.id ?? "cruise");
}

export function moodLabel(persona: DriveShiftPersona, modeId: string): string {
  return persona.modes.find((m) => m.id === modeId)?.label ?? modeId;
}

export function nextMoodId(persona: DriveShiftPersona, currentId: string): string {
  const modes = persona.modes;
  if (modes.length === 0) return currentId;
  const index = modes.findIndex((m) => m.id === currentId);
  const next = modes[(index + 1) % modes.length];
  return next?.id ?? modes[0]!.id;
}

export function isShiftMapPresetModeId(id: string): id is ShiftMapPresetId {
  return (SHIFT_MAP_PRESET_IDS as readonly string[]).includes(id);
}
