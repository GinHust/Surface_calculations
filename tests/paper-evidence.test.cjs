const {test}=require('node:test'),assert=require('node:assert/strict');
const reading=require('../src/paper-reading.js'),evidence=require('../src/paper-evidence.js');
const sources=require('../data/literature-seed.json').sources,profile=require('../data/l01-model.json');
function fixture(){const paper=reading.paper({title:'A source paper',doi:'https://doi.org/10.1000/example',segments:[{location:'Methods · PDF page 3',text:'The calculations use a plane-wave cutoff of 500 eV. The reported k-point grid is 3 by 3 by 1.'}]});return {paper,session:{papers:[paper],analysis:null},raw:{field:'Cutoff',value:'500 eV',target:'INCAR / method',segmentId:paper.segments[0].id,quote:'The calculations use a plane-wave cutoff of 500 eV.'}};}
test('manual information keeps exact paper, DOI, page and quote without an AI service',()=>{
  const f=fixture(),record=evidence.manual(f.raw,[f.paper]),links=evidence.lineage(f.session,[record],[],null);
  assert.equal(links.records[0].citations[0].title,'A source paper');assert.equal(links.records[0].citations[0].location,'Methods · PDF page 3');
  assert.equal(links.records[0].citations[0].url,'https://doi.org/10.1000/example');assert.equal(links.records[0].target,'INCAR / method');
  assert.equal(links.papers[0].segments[0].text,f.paper.segments[0].text);assert.equal(links.records[0].status,'quote-matched');
  assert.throws(()=>evidence.manual({...f.raw,quote:'The calculations actually used an invented cutoff.'},[f.paper]),/must match/);
  assert.throws(()=>evidence.manual({...f.raw,segmentId:'wrong'},[f.paper]),/must match/);
});
test('changed/removed paper text invalidates records and strips unsafe persisted links',()=>{
  const f=fixture(),record=evidence.manual(f.raw,[f.paper]);record.url='javascript:alert(1)';
  const rows=evidence.rows({papers:[]},[record,{id:5}],[],null);assert.equal(rows.length,1);assert.equal(rows[0].status,'stale');assert.equal(rows[0].url,'');assert.equal(rows[0].citations.length,0);
  f.paper.segments[0].text='Changed source text';assert.equal(evidence.rows(f.session,[record],[],null)[0].status,'stale');
});
test('existing paper data has linked sections and DFT destinations without fabricated quotes',()=>{
  const rows=evidence.rows({papers:[]},[],sources,profile),cutoff=rows.find(r=>r.field==='Plane-wave cutoff / k points');
  assert.equal(cutoff.paperId,'L01');assert.equal(cutoff.url,profile.url);assert.equal(cutoff.location,'Main text §1');assert.equal(cutoff.target,'INCAR: ENCUT · KPOINTS');
  assert.equal(cutoff.status,'summary');assert.equal(cutoff.citations.length,0);assert.equal(rows.length,23);
  const excerpt=rows.find(r=>r.id==='L01-cutoff-source');assert.equal(excerpt.status,'source-checked-excerpt');assert.equal(excerpt.citations[0].url,profile.url+'#S1');
});
test('registered imported papers appear once even when they have no DOI or public URL',()=>{
  const f=fixture();f.paper.doi='';const host={innerHTML:'',addEventListener(){},querySelector(){}};
  evidence.create({sources:[reading.sourceRecord(f.paper)],getSession:()=>f.session}).mount(host);
  const options=host.innerHTML.match(/<select data-ev-select>([\s\S]*?)<\/select>/)[1];assert.equal((options.match(/<option value="PAPER_/g)||[]).length,1);
  assert(host.innerHTML.includes('Information linked to this paper (0)'));
});
test('evidence UI supports saving, following a passage, exporting and restoring citation links',()=>{
  const f=fixture(),events={},fields={};let saved,exported;
  for(const [selector,value] of Object.entries({'[data-ev-field]':f.raw.field,'[data-ev-value]':f.raw.value,'[data-ev-target]':f.raw.target,'[data-ev-segment]':f.raw.segmentId,'[data-ev-quote]':f.raw.quote}))fields[selector]={value};
  const host={innerHTML:'',addEventListener:(k,fn)=>events[k]=fn,querySelector:s=>fields[s]};
  const ui=evidence.create({sources:[],initial:{selected:f.paper.id},getSession:()=>f.session,onChange:s=>saved=s,onExport:s=>exported=s});ui.mount(host);
  const click=dataset=>events.click({stopPropagation(){},target:{closest:()=>({dataset})}});
  click({evAction:'add'});assert.equal(saved.records.length,1);assert(host.innerHTML.includes('INCAR / method'));assert(host.innerHTML.includes('source passage'));
  click({evSource:f.raw.segmentId,evRecord:saved.records[0].id});assert(host.innerHTML.includes('Original source passage'));assert(host.innerHTML.includes('<mark>'+f.raw.quote+'</mark>'));
  click({evAction:'export'});assert.equal(exported.records[0].citations[0].segmentId,f.raw.segmentId);
  ui.restore(saved);assert.equal(ui.snapshot().records[0].quote,f.raw.quote);
});
test('authored values are escaped and reader citations show titles and original paper links',async()=>{
  const f=fixture(),record=evidence.manual({...f.raw,value:'<img src=x onerror=alert(1)>'},[f.paper]);
  const host={innerHTML:'',addEventListener(){},querySelector(){}};evidence.create({sources:[],initial:{records:[record]},getSession:()=>f.session}).mount(host);
  assert(!host.innerHTML.includes('<img'));assert(host.innerHTML.includes('&lt;img'));
  const events={},readerHost={innerHTML:'',addEventListener:(k,fn)=>events[k]=fn,querySelector(){}};
  const ref={segmentId:f.raw.segmentId,quote:f.raw.quote};
  const analysis={findings:[{kind:'reported',text:'The paper reports a cutoff.',citations:[ref]}],questions:[],definition:{modelType:'undetermined',researchQuestion:'Which models?',hypothesis:'Pending researcher input',target:'Pending observable',controls:'Pending controls',missing:['Models'],citations:[ref]}};
  reading.create({initial:{...f.session,goal:'Test',endpoint:'https://example.com/analyze'},onAnalyze:async()=>analysis}).mount(readerHost);
  await events.click({stopPropagation(){},target:{closest:()=>({dataset:{prAction:'analyze'}})}});
  assert(readerHost.innerHTML.includes('Show original source passage'));assert(readerHost.innerHTML.includes('Open paper / DOI'));
  assert(readerHost.innerHTML.includes('id="pr-source-'+f.raw.segmentId+'"'));
});
