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
# Top-level navigation (outside the sandboxed application iframe).
literature_nav = (
    '<div style="font:14px system-ui;padding:8px 16px;background:#173744;'
    'color:#fff;text-align:center">'
    '<a href="./literature-search.html" '
    'style="color:#d5f7f3;font-weight:600;text-decoration:none">'
    '🔎 Live Literature Search · Google Scholar ↗</a></div>'
)
page = page.replace('<body>', '<body>\n' + literature_nav, 1)
out = ROOT / 'site/index.html'
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(page, encoding='utf-8')
docs_page = ROOT / 'docs/index.html'
docs_page.parent.mkdir(parents=True, exist_ok=True)
docs_page.write_text(page, encoding='utf-8')
literature = (ROOT / 'src/literature-search.html').read_text(encoding='utf-8')
for destination in [ROOT / 'literature-search.html',
                    ROOT / 'site/literature-search.html',
                    ROOT / 'docs/literature-search.html']:
    destination.write_text(literature, encoding='utf-8')
(ROOT / 'index.html').write_text(page, encoding='utf-8')
for directory in [ROOT, ROOT / 'site', ROOT / 'docs']:
    (directory / '.nojekyll').write_text('', encoding='utf-8')
print('Built main page and literature search for root, site and docs')
