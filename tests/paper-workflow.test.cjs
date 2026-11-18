const {test}=require('node:test');
const assert=require('node:assert/strict');
const reading=require('../src/paper-reading.js');
const workflow=require('../src/paper-workflow.js');
function fixture(){
  const paper=reading.paper({title:'Test protocol',segments:[{location:'Methods, p. 3',text:'The calculations used VASP with PBE and a cutoff of 500 eV. A 3 3 1 mesh was used for surface relaxation.'}]}),ref={segmentId:paper.id+'-S1',quote:'The calculations used VASP with PBE and a cutoff of 500 eV.'};
  const methods={settings:[{key:'engine',value:'VASP',citations:[ref]},{key:'xc',value:'PBE',citations:[ref]},{key:'cutoff_eV',value:'500',citations:[ref]}],structure:'Surface geometry not supplied.',citations:[ref],missing:['Atomic coordinates and PAW release are missing.']};
  const calculations=[{id:'c1',task:'relax',purpose:'Relax the comparison models.',dependencies:[],citations:[ref]},{id:'c2',task:'scf',purpose:'Calculate matched energies.',dependencies:['c1'],citations:[ref]}];
  const analysis={findings:[{kind:'reported',text:'The calculation uses VASP/PBE.',citations:[ref]}],questions:[],definition:{modelType:'relative',researchQuestion:'Compare matched surface structures?',hypothesis:'Geometry changes stability.',target:'Matched composition energies.',controls:'Same cell, composition and method.',missing:['Coordinates'],citations:[ref]}};
  const review={decision:'researcher_review_required',checks:[{severity:'blocker',message:'Supply reviewed coordinates.',citations:[]}]};
  const multiAgent={version:1,agents:workflow.roles.map(role=>({role,status:'completed',model:'test-model'})),methods,calculations,review};
  return {paper,ref,methods,calculations,analysis,review,multiAgent,session:{goal:'Compare surface stability',papers:[paper],answers:{},analysis:{...analysis,multiAgent}}};
}
test('four real agent calls pass verified evidence through planning and independent critique',async()=>{
  const f=fixture(),api=await import('../server/research-api.mjs'),calls=[];
  const outputs={paper_reader:{findings:f.analysis.findings},paper_methods:f.methods,paper_planner:{...f.analysis,calculations:f.calculations},paper_reviewer:f.review};
  const result=await api.analyze({...f.session,workflow:'multiagent'},{OPENAI_API_KEY:'test',OPENAI_MODEL:'test-model'},async(url,options)=>{
    const body=JSON.parse(options.body),role=body.text.format.name;calls.push({role,body});
    return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(outputs[role])}]}]});
  });
  assert.equal(calls.length,4);assert.deepEqual(calls.map(c=>c.role),['paper_reader','paper_methods','paper_planner','paper_reviewer']);
  assert(calls.every(c=>c.body.store===false&&c.body.text.format.strict));
  assert(JSON.parse(calls[2].body.input).methods.settings[0].citations[0].location.includes('p. 3'));
  assert(JSON.parse(calls[3].body.input).proposal.calculations.length===2);
  assert.equal(result.multiAgent.agents.length,4);assert.equal(reading.normalize({...f.session,analysis:result}).analysis.multiAgent.methods.settings.length,3);
});
test('fabricated methods quotes stop the pipeline before planning',async()=>{
  const f=fixture(),api=await import('../server/research-api.mjs'),calls=[];
  f.methods.settings[0].citations=[{segmentId:f.ref.segmentId,quote:'This quote was never present in the paper.'}];
  await assert.rejects(()=>api.analyze({...f.session,workflow:'multiagent'},{OPENAI_API_KEY:'test',OPENAI_MODEL:'test-model'},async(url,options)=>{
    const role=JSON.parse(options.body).text.format.name;calls.push(role);
    return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(role==='paper_reader'?{findings:f.analysis.findings}:f.methods)}]}]});
  }),/absent/);
  assert.equal(calls.length,2);
});
test('untrusted setting syntax, duplicate keys, future dependencies and incomplete agents fail closed',()=>{
  const f=fixture(),segments=reading.allSegments([f.paper]);
  for(const value of ['500; curl example.com','-500','Infinity','1e999']){const m=structuredClone(f.methods);m.settings[2].value=value;assert.throws(()=>workflow.methods(m,segments),/numeric/);}
  const duplicate=structuredClone(f.methods);duplicate.settings.push(duplicate.settings[0]);assert.throws(()=>workflow.methods(duplicate,segments),/duplicate/);
  assert.throws(()=>workflow.calculations([{...f.calculations[0],dependencies:['c2']}],segments),/precede/);
  assert.throws(()=>workflow.verify({...f.multiAgent,agents:[]},segments),/Incomplete/);
});
test('DFT drafts preserve provenance and blockers and never silently convert across engines',()=>{
  const f=fixture(),vasp=workflow.bundle(f.session,'VASP'),qe=workflow.bundle(f.session,'QE');
  assert(vasp.files['c1-relax/INCAR.draft'].includes('ENCUT = 500'));
  assert(vasp.files['c1-relax/INCAR.draft'].includes('GGA = PE'));
  assert(!Object.keys(vasp.files).some(n=>n.endsWith('POSCAR')||n.endsWith('POTCAR')));
  assert.equal(vasp.manifest.status,'blocked-draft-not-run');assert.equal(vasp.manifest.calculationHasRun,false);
  assert(!qe.files['c1-relax/pw.in.draft'].includes('ecutwfc = 500'));
  assert(qe.manifest.blockers.some(b=>b.includes('engine does not match')));
  assert(vasp.files['evidence.json'].includes('Methods, p. 3'));
  f.session.analysis.multiAgent.review.decision='needs_revision';assert(workflow.bundle(f.session).manifest.blockers.some(b=>b.includes('requests revision')));
});
test('USTAR sizes and checksums cover UTF-8 evidence and reject unsafe paths',()=>{
  const body='Nghiên cứu · ΔE',tar=workflow.tar({'evidence.json':body}),header=tar.slice(0,512),decoder=new TextDecoder();
  const size=parseInt(decoder.decode(header.slice(124,135)),8),sum=parseInt(decoder.decode(header.slice(148,154)),8);
  header.fill(32,148,156);assert.equal(header.reduce((n,b)=>n+b,0),sum);
  assert.equal(size,new TextEncoder().encode(body).length);assert.equal(decoder.decode(tar.slice(512,512+size)),body);assert.equal(tar.length%512,0);
  assert.throws(()=>workflow.tar({'../secret':'bad'}),/archive path/);
});
test('paper-to-planner handoff transfers cited settings and clears diamond-specific template assumptions',()=>{
  const f=fixture(),planner=require('../src/research-planner.js');f.session.analysis.definition.modelType='adsorption';
  const study=reading.buildStudy(f.session,planner);
  assert.equal(study.protocol.cutoff,'500');assert.equal(study.protocol.xc,'PBE');
  assert(study.configurations.every(c=>!c.orientation&&!c.termination&&!c.nitrogenSite&&!c.charge));
  assert.equal(study.configurations[0].label,'Control · clean');assert.equal(study.configurations[3].label,'Treatment · adsorbed');
  assert.equal(study.groups[0].variable,'adsorbate addition');
  f.session.analysis.multiAgent.review.decision='needs_revision';assert.throws(()=>reading.buildStudy(f.session,planner),/reviewer revision/);
});
test('reader prevents stale analysis exports and requires explicit draft review',async()=>{
  const f=fixture(),events={},elements={'[data-pr-bundle-review]':{checked:true},'[data-pr-bundle-engine]':{value:'VASP'}},host={innerHTML:'',addEventListener:(k,fn)=>events[k]=fn,querySelector:k=>elements[k]};let exported;
  global.SurfacePaperWorkflow=workflow;
  const ui=reading.create({initial:{...f.session,endpoint:'https://example.com/analyze'},onAnalyze:async()=>({...f.analysis,multiAgent:f.multiAgent}),onExportBundle:x=>exported=x});ui.mount(host);
  const click=action=>events.click({stopPropagation(){},target:{closest:()=>({dataset:{prAction:action}})}});
  await click('bundle');assert.equal(exported,undefined);
  await click('analyze');assert(host.innerHTML.includes('Reconstructed computational method'));
  await click('bundle');assert(exported.files['manifest.json']);exported=undefined;
  events.input({stopPropagation(){},target:{dataset:{prField:'goal'},value:'Changed objective',hasAttribute:()=>false}});
  await click('bundle');assert.equal(exported,undefined);delete global.SurfacePaperWorkflow;
});
