"""Draws the README artwork in this folder as self-contained SVGs.

Text is converted to outlines from the product fonts (Palette Mosaic, Kode Mono) because GitHub
shows README images without access to web fonts. Edit the copy or layout here, then run:

    npm install                      # the fonts come from node_modules
    pip install fonttools brotli
    python docs/readme/generate.py

src/sky.jpg is a crop of client/src/assets/backgrounds/sky.webp and src/mark.png a small copy of
client/src/assets/brand/brand-mark.png.
"""
import base64
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
OUT = HERE
SRC = HERE / "src"
FONTS = REPO / "node_modules"

INK = "#191923"
ORANGE = "#fb541b"
W = 1200


class Face:
    def __init__(self, font):
        self.glyphs = font.getGlyphSet()
        self.cmap = font.getBestCmap()
        self.upm = font["head"].unitsPerEm
        self.hmtx = font["hmtx"]

    def advance(self, ch, size):
        name = self.cmap.get(ord(ch)) or self.cmap[ord("?")]
        return self.hmtx[name][0] * size / self.upm

    def width(self, text, size, spacing=0):
        return sum(self.advance(c, size) for c in text) + spacing * max(0, len(text) - 1)

    def glyph(self, ch, x, y, size):
        name = self.cmap.get(ord(ch)) or self.cmap[ord("?")]
        pen = SVGPathPen(self.glyphs, ntos=lambda v: f"{v:.1f}".rstrip("0").rstrip("."))
        scale = size / self.upm
        self.glyphs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, x, y)))
        return pen.getCommands()

    def path(self, text, x, y, size, anchor="start", spacing=0):
        """One path for the whole string; `letters` gives one path per character."""
        return "".join(d for d, _ in self.letters(text, x, y, size, anchor, spacing))

    def letters(self, text, x, y, size, anchor="start", spacing=0):
        total = self.width(text, size, spacing)
        if anchor == "middle":
            x -= total / 2
        elif anchor == "end":
            x -= total
        out = []
        for ch in text:
            out.append((self.glyph(ch, x, y, size), x))
            x += self.advance(ch, size) + spacing
        return out


display = Face(TTFont(FONTS / "@fontsource/palette-mosaic/files/palette-mosaic-latin-400-normal.woff2"))
_kode = FONTS / "@fontsource-variable/kode-mono/files/kode-mono-latin-wght-normal.woff2"
mono = {w: Face(instancer.instantiateVariableFont(TTFont(_kode), {"wght": w})) for w in (400, 500, 600, 700)}


def text(s, x, y, size, weight=500, fill=INK, anchor="start", opacity=None, spacing=0, extra=""):
    op = f' fill-opacity="{opacity}"' if opacity is not None else ""
    return f'<path d="{mono[weight].path(s, x, y, size, anchor, spacing)}" fill="{fill}"{op}{extra}/>'


def title(s, x, y, size, fill="#fff", anchor="start", spacing=0, extra=' filter="url(#titleShadow)"'):
    return f'<path d="{display.path(s, x, y, size, anchor, spacing)}" fill="{fill}"{extra}/>'


def leaf(x, y, w, h, r, corners="tl-br"):
    """PlayLoop's signature shape: two opposite corners rounded."""
    tl, tr, br, bl = (r, 0, r, 0) if corners == "tl-br" else (0, r, 0, r)
    return (
        f"M{x + tl},{y}H{x + w - tr}"
        + (f"A{tr},{tr} 0 0 1 {x + w},{y + tr}" if tr else "")
        + f"V{y + h - br}"
        + (f"A{br},{br} 0 0 1 {x + w - br},{y + h}" if br else "")
        + f"H{x + bl}"
        + (f"A{bl},{bl} 0 0 1 {x},{y + h - bl}" if bl else "")
        + f"V{y + tl}"
        + (f"A{tl},{tl} 0 0 1 {x + tl},{y}" if tl else "")
        + "Z"
    )


