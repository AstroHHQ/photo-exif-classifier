#!/usr/bin/env python3
"""Classify photos by EXIF metadata: focal length, aperture, ISO, etc."""

import argparse
import json
import os
import shutil
from collections import defaultdict
from pathlib import Path
from typing import Optional

from PIL import Image
from PIL.ExifTags import TAGS

# EXIF tag IDs we care about
EXIF_TAGS = {
    "Make": 271,
    "Model": 272,
    "LensModel": 42036,
    "FocalLength": 37386,
    "FNumber": 33437,
    "ISOSpeedRatings": 34855,
    "ExposureTime": 33434,
    "DateTimeOriginal": 36867,
}

SUPPORTED_EXTS = {".jpg", ".jpeg", ".png", ".tiff", ".tif", ".webp", ".heic", ".heif"}


def get_exif(filepath: str) -> Optional[dict]:
    """Extract relevant EXIF tags from an image file."""
    try:
        img = Image.open(filepath)
        raw = img._getexif()
        if not raw:
            return None

        exif = {}
        for name, tag_id in EXIF_TAGS.items():
            if tag_id in raw:
                val = raw[tag_id]
                if isinstance(val, tuple) and name in ("FocalLength", "FNumber", "ExposureTime"):
                    # Rational numbers: (numerator, denominator)
                    val = round(val[0] / val[1], 2)
                if isinstance(val, bytes):
                    val = val.decode("utf-8", errors="replace").strip("\x00")
                exif[name] = val

        # Flatten focal length: strip "mm" suffix and ensure numeric
        if "FocalLength" in exif:
            fl = exif["FocalLength"]
            if isinstance(fl, str):
                fl = fl.replace("mm", "").strip()
                try:
                    exif["FocalLength"] = float(fl)
                except ValueError:
                    pass
            exif["FocalLength"] = float(exif["FocalLength"])

        return exif
    except Exception:
        return None


def find_images(folder: str) -> list[str]:
    """Recursively find all image files in folder."""
    images = []
    for root, _, files in os.walk(folder):
        for f in files:
            if Path(f).suffix.lower() in SUPPORTED_EXTS:
                images.append(os.path.join(root, f))
    return sorted(images)


def make_key(val) -> str:
    """Human-readable bucket key for a value."""
    if val is None:
        return "Unknown"

    if isinstance(val, float):
        return str(int(val)) if val == int(val) else str(val)

    return str(val)


def print_report(results: list[dict]):
    """Print grouped summary."""
    # Bucket by each dimension
    for label, field in [
        ("Focal Length (mm)", "FocalLength"),
        ("Aperture (f/)", "FNumber"),
        ("ISO", "ISOSpeedRatings"),
        ("Camera", "Model"),
        ("Lens", "LensModel"),
    ]:
        buckets = defaultdict(list)
        for r in results:
            key = make_key(r.get(field))
            buckets[key].append(r["file"])

        print(f"\n{'='*60}")
        print(f"  {label}")
        print(f"{'='*60}")
        for key in sorted(buckets.keys()):
            print(f"  [{key}] — {len(buckets[key])} photo(s)")

    # Files with no EXIF
    no_exif = [r for r in results if not r.get("exif")]
    if no_exif:
        print(f"\n{'='*60}")
        print(f"  No EXIF data — {len(no_exif)} file(s)")
        print(f"{'='*60}")


def print_detail(results: list[dict]):
    """Print per-file detail."""
    for r in results:
        exif = r["exif"] or {}
        fl = exif.get("FocalLength", "?")
        ap = f"f/{exif['FNumber']}" if "FNumber" in exif else "?"
        iso = exif.get("ISOSpeedRatings", "?")
        cam = exif.get("Model") or exif.get("Make", "?")
        print(f"  {r['file']}")
        print(f"    Camera: {cam} | Lens: {exif.get('LensModel', '?')}")
        print(f"    FL: {fl}mm | Aperture: {ap} | ISO: {iso}")


def organize_files(results: list[dict], out_dir: str, by_field: str):
    """Copy files into out_dir/<field>/<value>/ structure."""
    field = by_field
    for r in results:
        exif = r.get("exif") or {}
        val = make_key(exif.get(field))
        dest = os.path.join(out_dir, field, val)
        os.makedirs(dest, exist_ok=True)
        shutil.copy2(r["file"], os.path.join(dest, os.path.basename(r["file"])))
    print(f"\nOrganized {len(results)} files into {out_dir}/ by {field}")


def main():
    parser = argparse.ArgumentParser(description="Classify photos by EXIF metadata")
    parser.add_argument("folder", nargs="?", default=".", help="Folder to scan (default: current dir)")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--detail", action="store_true", help="Per-file detail")
    parser.add_argument("--organize", metavar="FIELD", help="Copy files into folders by FIELD (FocalLength, FNumber, ISOSpeedRatings, Model, LensModel)")
    parser.add_argument("--out", default="classified", help="Output dir for --organize (default: ./classified)")
    args = parser.parse_args()

    images = find_images(args.folder)
    print(f"Found {len(images)} image(s) in {os.path.abspath(args.folder)}")

    results = []
    for fp in images:
        exif = get_exif(fp)
        results.append({"file": fp, "exif": exif})

    if args.json:
        print(json.dumps(results, indent=2, default=str))
    elif args.organize:
        organize_files(results, args.out, args.organize)
    elif args.detail:
        print_detail(results)
    else:
        print_report(results)


if __name__ == "__main__":
    main()
