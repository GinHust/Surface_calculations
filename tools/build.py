"""Build the shareable page using only Python's standard library."""
from pathlib import Path
from html import escape
import json

ROOT = Path(__file__).resolve().parents[1]
template = (ROOT / 'src/page-template.html').read_text(encoding='utf-8')
fragment = (ROOT / 'src/app.html').read_text(encoding='utf-8')
inventory = json.loads((ROOT / 'data/literature-seed.json').read_text(encoding='utf-8'))
source_marker = '__LITERATURE_SOURCES_JSON__'
if fragment.count(source_marker) != 1:
    raise ValueError('Expected exactly one literature sources placeholder')
fragment = fragment.replace(source_marker, json.dumps(inventory['sources'], ensure_ascii=False).replace('</', '<\\/'))
viewer_marker = '__STRUCTURE_VIEWER_JS__'
if fragment.count(viewer_marker) != 1:
    raise ValueError('Expected exactly one structure viewer placeholder')
viewer = (ROOT / 'src/structure-viewer.js').read_text(encoding='utf-8')
fragment = fragment.replace(viewer_marker, viewer.replace('</script', '<\\/script'))
planner_marker = '__RESEARCH_PLANNER_JS__'
if fragment.count(planner_marker) != 1:
    raise ValueError('Expected exactly one research planner placeholder')
planner = (ROOT / 'src/research-planner.js').read_text(encoding='utf-8')
fragment = fragment.replace(planner_marker, planner.replace('</script', '<\\/script'))
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
curated_marker = '__NITROGEN_LATTICE_REFERENCES__'
if literature.count(curated_marker) != 1:
    raise ValueError('Expected exactly one nitrogen literature placeholder')
curated = []
for source in inventory['sources']:
    if source['id'] not in {'L01', 'L05', 'L06', 'L07', 'L08', 'L09'}:
        continue
    curated.append(
        '<article class="panel"><p class="meta">'
        + escape(source['id'] + ' · ' + source['year']) + '</p><h3>'
        + escape(source['title']) + '</h3><p class="muted">'
        + escape(source['authors']) + '</p><div class="actions"><a href="'
        + escape(source['url'], quote=True)
        + '" target="_blank" rel="noopener noreferrer">DOI ↗</a><a href="'
        + escape(source['open'], quote=True)
        + '" target="_blank" rel="noopener noreferrer" data-i18n="curatedSource">Publisher / preprint ↗</a></div></article>'
    )
literature = literature.replace(curated_marker, '\n'.join(curated))
for destination in [ROOT / 'literature-search.html',
                    ROOT / 'site/literature-search.html',
                    ROOT / 'docs/literature-search.html']:
    destination.write_text(literature, encoding='utf-8')
(ROOT / 'index.html').write_text(page, encoding='utf-8')
for directory in [ROOT, ROOT / 'site', ROOT / 'docs']:
    (directory / '.nojekyll').write_text('', encoding='utf-8')
print('Built main page and literature search for root, site and docs')