def tag(label, x, y, tint="#ffffff", deep=INK, opacity=0.5, size=18, pad=15, h=39):
    w = mono[500].width(label, size) + pad * 2
    op = f' fill-opacity="{opacity}"' if tint == "#ffffff" else ""
    shape = f'<path d="{leaf(x, y, w, h, min(30, h / 2), "tr-bl")}" fill="{tint}"{op}/>'
    return shape + text(label, x + pad, y + h / 2 + size * 0.35, size, 500, deep), w


def markers(x, y, w, h, s=14, inset=14):
    pts = [(x + inset, y + inset), (x + w - inset - s, y + inset), (x + inset, y + h - inset - s), (x + w - inset - s, y + h - inset - s)]
    return "".join(f'<rect x="{px}" y="{py}" width="{s}" height="{s}" fill="url(#marker)"/>' for px, py in pts)


def glass(x, y, w, h, r=20, opacity=0.4, stroke=True):
    s = ' stroke="#fff" stroke-opacity=".5"' if stroke else ""
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="#fff" fill-opacity="{opacity}"{s}/>'


def data_uri(path, mime):
    return f"data:{mime};base64,{base64.b64encode(path.read_bytes()).decode()}"


DEFS = """
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4b8fdc"/><stop offset=".55" stop-color="#7db4ec"/><stop offset="1" stop-color="#b9dcf8"/></linearGradient>
<linearGradient id="marker" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff3f00"/><stop offset="1" stop-color="#ffa082"/></linearGradient>
<linearGradient id="cta" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fb541b" stop-opacity=".85"/><stop offset="1" stop-color="#ffa600" stop-opacity=".85"/></linearGradient>
<filter id="titleShadow" x="-10%" y="-30%" width="120%" height="170%"><feDropShadow dx="0" dy="0" stdDeviation="9" flood-color="#000" flood-opacity=".28"/></filter>
<filter id="textShadow" x="-10%" y="-40%" width="120%" height="200%"><feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="#000" flood-opacity=".3"/></filter>
<filter id="panelShadow" x="-10%" y="-20%" width="120%" height="150%"><feDropShadow dx="0" dy="4" stdDeviation="12" flood-color="#000" flood-opacity=".18"/></filter>
<filter id="cloud" x="-50%" y="-80%" width="200%" height="260%"><feGaussianBlur stdDeviation="26"/></filter>
"""

STYLE = """
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
@keyframes drift{0%{transform:translateX(-60px)}100%{transform:translateX(60px)}}
@keyframes dash{to{stroke-dashoffset:-48}}
@keyframes pulse{0%,100%{opacity:.55}50%{opacity:1}}
@keyframes spin{to{transform:rotate(360deg)}}
.bob{animation:bob 3.2s ease-in-out infinite}
.drift{animation:drift 18s ease-in-out infinite alternate}
.drift2{animation:drift 26s ease-in-out infinite alternate-reverse}
.dash{stroke-dasharray:10 14;animation:dash 1.6s linear infinite}
.pulse{animation:pulse 2.4s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.bob,.drift,.drift2,.dash,.pulse,.spin{animation:none}}
"""


def clouds(h, seed=0):
    spots = [(180, 0.25, 260, 60), (620, 0.7, 340, 70), (1010, 0.3, 240, 55), (380, 0.92, 300, 60), (900, 0.95, 280, 50)]
    out = []
    for i, (cx, fy, rx, ry) in enumerate(spots):
        cls = "drift" if (i + seed) % 2 else "drift2"
        out.append(f'<ellipse class="{cls}" cx="{cx}" cy="{h * fy:.0f}" rx="{rx}" ry="{ry}" fill="#fff" fill-opacity=".5" filter="url(#cloud)"/>')
    return "".join(out)


def grid(h, top=None):
    lines = f'<rect x="58" width="3" height="{h}" fill="#fff" fill-opacity=".2"/><rect x="{W - 61}" width="3" height="{h}" fill="#fff" fill-opacity=".2"/>'
    if top is not None:
        lines += f'<rect y="{top}" width="{W}" height="3" fill="#fff" fill-opacity=".2"/><rect y="{top + 16}" width="{W}" height="3" fill="#fff" fill-opacity=".2"/>'
    return lines


