"""Masks for the 16:9 presentation master: rounded-corner alpha for the vertical video and its drop shadow."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

BUILD = Path(__file__).resolve().parent.parent / "build"
W, H, R = 562, 1000, 28     # vertical video shown at 1000 px tall on a 1080 px canvas
PAD = 60

mask = Image.new("L", (W, H), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, W - 1, H - 1], R, fill=255)
mask.save(BUILD / "present_mask.png")

shadow = Image.new("RGBA", (W + 2 * PAD, H + 2 * PAD), (0, 0, 0, 0))
ImageDraw.Draw(shadow).rounded_rectangle([PAD, PAD + 14, PAD + W, PAD + H + 14], R, fill=(0, 0, 0, 200))
shadow.filter(ImageFilter.GaussianBlur(26)).save(BUILD / "present_shadow.png")
