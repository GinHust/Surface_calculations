/* Transparent planning rules; no generated evidence, coordinates or solver results. */
(function(scope){
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const rules=[
    {id:'migration',name:'Surface migration / reaction barrier',sources:['L02','L01'],type:'neb',species:'CH2',question:'Does nitrogen change the barrier of a specified CH2 surface migration step?',quantity:'ΔΔE‡ = (E_TS − E_initial)_N − (E_TS − E_initial)_N-free',decision:'A negative ΔΔE‡ supports a lower electronic barrier for this step, subject to numerical uncertainty. Assess free-energy corrections separately.',missing:'Relaxed initial/final structures with identical composition, cell and atom ordering within each path; NEB images; transition-state validation.'},
    {id:'adsorption',name:'Adsorption / precursor capture',sources:['L01','L02'],type:'adsorption',species:'CH3',question:'How does nitrogen change CH3 adsorption on matched diamond surfaces?',quantity:'E_ads = E_slab+CH3 − E_slab − E_CH3; compare ΔE_ads = E_ads,N − E_ads,N-free',decision:'A negative ΔE_ads supports stronger adsorption in this energy convention; adsorption alone does not establish faster growth.',missing:'Clean and adsorbed structures for each surface; the same gas-phase CH3 reference, spin treatment and energy convention.'},
    {id:'incorporation',name:'Dimer opening / carbon incorporation',sources:['L01'],type:'neb',species:'define incorporating species',question:'Does a surface C–N dimer lower the barrier of a specified carbon-incorporation step relative to a C–C dimer?',quantity:'ΔΔE‡ = ΔE‡_CN − ΔE‡_CC, each barrier referenced to its own initial state',decision:'Compare corresponding elementary steps and uncertainties. A lower step barrier does not determine the overall growth-rate multiplier.',missing:'A defined elementary reaction and atom-balanced endpoints for each path; source/SI geometries; intermediate states and transition-state validation.'},
    {id:'stability',name:'Nitrogen site stability',sources:['L05','L06','L09'],type:'relative',species:'none',question:'Which nitrogen position is more stable in a matched diamond slab at fixed composition?',quantity:'ΔE = E_siteB − E_siteA for equal composition and a shared protocol',decision:'The sign ranks the proposed sites at the electronic-energy level. Different compositions require formation energies and chemical reservoirs.',missing:'Two explicit nitrogen positions with the same composition and cell; relaxed structures; a convergence and spin/charge review.'}
  ];
  function normalize(raw={},sources=[]){
    const text=k=>typeof raw[k]==='string'?raw[k].slice(0,2000):'';
    return {goal:text('goal'),gap:text('gap'),hypothesis:text('hypothesis'),surface:text('surface')||'H-terminated diamond (100)',cell:text('cell'),nitrogen:text('nitrogen')||'surface-embedded N',criterion:text('criterion'),selected:rules.some(r=>r.id===raw.selected)?raw.selected:'migration',sourceIds:Array.isArray(raw.sourceIds)?[...new Set(raw.sourceIds.filter(id=>sources.some(s=>s.id===id)))]:[]};
  }
  function suggest(data){return rules.map((r,i)=>({...r,score:r.sources.filter(id=>data.sourceIds.includes(id)).length*10+(data.goal.toLowerCase().includes(r.id)?5:0),order:i})).sort((a,b)=>b.score-a.score||a.order-b.order);}
  function synthesize(data,sources){
    data=normalize(data,sources);const rule=rules.find(r=>r.id===data.selected);
    return {mode:'proposed-research-plan',question:rule.question+' Surface: '+data.surface+'; treatment: '+data.nitrogen+'.',goal:data.goal,gap:data.gap,hypothesis:data.hypothesis||'To be stated and reviewed by the researcher.',quantity:rule.quantity,criterion:data.criterion||rule.decision,model:rule.type==='neb'?'Paired slab DFT + relaxation → NEB for each surface':rule.type==='adsorption'?'Paired slab DFT + clean/adsorbed energies + gas reference':'Matched-composition slab DFT + relaxation + relative energies',controls:'Match orientation, termination, supercell, coverage, charge/spin treatment and numerical accuracy. Change only the declared factor.',evidence:sources.filter(s=>data.sourceIds.includes(s.id)).map(s=>({id:s.id,title:s.title,finding:s.finding,locator:s.locator,caution:s.caution})),missing:[...(!data.goal.trim()?['Define the research objective.']:[]),...(!data.gap.trim()?['State the unresolved issue in the selected evidence.']:[]),...(!data.hypothesis.trim()?['State a falsifiable hypothesis.']:[]),...(!data.sourceIds.length?['Select and review evidence sources.']:[]),...(!data.cell.trim()?['Define supercell, slab thickness, fixed layers and coverage.']:[]),rule.missing,'Supply coordinates, source locations, licensed pseudopotentials and convergence checks.'],ruleId:rule.id};
  }
  function buildStudy(data,sources,planner){
    data=normalize(data,sources);const summary=synthesize(data,sources),rule=rules.find(r=>r.id===data.selected);
    const s=rule.type==='relative'?planner.study():planner.template(rule.type);
    s.question=summary.question.slice(0,2000);s.criterion=[summary.quantity,summary.criterion,'Objective: '+(data.goal||'pending'),'Research gap: '+(data.gap||'pending'),'Hypothesis: '+summary.hypothesis].join('\n');s.sourceIds=data.sourceIds;
    if(rule.type==='relative'){
      s.configurations=['N site A — specify position','N site B — specify position'].map(label=>planner.configuration(label));
      s.groups=[{id:s.id+'-sites',label:'Matched N positions',type:'relative',left:s.configurations[0].id,right:s.configurations[1].id,variable:'N position at fixed composition',reference:'',mappingReviewed:false}];
    }
    s.configurations.forEach((c,i)=>{
      c.orientation=data.surface;c.termination='Specify termination / coverage';c.cellModel=data.cell;c.sourceId=data.sourceIds[0]||'';c.locator='';
      c.nitrogenSite=rule.type==='relative'?(i?'Specify N site B':'Specify N site A'):i<2?'N-free':data.nitrogen;
      c.adsorbate=rule.type==='adsorption'?(i%2?rule.species:'none'):rule.species;
      c.assumptions=['Proposed planning model; not author coordinates.',summary.controls,'Hypothesis: '+summary.hypothesis,'Unresolved: '+summary.missing.join(' ')].join('\n');
    });
    // Keep each field within the planner import contract.
    s.criterion=s.criterion.slice(0,2000);s.configurations.forEach(c=>c.assumptions=c.assumptions.slice(0,2000));
    s.groups.forEach(g=>{g.variable=rule.id==='stability'?'N position':rule.id+' on '+g.label;});
    return s;
  }
  function create({sources,initial,onChange,onCreate,onExport}){
    let data=normalize(initial,sources),host,notice='';
    const field=(key,label)=>`<label>${label}<textarea rows="2" maxlength="2000" data-ra-field="${key}">${esc(data[key])}</textarea></label>`;
    function render(){if(!host)return;const summary=synthesize(data,sources);
      host.innerHTML=`<section class="panel research-assistant"><div class="small">RESEARCH DISCOVERY</div><h2>Question suggestions & research synthesis</h2><p class="muted">Turn evidence into a testable question and a calculation model. Suggestions use explicit planning rules and selected source IDs; they are hypotheses for review.</p>
      <div class="fields">${field('goal','Research objective')}${field('gap','Unresolved issue / evidence gap')}${field('hypothesis','Hypothesis to test')}${field('surface','Surface and termination')}${field('cell','Supercell, layers and coverage')}${field('nitrogen','Nitrogen treatment / position')}${field('criterion','Decision criterion / acceptable uncertainty (optional)')}</div>
      <fieldset><legend>Evidence to synthesize</legend><div class="rp-source-list">${sources.map(s=>`<label class="check"><input type="checkbox" data-ra-source="${s.id}" ${data.sourceIds.includes(s.id)?'checked':''}>${esc(s.id+' · '+s.title)}</label>`).join('')}</div></fieldset>
      <h3>Suggested questions</h3><p class="small">Ordered by overlap with selected evidence, then objective keywords. Source overlap is a relevance hint, not proof.</p><div class="ra-candidates">${suggest(data).map(r=>`<label class="item"><input type="radio" name="ra-question" data-ra-select="${r.id}" ${data.selected===r.id?'checked':''}> <b>${esc(r.name)}</b><p>${esc(r.question)}</p><span class="small">Related inventory: ${esc(r.sources.join(', '))} · ${r.sources.filter(id=>data.sourceIds.includes(id)).length} selected source matches</span></label>`).join('')}</div>
      <button type="button" class="button" data-ra-action="refresh">Synthesize / refresh model brief</button><div data-ra-summary>${brief(summary)}</div>
      <div class="row"><button type="button" class="button primary" data-ra-action="create">Create model plan in Research Planner →</button><button type="button" class="button" data-ra-action="export">Export research brief JSON</button></div><p role="status" data-ra-notice>${esc(notice)}</p></section>`;
    }
    function brief(s){return `<section class="item" aria-label="Research synthesis"><h3>Proposed model brief</h3><p><b>Question:</b> ${esc(s.question)}</p><p><b>Objective:</b> ${esc(s.goal||'Pending')}</p><p><b>Research gap:</b> ${esc(s.gap||'Pending')}</p><p><b>Hypothesis:</b> ${esc(s.hypothesis)}</p><p><b>Calculation model:</b> ${esc(s.model)}</p><p><b>Target:</b> ${esc(s.quantity)}</p><p><b>Decision:</b> ${esc(s.criterion)}</p><p>${esc(s.controls)}</p><h3>Selected evidence and limits</h3>${s.evidence.map(e=>`<div class="record"><b>${esc(e.id+' · '+e.title)}</b><p>${esc(e.finding)}</p><p class="small">${esc(e.locator)}</p><p>${esc(e.caution)}</p></div>`).join('')||'<p>No evidence selected.</p>'}<h3>Required before computation</h3><ul>${s.missing.map(m=>`<li>${esc(m)}</li>`).join('')}</ul><p class="small">This brief proposes model scope. It does not validate the hypothesis or predict numerical results.</p></section>`;}
    function save(){onChange?.(JSON.parse(JSON.stringify(data)));}
    function update(event){event.stopPropagation();const el=event.target;
      if(el.dataset.raField){data[el.dataset.raField]=el.value.slice(0,2000);save();host.querySelector('[data-ra-summary]').innerHTML=brief(synthesize(data,sources));}
    }
    function bind(){host.addEventListener('input',update);host.addEventListener('change',event=>{event.stopPropagation();const el=event.target;
      if(el.dataset.raSource){data.sourceIds=el.checked?[...new Set([...data.sourceIds,el.dataset.raSource])]:data.sourceIds.filter(id=>id!==el.dataset.raSource);save();render();}
      if(el.dataset.raSelect){data.selected=el.dataset.raSelect;save();render();}
    });host.addEventListener('click',event=>{event.stopPropagation();const action=event.target.closest('[data-ra-action]')?.dataset.raAction;
      if(action==='refresh')render();
      if(action==='export')onExport?.({version:1,inputs:JSON.parse(JSON.stringify(data)),summary:synthesize(data,sources)});
      if(action==='create'){save();if(onCreate?.(data)===false){notice='Cannot add another plan. Export existing plans or free a problem slot in Research Planner (maximum 8).';render();}}
    });}
    return {mount(target){if(host!==target){host=target;bind();}render();},linkSource(id){if(sources.some(s=>s.id===id)&&!data.sourceIds.includes(id)){data.sourceIds.push(id);save();render();}},restore(raw){data=normalize(raw,sources);render();},snapshot(){return JSON.parse(JSON.stringify(data));}};
  }
  const api={normalize,suggest,synthesize,buildStudy,create};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else scope.SurfaceResearchAssistant=api;
})(globalThis);
