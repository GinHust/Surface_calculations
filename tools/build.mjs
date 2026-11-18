/* Portable equivalent of build.py for hosts with Node but no Python. */
import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=name=>readFileSync(path.join(root,name),'utf8');
const write=(name,text)=>{mkdirSync(path.dirname(path.join(root,name)),{recursive:true});writeFileSync(path.join(root,name),text);};
const escape=x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#x27;');
function replace(text,marker,value){if(text.split(marker).length!==2)throw Error('Expected exactly one '+marker);return text.replace(marker,()=>value);}
const inventory=JSON.parse(read('data/literature-seed.json')),theme=read('src/theme.css');
let fragment=replace(read('src/app.html'),'__SURFACE_THEME_CSS__',theme);
fragment=replace(fragment,'__LITERATURE_SOURCES_JSON__',JSON.stringify(inventory.sources).replaceAll('</','<\\/'));
for(const [marker,file] of [['STRUCTURE_VIEWER','structure-viewer'],['POTCAR_BUILDER','potcar-builder'],['RESEARCH_PLANNER','research-planner'],['RESEARCH_ASSISTANT','research-assistant'],['PAPER_READING','paper-reading'],['PAPER_WORKFLOW','paper-workflow'],['PAPER_MODEL','paper-model']]){
  // POTCAR is optional in older checkouts; embed it whenever its marker exists.
  if(marker==='POTCAR_BUILDER'&&!fragment.includes('__POTCAR_BUILDER_JS__'))continue;
  fragment=replace(fragment,'__'+marker+'_JS__',read('src/'+file+'.js').replaceAll('</script','<\\/script'));
}
fragment=replace(fragment,'__L01_PROFILE_JSON__',JSON.stringify(JSON.parse(read('data/l01-model.json'))).replaceAll('</','<\\/'));
let page=replace(read('src/page-template.html'),'__SURFACE_APP_ESCAPED__',escape(fragment));
page=page.replace('</head>','<style>\n'+theme+'\n</style>\n</head>');
const dialog=replace(read('src/paper-search-dialog.html'),'__PAPER_SEARCH_BRIDGE_JS__',read('src/paper-search-bridge.js').replaceAll('</script','<\\/script'));
page=page.replace('</body>',dialog+'\n</body>').replace('<body>','<body class="surface-host">\n<div id="surface-utility-bar"><span>DIAMOND SURFACE RESEARCH</span><a href="./literature-search.html">Explore scientific literature ↗</a></div>');
let literature=replace(read('src/literature-search.html'),'__SURFACE_THEME_CSS__',theme);
const curated=inventory.sources.filter(s=>['L01','L05','L06','L07','L08','L09'].includes(s.id)).map(s=>'<article class="panel"><p class="meta">'+escape(s.id+' · '+s.year)+'</p><h3>'+escape(s.title)+'</h3><p class="muted">'+escape(s.authors)+'</p><div class="actions"><a href="'+escape(s.url)+'" target="_blank" rel="noopener noreferrer">DOI ↗</a><a href="'+escape(s.open)+'" target="_blank" rel="noopener noreferrer" data-i18n="curatedSource">Publisher / preprint ↗</a></div></article>').join('\n');
literature=replace(literature,'__NITROGEN_LATTICE_REFERENCES__',curated);
for(const prefix of ['','site/','docs/']){write(prefix+'index.html',page);write(prefix+'literature-search.html',literature);write(prefix+'.nojekyll','');}
for(const prefix of ['site/','docs/'])for(const file of ['build_potcar.py','POTCAR_BUILDER.md']){mkdirSync(path.join(root,prefix,'tools'),{recursive:true});copyFileSync(path.join(root,'tools',file),path.join(root,prefix,'tools',file));}
console.log('Built main page and literature search for root, site and docs');
