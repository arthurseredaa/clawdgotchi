#!/usr/bin/env python3
"""Renders the README media in docs/media from the mod's own sprite code.

Usage (from the repo root): python3 scripts/render-media.py
Needs Node (for scripts/export-frames.mjs) and Pillow.
"""
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "media"
PX = 10  # one sprite pixel = one half of a terminal cell, drawn square
TICK_MS = 125

BG = (29, 28, 34)
PANEL = (36, 35, 42)
DIM = (128, 124, 136)
TEXT = (226, 222, 216)
RULE = (70, 68, 78)
ORANGE = (217, 119, 87)

FONT_PATH = "/System/Library/Fonts/Menlo.ttc"


def font(size):
    try:
        return ImageFont.truetype(FONT_PATH, size)
    except OSError:
        return ImageFont.load_default()


def rgb(c):
    return ((c >> 16) & 0xFF, (c >> 8) & 0xFF, c & 0xFF)


def draw_grid(draw, shot, x, y, px=PX):
    grid = shot["g"]
    for r, row in enumerate(grid):
        for c, color in enumerate(row):
            if color is not None:
                draw.rectangle([x + c * px, y + r * px, x + (c + 1) * px - 1, y + (r + 1) * px - 1], fill=rgb(color))
    # A glyph fills one terminal cell: one pixel column wide, two pixel rows tall.
    f = font(int(px * 1.8))
    for gl in shot.get("z", []):
        cx, cy = x + gl["x"] * px + px / 2, y + gl["row"] * 2 * px + px
        draw.text((cx, cy), gl["ch"], font=f, fill=rgb(gl["color"]), anchor="mm")


def save_gif(path, frames):
    pal = [f.convert("P", palette=Image.ADAPTIVE, colors=64) for f in frames]
    pal[0].save(path, save_all=True, append_images=pal[1:], duration=TICK_MS, loop=0, disposal=2, optimize=False)


def sprite_card(grid, width, height, right_margin=40):
    """A dark card with the sprite standing on its bottom edge, right-aligned like in the band."""
    im = Image.new("RGB", (width, height), BG)
    d = ImageDraw.Draw(im)
    w = len(grid["g"][0]) * PX
    draw_grid(d, grid, width - right_margin - w, height - 30 - len(grid["g"]) * PX)
    return im


def hero(frames):
    # Segment lengths and status-line context, matching export-frames.mjs.
    segments = [(24, 12), (16, 12), (13, 31), (16, 58), (16, 81), (24, 94), (25, 94), (5, 9), (12, 9)]
    ctx = [pct for n, pct in segments for _ in range(n)]
    W, H = 760, 250
    f_small, f_text = font(14), font(16)
    out = []
    for i, grid in enumerate(frames):
        im = Image.new("RGB", (W, H), BG)
        d = ImageDraw.Draw(im)
        d.text((24, 22), "● Refactored the retry loop and added a test for three retries.", font=f_small, fill=DIM)
        d.text((W - 52, 70), "[-]", font=f_small, fill=DIM)
        w = len(grid["g"][0]) * PX
        draw_grid(d, grid, W - 64 - w, 72)
        d.line([(16, 168), (W - 16, 168)], fill=RULE, width=1)
        d.text((24, 178), ">", font=f_text, fill=TEXT)
        d.line([(16, 206), (W - 16, 206)], fill=RULE, width=1)
        d.text((24, 216), f"[~/project] | Opus  ctx:{ctx[min(i, len(ctx) - 1)]}%", font=f_small, fill=DIM)
        out.append(im)
    save_gif(OUT / "hero.gif", out)


def stages(grids):
    labels = [("0–24%", "light"), ("25–49%", "fed"), ("50–74%", "stuffed"), ("75–89%", "bloated"), ("90%+", "about to pop")]
    col = 260
    W, H = col * 5, 190
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)
    f_big, f_small = font(16), font(14)
    for i, grid in enumerate(grids):
        w = len(grid["g"][0]) * PX
        x0 = i * col + (col - w) // 2
        draw_grid(d, grid, x0, 120 - len(grid["g"]) * PX)
        pct, name = labels[i]
        d.text((i * col + col // 2, 140), pct, font=f_big, fill=TEXT, anchor="mm")
        d.text((i * col + col // 2, 162), name, font=f_small, fill=DIM, anchor="mm")
    im.save(OUT / "stages.png")


def card_gif(name, frames, width=520, height=140):
    save_gif(OUT / f"{name}.gif", [sprite_card(g, width, height) for g in frames])


def passport(data):
    lines = data["lines"]
    W, H = 640, 200
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([12, 12, W - 12, H - 12], radius=14, outline=RULE, width=2, fill=PANEL)
    f = font(16)
    d.text((W - 40, 26), "✕", font=f, fill=DIM)
    grid = data["portrait"]
    draw_grid(d, grid, 36, 40)
    for i, line in enumerate(lines):
        d.text((260, 40 + i * 24), line, font=f, fill=TEXT)
    im.save(OUT / "passport.png")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    raw = subprocess.run(["node", str(ROOT / "scripts" / "export-frames.mjs")], check=True, capture_output=True, text=True).stdout
    data = json.loads(raw)
    hero(data["hero"])
    stages(data["stages"])
    card_gif("compact", data["compact"])
    card_gif("babies", data["babies"], width=640)
    card_gif("night", data["night"])
    passport(data["passport"])
    for p in sorted(OUT.iterdir()):
        print(p.relative_to(ROOT), p.stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()
