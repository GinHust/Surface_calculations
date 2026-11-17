const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const assistant=require('../src/research-assistant.js');
const planner=require('../src/research-planner.js');
const viewer=require('../src/structure-viewer.js');
const sources=require('../data/literature-seed.json').sources;
const known=sources.map(s=>s.id);
const input=(selected='migration')=>assistant.normalize({selected,goal:'Compare nitrogen effects',gap:'Step-specific mechanism remains unresolved',hypothesis:'N changes the selected step',cell:'2x2, 8 layers',sourceIds:['L01','L02']},sources);

test('question relevance is transparent and unknown sources are discarded',()=>{
  const data=assistant.normalize({sourceIds:['L05','fake','L05']},sources);
  assert.deepEqual(data.sourceIds,['L05']);assert.equal(assistant.suggest(data)[0].id,'stability');
  const brief=assistant.synthesize(data,sources);
  assert.equal(brief.mode,'proposed-research-plan');assert.equal(brief.evidence.length,1);
  assert(brief.missing.some(x=>x.includes('hypothesis')));
  assert(brief.evidence[0].caution);
});

test('all model recommendations round-trip through existing planner and remain blocked without structures',()=>{
  for(const kind of ['migration','adsorption','incorporation','stability']){
    const data=input(kind),s=assistant.buildStudy(data,sources,planner);
    assert(s.question.includes(data.surface));assert(s.criterion.includes(data.hypothesis));
    assert(s.configurations.every(c=>!c.attachment&&!c.optimized&&c.locator===''));
    assert(s.groups.every(g=>!g.mappingReviewed));
    const doc={version:1,locale:'en',activeId:s.id,studies:[s]};
    assert.deepEqual(planner.validateDocument(doc,known,viewer.prepareFile),doc);
    assert(planner.jobPlan(s,viewer.prepareFile).jobs.every(j=>j.status==='blocked'));
    if(kind==='adsorption')assert.deepEqual(s.configurations.map(c=>c.adsorbate),['none','CH3','none','CH3']);
    if(kind==='incorporation')assert(s.configurations.every(c=>c.adsorbate!=='CH3'));
  }
});

test('long user fields respect planner contract and missing evidence stays missing',()=>{
  const data=input();for(const key of ['surface','nitrogen','hypothesis','goal','gap','criterion'])data[key]='x'.repeat(2000);
  data.sourceIds=[];const s=assistant.buildStudy(data,sources,planner);
  assert.doesNotThrow(()=>planner.validateDocument({version:1,locale:'en',activeId:s.id,studies:[s]},known,viewer.prepareFile));
  assert(s.configurations.every(c=>c.sourceId===''));assert.equal(s.protocol.cutoff,'');
});

function host(){return {innerHTML:'',events:{},addEventListener(k,fn){this.events[k]=fn;},querySelector(){return {innerHTML:''};}};}
test('editor saves, restores, escapes evidence and exports the currently edited brief',()=>{
  const h=host();let saved,exported,created;
  const ui=assistant.create({sources,initial:input(),onChange:d=>saved=d,onCreate:d=>{created=d;return false;},onExport:d=>exported=d});ui.mount(h);
  h.events.input({stopPropagation(){},target:{dataset:{raField:'hypothesis'},value:'<img onerror=attack>'}});
  assert.equal(saved.hypothesis,'<img onerror=attack>');
  const click=action=>h.events.click({stopPropagation(){},target:{closest:()=>({dataset:{raAction:action}})}});
  click('refresh');assert(!h.innerHTML.includes('<img'));assert(h.innerHTML.includes('&lt;img'));
  click('export');assert.equal(exported.inputs.hypothesis,saved.hypothesis);
  click('create');assert.equal(created.hypothesis,saved.hypothesis);assert(h.innerHTML.includes('maximum 8'));
  ui.restore({selected:'stability',sourceIds:['L05']});assert.equal(ui.snapshot().selected,'stability');
});

test('discovery connects to main page, build embedding, persistence and planner handoff',()=>{
  const app=fs.readFileSync('src/app.html','utf8');
  assert(app.includes('__RESEARCH_ASSISTANT_JS__'));
  assert(app.includes('id="sl-research-assistant-host"'));
  assert(app.includes('researchAssistant.mount(assistantHost)'));
  assert(app.includes('researchAssistant.restore(state.discovery||{})'));
  assert(app.includes('researchPlanner.addStudy(study)'));
  assert(fs.readFileSync('tools/build.py','utf8').includes("src/research-assistant.js"));
});
