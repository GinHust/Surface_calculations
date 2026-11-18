const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const planner=require('../src/research-planner.js');
const viewer=require('../src/structure-viewer.js');
const sources=require('../data/literature-seed.json').sources;
const known=sources.map(s=>s.id);
const parse=viewer.prepareFile;
const poscar=(species='C N',counts='1 1',cell='4 0 0',coords=['0 0 0','.25 .25 .25'])=>['Test','1',cell,'0 4 0','0 0 12',species,counts,'Direct',...coords].join('\n');
function complete(type='relative') {
  const s=planner.study();s.question='Does N depth change stability?';s.criterion='Compare relative energies';s.sourceIds=['L05'];
  s.protocol={engine:'VASP',xc:'PBE',cutoff:'500',kpoints:'3 3 1',pseudo:'reviewed library/version',convergence:'Converge cutoff, k-grid, slab and vacuum separately.'};
  s.configurations=[0,1].map(i=>({...planner.configuration('configuration '+i),cellModel:'2x2, 8 layers',nitrogenSite:'layer '+(i+1),sourceId:'L05',locator:'SI structure '+i,assumptions:'Reconstructed model',optimized:true,attachment:{name:'slab.vasp',text:poscar()}}));
  const g={id:'G-test',label:'N positions',type,left:s.configurations[0].id,right:s.configurations[1].id,variable:'N depth',reference:'',mappingReviewed:true};s.groups=[g];return {s,g};
}
test('relative stability permits matched composition and blocks raw subtraction across compositions',()=>{
  const {s,g}=complete();assert.deepEqual(planner.validateGroup(s,g,parse),[]);
  s.configurations[1].attachment.text=poscar('C','2');
  assert(planner.validateGroup(s,g,parse).includes('composition'));
  g.type='formation';assert(planner.validateGroup(s,g,parse).includes('reference'));
  g.reference='delta N: mu_N; delta C: mu_C. Define reservoirs and sign convention.';
  assert.deepEqual(planner.validateGroup(s,g,parse),[]);
});
test('NEB checks actual cells, atom order, endpoint optimization and human mapping review',()=>{
  const {s,g}=complete('neb');assert.deepEqual(planner.validateGroup(s,g,parse),[]);
  s.configurations[1].attachment.text=poscar('N C');assert(planner.validateGroup(s,g,parse).includes('ordering'));
  s.configurations[1].attachment.text=poscar('C N','1 1','5 0 0');assert(planner.validateGroup(s,g,parse).includes('cell'));
  s.configurations[1].attachment.text=poscar();s.configurations[1].optimized=false;g.mappingReviewed=false;
  const issues=planner.validateGroup(s,g,parse);assert(issues.includes('endpoints'));assert(issues.includes('mapping'));
});
test('adsorption requires added atoms and an explicit energy reference',()=>{
  const {s,g}=complete('adsorption');assert(planner.validateGroup(s,g,parse).includes('adsorptionComposition'));
  s.configurations[1].attachment.text=poscar('C N H','1 1 1','4 0 0',['0 0 0','.25 .25 .25','.4 .4 .4']);
  assert.deepEqual(planner.validateGroup(s,g,parse),['reference']);
  g.reference='E(H radical), doublet, same electronic method';assert.deepEqual(planner.validateGroup(s,g,parse),[]);
});
test('XYZ/CIF previews do not imply validated periodic models',()=>{
  const {s,g}=complete('neb');s.configurations[0].attachment={name:'a.xyz',text:'2\nframe\nC 0 0 0\nN 1 1 1'};
  assert(planner.validateGroup(s,g,parse).includes('unknownCell'));
  s.configurations[0].attachment={name:'a.cif',text:'data_test\n_atom_site_fract_x 0'};
  const issues=planner.validateGroup(s,g,parse);assert(issues.includes('unknownComposition'));assert(issues.includes('unknownCell'));
});
test('provenance, assumptions, study evidence and shared method must be explicit',()=>{
  const {s,g}=complete();s.configurations[0].origin='reconstructed';s.configurations[0].assumptions='';s.configurations[0].sourceId='L06';s.protocol.kpoints='3 0 1';
  const issues=planner.validateGroup(s,g,parse);for(const key of ['assumptions','provenance','protocol'])assert(issues.includes(key));
  s.configurations[1].orientation='(111)';assert(planner.validateGroup(s,g,parse).includes('matchedSlab'));
});
test('calculation graph preserves geometry and energy dependencies and never claims execution',()=>{
  const {s,g}=complete('neb');const plan=planner.jobPlan(s,parse);
  assert.equal(plan.mode,'planning-only-not-runnable');assert.equal(plan.jobs.length,5);
  assert.deepEqual(plan.jobs.at(-1).dependsOn,s.configurations.map(c=>`${c.id}:relax`));
  assert(plan.jobs.every(j=>['draft','blocked'].includes(j.status)));
  s.configurations[0].attachment=null;assert.equal(planner.jobPlan(s,parse).jobs.at(-1).status,'blocked');
});
test('round-trip preserves coordinates and incomplete records; rejects malformed imports and size limits',()=>{
  const {s,g}=complete();const raw={version:1,locale:'en',activeId:s.id,studies:[s]};
  assert.deepEqual(planner.validateDocument(raw,known,parse),raw);
  g.right=g.left;assert.equal(planner.validateDocument(raw,known,parse).studies[0].groups[0].right,g.left);
  const bad=structuredClone(raw);bad.studies[0].configurations[0].attachment.text='bad';assert.throws(()=>planner.validateDocument(bad,known,parse));
  bad.studies[0].id='__proto__';assert.throws(()=>planner.validateDocument(bad,known,parse));
  assert.throws(()=>planner.validateDocument({...raw,version:99},known,parse));
  const duplicate=structuredClone(raw);duplicate.studies.push(structuredClone(s));assert.throws(()=>planner.validateDocument(duplicate,known,parse));
  assert.throws(()=>planner.validateDocument({version:1,studies:[],extra:'x'.repeat(1024*1024)},known,parse),/size/);
});
test('templates remain incomplete plans without fabricated coordinates or computed values',()=>{
  for(const type of ['adsorption','neb']){const s=planner.template(type,'L05');assert.equal(s.configurations.length,4);assert.equal(s.groups.length,2);assert(s.configurations.every(c=>c.attachment===null));assert(planner.jobPlan(s,parse).jobs.filter(j=>j.groupId).every(j=>j.status==='blocked'));}
});
function host() {
  return {innerHTML:'',isConnected:true,events:{},addEventListener(type,fn){this.events[type]=fn;},querySelector(){return {textContent:''};},querySelectorAll(){return [];}};
}
function click(target,dataset){target.events.click({stopPropagation(){},target:{closest:()=>({dataset})}});}
test('editor escapes authored text and keeps fields alive when saving text changes',async()=>{
  const {s}=complete();s.question='<img src=x onerror=alert(1)>';
  const h=host(),changes=[];
  const ui=planner.create({sources,parser:parse,initial:{version:1,locale:'vi',activeId:s.id,studies:[s]},onChange:d=>changes.push(d)});ui.mount(h);
  assert(!h.innerHTML.includes('<img'));assert(h.innerHTML.includes('&lt;img'));
  const before=h.innerHTML;
  await h.events.change({stopPropagation(){},target:{dataset:{rpEntity:'study',rpField:'question'},type:'text',tagName:'INPUT',value:'Updated question',hasAttribute(){return false;}}});
  assert.equal(ui.snapshot().studies[0].question,'Updated question');assert.equal(h.innerHTML,before);assert.equal(changes.length,1);
  click(h,{rpAction:'duplicate'});assert.equal(ui.snapshot().studies[0].configurations.length,3);
});
test('coordinate/protocol edits invalidate endpoint review and imported plans append with remapped IDs',async()=>{
  const {s}=complete('neb');const h=host();const ui=planner.create({sources,parser:parse,initial:{version:1,locale:'en',activeId:s.id,studies:[s]}});ui.mount(h);
  await h.events.change({stopPropagation(){},target:{dataset:{rpEntity:'protocol',rpField:'cutoff'},type:'number',tagName:'INPUT',value:'600',hasAttribute(){return false;}}});
  assert(ui.snapshot().studies[0].configurations.every(c=>!c.optimized));assert.equal(ui.snapshot().studies[0].groups[0].mappingReviewed,false);
  const json=JSON.stringify(ui.snapshot());
  await h.events.change({stopPropagation(){},target:{dataset:{rpImport:''},files:[{size:json.length,text:async()=>json}]}});
  const result=ui.snapshot();assert.equal(result.studies.length,2);assert.notEqual(result.studies[0].configurations[0].id,result.studies[1].configurations[0].id);assert.equal(result.studies[1].groups[0].left,result.studies[1].configurations[0].id);
});
test('typing saves without waiting for blur and handoff uses the latest question',()=>{
  const {s}=complete();const h=host();let handed;
  const ui=planner.create({sources,parser:parse,initial:{version:1,locale:'vi',activeId:s.id,studies:[s]},onUse:value=>handed=value});ui.mount(h);
  h.events.input({stopPropagation(){},target:{dataset:{rpEntity:'study',rpField:'question'},type:'textarea',tagName:'TEXTAREA',value:'New question while still focused'}});
  assert.equal(ui.snapshot().studies[0].question,'New question while still focused');
  click(h,{rpAction:'prepare',rpId:s.groups[0].id});assert.equal(handed.study.question,'New question while still focused');
});
test('application connects literature, planner groups and draft manifests without a real solver',()=>{
  const content=host(),message=host(),plannerHost=host(),root=host();
  root.querySelector=selector=>selector==='#sl-content'?content:selector==='#sl-message'?message:selector==='#sl-planner-host'&&content.innerHTML.includes('sl-planner-host')?plannerHost:null;
  const globals={};const window={parent:{postMessage(){}},addEventListener:(type,fn)=>globals[type]=fn};
  const context=vm.createContext({document:{getElementById:()=>root,createTreeWalker:()=>({nextNode:()=>null})},NodeFilter:{SHOW_TEXT:4},window,TextEncoder,SurfacePaperEvidence:require('../src/paper-evidence.js'),SurfacePaperReading:require('../src/paper-reading.js'),SurfaceResearchAssistant:require('../src/research-assistant.js'),SurfacePaperModel:require('../src/paper-model.js'),SurfaceResearchPlanner:planner,SurfaceStructureViewer:{prepareFile:parse,create:()=>({mount(){},loadFile(){}})}});
  root.setAttribute=()=>{};
  let html=fs.readFileSync(require.resolve('../src/app.html'),'utf8').replace('__LITERATURE_SOURCES_JSON__',JSON.stringify(sources)).replace('__L01_PROFILE_JSON__',JSON.stringify(require('../data/l01-model.json')));
  const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  let script=scripts.at(-1).replace(/render\(\);\r?\n\}\)\(\);/,'render();globalThis.testAPI={state,makeFiles};\n})();');
  new vm.Script(script).runInContext(context);
  click(root,{source:'L05'});click(root,{action:'use-source'});
  assert.equal(context.testAPI.state.page,'define');
  assert(content.innerHTML.includes('Advanced comparison planning'));
  click(root,{go:'plan'});
  assert.equal(context.testAPI.state.page,'plan');assert(plannerHost.innerHTML.includes('Research Planner'));
  click(plannerHost,{rpAction:'neb-template'});
  const data=context.testAPI.state.research,s=data.studies.find(s=>s.id===data.activeId);
  assert(s.sourceIds.includes('L05'));
  click(plannerHost,{rpAction:'prepare',rpId:s.groups[0].id});
  assert.equal(context.testAPI.state.page,'define');assert.equal(context.testAPI.state.task,'neb');
  const manifest=JSON.parse(context.testAPI.makeFiles()['run-manifest.json']);
  assert.equal(manifest.research_context.studyId,s.id);assert.equal(manifest.research_context.endpoints.length,2);assert(manifest.research_context.planningIssues.includes('structure'));assert.equal(manifest.mode,'draft-not-runnable');
});
test('English-only labels override old locale preferences while preserving authored content',()=>{
  const {s}=complete();s.question='User-authored research question';
  const raw={version:1,locale:'vi',activeId:s.id,studies:[s]};
  const h=host();const ui=planner.create({sources,parser:parse,initial:raw});ui.mount(h);
  assert.equal(ui.snapshot().locale,'en');assert.equal(ui.snapshot().studies[0].question,s.question);
  assert(!h.innerHTML.includes('data-rp-lang'));assert(h.innerHTML.includes('Research Planner'));
  const app=fs.readFileSync(require.resolve('../src/app.html'),'utf8');
  assert(!app.includes('class="nav" data-go="plan"'));assert(!app.includes('data-lang="ko"'));assert(!app.includes('data-lang="en"'));
  const literature=fs.readFileSync(require.resolve('../src/literature-search.html'),'utf8');assert(!literature.includes('data-lang='));
  assert(!/[가-힣]/.test(JSON.stringify(sources)));
});
test('build embeds planner and inventory once and retains enough storage for coordinate records',()=>{
  const app=fs.readFileSync(require.resolve('../src/app.html'),'utf8');assert.equal(app.split('__RESEARCH_PLANNER_JS__').length,2);
  const template=fs.readFileSync(require.resolve('../src/page-template.html'),'utf8');assert(!template.includes('16 * 1024'));assert.equal((template.match(/2 \* 1024 \* 1024/g)||[]).length,3);
  const rendered=app.replace('__LITERATURE_SOURCES_JSON__',JSON.stringify(sources)).replace('__STRUCTURE_VIEWER_JS__',fs.readFileSync(require.resolve('../src/structure-viewer.js'),'utf8')).replace('__RESEARCH_PLANNER_JS__',fs.readFileSync(require.resolve('../src/research-planner.js'),'utf8'));
  for(const m of rendered.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
});
