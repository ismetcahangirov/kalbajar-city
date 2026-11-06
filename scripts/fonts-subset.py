#!/usr/bin/env python3
"""Splits Alethia Next into the three files per weight the public site loads.

    pip install fonttools brotli
    python3 scripts/fonts-subset.py
    pnpm exec prettier --write src/styles/font-ranges.css

A page in Azerbaijani or English uses a small part of the font, so each of the
three upright weights is split (#30):

  Core      ASCII, the Azerbaijani letters and the punctuation the catalogues
            use. Preloaded on every page (src/app/fonts.ts).
  Cyrillic  The Russian pages' letters.
  Extended  Every other character, for a name typed in the console.

The last two get `unicode-range` faces (src/styles/font-ranges.css, written
here), so the browser fetches one only for a page that shows one of its
characters. No code point is dropped: the three files together cover all of the
original. Only the OpenType features no style turns on (`salt`, `ss06`, `frac`,
`cpsp`) go, with the glyphs that only they reach. Reads
assets/fonts/alethia-next, writes src/fonts/alethia-next. The italic is not
split: it sets one emphasised phrase at most and is not preloaded.
"""

from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

WEIGHTS = {"Light": 300, "Regular": 400, "Medium": 500}
CYRILLIC = range(0x0400, 0x0530)
CORE = {
    0x0000,
    0x000D,
    *range(0x0020, 0x007F),
    *map(ord, " ©«»²°·×"),
    *map(ord, "ÇÉÖÜáçéöü"),
    *map(ord, "ĞğİıŞşƏə"),
    *map(ord, "–—‘’“”…•№−€←↑→↓"),
}
FEATURES = "kern,mark,mkmk,liga,clig,locl,ccmp,calt,rlig"
ROOT = Path(__file__).resolve().parent.parent
SOURCES = ROOT / "assets/fonts/alethia-next"
TARGET = ROOT / "src/fonts/alethia-next"

HEADER = """/*
 * Written by scripts/fonts-subset.py; change the ranges there.
 *
 * The parts of Alethia Next most pages never use. With `unicode-range` a
 * browser fetches a file only for a page that shows one of its characters, so
 * an Azerbaijani page loads none of them and a Russian one the Cyrillic. Not
 * preloaded, and metric-matched by the same fallback as the core files, so a
 * late swap moves nothing.
 */
"""


def write(source: Path, target: Path, code_points: list[int]) -> None:
    options = subset.Options(
        flavor="woff2",
        layout_features=FEATURES.split(","),
        desubroutinize=True,
        name_IDs=["*"],
        notdef_outline=True,
    )
    font = TTFont(source)
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=code_points)
    subsetter.subset(font)
    font.flavor = "woff2"
    font.save(target)
    print(f"{target.name}: {target.stat().st_size} bytes, {len(code_points)} code points")


def unicode_range(code_points: list[int]) -> str:
    """`U+00C0-00C6, U+00C8, …` for a sorted list."""
    ranges: list[list[int]] = []
    for point in code_points:
        if ranges and point == ranges[-1][1] + 1:
            ranges[-1][1] = point
        else:
            ranges.append([point, point])
    return ", ".join(
        f"U+{low:04X}" if low == high else f"U+{low:04X}-{high:04X}" for low, high in ranges
    )


def face(family: str, weight: str, number: int, part: str, code_points: list[int]) -> str:
    return f"""
@font-face {{
  font-family: "{family}";
  src: url("../fonts/alethia-next/AlethiaNext-{weight}-{part}.woff2") format("woff2");
  font-weight: {number};
  font-style: normal;
  font-display: swap;
  unicode-range: {unicode_range(code_points)};
}}
"""


faces = {"Cyrillic": "", "Extended": ""}
for weight, number in WEIGHTS.items():
    source = SOURCES / f"AlethiaNext-{weight}.woff2"
    all_points = sorted(TTFont(source).getBestCmap())
    cyrillic = [point for point in all_points if point in CYRILLIC]
    extended = [point for point in all_points if point not in CORE and point not in CYRILLIC]
    core = [point for point in all_points if point in CORE]
    write(source, TARGET / f"AlethiaNext-{weight}-Core.woff2", core)
    write(source, TARGET / f"AlethiaNext-{weight}-Cyrillic.woff2", cyrillic)
    write(source, TARGET / f"AlethiaNext-{weight}-Extended.woff2", extended)
    faces["Cyrillic"] += face("Alethia Cyrillic", weight, number, "Cyrillic", cyrillic)
    faces["Extended"] += face("Alethia Extended", weight, number, "Extended", extended)

(ROOT / "src/styles/font-ranges.css").write_text(HEADER + faces["Cyrillic"] + faces["Extended"])
