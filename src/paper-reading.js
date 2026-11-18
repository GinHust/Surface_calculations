/* Paper text, source locations, review questions and a grounded AI service contract. */
(function(scope){
  'use strict';
  const MAX_TEXT=120000,MAX_PAPERS=6;
  const copy=x=>JSON.parse(JSON.stringify(x));
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clean=x=>String(x??'').replace(/\s+/g,' ').trim();
  function safeURL(x){try{const u=new URL(x);return u.protocol==='https:'?u.href:'';}catch(_){return '';}}
  function paper(raw){
    if(!raw||typeof raw.title!=='string'||!raw.title.trim())throw Error('Paper title is required.');
    if(String(raw.abstract||'').length>MAX_TEXT)throw Error('Abstract exceeds the text limit. Supply selected sections instead.');
    const title=raw.title.slice(0,1000),doi=safeURL(raw.doi),url=safeURL(raw.oa||raw.url);
    let hash=2166136261;for(const c of doi||raw.id||title)hash=Math.imul(hash^c.charCodeAt(0),16777619);
    const id=/^PAPER_[a-z0-9]+$/.test(raw.id)?raw.id:'PAPER_'+(hash>>>0).toString(36);
    const segments=Array.isArray(raw.segments)?raw.segments.slice(0,100).map((s,i)=>({id:id+'-S'+(i+1),location:String(s.location||'Text section '+(i+1)).slice(0,200),text:String(s.text||'')})):[];
    if(segments.reduce((n,s)=>n+s.text.length,0)>MAX_TEXT)throw Error('Paper text exceeds 120,000 characters. Select a smaller set of sections.');
    return {id,title,doi,url,libraryId:typeof raw.libraryId==='string'&&/^[A-Z][A-Za-z0-9_-]{1,60}$/.test(raw.libraryId)?raw.libraryId:'',authors:String(raw.authors||'').slice(0,1000),year:String(raw.year||'').slice(0,10),abstract:String(raw.abstract||''),abstractTruncated:raw.abstractTruncated===true,scope:segments.length?String(raw.scope||'user-supplied sections').slice(0,100):raw.abstractTruncated?'abstract excerpt (OpenAlex reconstruction limit)':'abstract only',segments};
  }
  function allSegments(papers){return papers.flatMap(p=>p.segments.length?p.segments.map(s=>({...s,paperId:p.id})):(p.abstract?[{id:p.id+'-A',paperId:p.id,location:'Abstract (OpenAlex metadata; verify against publisher)',text:p.abstract}]:[]));}
  function sourceRecord(p){return {id:p.id,title:p.title,authors:p.authors,year:p.year,kind:'Imported paper',url:p.doi||p.url,open:p.url||p.doi,status:'User-selected paper; interpretation pending review',finding:p.abstract?'Abstract available in paper reader.':'Read the attached text in the paper reader.',need:'Define a testable question from cited paper passages.',locator:'Paper reader: '+p.scope,value:null,caution:'Imported metadata/text is not independently verified. No numerical settings are automatically adopted.'};}
  function verifyAnalysis(raw,segments){
    if(!raw||!Array.isArray(raw.findings)||!Array.isArray(raw.questions)||!raw.definition)throw Error('Invalid analysis structure.');
    if(raw.findings.length>20||raw.questions.length>12)throw Error('Analysis exceeds item limits.');
    const str=(v,max=3000)=>{if(typeof v!=='string'||v.length>max)throw Error('Invalid analysis field.');return v;};
    function refs(value,required){
      if(!Array.isArray(value)||value.length>5||(required&&!value.length))throw Error('A paper claim needs a verifiable citation.');
      return value.map(ref=>{const segment=segments.find(s=>s.id===ref.segmentId),quote=str(ref.quote,1000);
        if(!segment||clean(quote).length<20||!clean(segment.text).includes(clean(quote)))throw Error('Citation verification failed: the quoted passage is absent from the supplied text.');
        return {segmentId:segment.id,quote,location:segment.location,paperId:segment.paperId};});
    }
    const findings=raw.findings.map(f=>{if(!['reported','inference'].includes(f.kind))throw Error('Invalid finding type.');return {kind:f.kind,text:str(f.text),citations:refs(f.citations,true)};});
    const ids=new Set();const questions=raw.questions.map(q=>{const id=str(q.id,60);if(!/^q[1-9]\d?$/.test(id)||ids.has(id))throw Error('Invalid question ID.');ids.add(id);return {id,question:str(q.question),why:str(q.why),citations:refs(q.citations,false)};});
    const d=raw.definition;if(!['neb','adsorption','relative','formation','undetermined'].includes(d.modelType))throw Error('Unknown model type.');
    const definition={modelType:d.modelType};for(const k of ['researchQuestion','hypothesis','target','controls']){definition[k]=str(d[k],2000);if(!definition[k].trim())throw Error('Problem definition contains an empty field.');}
    if(!Array.isArray(d.missing)||d.missing.length>20)throw Error('Invalid missing-data list.');definition.missing=d.missing.map(v=>str(v,1000));
    definition.citations=refs(d.citations,true);
    const result={findings,questions,definition,verification:'quotes-match-supplied-text; scientific-interpretation-requires-review'};
    if(raw.multiAgent){const workflow=typeof module!=='undefined'&&module.exports?require('./paper-workflow.js'):scope.SurfacePaperWorkflow;result.multiAgent=workflow.verify(raw.multiAgent,segments);}
    return result;
  }
  function normalize(raw={}){
    let papers=[];for(const p of Array.isArray(raw.papers)?raw.papers.slice(0,MAX_PAPERS):[])try{papers.push(paper(p));}catch(_){}
    let analysis=null;try{if(raw.analysis)analysis=verifyAnalysis(raw.analysis,allSegments(papers));}catch(_){}
    const answers={};if(raw.answers&&typeof raw.answers==='object')for(const [k,v] of Object.entries(raw.answers).slice(0,20))if(/^[a-zA-Z0-9_-]+$/.test(k)&&typeof v==='string')answers[k]=v.slice(0,2000);
    return {papers,goal:typeof raw.goal==='string'?raw.goal.slice(0,2000):'',answers,analysis,endpoint:typeof raw.endpoint==='string'?raw.endpoint.slice(0,300):''};
  }
  function buildStudy(data,planner){
    const analysis=verifyAnalysis(data.analysis,allSegments(data.papers));const d=analysis.definition;
    if(analysis.multiAgent?.review.decision==='needs_revision')throw Error('Resolve the scientific reviewer revision requests and re-analyze before creating a plan.');
    if(d.modelType==='undetermined')throw Error('Resolve the model choice with further answers before creating a plan.');
    const unanswered=analysis.questions.filter(q=>!data.answers[q.id]?.trim());
    if(unanswered.length)throw Error('Answer all clarification questions and re-analyze before creating the plan.');
    const s=['neb','adsorption'].includes(d.modelType)?planner.template(d.modelType):planner.study();
    s.question=d.researchQuestion;s.criterion=[d.target,'Hypothesis: '+d.hypothesis,'Controls: '+d.controls].join('\n').slice(0,2000);s.sourceIds=data.papers.map(p=>p.id);
    if(!s.configurations.length){s.configurations=['Control — define structure','Treatment — define structure'].map(x=>planner.configuration(x));s.groups=[{id:s.id+'-comparison',label:'Paper-derived comparison',type:d.modelType,left:s.configurations[0].id,right:s.configurations[1].id,variable:'Specify the changed factor',reference:'',mappingReviewed:false}];}
    const citation=d.citations[0];
    s.configurations.forEach(c=>{c.sourceId=citation.paperId;c.locator=citation.location;c.cellModel='';c.assumptions=['Proposed model from a paper-reading session; researcher reviewed the brief.',d.controls,'Missing: '+d.missing.join('; '),'Paper: '+data.papers.find(p=>p.id===citation.paperId)?.title,'Quote: '+citation.quote].join('\n').slice(0,2000);});
    if(analysis.multiAgent){
      const m=analysis.multiAgent.methods,settings=Object.fromEntries(m.settings.map(v=>[v.key,v.value]));
      s.protocol={...s.protocol,engine:settings.engine==='QE'?'Quantum ESPRESSO':'VASP',xc:settings.xc||'',cutoff:settings.engine==='QE'?settings.ecutwfc_Ry||'':settings.engine==='VASP'?settings.cutoff_eV||'':'',kpoints:settings.kmesh||'',pseudo:'',convergence:('Cited draft protocol; verify original text. '+m.missing.join('; ')).slice(0,2000)};
      // Clear template-specific diamond/N assumptions for arbitrary imported papers.
      s.configurations.forEach((c,i)=>{if(['neb','adsorption'].includes(d.modelType))c.label=(i<2?'Control':'Treatment')+' · '+(d.modelType==='neb'?(i%2?'final':'initial'):(i%2?'adsorbed':'clean'));c.orientation='';c.termination='';c.nitrogenSite='';c.adsorbate='';c.charge='';c.spin=settings.spin||'';c.assumptions=(c.assumptions+'\nMethod: '+m.structure).slice(0,2000);});
      if(['neb','adsorption'].includes(d.modelType))s.groups.forEach((g,i)=>{g.label=i?'Treatment':'Control';g.variable=d.modelType==='neb'?'reaction coordinate':'adsorbate addition';});
    }
    return s;
  }
  const prompts=[['scope','Which claim or limitation in the paper do you want to test, and why?'],['comparison','What are the control and treatment systems? Which single factor should change?'],['target','Which observable and decision criterion would answer your question?'],['conditions','What surface, composition, coverage, temperature and boundary conditions should be held fixed?'],['data','Which coordinates, reference energies, supplementary files and convergence data are available?']];
  function create({initial,onChange,onSearch,onAnalyze,onCreate,onExport,onExportBundle,onSources,onEvidence}){
    let data=normalize(initial),host,notice='',busy=false,token='',revision=0,analyzedRevision=-1;
    const save=()=>onChange?.(copy(data));
    function invalidate(){revision++;data.analysis=null;analyzedRevision=-1;}
    const citationHTML=refs=>refs.map(r=>{const p=data.papers.find(p=>p.id===r.paperId),url=p?.doi||p?.url;return `<blockquote><b>${esc(p?.title||r.paperId)}</b><p class="small">${esc(r.location)}</p><p>${esc(r.quote)}</p><div class="row"><button class="button" type="button" data-pr-citation="${esc(r.segmentId)}" data-pr-quote="${esc(r.quote)}">Show original source passage</button>${url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Open paper / DOI ↗</a>`:''}</div></blockquote>`;}).join('');
    const area=(key,label,value,attrs='')=>`<label>${esc(label)}<textarea rows="2" maxlength="2000" ${attrs} data-pr-field="${key}">${esc(value)}</textarea></label>`;
    function render(){if(!host)return;const segments=allSegments(data.papers),a=data.analysis;
      host.innerHTML=`<section class="panel paper-reading"><div class="small">MULTI-AGENT RESEARCH · PAPER → EVIDENCE → DFT</div><h2>Read papers & define a research problem</h2><p>Four AI agents extract evidence, reconstruct methods, plan calculations and independently critique the proposal. Review the cited protocol before exporting DFT drafts.</p><div class="row"><button class="button" type="button" data-pr-action="evidence">Open paper → information → DFT links</button></div><div class="agent-grid" aria-label="Agent workflow">${[['reader','01','Evidence reader','Source claims & citations'],['methods','02','Methods reconstruction','Geometry, units & DFT settings'],['planner','03','Calculation planner','Controls, questions & dependencies'],['reviewer','04','Scientific reviewer','Contradictions & missing inputs']].map(([role,n,title,desc])=>`<div class="record"><span class="small">${n} · ${a?.multiAgent?'Completed':busy?'Orchestration in progress':'Waiting for analysis'}</span><h3>${title}</h3><p class="small">${desc}</p></div>`).join('')}</div>
      ${area('goal','Research topic / objective',data.goal)}<div class="row"><button class="button primary" type="button" data-pr-action="search">1 · Find papers for this topic</button></div>
      <h3>2 · Reading workspace (${data.papers.length}/${MAX_PAPERS})</h3><p class="small">Search → “Read & define problem” imports the abstract automatically. Attach a PDF or paste methods, results and supplementary sections for deeper reading. Abstract-only analysis cannot establish detailed model settings.</p><details><summary>Add your own paper / PDF</summary><label>Paper title<input data-pr-new-title maxlength="1000" placeholder="Title of the paper"></label><label>Source URL (optional, HTTPS)<input data-pr-new-url type="url" placeholder="https://doi.org/…"></label><button class="button" type="button" data-pr-action="add-paper" ${busy?'disabled':''}>Add paper, then attach PDF or text</button></details>
      ${data.papers.map(p=>`<section class="item"><h3>${esc(p.title)}</h3><p class="small">${esc(p.authors+' · '+p.year)} · <b>${esc(p.scope)}</b></p><div class="row">${p.doi||p.url?`<a href="${esc(p.doi||p.url)}" target="_blank" rel="noopener noreferrer">Original paper ↗</a>`:''}<button class="button" type="button" data-pr-remove="${p.id}">Remove paper</button></div><details><summary>Read available text (${p.segments.length||Number(!!p.abstract)} sections)</summary>${(p.segments.length?p.segments:[{location:'Abstract',text:p.abstract||'No abstract supplied.'}]).map(s=>`<div class="record" id="${esc('pr-source-'+(s.id||p.id+'-A'))}" tabindex="-1"><b>${esc(s.location)}</b><p class="pr-text">${esc(s.text)}</p></div>`).join('')}</details><label>Upload PDF / TXT / MD (max 10 MB PDF; max 120,000 extracted characters)<input type="file" accept=".pdf,.txt,.md" data-pr-upload="${p.id}" ${busy?'disabled':''}></label><label>Or paste paper sections (include section/page markers)<textarea rows="4" maxlength="120000" data-pr-text="${p.id}" placeholder="Paste methods, results, conclusions or supplementary text">${esc(p.segments.filter(s=>s.location==='Pasted paper sections').map(s=>s.text).join('\n'))}</textarea></label></section>`).join('')||'<p class="empty">No paper selected. Search above and choose “Read & define problem”.</p>'}
      <details><summary>AI analysis connection</summary><p class="small">The analysis service receives the selected paper text, goal and answers. API keys belong on the server. An optional service access token is kept only in memory.</p><label>Analysis service URL<input type="url" data-pr-endpoint value="${esc(data.endpoint)}" placeholder="https://your-analysis-service.example/analyze"></label><label>Service access token (optional)<input type="password" autocomplete="off" data-pr-token value="${esc(token)}"></label></details>
      <p class="notice" data-pr-connection>${data.endpoint?'Analysis service URL is set. Running analysis verifies AI availability; quote matches do not establish scientific correctness.':'AI analysis is not connected yet. You can read papers and answer the preparation questions below. No AI paper analysis has been performed.'}</p>
      <button class="button primary" type="button" data-pr-action="analyze" ${busy||!segments.length||!data.goal.trim()||!data.endpoint?'disabled':''}>${busy?'Running four-agent analysis…':'3 · Run multi-agent research'}</button><p class="small">Each run makes four model calls on the server and can take several minutes. No DFT solver is executed.</p>
      ${a?.multiAgent?`<section class="record"><h3>Reconstructed computational method</h3><p>${esc(a.multiAgent.methods.structure)}</p>${citationHTML(a.multiAgent.methods.citations)}<div class="tablebox"><table><thead><tr><th>Reported parameter / unit</th><th>Value</th><th>Evidence</th></tr></thead><tbody>${a.multiAgent.methods.settings.map(s=>`<tr><td>${esc(s.key)}</td><td>${esc(s.value)}</td><td>${citationHTML(s.citations)}</td></tr>`).join('')||'<tr><td colspan="3">No supported numerical protocol extracted.</td></tr>'}</tbody></table></div><ul>${a.multiAgent.methods.missing.map(m=>`<li>${esc(m)}</li>`).join('')}</ul></section><section class="record"><h3>Calculation dependency plan</h3>${a.multiAgent.calculations.map(c=>`<div class="item"><b>${esc(c.id+' · '+c.task)}</b><p>${esc(c.purpose)}</p><p class="small">Depends on: ${esc(c.dependencies.join(', ')||'none')} · Coordinates and local inputs require review</p>${citationHTML(c.citations)}</div>`).join('')||'<p>Model unresolved. Answer clarification questions and re-analyze.</p>'}</section><section class="record"><h3>Scientific review · ${esc(a.multiAgent.review.decision)}</h3>${a.multiAgent.review.checks.map(c=>`<div class="item"><b>${esc(c.severity.toUpperCase())}</b><p>${esc(c.message)}</p>${citationHTML(c.citations)}</div>`).join('')}</section>`:''}
      ${a?`<h3>Evidence extracted from supplied text</h3>${a.findings.map(f=>`<div class="record"><b>${f.kind==='reported'?'Paper reports':'AI inference — verify'}</b><p>${esc(f.text)}</p>${citationHTML(f.citations)}</div>`).join('')}<p class="small">All displayed quotes were found in the supplied text. A quote match does not establish that the interpretation is correct.</p>`:''}
      <h3>${a?'Questions to resolve before defining the problem':'Preparation questions'}</h3>${(a?a.questions:prompts.map(([id,question])=>({id,question,why:'Researcher input; this is a preparation prompt, not a conclusion from the paper.',citations:[]}))).map(q=>`<div class="item">${area(q.id,q.question,data.answers[q.id]||'','data-pr-answer')}<p class="small">${esc(q.why)}</p>${citationHTML(q.citations)}</div>`).join('')}
      ${a?`<section class="record"><h3>Proposed computational problem</h3><p><b>Question:</b> ${esc(a.definition.researchQuestion)}</p><p><b>Hypothesis:</b> ${esc(a.definition.hypothesis)}</p><p><b>Model:</b> ${esc(a.definition.modelType)}</p><p><b>Target / decision:</b> ${esc(a.definition.target)}</p><p><b>Controls:</b> ${esc(a.definition.controls)}</p><ul>${a.definition.missing.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>${citationHTML(a.definition.citations)}</section><label class="check"><input type="checkbox" data-pr-review> I reviewed the evidence, answers, model choice and remaining assumptions.</label><button class="button primary" type="button" data-pr-action="create" ${busy?'disabled':''}>4 · Create reviewed model plan →</button>`:''}
      ${a?.multiAgent?`<section class="record"><h3>DFT research package</h3><p>Download cited settings, calculation folders, evidence and a blocker manifest. Incomplete structures and protocols remain explicit TODOs in .draft files.</p><label>Draft engine<select data-pr-bundle-engine><option value="VASP">VASP</option><option value="QE">Quantum ESPRESSO</option></select></label><label class="check"><input type="checkbox" data-pr-bundle-review> I reviewed the cited settings and understand these are incomplete calculation drafts.</label><button class="button" type="button" data-pr-action="bundle" ${busy?'disabled':''}>Download DFT draft package (.tar)</button><p class="small">Use “Create reviewed model plan” to attach coordinates and edit comparison models in Research Planner. Engine-specific values are never converted automatically.</p></section>`:''}
      <button class="button" type="button" data-pr-action="export">Export reading session & citations JSON</button><p data-pr-status role="status">${esc(notice)}</p></section>`;
    }
    function refreshButtons(){const button=host?.querySelector('[data-pr-action="analyze"]');if(button)button.disabled=busy||!allSegments(data.papers).length||!data.goal.trim()||!data.endpoint;const connection=host?.querySelector('[data-pr-connection]');if(connection)connection.textContent=data.endpoint?'Analysis service URL is set. Running analysis verifies AI availability; quote matches do not establish scientific correctness.':'AI analysis is not connected yet. You can read papers and answer the preparation questions below. No AI paper analysis has been performed.';}
    function status(msg){notice=msg;const el=host?.querySelector('[data-pr-status]');if(el)el.textContent=msg;}
    async function loadFile(p,file){
      if(file.size>10*1024*1024)throw Error('File exceeds 10 MB.');let segments;
      if(/\.pdf$/i.test(file.name)){
        const pdfjs=await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@5.6.205/build/pdf.mjs');
        pdfjs.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@5.6.205/build/pdf.worker.mjs';
        const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false});let pdf;
        try{pdf=await task.promise;if(pdf.numPages>100)throw Error('PDF exceeds 100 pages. Upload selected sections.');segments=[];let chars=0;
          for(let n=1;n<=pdf.numPages;n++){const page=await pdf.getPage(n),content=await page.getTextContent();const text=content.items.map(i=>i.str+(i.hasEOL?'\n':' ')).join('');chars+=text.length;if(chars>MAX_TEXT)throw Error('Extracted PDF exceeds 120,000 characters. Upload selected sections.');segments.push({location:file.name+' · PDF page '+n,text});page.cleanup();}
          if(clean(segments.map(s=>s.text).join('')).length<80)throw Error('No readable PDF text. This may be a scanned PDF; use OCR and paste the text.');
        }finally{await task.destroy();}
      }else{const text=await file.text();if(text.length>MAX_TEXT)throw Error('Text exceeds 120,000 characters.');segments=[{location:file.name,text}];}
      const next=paper({...p,scope:'uploaded file: '+file.name,segments});Object.assign(p,next);invalidate();save();onSources?.(data.papers.map(sourceRecord));
    }
    function bind(){
      host.addEventListener('input',event=>{event.stopPropagation();const el=event.target;
        if(el.hasAttribute('data-pr-answer')){data.answers[el.dataset.prField]=el.value.slice(0,2000);revision++;save();status('Answers changed. Re-analyze to update the problem definition.');return;}
        if(el.dataset.prField==='goal'){data.goal=el.value.slice(0,2000);invalidate();save();status('Objective changed. Re-analyze the selected text.');return;}
        if(el.hasAttribute('data-pr-endpoint')){data.endpoint=el.value.slice(0,300);invalidate();save();return;}
        if(el.hasAttribute('data-pr-token'))token=el.value;
        if(el.dataset.prText){const p=data.papers.find(p=>p.id===el.dataset.prText);p.segments=[{id:p.id+'-S1',location:'Pasted paper sections',text:el.value.slice(0,MAX_TEXT)}];p.scope='user-pasted sections (completeness unverified)';invalidate();save();status('Text updated; previous analysis cleared.');}
      });
      host.addEventListener('change',async event=>{event.stopPropagation();const el=event.target;
        if(el.hasAttribute('data-pr-endpoint')||el.dataset.prField==='goal'||el.dataset.prText){refreshButtons();return;}
        if(el.dataset.prUpload){const file=el.files?.[0],p=data.papers.find(p=>p.id===el.dataset.prUpload);if(!file||!p)return;busy=true;status('Extracting file text…');try{await loadFile(p,file);notice='Text loaded. Review extraction order, figures and equations against the original PDF.';}catch(e){notice=e.message;}finally{busy=false;render();}}
      });
      host.addEventListener('click',async event=>{event.stopPropagation();const el=event.target.closest('button');if(!el)return;
        if(el.dataset.prCitation){const segment=allSegments(data.papers).find(s=>s.id===el.dataset.prCitation);if(!segment||!clean(segment.text).includes(clean(el.dataset.prQuote))){status('The source text changed. Re-analyze before following this citation.');return;}const target=host.querySelector('#pr-source-'+el.dataset.prCitation);if(target){target.closest('details').open=true;const text=clean(segment.text),quote=clean(el.dataset.prQuote),at=text.indexOf(quote);target.querySelector('.pr-text').innerHTML=esc(text.slice(0,at))+'<mark>'+esc(text.slice(at,at+quote.length))+'</mark>'+esc(text.slice(at+quote.length));target.scrollIntoView?.({behavior:'smooth',block:'center'});target.focus?.();}return;}
        if(el.dataset.prRemove){data.papers=data.papers.filter(p=>p.id!==el.dataset.prRemove);invalidate();save();render();return;}
        switch(el.dataset.prAction){
          case 'add-paper':try{const p=paper({title:host.querySelector('[data-pr-new-title]').value,url:host.querySelector('[data-pr-new-url]').value});if(data.papers.length>=MAX_PAPERS)throw Error('Maximum six papers per session.');if(data.papers.some(x=>x.id===p.id))throw Error('This paper is already selected.');data.papers.push(p);invalidate();save();onSources?.(data.papers.map(sourceRecord));notice='Paper added. Attach its PDF or paste selected text below.';render();}catch(e){status(e.message);}break;
          case 'bundle':try{if(analyzedRevision!==revision)throw Error('Re-analyze the current text and answers before exporting DFT drafts.');if(!host.querySelector('[data-pr-bundle-review]')?.checked)throw Error('Review the draft limitations and select the confirmation checkbox.');onExportBundle?.(scope.SurfacePaperWorkflow.bundle(data,host.querySelector('[data-pr-bundle-engine]').value));status('DFT draft package prepared with explicit blockers and source evidence.');}catch(e){status(e.message);}break;
          case 'evidence':onEvidence?.(data.papers.at(-1)?.libraryId||data.papers.at(-1)?.id);break;
          case 'search':onSearch?.(data.goal||'nitrogen diamond surface');break;
          case 'export':onExport?.({version:1,...copy(data)});break;
          case 'analyze':{if(busy)return;const submitted=revision,payload={workflow:'multiagent',papers:copy(data.papers),goal:data.goal,answers:copy(data.answers),questions:(data.analysis?.questions||[]).map(({id,question})=>({id,question}))};busy=true;notice='Evidence and methods agents run first, followed by planning and independent review. Please keep this tab open.';render();
            try{const raw=await onAnalyze({endpoint:data.endpoint,token,payload});if(submitted!==revision)throw Error('Inputs changed during analysis. Run analysis again.');const next=verifyAnalysis(raw,allSegments(data.papers));for(const q of payload.questions)if(payload.answers[q.id]?.trim()&&!next.questions.some(n=>n.id===q.id&&n.question===q.question))throw Error('The analysis changed an answered question. Recheck question/answer mapping before proceeding.');data.analysis=next;analyzedRevision=revision;save();notice='Quotes verified. Answer the questions, then re-analyze before creating a plan.';}
            catch(e){data.analysis=null;notice=e.message||'Analysis failed; no model plan created.';}finally{busy=false;render();}break;}
          case 'create':try{if(!host.querySelector('[data-pr-review]')?.checked)throw Error('Review the evidence and select the confirmation checkbox first.');if(analyzedRevision!==revision)throw Error('Answers or inputs changed. Re-analyze before creating the plan.');if(onCreate?.(buildStudy(data,scope.SurfaceResearchPlanner),data)===false)throw Error('Could not add plan. Check the eight-problem limit.');}catch(e){status(e.message);}break;
        }
      });
    }
    return {mount(target){if(host!==target){host=target;bind();}render();},restore(raw){data=normalize(raw);revision++;analyzedRevision=-1;render();},addPaper(raw){const p=paper(raw);if(!data.papers.some(x=>x.id===p.id)){if(data.papers.length>=MAX_PAPERS)throw Error('Maximum six papers per reading session.');data.papers.push(p);invalidate();save();onSources?.(data.papers.map(sourceRecord));}render();return p;},snapshot(){return copy(data);}};
  }
  const api={paper,allSegments,sourceRecord,verifyAnalysis,normalize,buildStudy,create,MAX_TEXT};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else scope.SurfacePaperReading=api;
})(globalThis);
