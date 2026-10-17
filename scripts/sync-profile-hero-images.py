"""Copy name-matched stills into public/hero/sound-profiles/{profileId}.png.

Source: Images cars_elcamoso/Cars No Branding (unbranded; no top/corner paint-out).
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = ROOT / "Images cars_elcamoso" / "Cars No Branding"
DST_DIR = ROOT / "public" / "hero" / "sound-profiles"
TARGET = (1672, 941)

# profile_id -> source filename (leading "_" optional; resolve strips it)
MAP: dict[str, str] = {
    "gt-v8": "GT V8.png",
    "racing-v10": "Racing V10.png",
    "cyber-pulse": "Cyber pulse.png",
    "race-car": "Race Car.png",
    "rally-car": "Rally car.png",
    "space-ship": "Space Ship.png",
    "ufo": "UFO.png",
    "speed-boat": "Speed Boat.png",
    "cruise-ship": "Cruise Ship.png",
    "santa-sleigh": "Santa Car.png",
    "romanian-85-carriage": "Romanian 85 carriage.png",
    "laughing-machine": "Laughing Car.png",
    "farting-car": "Farting Car.png",
    "steam-train": "Steam Train.png",
    "kazoo-kart": "Kazoo Kart.png",
    "turbine-jet": "Turbine Jet.png",
    "helicopter": "Helicopter.png",
    "private-jet": "Private Jet.png",
    "wiesn-tractor": "Oide Wiesn Tractor.png",
    "open-wind": "Open Wind.png",
    "storm-glider": "Storm Glider.png",
    "flat-six-sport": "Flat-Six Sport.png",
    "american-muscle-v8": "American Muscle V8.png",
    "turbo-inline-6": "Turbo Inline-6.png",
    "electric-hypercar": "Synthetic Hyper EV.png",
    "formula-electric": "Formula Electric.png",
    "neon-drive": "Neon Drive.png",
    "maglev-train": "Maglev Train.png",
    "high-speed-train": "High-Speed Train.png",
    "submarine": "Submarine.png",
    "motorcycle-superbike": "Motorcycle Superbike.png",
    "big-twin": "Big Twin.png",
    "snowmobile": "Snow Mobile.png",
    "tank": "Tank.png",
    "construction-monster": "Construction Monster.png",
    "horse-gallop": "Horse Gallop.png",
    "dragon": "Dragon.png",
    "thunder-beast": "Thunder Beast.png",
    "retro-arcade": "Retro Arcade.png",
    "deep-bass-pulse": "Deep Bass Pulse.png",
    "zen-drive": "Zen Car.png",
    "heartbeat": "Heartbeat.png",
    "rocket-car": "Rocket Car.png",
    "time-machine": "Time Machine.png",
    "rain-drive": "Rain Drive.png",
    "ocean-drive": "Ocean Drive.png",
    "wild-west-carriage": "Wild West Carriage.png",
    "jet-ski": "Jet Ski.png",
    "synthwave-drive": "Neon Drive.png",
    "world-cyber-city": "Cyber City.png",
    "world-space-drive": "Space Drive.png",
    "world-storm-run": "Storm Run.png",
    "symphony-cinematic-rock": "Cinematic Rock.png",
    "symphony-motion-orchestra": "Motion Orchestra.png",
    "symphony-neon-run": "Neon Drive.png",
    "fusion-road-anthem": "Road Anthem.png",
    "fusion-mechanical-symphony": "Mechanical Symphony.png",
    "fusion-midnight-boost": "Midnight Boost.png",
}

# Extra stills kept in the source folder on purpose - not mapped to a Sound Profile.
IGNORE_SOURCE = {
    "_Cinematic Rock Electric Hypercar.png",
    "_Road Athem.png",
}


def normalize_key(name: str) -> str:
    stem = Path(name).stem
    if stem.startswith("_"):
        stem = stem[1:]
    # Collapse curly/straight apostrophes and spaces for fuzzy match.
    return (
        stem.casefold()
        .replace("'", "")
        .replace("\u2019", "")
        .replace("\u2018", "")
        .replace("-", " ")
        .replace("_", " ")
    )


def resolve(files_by_norm: dict[str, Path], fname: str) -> Path | None:
    key = normalize_key(fname)
    hit = files_by_norm.get(key)
    if hit:
        return hit
    # Romanian carriage: apostrophe / encoding variants.
    if "romanian" in key and "carriage" in key:
        for norm, path in files_by_norm.items():
            if "romanian" in norm and "carriage" in norm:
                return path
    # Loose containment on stem tokens.
    tokens = [t for t in key.split() if len(t) > 2]
    for norm, path in files_by_norm.items():
        if all(t in norm for t in tokens):
            return path
    return None


def main() -> None:
    DST_DIR.mkdir(parents=True, exist_ok=True)
    files_by_norm = {normalize_key(f.name): f for f in SRC_DIR.glob("*.png")}
    ok: list[str] = []
    missing: list[tuple[str, str]] = []

    for profile_id, fname in MAP.items():
        src = resolve(files_by_norm, fname)
        if src is None:
            missing.append((profile_id, fname))
            continue
        im = Image.open(src).convert("RGB").resize(TARGET, Image.Resampling.LANCZOS)
        out = DST_DIR / f"{profile_id}.png"
        im.save(out, optimize=True)
        ok.append(f"{profile_id} <- {src.name}")

    mapped_srcs = {line.split(" <- ", 1)[1] for line in ok}
    unused = sorted(
        f.name
        for f in SRC_DIR.glob("*.png")
        if f.name not in mapped_srcs and f.name not in IGNORE_SOURCE
    )

    print(f"wrote {len(ok)}")
    for line in ok:
        print(line)
    if missing:
        print("MISSING_MAP:")
        for item in missing:
            print(item)
    if unused:
        print("UNUSED_SOURCE:")
        for name in unused:
            print(name)


if __name__ == "__main__":
    main()
