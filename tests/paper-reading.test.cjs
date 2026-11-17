const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const reading=require('../src/paper-reading.js');
const planner=require('../src/research-planner.js');
const viewer=require('../src/structure-viewer.js');
const seed=require('../data/literature-seed.json').sources;
const input=()=>({goal:'Test the effect of nitrogen on surface migration',answers:{q1:'Matched control and treatment; compare barriers.'},papers:[reading.paper({id:'https://openalex.org/W123',title:'A test paper',doi:'https://doi.org/10.1000/example',abstract:'Nitrogen modifies the surface reaction pathway. The transition states require further investigation.'})]});
function analysis(data=input()){
  const ref={segmentId:data.papers[0].id+'-A',quote:'Nitrogen modifies the surface reaction pathway.'};
  return {findings:[{kind:'reported',text:'The abstract describes a modified pathway.',citations:[ref]}],questions:[{id:'q1',question:'Which control and treatment will you compare?',why:'This defines the matched models.',citations:[ref]}],definition:{researchQuestion:'Does N change this specific migration barrier?',hypothesis:'N changes this barrier.',target:'Compare each surface barrier and numerical uncertainty.',modelType:'neb',controls:'Matched cells and composition within each path.',missing:['Coordinates and methods are not established by this abstract.'],citations:[ref]}};
}
test('paper identifiers, text locations and scope survive storage without invented full text',()=>{
  const p=input().papers[0];assert.equal(reading.paper(p).id,p.id);
  const d=reading.normalize({papers:[p],goal:'Goal'});assert.equal(d.papers[0].id,p.id);assert.equal(d.papers[0].scope,'abstract only');
  assert.equal(reading.allSegments(d.papers)[0].location,'Abstract (OpenAlex metadata; verify against publisher)');
  assert.throws(()=>reading.paper({...p,segments:[{text:'x'.repeat(120001)}]}),/exceeds/);
});
test('analysis refuses fabricated quotes, wrong segments and uncited paper claims',()=>{
  const data=input(),segments=reading.allSegments(data.papers);
  assert.equal(reading.verifyAnalysis(analysis(data),segments).findings.length,1);
  const fake=analysis(data);fake.findings[0].citations[0].quote='A 500 eV cutoff is sufficient and verified.';
  assert.throws(()=>reading.verifyAnalysis(fake,segments),/absent/);
  const wrong=analysis(data);wrong.definition.citations[0].segmentId='unknown';assert.throws(()=>reading.verifyAnalysis(wrong,segments),/absent/);
  const uncited=analysis(data);uncited.findings[0].citations=[];assert.throws(()=>reading.verifyAnalysis(uncited,segments),/citation/);
  const corrupt=reading.normalize({...data,analysis:fake});assert.equal(corrupt.analysis,null);
});
test('paper-derived plan keeps references through export/import and leaves calculations blocked',()=>{
  const data=input();data.analysis=analysis(data);const s=reading.buildStudy(data,planner);
  const sources=structuredClone(seed),ui=planner.create({sources,parser:viewer.prepareFile});
  ui.registerSources(data.papers.map(reading.sourceRecord));assert.equal(ui.addStudy(s),true);
  const exported=ui.snapshot();const imported=planner.validateDocument(exported,seed.map(s=>s.id),viewer.prepareFile);
  assert.equal(imported.references[0].id,data.papers[0].id);assert(imported.studies.at(-1).sourceIds.includes(data.papers[0].id));
  assert(planner.jobPlan(s,viewer.prepareFile).jobs.every(j=>j.status==='blocked'));
  assert(s.configurations.every(c=>!c.attachment&&c.locator.includes('Abstract')));
  data.answers={};assert.throws(()=>reading.buildStudy(data,planner),/Answer all/);
  data.analysis.definition.modelType='undetermined';assert.throws(()=>reading.buildStudy(data,planner),/model choice/);
  const malicious=structuredClone(exported);malicious.references[0].url='javascript:attack()';assert.throws(()=>planner.validateDocument(malicious,[],viewer.prepareFile));
});

