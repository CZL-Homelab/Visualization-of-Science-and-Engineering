"""Check published routes, local assets and repository identity without third-party packages."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import subprocess
import sys
import json
import base64
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
subprocess.run([sys.executable, str(ROOT / 'scripts/build_site.py')], check=True)
OUT = ROOT / '_site'
projects = json.loads((ROOT / 'site/projects.json').read_text(encoding='utf-8'))
slugs = {project['slug'] for project in projects}
embedded_icon = 'data:image/svg+xml;base64,' + base64.b64encode((ROOT / 'assets/icon.svg').read_bytes()).decode('ascii')

class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []
        self.directory = []
    def handle_starttag(self, tag, attrs):
        data = dict(attrs)
        if tag == 'a' and 'dir-card' in data.get('class', '').split():
            self.directory.append(data)
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
    assert '<!-- THEME_BOOT -->' not in text and '<!-- SHARED_EXPERIENCE -->' not in text, page
    assert 'CZLLabTheme' in text and 'czl-entry-replay' in text, page
    if page.parent.name in slugs:
        assert embedded_icon in text, f'{page}: embedded logo is stale'
        assert f'data-lab="{page.parent.name}"' in text, f'{page}: wrong entrance identity'
        # Every lab must list every registered lab once and mark only itself.
        destinations = [(page.parent / unquote(urlsplit(a['href']).path)).resolve()
                        for a in parser.directory]
        expected = {(OUT / slug / 'index.html').resolve() for slug in slugs}
        assert len(destinations) == len(expected) and set(destinations) == expected, (page, destinations)
        current = [a for a in parser.directory if a.get('aria-current') == 'page']
        assert len(current) == 1, (page, current)
        assert (page.parent / current[0]['href']).resolve() == page.resolve(), page
for svg in (ROOT / 'assets').glob('*.svg'):
    ET.parse(svg)
assert 'http-equiv="refresh"' not in (OUT / 'index.html').read_text(encoding='utf-8')
print('PASS: published routes, relative assets, SVG syntax, favicon and repository entries.')
