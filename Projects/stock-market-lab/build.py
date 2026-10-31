"""Build the self-contained offline Stock Market Lab page.

Everything (CSS, JS, icon) is embedded so that index.html can be copied to a
USB stick, opened from file:// and still run without a network connection.
Only Python's standard library is used.
"""
from pathlib import Path
import base64
import sys

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent.parent

SCRIPTS = [
    "src/core.js",
    "src/market-rules.js",
    "src/datasets.js",
    "src/simulations.js",
    "src/ui.js",
    "src/charts.js",
    "src/registry.js",
    "src/modules/a-basics.js",
    "src/modules/b-kline.js",
    "src/modules/c-indicators.js",
    "src/modules/d-orderbook.js",
    "src/modules/e-rules.js",
    "src/modules/f-ipo.js",
    "src/modules/g-valuation.js",
    "src/modules/h-leverage.js",
    "src/modules/i-etf.js",
    "src/modules/j-compare.js",
    "src/app.js",
]


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

    leftover = [t for t in ("<!-- SITE_ICON -->", "<!-- BRAND_ICON -->", "/* LAB_STYLES */", "<!-- LAB_SCRIPTS -->") if t in html]
    if leftover:
        raise SystemExit("unreplaced build tokens: " + ", ".join(leftover))
    if "http://" in html or "https://" in html:
        # Links inside prose are fine; remote *subresources* are not. Guard the
        # usual offenders so the offline promise stays honest.
        for bad in ("<script src=", "<link rel=\"stylesheet\"", "@import url(", "srcset="):
            if bad in html:
                raise SystemExit(f"remote subresource detected: {bad}")

    out = ROOT / "index.html"
    with out.open("w", encoding="utf-8", newline="\n") as fh:
        fh.write(html)
    print(f"Built {out.name} ({len(html.encode('utf-8')):,} bytes), all resources embedded.")


if __name__ == "__main__":
    main()
