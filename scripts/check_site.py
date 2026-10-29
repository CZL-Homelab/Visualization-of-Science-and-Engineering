"""Check published routes, local assets and repository identity without third-party packages."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import subprocess
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
subprocess.run([sys.executable, str(ROOT / 'scripts/build_site.py')], check=True)
OUT = ROOT / '_site'

class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []
    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key in ('href', 'src') and value:
                self.urls.append(value)

for page in OUT.rglob('*.html'):
    text = page.read_text(encoding='utf-8')
    parser = Links()
    parser.feed(text)
    for value in parser.urls:
        url = urlsplit(value)
        if url.scheme or url.netloc or not url.path:
            continue
        if url.path.startswith('/'):
            raise AssertionError(f'Root-relative URL breaks project Pages path: {value}')
        dest = (page.parent / unquote(url.path)).resolve()
        assert dest.is_relative_to(OUT.resolve()), value
        if dest.is_dir():
            dest /= 'index.html'
        assert dest.is_file(), (page, value)
    assert 'CZL-Homelab/Visualization-of-Science-and-Engineering' in text
    assert 'rel="icon"' in text
for svg in (ROOT / 'assets').glob('*.svg'):
    ET.parse(svg)
assert 'http-equiv="refresh"' not in (OUT / 'index.html').read_text(encoding='utf-8')
print('PASS: published routes, relative assets, SVG syntax, favicon and repository entries.')
