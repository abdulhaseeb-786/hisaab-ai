"""Builds the README images in docs/images from the deck's screenshots and art.
    python readme_images.py
"""
import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "..", "docs", "images")
os.makedirs(OUT, exist_ok=True)
SHOTS = os.path.join(HERE, "assets", "shots")
ART = os.path.join(HERE, "assets", "art")
FONTS = "C:/Windows/Fonts"

BOARD = (6, 48, 29)
HALDI = (232, 163, 23)
HALDI_LIGHT = (252, 237, 204)
SABZ_100 = (215, 237, 223)
PAPER = (250, 245, 236)
INK = (27, 25, 21)


def font(name, size):
    return ImageFont.truetype(os.path.join(FONTS, name), size)


def phone(file, height):
    """A screenshot inside a dark rounded phone frame, with a soft shadow."""
    shot = Image.open(os.path.join(SHOTS, file)).convert("RGB")
    bezel = max(10, height // 55)
    inner_h = height - 2 * bezel
    inner_w = round(inner_h * shot.width / shot.height)
    shot = shot.resize((inner_w, inner_h), Image.LANCZOS)
    w, h = inner_w + 2 * bezel, height
    r = bezel * 3
    frame = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(frame).rounded_rectangle((0, 0, w - 1, h - 1), radius=r, fill=INK + (255,))
    mask = Image.new("L", (inner_w, inner_h), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, inner_w - 1, inner_h - 1), radius=r - bezel, fill=255)
    frame.paste(shot, (bezel, bezel), mask)
    pad = 40
    out = Image.new("RGBA", (w + 2 * pad, h + 2 * pad), (0, 0, 0, 0))
    sh = Image.new("RGBA", out.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle((pad, pad + 14, pad + w, pad + h + 14), radius=r, fill=(0, 0, 0, 110))
    out = Image.alpha_composite(out, sh.filter(ImageFilter.GaussianBlur(18)))
    out.alpha_composite(frame, (pad, pad))
    return out


def fit(img, width):
    return img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)


# ---- Banner: the signboard, the name in both scripts, three real screens --------------
W, H = 2400, 1100
banner = Image.new("RGBA", (W, H), BOARD + (255,))
d = ImageDraw.Draw(banner)
d.rounded_rectangle((28, 28, W - 29, H - 29), radius=44, outline=HALDI, width=6)
hisaab = fit(Image.open(os.path.join(ART, "hisaab-haldi.png")).convert("RGBA"), 560)
banner.alpha_composite(hisaab, (150, 40))
d.text((160, 440), "HisaabAI", font=font("BOOKOSB.TTF", 128), fill=(255, 255, 255))
tag = fit(Image.open(os.path.join(ART, "tagline-urdu-haldi.png")).convert("RGBA"), 820)
banner.alpha_composite(tag, (150, 610))
d.text((165, 790), "Dukaandar bolta hai. HisaabAI likhta hai.", font=font("calibrii.ttf", 50), fill=HALDI_LIGHT)
d.text((165, 870), "The shopkeeper speaks. HisaabAI writes the books.", font=font("calibri.ttf", 44), fill=SABZ_100)
# Side phones first, the saved entry (with its stamp) on top in the middle.
for file, x, y, h in [("goods-items.png", 1160, 160, 800), ("jobs.png", 1960, 160, 800), ("voice-saved.png", 1560, 70, 920)]:
    banner.alpha_composite(phone(file, h), (x - 40, y - 40))
banner.convert("RGB").save(os.path.join(OUT, "banner.png"), optimize=True)


# ---- Galleries: rows of framed screens on paper ------------------------------------
def gallery(name, files, height=900):
    phones = [phone(f, height) for f in files]
    gap = 30
    w = sum(p.width for p in phones) + gap * (len(phones) - 1) + 60
    h = max(p.height for p in phones) + 40
    g = Image.new("RGBA", (w, h), PAPER + (255,))
    x = 30
    for p in phones:
        g.alpha_composite(p, (x, 20))
        x += p.width + gap
    g.convert("RGB").save(os.path.join(OUT, name), optimize=True)


gallery("voice.png", ["voice-saved.png", "goods-items.png", "ask-answer.png"])
gallery("day.png", ["jobs.png", "budget-plan.png", "khata-voice.png"])
Image.open(os.path.join(SHOTS, "report.png")).convert("RGB").resize((1600, 1075), Image.LANCZOS).save(os.path.join(OUT, "report.png"), optimize=True)
for f in sorted(os.listdir(OUT)):
    im = Image.open(os.path.join(OUT, f))
    print(f, im.size, os.path.getsize(os.path.join(OUT, f)) // 1024, "KB")
