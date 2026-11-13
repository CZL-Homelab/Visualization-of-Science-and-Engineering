"""Build the self-contained offline Fusion Lab page.

Everything (CSS, JS, the vendored three.js core, the icon) is embedded so that
index.html can be opened from file:// with no network connection. Standard
library only.
"""
from pathlib import Path
import base64
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts'))
from shared_experience import embed_experience

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent.parent

SCRIPTS = [
    "vendor/three.min.js",
    "src/core.js",
    "src/reference.js",
    "src/geometry.js",
    "src/engine.js",
    "src/tokamak.js",
    "src/effects.js",
    "src/plant.js",
    "src/micro.js",
    "src/content.js",
    "src/instruments.js",
    "src/app.js",
]
TOKENS = ("<!-- SITE_ICON -->", "<!-- BRAND_ICON -->", "/* LAB_STYLES */", "<!-- LAB_SCRIPTS -->")


def read(path: Path) -> str:
    if not path.exists():
        raise SystemExit(f"missing source file: {path.relative_to(ROOT)}")
    return path.read_text(encoding="utf-8")


def main() -> None:
    html = read(ROOT / "src/page.html")
    icon = "data:image/svg+xml;base64," + base64.b64encode(
        (REPO / "assets/icon.svg").read_bytes()
    ).decode("ascii")
    html = html.replace(
        "<!-- SITE_ICON -->", '<link rel="icon" type="image/svg+xml" href="' + icon + '">'
    ).replace("<!-- BRAND_ICON -->", icon)
    html = html.replace("/* LAB_STYLES */", read(ROOT / "src/lab.css"))

    scripts = []
    for name in SCRIPTS:
        code = read(ROOT / name).replace("</script", "<\\/script")
        scripts.append("<script>\n" + code + "\n</script>")
    html = html.replace("<!-- LAB_SCRIPTS -->", "\n".join(scripts))

    html = embed_experience(html, 'fusion-lab')

    leftover = [t for t in TOKENS if t in html]
    if leftover:
        raise SystemExit("unreplaced build tokens: " + ", ".join(leftover))
    # Links in prose are fine; remote *subresources* would break the offline promise.
    for bad in ("<script src=", '<link rel="stylesheet"', "@import url(", "srcset="):
        if bad in html:
            raise SystemExit(f"remote subresource detected: {bad}")

    out = ROOT / "index.html"
    with out.open("w", encoding="utf-8", newline="\n") as fh:
        fh.write(html)
    print(f"Built {out.name} ({len(html.encode('utf-8')):,} bytes), all resources embedded.")


if __name__ == "__main__":
    main()
