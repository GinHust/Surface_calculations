/* Research planning only. No solver execution or automatic scientific approval. */
(function (scope) {
  'use strict';
  const VERSION = 1, MAX_BYTES = 1024 * 1024, MAX_FILE = 200 * 1024;
  const TYPES = ['relative', 'formation', 'adsorption', 'neb'];
  const ORIGINS = ['paper', 'reconstructed', 'proposed'];
  const copy = value => JSON.parse(JSON.stringify(value));
  const bytes = value => new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value)).length;
  const id = prefix => prefix + '-' + (scope.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function configuration(label = '') {
    return {id:id('C'), label, orientation:'(100)', termination:'H', cellModel:'', nitrogenSite:'', adsorbate:'none', charge:'0', spin:'2', origin:'proposed', sourceId:'', locator:'', assumptions:'', optimized:false, attachment:null};
  }
  function study() {
    return {id:id('P'), question:'', criterion:'', sourceIds:[], protocol:{engine:'VASP', xc:'PBE', cutoff:'', kpoints:'', pseudo:'', convergence:''}, configurations:[], groups:[]};
  }
  function empty() { const s=study(); return {version:VERSION, locale:'en', activeId:s.id, studies:[s]}; }
  function template(type, sourceId) {
    const s=study();
    s.sourceIds=sourceId?[sourceId]:[];
    s.question=type==='neb'?'How does nitrogen change the barrier for a specified surface reaction?':'How does nitrogen position change CH3 adsorption on H-terminated diamond (100)?';
    s.criterion=type==='neb'?'Compare the same elementary reaction with and without N; report electronic barriers separately from free-energy barriers.':'Compare adsorption energies using matched slabs and the same gas-phase CH3 reference.';
    const names=type==='neb'?['N-free initial','N-free final','N-containing initial','N-containing final']:['N-free clean','N-free + CH3','N-containing clean','N-containing + CH3'];
    s.configurations=names.map((name,i)=>({...configuration(name), nitrogenSite:i<2?'N-free':'subsurface substitutional N', adsorbate:type==='neb'?'define reaction species':i%2?'CH3':'none', sourceId:sourceId||'', assumptions:'Planning example only. Supply the actual structure, source location and reconstruction assumptions.'}));
    for(let i=0;i<4;i+=2)s.groups.push({id:id('G'), label:i?'N-containing':'N-free', type:type==='neb'?'neb':'adsorption', left:s.configurations[i].id, right:s.configurations[i+1].id, variable:type==='neb'?'reaction coordinate':'CH3 adsorption', reference:'', mappingReviewed:false});
    return s;
  }
  function inspectStructure(attachment, parser) {
    const prepared=parser(attachment.name, attachment.text);
    if(prepared.format==='cif')return {format:'cif', counts:null, elements:null, cell:null};
    const lines=prepared.text.split(/\r?\n/);
    if(prepared.format==='xyz') {
      const elements=lines.slice(2,2+Number(lines[0])).map(line=>line.trim().split(/\s+/)[0]);
      const counts={}; for(const element of elements)counts[element]=(counts[element]||0)+1;
      return {format:'xyz',elements,counts,cell:null};
    }
    const species=lines[5].trim().split(/\s+/), numbers=lines[6].trim().split(/\s+/).map(Number);
    const counts={},elements=[];
    species.forEach((element,i)=>{counts[element]=(counts[element]||0)+numbers[i];for(let j=0;j<numbers[i];j++)elements.push(element);});
    return {format:'vasp',counts,elements,cell:lines.slice(2,5).map(line=>line.trim().split(/\s+/).map(Number))};
  }
  function sameCounts(a,b) {return a&&b&&Object.keys({...a,...b}).every(k=>(a[k]||0)===(b[k]||0));}
  function sameCell(a,b) {return a&&b&&a.every((row,i)=>row.every((v,j)=>Math.abs(v-b[i][j])<1e-6));}
  function validateGroup(s,g,parser) {
    const issues=[], add=code=>{if(!issues.includes(code))issues.push(code);};
    const a=s.configurations.find(c=>c.id===g.left),b=s.configurations.find(c=>c.id===g.right);
    if(!s.question.trim())add('question');
    if(!s.criterion.trim())add('criterion');
    if(!s.sourceIds.length)add('sources');
    if(!g.variable.trim())add('variable');
    if(!a||!b||a===b){add('pair');return issues;}
    for(const c of [a,b]) {
      if(!c.label.trim()||!c.orientation.trim()||!c.termination.trim()||!c.cellModel.trim()||!c.nitrogenSite.trim()||!c.adsorbate.trim()||!Number.isInteger(Number(c.charge))||!c.charge.trim()||!['1','2'].includes(c.spin))add('metadata');
      if(!c.sourceId||!s.sourceIds.includes(c.sourceId)||!c.locator.trim())add('provenance');
      if(c.origin!=='paper'&&!c.assumptions.trim())add('assumptions');
      if(!c.attachment)add('structure');
    }
    const p=s.protocol;
    if(!p.xc.trim()||!Number.isFinite(Number(p.cutoff))||Number(p.cutoff)<=0||!/^\s*[1-9]\d*\s+[1-9]\d*\s+[1-9]\d*\s*$/.test(p.kpoints)||!p.pseudo.trim()||!p.convergence.trim())add('protocol');
    // Matched slab comparisons. Different facets/terminations need separate groups.
    if(['orientation','termination','cellModel'].some(k=>a[k].trim()!==b[k].trim()))add('matchedSlab');
    if(a.charge!==b.charge||a.spin!==b.spin)add('chargeSpin');
    let ma,mb;
    try {if(a.attachment)ma=inspectStructure(a.attachment,parser);if(b.attachment)mb=inspectStructure(b.attachment,parser);} catch(_){add('invalidStructure');}
    if(ma&&mb) {
      if(!ma.counts||!mb.counts)add('unknownComposition');
      if(ma.cell&&mb.cell&&!sameCell(ma.cell,mb.cell))add('cell');
      if(!ma.cell||!mb.cell)add('unknownCell');
      if(g.type==='relative'||g.type==='neb')if(ma.counts&&mb.counts&&!sameCounts(ma.counts,mb.counts))add('composition');
      if(g.type==='adsorption'&&ma.counts&&mb.counts) {
        const keys=Object.keys({...ma.counts,...mb.counts});
        if(keys.some(k=>(mb.counts[k]||0)<(ma.counts[k]||0))||sameCounts(ma.counts,mb.counts))add('adsorptionComposition');
      }
      if(g.type==='neb'&&ma.elements&&mb.elements&&ma.elements.join(',')!==mb.elements.join(','))add('ordering');
    }
    if(['formation','adsorption'].includes(g.type)&&!g.reference.trim())add('reference');
    if(g.type==='neb') {
      if(!a.optimized||!b.optimized)add('endpoints');
      if(!g.mappingReviewed)add('mapping');
    }
    return issues;
  }
  function jobPlan(s,parser) {
    const jobs=[];
    const p=s.protocol;
    const protocolMissing=!p.xc.trim()||!Number.isFinite(Number(p.cutoff))||Number(p.cutoff)<=0||!/^\s*[1-9]\d*\s+[1-9]\d*\s+[1-9]\d*\s*$/.test(p.kpoints)||!p.pseudo.trim()||!p.convergence.trim();
    for(const c of s.configurations) {
      const missing=[];
      if(!c.attachment)missing.push('structure');
      if(protocolMissing)missing.push('protocol');
      if(!s.question.trim())missing.push('question');
      if(!c.sourceId||!s.sourceIds.includes(c.sourceId)||!c.locator.trim())missing.push('provenance');
      if(!c.cellModel.trim()||!c.nitrogenSite.trim()||!c.orientation.trim()||!c.termination.trim())missing.push('metadata');
      if(c.origin!=='paper'&&!c.assumptions.trim())missing.push('assumptions');
      jobs.push({id:`${c.id}:relax`,configurationId:c.id,task:'relax',dependsOn:[],status:missing.length?'blocked':'draft',blockers:[...missing,'pseudopotential, convergence and structure review required']});
      jobs.push({id:`${c.id}:scf`,configurationId:c.id,task:'scf',dependsOn:[`${c.id}:relax`],status:missing.length?'blocked':'draft',blockers:[...missing,'use relaxed geometry; no calculation has run']});
    }
    for(const g of s.groups) {
      const issues=validateGroup(s,g,parser);
      jobs.push({id:`${g.id}:${g.type==='neb'?'neb':'compare'}`,groupId:g.id,task:g.type==='neb'?'neb':'compare',dependsOn:[`${g.left}:${g.type==='neb'?'relax':'scf'}`,`${g.right}:${g.type==='neb'?'relax':'scf'}`],status:issues.length?'blocked':'draft',blockers:issues,reference:g.reference,formula:g.type==='adsorption'?'E(right) - E(left) - E(adsorbate reference)':g.type==='formation'?'E(right) - E(left) - sum(delta_n_i * mu_i) + charge corrections as applicable':g.type==='neb'?'max(E(path)) - E(initial)':'E(right) - E(left)'});
    }
    return {mode:'planning-only-not-runnable',studyId:s.id,question:s.question,criterion:s.criterion,sourceIds:copy(s.sourceIds),protocol:copy(s.protocol),jobs};
  }
  function validateDocument(raw, knownSourceIds, parser) {
    if(bytes(raw)>MAX_BYTES)throw new Error('size');
    if(!raw||raw.version!==VERSION||!Array.isArray(raw.studies)||!raw.studies.length||raw.studies.length>8)throw new Error('schema');
    const out={version:VERSION,locale:'en',activeId:raw.activeId,studies:[]};
    const identifiers=new Set();
    const text=(value,max=2000)=>{if(typeof value!=='string'||value.length>max)throw new Error('schema');return value;};
    const identity=value=>{text(value,100);if(!/^[a-zA-Z0-9_-]+$/.test(value)||identifiers.has(value))throw new Error('schema');identifiers.add(value);return value;};
    for(const item of raw.studies) {
      if(!Array.isArray(item.configurations)||item.configurations.length>40||!Array.isArray(item.groups)||item.groups.length>40||!Array.isArray(item.sourceIds))throw new Error('schema');
      const s={id:identity(item.id),question:text(item.question),criterion:text(item.criterion),sourceIds:[...new Set(item.sourceIds.filter(v=>knownSourceIds.includes(v)))],protocol:{},configurations:[],groups:[]};
      if(!item.protocol||!['VASP','Quantum ESPRESSO'].includes(item.protocol.engine))throw new Error('schema');
      for(const key of ['engine','xc','cutoff','kpoints','pseudo','convergence'])s.protocol[key]=text(item.protocol[key]);
      for(const key of ['vacuum','layers','scf','force','fixedLayers'])if(item.protocol[key]!==undefined)s.protocol[key]=text(item.protocol[key]);
      for(const source of item.configurations) {
        const c={id:identity(source.id)};
        for(const key of ['label','orientation','termination','cellModel','nitrogenSite','adsorbate','charge','spin','origin','sourceId','locator','assumptions'])c[key]=text(source[key]);
        if(!ORIGINS.includes(c.origin)||!['1','2'].includes(c.spin)||(c.sourceId&&!knownSourceIds.includes(c.sourceId)))throw new Error('schema');
        c.optimized=source.optimized===true;c.attachment=null;
        if(source.attachment) {
          const name=text(source.attachment.name,200), body=text(source.attachment.text,MAX_FILE);
          if(bytes(body)>MAX_FILE)throw new Error('size');
          parser(name,body);c.attachment={name,text:body};
        }
        s.configurations.push(c);
      }
      for(const source of item.groups) {
        const g={id:identity(source.id)};
        for(const key of ['label','type','left','right','variable','reference'])g[key]=text(source[key]);
        if(!TYPES.includes(g.type)||!s.configurations.some(c=>c.id===g.left)||!s.configurations.some(c=>c.id===g.right))throw new Error('schema');
        g.mappingReviewed=source.mappingReviewed===true;s.groups.push(g);
      }
      out.studies.push(s);
    }
    if(!out.studies.some(s=>s.id===out.activeId))out.activeId=out.studies[0].id;
    return out;
  }
  const words={"title":"Research Planner","intro":"One question → multiple configurations → comparison groups → calculation dependencies.","scope":"This is a research plan. Automated checks flag missing data; they do not establish physical validity or execute DFT.","local":"Plans are stored in this browser when available. Export JSON to back up or transfer.","saved":"Saved in this browser","unsaved":"Storage unavailable — export JSON before closing","problem":"Research problem","new":"New problem","adsTemplate":"Template: N effect on CH₃ adsorption","nebTemplate":"Template: reaction pathways","question":"Specific research question","criterion":"Target quantity and decision criterion","sources":"Evidence sources","configs":"Material configurations","addConfig":"Add configuration","duplicate":"Duplicate record","remove":"Remove","edit":"Edit","label":"Configuration name","orientation":"Surface orientation","termination":"Surface termination","cellModel":"Slab / supercell model (e.g. 2×2, 8 layers)","nitrogenSite":"N position / state","adsorbate":"Adsorbate (none if absent)","charge":"Cell charge (e)","spin":"Spin channels","origin":"Structure provenance","paper":"Author / supplementary file","reconstructed":"Reconstructed from paper","proposed":"Proposed model","sourceId":"Related source","locator":"Figure / table / section / SI filename","assumptions":"Assumptions and unresolved details","optimized":"I have reviewed the relaxation result for this configuration","attachment":"Structure: POSCAR / CONTCAR / VASP / CIF / XYZ · max 200 KiB","noFile":"No coordinate file","preview":"Preview in 3D","detach":"Detach file","use":"Use configuration in Input Builder","groups":"Comparison groups","addGroup":"Add comparison group","left":"Configuration A / initial / clean slab","right":"Configuration B / final / adsorbed slab","type":"Comparison objective","variable":"Changed factor / reaction step","reference":"Reference energies / chemical potentials and conventions","mapping":"I have checked atom-by-atom mapping between NEB endpoints","relative":"Relative stability: same composition","formation":"Formation energy: chemical references required","adsorption":"Adsorption: clean → adsorbed","neb":"Reaction path / NEB","protocol":"Shared protocol for this research problem","engine":"Calculation engine","xc":"Exchange–correlation functional","cutoff":"Cutoff (VASP: eV; QE: Ry)","kpoints":"k-point grid (e.g. 3 3 1)","pseudo":"Pseudopotential library / version","convergence":"Convergence plan: cutoff, k grid, slab, vacuum; spin/charge treatment","checks":"Planning checks","ready":"Group record complete for review; not scientifically validated","jobs":"Planned calculations","dependencies":"Dependencies","status":"Status","draft":"Draft","blocked":"Missing data","prepare":"Use group in Input Builder","export":"Export all plans as JSON","import":"Import plans JSON (append)","exportJobs":"Export calculation plan","emptyConfigs":"Add configurations or start with a template. Templates are planning records without coordinates.","emptyGroups":"At least two configurations are needed. To study N effects on adsorption, create one group per N-free/N-containing surface and use the same CH₃ reference.","linked":"Source linked to the active research problem","error":"Cannot complete action. Check JSON/structure format and limits: 8 problems, 40 configurations/groups each, 1 MiB total.","referenced":"Configuration is used by a group. Remove the related group first.","templateNote":"Templates contain illustrative English names and hypotheses. Replace them with your actual question and structures.","fileNote":"Duplicating copies the record; it does not edit coordinates. Supply and review the matching file when changing N, adsorbates or charge."};
  const issueWords={"question":"Research question missing.","criterion":"Target quantity / decision criterion missing.","sources":"Evidence source missing.","variable":"Changed factor missing.","pair":"Select two different configurations.","metadata":"Incomplete configuration metadata or invalid spin/charge.","provenance":"Each configuration needs a source and figure/table/SI location.","assumptions":"Reconstructed/proposed structures need assumptions.","structure":"Coordinate file missing.","protocol":"Shared protocol, pseudopotentials or convergence plan incomplete.","matchedSlab":"Different orientation/termination/slab model. Use matched groups.","chargeSpin":"Different spin/charge requires a separate reference protocol; this planner requires matching values.","invalidStructure":"Invalid structure file.","unknownComposition":"CIF preview only; convert to POSCAR for composition/NEB checks.","unknownCell":"Periodic cell unknown; XYZ is insufficient for slab/NEB checks.","cell":"Actual cells in the files differ.","composition":"Atomic compositions differ. Relative stability/NEB requires equal composition; use formation energy when appropriate.","adsorptionComposition":"B must add adsorbate atoms to A. Review both files.","ordering":"Element ordering differs between NEB endpoints.","reference":"Specify reference energies / chemical potentials, spin and conventions.","endpoints":"Relax and review both endpoints before NEB.","mapping":"Review atom mapping, including atoms of the same element."};
  function create({sources, parser, initial, onChange, onUse, createViewer}) {
    const known=sources.map(s=>s.id);
    let data; try {data=initial?validateDocument(initial,known,parser):empty();}catch(_){data=empty();}
    let host, selected='', notice='', storage='unsaved', viewer, previewing='';
    const t=key=>words[key]||key;
    const it=key=>issueWords[key]||key;
    const current=()=>data.studies.find(s=>s.id===data.activeId)||data.studies[0];
    const button=(action,label,attrs='')=>`<button type="button" class="button" data-rp-action="${action}" ${attrs}>${esc(t(label))}</button>`;
    const field=(entity,record,key,label=key,type='text')=>`<label>${esc(t(label))}<input data-rp-entity="${entity}" data-rp-id="${esc(record.id||'')}" data-rp-field="${key}" type="${type}" maxlength="2000" value="${esc(record[key])}"></label>`;
    const area=(entity,record,key,label=key)=>`<label>${esc(t(label))}<textarea rows="2" maxlength="2000" data-rp-entity="${entity}" data-rp-id="${esc(record.id||'')}" data-rp-field="${key}">${esc(record[key])}</textarea></label>`;
    const pick=(entity,record,key,options,label=key)=>`<label>${esc(t(label))}<select data-rp-entity="${entity}" data-rp-id="${esc(record.id||'')}" data-rp-field="${key}">${options.map(([value,name])=>`<option value="${esc(value)}" ${record[key]===value?'selected':''}>${esc(name)}</option>`).join('')}</select></label>`;
    function persist(){if(bytes(data)>MAX_BYTES)throw new Error('size');onChange?.(copy(data));}
    function render() {
      if(!host)return;
      host.setAttribute?.('lang',data.locale);
      const s=current(); if(!s.configurations.some(c=>c.id===selected))selected=s.configurations[0]?.id||'';
      const c=s.configurations.find(c=>c.id===selected),p=s.protocol,plan=jobPlan(s,parser);
      host.innerHTML=`<div class="headline"><div class="small">SURFACE COMPUTE / RESEARCH PLANNER</div><h1>${esc(t('title'))}</h1><p class="muted">${esc(t('intro'))}</p></div>
      <div class="row"><span class="small" data-rp-storage role="status">${esc(t(storage))}</span></div>
      <p class="small">${esc(t('local'))}</p><div class="notice">${esc(t('scope'))}</div><p role="status" data-rp-notice>${esc(notice)}</p>
      <section class="panel"><div class="row between"><h2>1 · ${esc(t('problem'))}</h2>${button('new','new')}</div>
      <label>${esc(t('problem'))}<select data-rp-study>${data.studies.map((x,i)=>`<option value="${esc(x.id)}" ${s.id===x.id?'selected':''}>${i+1} · ${esc(x.question||x.id)}</option>`).join('')}</select></label>
      <div class="row">${button('ads-template','adsTemplate')}${button('neb-template','nebTemplate')}</div><p class="small">${esc(t('templateNote'))}</p>
      ${area('study',s,'question')}${area('study',s,'criterion')}
      <fieldset><legend>${esc(t('sources'))}</legend><div class="rp-source-list">${sources.map(x=>`<label class="check"><input type="checkbox" data-rp-source="${x.id}" ${s.sourceIds.includes(x.id)?'checked':''}>${esc(x.id+' · '+x.title)}</label>`).join('')}</div></fieldset></section>
      <section class="panel"><div class="row between"><h2>2 · ${esc(t('configs'))} (${s.configurations.length})</h2>${button('add-config','addConfig')}</div><p class="small">${esc(t('fileNote'))}</p>
      ${s.configurations.length?`<div class="tablebox"><table><thead><tr><th>ID</th><th>${esc(t('label'))}</th><th>${esc(t('nitrogenSite'))}</th><th>${esc(t('attachment').split(':')[0])}</th><th></th></tr></thead><tbody>${s.configurations.map(x=>`<tr ${x.id===selected?'class="rp-selected"':''}><td title="${esc(x.id)}">${esc(x.id.slice(0,10))}</td><td>${esc(x.label)}</td><td>${esc(x.nitrogenSite)}</td><td>${esc(x.attachment?.name||t('noFile'))}</td><td>${button('edit','edit',`data-rp-id="${x.id}"`)}</td></tr>`).join('')}</tbody></table></div>`:`<p class="empty">${esc(t('emptyConfigs'))}</p>`}
      ${c?`<div class="item"><div class="row between"><h3>${esc(c.label||c.id)}</h3><div class="row">${button('duplicate','duplicate',`data-rp-id="${c.id}"`)}${button('remove-config','remove',`data-rp-id="${c.id}"`)}</div></div><div class="fields">${field('config',c,'label')}${field('config',c,'orientation')}${field('config',c,'termination')}${field('config',c,'cellModel')}${field('config',c,'nitrogenSite')}${field('config',c,'adsorbate')}${field('config',c,'charge','charge','number')}${pick('config',c,'spin',[['1','1'],['2','2']])}${pick('config',c,'origin',ORIGINS.map(x=>[x,t(x)]))}${pick('config',c,'sourceId',[['','—'],...sources.map(x=>[x.id,x.id+' · '+x.title])])}</div>${field('config',c,'locator')}${area('config',c,'assumptions')}
      <label class="check"><input type="checkbox" data-rp-entity="config" data-rp-id="${c.id}" data-rp-field="optimized" ${c.optimized?'checked':''}>${esc(t('optimized'))}</label>
      <label>${esc(t('attachment'))}<input type="file" data-rp-structure="${c.id}" accept=".vasp,.poscar,.contcar,.cif,.xyz,POSCAR,CONTCAR"></label>
      <p class="small">${esc(c.attachment?.name||t('noFile'))}</p><div class="row">${button('preview','preview',c.attachment?'':'disabled')}${button('detach','detach',c.attachment?'':'disabled')}${button('use','use')}</div></div>`:''}</section>
      <div data-rp-viewer></div>
      <section class="panel"><h2>3 · ${esc(t('protocol'))}</h2><div class="fields">${pick('protocol',p,'engine',[['VASP','VASP'],['Quantum ESPRESSO','Quantum ESPRESSO']])}${field('protocol',p,'xc')}${field('protocol',p,'cutoff','cutoff','number')}${field('protocol',p,'kpoints')}</div>${field('protocol',p,'pseudo')}${area('protocol',p,'convergence')}</section>
      <section class="panel"><div class="row between"><h2>4 · ${esc(t('groups'))}</h2>${button('add-group','addGroup',s.configurations.length<2?'disabled':'')}</div><p class="small">${esc(t('emptyGroups'))}</p>
      ${s.groups.map(g=>{const issues=validateGroup(s,g,parser);const opts=s.configurations.map(x=>[x.id,x.label||x.id]);return `<section class="item"><h3>${esc(g.label||g.id)}</h3><div class="fields">${field('group',g,'label')}${pick('group',g,'type',TYPES.map(x=>[x,t(x)]))}${pick('group',g,'left',opts)}${pick('group',g,'right',opts)}</div>${field('group',g,'variable')}${['formation','adsorption'].includes(g.type)?area('group',g,'reference'):''}${g.type==='neb'?`<label class="check"><input type="checkbox" data-rp-entity="group" data-rp-id="${g.id}" data-rp-field="mappingReviewed" ${g.mappingReviewed?'checked':''}>${esc(t('mapping'))}</label>`:''}<div data-rp-checks="${g.id}" class="${issues.length?'notice':'banner'}"><b>${esc(t(issues.length?'checks':'ready'))}</b>${issues.length?`<ul>${issues.map(key=>`<li>${esc(it(key))}</li>`).join('')}</ul>`:''}</div><div class="row">${button('prepare','prepare',`data-rp-id="${g.id}"`)}${button('remove-group','remove',`data-rp-id="${g.id}"`)}</div></section>`;}).join('')}</section>
      <section class="panel"><div class="row between"><h2>5 · ${esc(t('jobs'))} (${plan.jobs.length})</h2>${button('export-jobs','exportJobs')}</div><div class="tablebox"><table><thead><tr><th>ID</th><th>Task</th><th>${esc(t('dependencies'))}</th><th>${esc(t('status'))}</th></tr></thead><tbody>${plan.jobs.map(j=>`<tr><td>${esc(j.id.slice(0,10)+':'+j.task)}</td><td>${esc(j.task)}</td><td>${esc(j.dependsOn.map(d=>d.split(':')[0].slice(0,10)+':'+d.split(':')[1]).join(', ')||'—')}</td><td data-rp-job="${j.id}">${esc(t(j.status))}</td></tr>`).join('')}</tbody></table></div></section>
      <section class="panel"><div class="row">${button('export','export')}<label class="button">${esc(t('import'))}<input type="file" data-rp-import accept=".json,application/json"></label></div></section>`;
      if(viewer&&previewing)viewer.mount(host.querySelector('[data-rp-viewer]'),'en');
    }
    function download(name,value) {
      const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));
      const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
    function commit(mutator, redraw=true) {
      const previous=copy(data);
      try {mutator();if(data.studies.length>8||current().configurations.length>40||current().groups.length>40)throw new Error('size');persist();notice='';}
      catch(_){data=previous;notice=t('error');}
      if(redraw)render();
      else {
        const status=host?.querySelector('[data-rp-notice]');if(status)status.textContent=notice;
        // Keep form controls alive during blur/click. A later navigation redraws
        // summaries; checks below are refreshed without replacing the editor.
        refreshChecks();
      }
    }
    function refreshChecks() {
      const s=current();
      host?.querySelectorAll('[data-rp-checks]').forEach(el=>{
        const g=s.groups.find(g=>g.id===el.dataset.rpChecks);if(!g)return;
        const issues=validateGroup(s,g,parser);el.className=issues.length?'notice':'banner';
        el.innerHTML=`<b>${esc(t(issues.length?'checks':'ready'))}</b>${issues.length?`<ul>${issues.map(key=>`<li>${esc(it(key))}</li>`).join('')}</ul>`:''}`;
      });
      const jobs=jobPlan(s,parser).jobs;
      host?.querySelectorAll('[data-rp-job]').forEach(el=>{const job=jobs.find(j=>j.id===el.dataset.rpJob);if(job)el.textContent=t(job.status);});
    }
    function prepare(config,group) {
      const s=current();
      onUse?.({study:copy(s),configuration:copy(config),group:group?copy(group):null,plan:jobPlan(s,parser),issues:group?validateGroup(s,group,parser):['single-configuration-draft']});
    }
    function updateField(el,redraw) {
      const entity=el.dataset.rpEntity,key=el.dataset.rpField;if(!entity)return;
      const s=current();
      commit(()=>{
        const target=entity==='study'?s:entity==='protocol'?s.protocol:entity==='config'?s.configurations.find(x=>x.id===el.dataset.rpId):s.groups.find(x=>x.id===el.dataset.rpId);
        target[key]=el.type==='checkbox'?el.checked:el.value;
        if(entity==='protocol') {
          if(key==='engine'){target.cutoff='';target.pseudo='';target.convergence='';}
          s.configurations.forEach(c=>c.optimized=false);s.groups.forEach(g=>g.mappingReviewed=false);
        }
        if(entity==='config'&&key!=='optimized'&&key!=='label'&&key!=='locator'&&key!=='assumptions') {target.optimized=false;s.groups.filter(g=>g.left===target.id||g.right===target.id).forEach(g=>g.mappingReviewed=false);}
        if(entity==='group'&&['left','right','type'].includes(key))target.mappingReviewed=false;
      },redraw);
    }
    function bind() {
      host.addEventListener('click',event=>{
        const b=event.target.closest('button');if(!b)return;event.stopPropagation();
        const s=current(),c=s.configurations.find(x=>x.id===selected),g=s.groups.find(x=>x.id===b.dataset.rpId);
        const addStudy=type=>{const next=type?template(type,s.sourceIds[0]):study();data.studies.push(next);data.activeId=next.id;selected='';previewing='';};
        switch(b.dataset.rpAction) {
          case 'new':commit(()=>addStudy());break;
          case 'ads-template':commit(()=>addStudy('adsorption'));break;
          case 'neb-template':commit(()=>addStudy('neb'));break;
          case 'add-config':commit(()=>{const x=configuration();x.sourceId=s.sourceIds[0]||'';s.configurations.push(x);selected=x.id;});break;
          case 'edit':selected=b.dataset.rpId;previewing='';render();break;
          case 'duplicate':commit(()=>{const x=copy(c);x.id=id('C');x.label+=' (copy)';x.optimized=false;s.configurations.push(x);selected=x.id;});break;
          case 'remove-config':if(s.groups.some(g=>g.left===c.id||g.right===c.id)){notice=t('referenced');render();}else commit(()=>{s.configurations=s.configurations.filter(x=>x.id!==c.id);previewing='';});break;
          case 'detach':commit(()=>{c.attachment=null;c.optimized=false;previewing='';s.groups.filter(g=>g.left===c.id||g.right===c.id).forEach(g=>g.mappingReviewed=false);});break;
          case 'add-group':commit(()=>s.groups.push({id:id('G'),label:'',type:'relative',left:s.configurations[0].id,right:s.configurations[1].id,variable:'',reference:'',mappingReviewed:false}));break;
          case 'remove-group':commit(()=>{s.groups=s.groups.filter(x=>x.id!==g.id);});break;
          case 'use':prepare(c);break;
          case 'prepare':prepare(s.configurations.find(x=>x.id===g.left),g);break;
          case 'export':download('surface-research-plans.json',data);break;
          case 'export-jobs':download('surface-calculation-plan.json',jobPlan(s,parser));break;
          case 'preview':previewing=c.id;if(!viewer)viewer=createViewer();render();viewer.loadFile(c.attachment.name,c.attachment.text);break;
        }
      });
      host.addEventListener('change',async event=>{
        const el=event.target;event.stopPropagation();
        if(el.dataset.rpImport!==undefined) {
          const file=el.files?.[0];if(!file)return;
          try {
            if(file.size>MAX_BYTES)throw new Error('size');
            const imported=validateDocument(JSON.parse(await file.text()),known,parser);
            commit(()=>{for(const s of imported.studies){const ids={};s.id=id('P');for(const c of s.configurations){const old=c.id;c.id=id('C');ids[old]=c.id;}for(const g of s.groups){g.id=id('G');g.left=ids[g.left];g.right=ids[g.right];}data.studies.push(s);}data.activeId=data.studies.at(-1).id;previewing='';});
          }catch(_){notice=t('error');render();}return;
        }
        const s=current();
        if(el.dataset.rpStructure) {
          const c=s.configurations.find(x=>x.id===el.dataset.rpStructure), file=el.files?.[0];if(!file)return;
          try {if(file.size>MAX_FILE)throw new Error('size');const text=await file.text();parser(file.name,text);commit(()=>{c.attachment={name:file.name,text};c.optimized=false;previewing='';s.groups.filter(g=>g.left===c.id||g.right===c.id).forEach(g=>g.mappingReviewed=false);});}catch(_){notice=t('error');render();}return;
        }
        if(el.hasAttribute('data-rp-study')){commit(()=>{data.activeId=el.value;selected='';previewing='';});return;}
        if(el.dataset.rpSource){commit(()=>{s.sourceIds=el.checked?[...new Set([...s.sourceIds,el.dataset.rpSource])]:s.sourceIds.filter(x=>x!==el.dataset.rpSource);});return;}
        updateField(el,el.tagName==='SELECT'||el.type==='checkbox');
      });
      // Parent application has its own live-search handler.
      host.addEventListener('input',event=>{
        event.stopPropagation();
        if(event.target.dataset.rpEntity&&event.target.tagName!=='SELECT'&&event.target.type!=='checkbox')updateField(event.target,false);
      });
    }
    return {
      mount(target){if(host!==target){host=target;bind();}render();},
      linkSource(sourceId){if(!known.includes(sourceId))return;commit(()=>{const s=current();if(!s.sourceIds.includes(sourceId))s.sourceIds.push(sourceId);});notice=t('linked');render();},
      restore(value){try{data=validateDocument(value,known,parser);render();}catch(_){notice=t('error');render();}},
      setStorage(value){storage=value;if(host?.isConnected){const el=host.querySelector('[data-rp-storage]');if(el)el.textContent=t(storage);}},
      snapshot(){return copy(data);}
      ,addStudy(value){
        const checked=validateDocument({version:VERSION,locale:'en',activeId:value.id,studies:[value]},known,parser).studies[0];
        commit(()=>{data.studies.push(checked);data.activeId=checked.id;selected='';previewing='';});
        return data.studies.some(s=>s.id===checked.id);
      }
    };
  }
  const api={create,empty,study,template,configuration,inspectStructure,validateGroup,jobPlan,validateDocument,sameCounts,sameCell,VERSION};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else scope.SurfaceResearchPlanner=api;
})(globalThis);