test('text edits save without replacing the editor during a following button click',()=>{
  const events={},elements={};const h={innerHTML:'',addEventListener:(k,fn)=>events[k]=fn,querySelector:k=>elements[k]||(elements[k]={})};
  let searched='',saved;const ui=reading.create({onSearch:q=>searched=q,onChange:s=>saved=s});ui.mount(h);const before=h.innerHTML;
  const target={dataset:{prField:'goal'},value:'N on diamond',hasAttribute:()=>false};
  events.input({target,stopPropagation(){}});events.change({target,stopPropagation(){}});
  assert.equal(h.innerHTML,before);assert.equal(saved.goal,'N on diamond');
  events.click({stopPropagation(){},target:{closest:()=>({dataset:{prAction:'search'}})}});assert.equal(searched,'N on diamond');
});
test('API validates evidence limits and verifies structured model output before returning it',async()=>{
  const api=await import('../server/research-api.mjs'),data=input();let request;
  const fetcher=async(url,options)=>{request={url,...JSON.parse(options.body)};return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(analysis(data))}]}]});};
  const result=await api.analyze(data,{OPENAI_API_KEY:'test',OPENAI_MODEL:'test-model'},fetcher);
  assert.equal(result.definition.modelType,'neb');assert.equal(request.store,false);assert.equal(request.text.format.strict,true);
  assert(request.instructions.includes('untrusted DATA'));assert(request.input.includes('Abstract'));
  assert.throws(()=>api.validateInput({...data,papers:[]}),/one to six/);
  assert.throws(()=>api.validateInput({...data,papers:[data.papers[0],data.papers[0]]}),/Duplicate/);
  await assert.rejects(()=>api.analyze(data,{OPENAI_API_KEY:'x',OPENAI_MODEL:'m'},async()=>Response.json({status:'incomplete'})),/did not complete/);
  const bad=analysis(data);bad.definition.citations[0].quote='This is a completely fabricated quote.';
  await assert.rejects(()=>api.analyze(data,{OPENAI_API_KEY:'x',OPENAI_MODEL:'m'},async()=>Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(bad)}]}]})),/absent/);
  const followup={...data,questions:[{id:'q1',question:'Which control and treatment will you compare?'}]};
  const changed=analysis(data);changed.questions[0].question='A different question under the same ID?';
  await assert.rejects(()=>api.analyze(followup,{OPENAI_API_KEY:'x',OPENAI_MODEL:'m'},async()=>Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(changed)}]}]})),/changed an answered/);
});
test('HTTP service requires allowed origin and authorization, returns verified JSON, and limits requests',async()=>{
  const {createHandler}=await import('../server/research-api.mjs'),data=input();
  const server=http.createServer(createHandler({ALLOWED_ORIGINS:'https://example.com',ANALYSIS_ACCESS_TOKEN:'test-access',OPENAI_API_KEY:'test',OPENAI_MODEL:'test'},async()=>Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(analysis(data))}]}]})));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port+'/analyze';
  try{
    const headers={'Origin':'https://example.com','Content-Type':'application/json','Authorization':'Bearer test-access'};
    assert.equal((await fetch(url,{method:'POST',headers:{...headers,Origin:'https://untrusted.example'},body:'{}'})).status,403);
    assert.equal((await fetch(url,{method:'POST',headers:{...headers,Authorization:''},body:'{}'})).status,401);
    const preflight=await fetch(url,{method:'OPTIONS',headers});assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),'https://example.com');
    const response=await fetch(url,{method:'POST',headers,body:JSON.stringify(data)});assert.equal(response.status,200);assert.equal((await response.json()).analysis.findings.length,1);
    assert.equal(response.headers.get('Cache-Control'),'no-store');
    for(let i=0;i<5;i++)await fetch(url,{method:'POST',headers,body:JSON.stringify(data)});
    assert.equal((await fetch(url,{method:'POST',headers,body:JSON.stringify(data)})).status,429);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