def svg(name, h, body, label, sky_image=None, seed=0, grid_top=None, cloudy=True):
    bg = (
        f'<image href="{sky_image}" x="0" y="0" width="{W}" height="{h}" preserveAspectRatio="xMidYMid slice"/>'
        if sky_image
        else f'<rect width="{W}" height="{h}" fill="url(#sky)"/>' + (clouds(h, seed) if cloudy else f'<ellipse class="drift" cx="{880 + seed * 20}" cy="{h}" rx="260" ry="46" fill="#fff" fill-opacity=".35" filter="url(#cloud)"/>')
    )
    doc = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {h}" width="{W}" height="{h}" role="img" aria-label="{label}">'
        f"<title>{label}</title><defs>{DEFS}<clipPath id=\"frame\"><rect width=\"{W}\" height=\"{h}\" rx=\"24\"/></clipPath></defs>"
        f"<style>{STYLE}</style>"
        f'<g clip-path="url(#frame)">{bg}{grid(h, grid_top)}{body}</g></svg>'
    )
    (OUT / name).write_text(" ".join(doc.split()).replace("> <", "><"))
    return len(doc)


# ---------------------------------------------------------------- hero
def hero():
    h = 500
    sky = data_uri(SRC / "sky.jpg", "image/jpeg")
    mark = data_uri(SRC / "mark.png", "image/png")
    b = []
    # Navigation, as on the site.
    b.append(f'<image href="{mark}" x="330" y="26" width="54" height="48"/>')
    for label, x in (("Explore Games", 440), ("My Games", 640), ("Avatar", 790)):
        b.append(text(label, x, 58, 18, 500, "#fff", extra=' filter="url(#textShadow)"'))
    b.append(f'<rect x="920" y="32" width="108" height="38" rx="8" fill="{ORANGE}" fill-opacity=".5" stroke="#ff803c"/>')
    b.append(text("Log In", 974, 58, 18, 700, "#fff", "middle", extra=' filter="url(#textShadow)"'))
    # Bobbing PLAYLOOP lettering.
    size = 138
    letters = display.letters("PLAYLOOP", W / 2, 268, size, "middle", spacing=6)
    for i, (d, _) in enumerate(letters):
        b.append(f'<path class="bob" style="animation-delay:{i * 0.16:.2f}s" d="{d}" fill="#fff" filter="url(#titleShadow)"/>')
    b.append(text("Reciprocal playtesting for indie game developers", W / 2, 322, 24, 500, "#fff", "middle", extra=' filter="url(#textShadow)"'))
    # Feature bubbles.
    for cx, cy, r, tint, top, bottom, delay in ((168, 398, 72, "#8cd43f", "Playtest", "Roulette", 0.4), (1032, 398, 72, ORANGE, "Publish", "your build", 1.1)):
        b.append(
            f'<g class="bob" style="animation-delay:{delay}s"><circle cx="{cx}" cy="{cy}" r="{r}" fill="{tint}" fill-opacity=".28" stroke="#fff" stroke-opacity=".5"/>'
            + text(top, cx, cy - 2, 19, 700, "#fff", "middle", extra=' filter="url(#textShadow)"')
            + text(bottom, cx, cy + 22, 16, 500, "#fff", "middle", extra=' filter="url(#textShadow)"')
            + "</g>"
        )
    # Call to action on the button leaf.
    cw, ch = 520, 64
    cx = (W - cw) / 2
    b.append(f'<path d="{leaf(cx, 368, cw, ch, 20)}" fill="url(#cta)" filter="url(#panelShadow)"/>')
    b.append(text("Play it.  Review it.  Level up.", W / 2, 410, 26, 700, INK, "middle"))
    b.append(text("publish a build  ->  get playtested  ->  give feedback back", W / 2, 466, 16, 500, "#fff", "middle", extra=' filter="url(#textShadow)"'))
    b.append(markers(61, 96 + 19, W - 122, h - 96 - 19, s=16, inset=18))
    return svg("hero.svg", h, "".join(b), "PlayLoop: reciprocal playtesting for indie game developers", sky_image=sky, grid_top=96)


