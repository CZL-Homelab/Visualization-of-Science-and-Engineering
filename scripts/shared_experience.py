"""Inline shared theme/entrance assets for the catalog and standalone labs."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONFIG = {
    'catalog': ('#f5f2ea', '#161719', ''),
    'motor-lab': ('#f5f2eb', '#16171a', ''),
    'stock-market-lab': ('#f4f2ec', '#101113', 'sm:theme'),
    'desalination-lab': ('#f4f2ec', '#101113', 'dl:theme'),
    'fusion-lab': ('#f3f1ec', '#0d0e13', 'fl:theme'),
    'distillation-lab': ('#f4f2ec', '#101113', 'distl:theme'),
}


def embed_experience(html: str, slug: str) -> str:
    light, dark, event = CONFIG[slug]
    def read(name: str) -> str:
        return (ROOT / 'assets' / name).read_text(encoding='utf-8')
    boot = (f'<script data-light="{light}" data-dark="{dark}" data-event="{event}">\n'
            + read('theme.js').replace('</script', '<\\/script') + '\n</script>')
    entry = ('<style>\n' + read('entry.css') + '\n</style>'
             + f'<script data-lab="{slug}">\n'
             + read('entry.js').replace('</script', '<\\/script') + '\n</script>')
    for token, value in [('<!-- THEME_BOOT -->', boot), ('<!-- SHARED_EXPERIENCE -->', entry)]:
        if html.count(token) != 1:
            raise ValueError(f'{slug}: expected exactly one {token}')
        html = html.replace(token, value)
    return html
