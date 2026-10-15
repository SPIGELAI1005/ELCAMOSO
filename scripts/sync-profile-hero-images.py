"""Copy name-matched stills from Images cars_elcamoso into public/hero/sound-profiles/{profileId}.png."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

SRC_DIR = Path(r"C:\Users\georg\ELCAMOSO\Images cars_elcamoso")
DST_DIR = Path(r"C:\Users\georg\ELCAMOSO\public\hero\sound-profiles")
TARGET = (1672, 941)
TOP_H_RATIO = 230 / 941
BR_W, BR_H = 320, 80

# profile_id -> exact source filename (as named in Images cars_elcamoso)
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
    "santa-sleigh": "Santa sleigh.png",
    "wild-west-carriage": "Wild West Carriage.png",
    # Apostrophe encoding varies; resolve() falls back to stem match / glob.
    "romanian-85-carriage": "Romanian 85 carriage.png",
    "laughing-machine": "Laughing machine.png",
    "farting-car": "Cheeky Micro Hatchback with Gas Puffs.png",
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
    "snowmobile": "Snowmobile.png",
    "tank": "Tank.png",
    "construction-monster": "Construction Monster.png",
    "horse-gallop": "Horse Gallop.png",
    "dragon": "Dragon.png",
    "thunder-beast": "Thunder Beast.png",
    "retro-arcade": "Retro Arcade.png",
    "deep-bass-pulse": "Deep Bass Pulse.png",
    "zen-drive": "Zen Drive.png",
    "rain-drive": "Rain Drive.png",
    "ocean-drive": "Ocean Drive.png",
    "heartbeat": "Heartbeat.png",
    "world-cyber-city": "Cyber City Electric Fastback.png",
    "world-space-drive": "Space Drive.png",
    "world-storm-run": "Storm Run.png",
    "symphony-cinematic-rock": "Cinematic Rock.png",
    "symphony-motion-orchestra": "Motion Orchestra.png",
    "symphony-neon-run": "Neon Drive.png",
    "fusion-road-anthem": "Road Anthem.png",
    "fusion-mechanical-symphony": "Mechanical Symphony.png",
    "fusion-midnight-boost": "Midnight Boost.png",
    "fusion-future-pulse": "Future Pulse.png",
    "jet-ski": "Speed Boat.png",
    "synthwave-drive": "Neon Drive.png",
}


def resolve(files_cf: dict[str, Path], fname: str) -> Path | None:
    hit = files_cf.get(fname.casefold())
    if hit:
        return hit
    key = Path(fname).stem.casefold()
    for name, path in files_cf.items():
        if key in name or name.startswith(key[:12]):
            return path
    # Romanian carriage: filename may use a non-ASCII apostrophe.
    if "romanian" in key and "carriage" in key:
        for name, path in files_cf.items():
            if "romanian" in name and "carriage" in name:
                return path
    return None


def main() -> None:
    DST_DIR.mkdir(parents=True, exist_ok=True)
    files_cf = {f.name.casefold(): f for f in SRC_DIR.glob("*.png")}
    ok: list[str] = []
    missing: list[tuple[str, str]] = []

    for profile_id, fname in MAP.items():
        src = resolve(files_cf, fname)
        if src is None:
            missing.append((profile_id, fname))
            continue
        im = Image.open(src).convert("RGB").resize(TARGET, Image.Resampling.LANCZOS)
        w, h = im.size
        draw = ImageDraw.Draw(im)
        draw.rectangle([0, 0, w, int(h * TOP_H_RATIO)], fill=(0, 0, 0))
        draw.rectangle([w - BR_W, h - BR_H, w, h], fill=(0, 0, 0))
        out = DST_DIR / f"{profile_id}.png"
        im.save(out, optimize=True)
        ok.append(f"{profile_id} <- {src.name}")

    print(f"wrote {len(ok)}")
    for line in ok:
        print(line)
    if missing:
        print("MISSING:")
        for item in missing:
            print(item)


if __name__ == "__main__":
    main()