# ---------------------------------------------------------------- section headings
def heading(slug, number, label, seed):
    h = 120
    b = [glass(90, 22, W - 180, 76, 20, 0.2)]
    b.append(f'<path d="{leaf(112, 38, 86, 44, 22, "tr-bl")}" fill="#ffd6c7"/>')
    b.append(text(number, 155, 68, 22, 700, "#a3300a", "middle"))
    b.append(title(label, 226, 79, 46, spacing=3))
    b.append(f'<rect x="{W - 90 - 34}" y="52" width="16" height="16" fill="url(#marker)" class="pulse"/>')
    return svg(f"h-{slug}.svg", h, "".join(b), label.title(), seed=seed, cloudy=False)


# ---------------------------------------------------------------- the loop
def loop():
    h = 500
    steps = [
        ("01", "PUBLISH", "Upload a web or", "download build.", "#ffd6c7", "#a3300a"),
        ("02", "PLAYTEST", "Reviewers accept", "your missions.", "#cbd9ff", "#0536b5"),
        ("03", "REVIEW", "First impression,", "playtest, verdict.", "#dff4c7", "#376c0d"),
        ("04", "LEVEL UP", "Helpful feedback", "earns reputation.", "#ffedb5", "#8a5b00"),
    ]
    b = [title("THE LOOP", W / 2, 84, 62, anchor="middle", spacing=4)]
    b.append(text("Every review you give sends a playtester back to your own game.", W / 2, 122, 18, 500, "#fff", "middle", extra=' filter="url(#textShadow)"'))
    cw, ch, gap, top = 232, 214, 44, 160
    x0 = (W - (cw * 4 + gap * 3)) / 2
    # The return path, drawn first so the cards sit on it.
    left, right = x0 + cw / 2, x0 + 3 * (cw + gap) + cw / 2
    b.append(f'<path class="dash" d="M{right},{top + ch}V{top + ch + 44}a14,14 0 0 1 -14,14H{left + 14}a14,14 0 0 1 -14,-14V{top + ch + 8}" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>')
    b.append(f'<path d="M{left - 10},{top + ch + 20}l10,-14l10,14Z" fill="#fff"/>')
    b.append(text("and around again", W / 2, top + ch + 92, 17, 600, "#fff", "middle", extra=' filter="url(#textShadow)"'))
    for i, (num, name, l1, l2, tint, deep) in enumerate(steps):
        x = x0 + i * (cw + gap)
        corners = "tl-br" if i % 2 == 0 else "tr-bl"
        b.append(f'<g class="bob" style="animation-delay:{i * 0.35:.2f}s;animation-duration:4.4s">')
        b.append(f'<path d="{leaf(x, top, cw, ch, 56, corners)}" fill="#fff" fill-opacity=".42" stroke="#fff" stroke-opacity=".5" filter="url(#panelShadow)"/>')
        b.append(f'<path d="{leaf(x + 24, top + 26, 70, 38, 19, "tr-bl")}" fill="{tint}"/>')
        b.append(text(num, x + 59, top + 52, 19, 700, deep, "middle"))
        b.append(title(name, x + 24, top + 116, 32, fill=INK, spacing=2, extra=""))
        b.append(text(l1, x + 24, top + 152, 16, 500, INK, opacity=0.8))
        b.append(text(l2, x + 24, top + 174, 16, 500, INK, opacity=0.8))
        b.append("</g>")
        if i < 3:
            ax = x + cw + 6
            b.append(f'<path class="dash" d="M{ax},{top + ch / 2}h{gap - 18}" stroke="#fff" stroke-width="4" stroke-linecap="round" fill="none"/>')
            b.append(f'<path d="M{ax + gap - 16},{top + ch / 2 - 9}l14,9l-14,9Z" fill="#fff"/>')
    b.append(markers(61, 0, W - 122, h, s=14, inset=16))
    return svg("loop.svg", h, "".join(b), "The loop: publish a build, get playtested, review, level up, and around again", seed=1)


