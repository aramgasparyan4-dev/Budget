"""Rounded-corner alpha mask for compositing the vertical video into a 16:9 frame (stage master + read-along)."""
from pathlib import Path

from PIL import Image, ImageDraw

BUILD = Path(__file__).resolve().parent.parent / "build"
W, H, R = 562, 1000, 28     # vertical video shown at 1000 px tall on a 1080 px canvas

mask = Image.new("L", (W, H), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, W - 1, H - 1], R, fill=255)
mask.save(BUILD / "present_mask.png")
