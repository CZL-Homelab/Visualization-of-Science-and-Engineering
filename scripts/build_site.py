"""Build the Pages directory from an explicit project registry. Standard library only."""
from pathlib import Path
import html
import json
import re
import shutil

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / '_site'
projects = json.loads((ROOT / 'site/projects.json').read_text(encoding='utf-8'))
slugs = set()
cards = []
OUT.mkdir(exist_ok=True)
for i, p in enumerate(projects, 1):
    slug = p['slug']
    if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', slug) or slug in slugs:
        raise ValueError(f'Invalid or duplicate project slug: {slug}')
    slugs.add(slug)
    source = ROOT / 'Projects' / slug / 'index.html'
    if not source.is_file():
        raise FileNotFoundError(source)
    (OUT / slug).mkdir(exist_ok=True)
    shutil.copyfile(source, OUT / slug / 'index.html')
    esc = html.escape
    search = esc(' '.join([p['title'], p['category'], p['description'], p['english'], *p['tags']]).lower(), quote=True)
    tags = ''.join(f'<span>{esc(tag)}</span>' for tag in p['tags'])
    cards.append(f'''<article class="project-card" data-search="{search}"><a class="project-art" href="{slug}/" aria-label="打开 / Open {esc(p['title'])}"><img src="{esc(p['preview'])}" alt="电机横截面示意 / Illustrated motor cross-section" width="620" height="380"></a><div class="project-copy"><span class="project-index">{i:02d} / {esc(p['category'])}</span><h3><a href="{slug}/">{esc(p['title'])}</a></h3><p>{esc(p['description'])}<span class="english" lang="en">{esc(p['english'])}</span></p><div class="tags">{tags}</div><div class="project-metrics">{esc(p['metrics'])}</div><div class="project-links"><a class="button primary" href="{slug}/">打开演示 / Open ↗</a><a class="source-link" href="https://github.com/CZL-Homelab/Visualization-of-Science-and-Engineering/tree/main/Projects/{slug}">项目源码 / Source ↗</a></div></div></article>''')
template = (ROOT / 'site/index.template.html').read_text(encoding='utf-8')
page = template.replace('{{PROJECT_CARDS}}', '\n'.join(cards)).replace('{{COUNT}}', str(len(projects)))
with (OUT / 'index.html').open('w', encoding='utf-8', newline='\n') as f:
    f.write(page)
shutil.copytree(ROOT / 'assets', OUT / 'assets', dirs_exist_ok=True)
(OUT / '.nojekyll').touch()
print(f'Built project directory: {len(projects)} project(s), routes: /, ' + ', '.join(f'/{s}/' for s in sorted(slugs)))