# ---------------------------------------------------------------- architecture
def architecture():
    h = 600
    b = [title("HOW IT FITS", W / 2, 80, 56, anchor="middle", spacing=4)]

    def card(x, y, w, hh, name, sub, tint=None, deep=INK, kind="card"):
        out = []
        if kind == "leaf":
            out.append(f'<path d="{leaf(x, y, w, hh, 40)}" fill="#fff" fill-opacity=".45" stroke="#fff" stroke-opacity=".5" filter="url(#panelShadow)"/>')
        else:
            out.append(f'<rect x="{x}" y="{y}" width="{w}" height="{hh}" rx="20" fill="{tint or "#fff"}" fill-opacity="{1 if tint else 0.42}" stroke="#fff" stroke-opacity=".5" filter="url(#panelShadow)"/>')
        out.append(text(name, x + w / 2, y + hh / 2 - 2, 20, 700, deep, "middle"))
        out.append(text(sub, x + w / 2, y + hh / 2 + 22, 14, 500, deep, "middle", opacity=0.8))
        return "".join(out)

    def wire(d):
        return f'<path class="dash" d="{d}" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>'

    # Row 1: client, row 2: gateway, row 3: services, row 4: data.
    b.append(card(450, 112, 300, 74, "React client", "Vite · :5173", kind="leaf"))
    b.append(wire("M600,186V214"))
    b.append(f'<path d="{leaf(380, 214, 440, 72, 20)}" fill="url(#cta)" filter="url(#panelShadow)"/>')
    b.append(text("Nginx gateway", 600, 247, 22, 700, INK, "middle"))
    b.append(text("http://localhost:4000/api", 600, 270, 14, 500, INK, "middle", opacity=0.8))
    services = [
        ("Identity", "accounts · sessions", "#cbd9ff", "#0536b5"),
        ("Community", "games · reviews", "#dff4c7", "#376c0d"),
        ("Notifications", "inbox · unread", "#ffedb5", "#8a5b00"),
        ("Media", "uploads · builds", "#e3daff", "#5937c8"),
    ]
    sw, sgap = 222, 28
    sx0 = (W - (sw * 4 + sgap * 3)) / 2
    b.append(wire(f"M600,286V314M{sx0 + sw / 2},314H{sx0 + 3 * (sw + sgap) + sw / 2}"))
    for i, (name, sub, tint, deep) in enumerate(services):
        x = sx0 + i * (sw + sgap)
        b.append(wire(f"M{x + sw / 2},314V342"))
        b.append(card(x, 342, sw, 84, name, sub, tint, deep))
        b.append(wire(f"M{x + sw / 2},426V470"))
    b.append(glass(sx0, 470, sw * 3 + sgap * 2, 78, 20, 0.42))
    b.append(text("MongoDB 8", sx0 + (sw * 3 + sgap * 2) / 2, 505, 20, 700, INK, "middle"))
    b.append(text("one database per service · replica set rs0", sx0 + (sw * 3 + sgap * 2) / 2, 528, 14, 500, INK, "middle", opacity=0.8))
    mx = sx0 + 3 * (sw + sgap)
    b.append(glass(mx, 470, sw, 78, 20, 0.42))
    b.append(text("S3 storage", mx + sw / 2, 505, 20, 700, INK, "middle"))
    b.append(text("local :9000 · AWS S3", mx + sw / 2, 528, 14, 500, INK, "middle", opacity=0.8))
    # Lambdas, off to the side.
    for x, y, name, sub in ((84, 196, "Lambda", "monthly badges"), (W - 84 - 196, 196, "Lambda", "unzip web builds")):
        b.append(f'<path d="{leaf(x, y, 196, 70, 30, "tr-bl")}" fill="#fff" fill-opacity=".5" stroke="#fff" stroke-opacity=".5"/>')
        b.append(text(name, x + 98, y + 32, 18, 700, INK, "middle"))
        b.append(text(sub, x + 98, y + 53, 14, 500, INK, "middle", opacity=0.8))
    b.append(wire("M280,231H372"))
    b.append(wire(f"M{W - 280},231H{W - 372}"))
    b.append(markers(61, 0, W - 122, h, s=14, inset=16))
    return svg("architecture.svg", h, "".join(b), "Architecture: the React client calls an Nginx gateway in front of the Identity, Community, Notifications and Media services, which use MongoDB and S3 storage; two Lambdas award monthly badges and unzip web builds", seed=0)


