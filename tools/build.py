"""Build the shareable page using only Python's standard library."""
from pathlib import Path
from html import escape

ROOT = Path(__file__).resolve().parents[1]
template = (ROOT / 'src/page-template.html').read_text(encoding='utf-8')
fragment = (ROOT / 'src/app.html').read_text(encoding='utf-8')
marker = '__SURFACE_APP_ESCAPED__'
if template.count(marker) != 1:
    raise ValueError('Expected exactly one application placeholder')
page = template.replace(marker, escape(fragment))
out = ROOT / 'site/index.html'
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(page, encoding='utf-8')
docs_page = ROOT / 'docs/index.html'
docs_page.parent.mkdir(parents=True, exist_ok=True)
docs_page.write_text(page, encoding='utf-8')
(ROOT / 'index.html').write_text(page, encoding='utf-8')
for directory in [ROOT, ROOT / 'site', ROOT / 'docs']:
    (directory / '.nojekyll').write_text('', encoding='utf-8')
print('Built index.html, site/index.html and docs/index.html')
