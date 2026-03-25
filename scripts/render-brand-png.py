#!/usr/bin/env python3
"""
Render MechaGen brand assets (icon + wordmarks) to PNG in repo root.
Matches frontend TopBar / landing: hex mark + Space Grotesk, dark-theme colors.
Run: python3 scripts/render-brand-png.py
"""
from __future__ import annotations

import math
import os
import subprocess
import urllib.request

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = ROOT
FONT_URL = (
    "https://cdn.jsdelivr.net/fontsource/fonts/space-grotesk@latest/latin-700-normal.ttf"
)
CACHE_FONT = os.path.join(os.path.dirname(__file__), ".space-grotesk-700.ttf")

ACCENT = (126, 184, 247, 255)  # --accent-blue dark theme
TEXT = (224, 224, 232, 255)  # --text-primary dark theme
TRANSPARENT = (0, 0, 0, 0)


def ensure_font() -> str:
    if os.path.isfile(CACHE_FONT):
        return CACHE_FONT
    try:
        subprocess.run(
            ["curl", "-fsSL", "-o", CACHE_FONT, FONT_URL],
            check=True,
            capture_output=True,
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        urllib.request.urlretrieve(FONT_URL, CACHE_FONT)
    return CACHE_FONT


def hexagon_polygon(cx: float, cy: float, r: float) -> list[tuple[float, float]]:
    """Flat-top regular hexagon (6 vertices)."""
    pts = []
    for i in range(6):
        ang = math.pi / 3 * i - math.pi / 6
        pts.append((cx + r * math.cos(ang), cy + r * math.sin(ang)))
    return pts


def draw_hex_icon_outline(size: int) -> Image.Image:
    """Hex outline only (hollow inside) — matches ⬡ stroke look, not solid fill."""
    img = Image.new("RGBA", (size, size), TRANSPARENT)
    draw = ImageDraw.Draw(img)
    cx = cy = size / 2
    r = size * 0.42
    stroke = max(4, int(size * 0.065))
    draw.polygon(
        hexagon_polygon(cx, cy, r),
        fill=None,
        outline=ACCENT,
        width=stroke,
    )
    return img


def text_size(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont) -> tuple[int, int]:
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]


def main() -> None:
    font_path = ensure_font()

    # --- logo-icon.png (symbol only, transparent) ---
    icon_size = 512
    icon = draw_hex_icon_outline(icon_size)
    icon.save(os.path.join(OUT, "logo-icon.png"), "PNG")
    print("Wrote logo-icon.png")

    # --- logo-text.png (wordmark only) ---
    text_content = "MECHAGEN"
    font_px = 160
    font = ImageFont.truetype(font_path, font_px)
    tmp = Image.new("RGBA", (4, 4), TRANSPARENT)
    td = ImageDraw.Draw(tmp)
    tw, th = text_size(td, text_content, font)
    pad = 40
    tw_img = Image.new("RGBA", (tw + pad * 2, th + pad * 2), TRANSPARENT)
    tdraw = ImageDraw.Draw(tw_img)
    tdraw.text((pad, pad), text_content, font=font, fill=TEXT)
    tw_img.save(os.path.join(OUT, "logo-text.png"), "PNG")
    print("Wrote logo-text.png")

    # --- logo-full.png (icon + wordmark, horizontal) ---
    full_h = 200
    # Render hex at target size so outline stroke scales correctly (no resize blur).
    icon_small = draw_hex_icon_outline(full_h)
    word = "MECHAGEN"
    f2 = ImageFont.truetype(font_path, int(full_h * 0.42))
    tmp2 = Image.new("RGBA", (4, 4), TRANSPARENT)
    d2 = ImageDraw.Draw(tmp2)
    ww, wh = text_size(d2, word, f2)
    gap = int(full_h * 0.12)
    fw = full_h + gap + ww + 80
    fh = full_h + 80
    full = Image.new("RGBA", (fw, fh), TRANSPARENT)
    full.paste(icon_small, (40, 40), icon_small)
    ImageDraw.Draw(full).text((40 + full_h + gap, 40 + (full_h - wh) // 2), word, font=f2, fill=TEXT)
    full.save(os.path.join(OUT, "logo-full.png"), "PNG")
    print("Wrote logo-full.png")

    # --- logo-full-pro.png (MECHAGEN PRO, matches landing nav) ---
    word_pro = "MECHAGEN PRO"
    f3 = ImageFont.truetype(font_path, int(full_h * 0.36))
    tmp3 = Image.new("RGBA", (4, 4), TRANSPARENT)
    d3 = ImageDraw.Draw(tmp3)
    # Accent for hex char simulation: draw small hex + text
    ww3, wh3 = text_size(d3, word_pro, f3)
    gap3 = int(full_h * 0.1)
    fw3 = full_h + gap3 + ww3 + 100
    pro_img = Image.new("RGBA", (fw3, fh), TRANSPARENT)
    icon2 = draw_hex_icon_outline(full_h)
    pro_img.paste(icon2, (40, 40), icon2)
    x_text = 40 + full_h + gap3
    y_text = 40 + (full_h - wh3) // 2
    # "MECHAGEN" in text color, " PRO" could stay same — landing uses one color for full string after icon
    ImageDraw.Draw(pro_img).text((x_text, y_text), word_pro, font=f3, fill=TEXT)
    pro_img.save(os.path.join(OUT, "logo-full-pro.png"), "PNG")
    print("Wrote logo-full-pro.png")


if __name__ == "__main__":
    main()