# ---------------------------------------------------------------- stack tags
def stack():
    h = 96
    tags = [
        ("React 19", "#cbd9ff", "#0536b5"),
        ("Vite 8", "#e3daff", "#5937c8"),
        ("Node 22", "#dff4c7", "#376c0d"),
        ("Express", "#ffffff", INK),
        ("MongoDB 8", "#dff4c7", "#376c0d"),
        ("Nginx", "#ffffff", INK),
        ("Docker", "#cdebff", "#075e8f"),
        ("AWS SAM", "#ffedb5", "#8a5b00"),
        ("OpenAPI", "#ffd6c7", "#a3300a"),
    ]
    widths = [mono[500].width(t[0], 18) + 30 for t in tags]
    gap = 14
    x = (W - (sum(widths) + gap * (len(tags) - 1))) / 2
    b = []
    for (label, tint, deep), w in zip(tags, widths):
        shape, _ = tag(label, x, 28, tint, deep)
        b.append(shape)
        x += w + gap
    return svg("stack.svg", h, "".join(b), "Built with React 19, Vite 8, Node 22, Express, MongoDB 8, Nginx, Docker, AWS SAM and OpenAPI", seed=1)


# ---------------------------------------------------------------- footer
def footer():
    h = 240
    sky = data_uri(SRC / "sky.jpg", "image/jpeg")
    b = []
    letters = display.letters("THANKS FOR PLAYING", W / 2, 118, 64, "middle", spacing=4)
    for i, (d, _) in enumerate(letters):
        b.append(f'<path class="bob" style="animation-delay:{i * 0.09:.2f}s" d="{d}" fill="#fff" filter="url(#titleShadow)"/>')
    b.append(text("Every note you leave goes straight into someone's next build.", W / 2, 162, 18, 500, "#fff", "middle", extra=' filter="url(#textShadow)"'))
    for i, key in enumerate("WASD"):
        kx = W / 2 - 2 * 50 + i * 50 + 4
        b.append(f'<rect x="{kx}" y="186" width="42" height="30" rx="8" fill="#fff" fill-opacity=".8"/><rect x="{kx}" y="214" width="42" height="3" rx="1.5" fill="#000" fill-opacity=".12"/>')
        b.append(text(key, kx + 21, 207, 15, 600, INK, "middle"))
    b.append(markers(61, 0, W - 122, h, s=14, inset=16))
    return svg("footer.svg", h, "".join(b), "Thanks for playing", sky_image=sky)


sizes = {"hero": hero(), "loop": loop(), "architecture": architecture(), "stack": stack(), "footer": footer()}
for n, (slug, label) in enumerate(
    [
        ("start", "START HERE"),
        ("run", "RUN THE STACK"),
        ("seed", "SEED DEMO DATA"),
        ("frontend", "FRONTEND"),
        ("docs", "API DOCS"),
        ("api", "API RULES"),
        ("deploy", "DEPLOY TO AWS"),
    ],
    start=1,
):
    sizes[f"h-{slug}"] = heading(slug, f"{n:02d}", label, n)
print({k: f"{v // 1024} KB" for k, v in sizes.items()})
