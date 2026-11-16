/* L01: reviewed paper specification -> explicitly assumed geometric drafts. */
(function(scope){
  'use strict';
  const DEFAULTS={a:3.573,nx:5,ny:4,pucZ:6,vacuum:10,cc:1.54,ch:1.09};
  const clone=x=>JSON.parse(JSON.stringify(x));
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uid=prefix=>prefix+'-'+(scope.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2,8));
  const length=v=>Math.hypot(...v);
  const unit=v=>{const l=length(v);if(l<1e-9)throw new Error('Degenerate bond direction.');return v.map(x=>x/l);};
  function settings(raw={}){
    const p=Object.fromEntries(Object.keys(DEFAULTS).map(k=>[k,Number(raw[k]??DEFAULTS[k])]));
    if(Object.values(p).some(v=>!Number.isFinite(v)))throw new Error('All construction parameters must be finite.');
    if(p.a<3||p.a>4.5||p.vacuum<6||p.vacuum>40||p.cc<1.3||p.cc>1.8||p.ch<.9||p.ch>1.3)throw new Error('Use a=3–4.5 Å, vacuum=6–40 Å, C–C=1.3–1.8 Å and C–H=0.9–1.3 Å.');
    if(![p.nx,p.ny,p.pucZ].every(Number.isInteger)||p.nx<2||p.nx>10||p.ny<2||p.ny>10||p.ny%2||p.pucZ<2||p.pucZ>12||p.pucZ%2)throw new Error('nx must be 2–10; ny and thickness units must be even (ny=2–10, thickness=2–12).');
    if(p.nx*p.ny*p.pucZ*2>1600)throw new Error('This browser builder is limited to 1600 heavy-atom sites.');
    return p;
  }
  function delta(a,b,cell){return b.map((v,i)=>{let d=v-a[i];if(i<2)d-=Math.round(d/cell[i])*cell[i];return d;});}
  function makeModel(p,nitrogen){
    const side=p.a/Math.sqrt(2), layers=2*p.pucZ, per=p.nx*p.ny;
    const cell=[p.nx*side,p.ny*side,0],atoms=[];
    const offsets=[[0,0],[.5,0],[.5,.5],[0,.5]];
    for(let layer=0;layer<layers;layer++)for(let iy=0;iy<p.ny;iy++)for(let ix=0;ix<p.nx;ix++){
      const o=offsets[layer%4];atoms.push({element:'C',site:atoms.length+1,layer,position:[(ix+o[0])*side,(iy+o[1])*side,layer*p.a/4],free:layer>=layers-4?[true,true,true]:[false,false,true]});
    }
    const nX=Math.floor(p.nx/2),nY=Math.min(p.ny-2,2*Math.floor(p.ny/4));
    const nIndex=(layers-1)*per+nY*p.nx+nX;
    const partner=nIndex+p.nx;
    for(const layer of [0,layers-1])for(let iy=0;iy<p.ny;iy+=2)for(let ix=0;ix<p.nx;ix++){
      const i=layer*per+iy*p.nx+ix,j=i+p.nx;
      const bond=nitrogen&&i===nIndex?p.cc*.945:p.cc;
      const shift=(side-bond)/2;atoms[i].position[1]+=shift;atoms[j].position[1]-=shift;
    }
    if(nitrogen)atoms[nIndex].element='N';
    // Infer the two subsurface neighbors by the known adjacent atomic plane.
    for(const layer of [0,layers-1])for(let k=0;k<per;k++){
      const index=layer*per+k,host=atoms[index];if(nitrogen&&index===nIndex)continue;
      const adjacent=layer===0?1:layers-2;
      const neighbors=atoms.slice(adjacent*per,(adjacent+1)*per).map(a=>delta(host.position,a.position,cell)).sort((a,b)=>length(a)-length(b)).slice(0,2);
      const iy=Math.floor(k/p.nx),ix=k%p.nx,dimer=layer*per+(iy%2?iy-1:iy+1)*p.nx+ix;
      neighbors.push(delta(host.position,atoms[dimer].position,cell));
      const sum=neighbors.map(unit).reduce((acc,v)=>acc.map((x,i)=>x+v[i]),[0,0,0]);
      const direction=unit(sum.map(x=>-x));
      atoms.push({element:'H',site:null,hostSite:host.site,layer,position:host.position.map((x,i)=>x+direction[i]*p.ch),free:clone(host.free)});
    }
    const zMin=Math.min(...atoms.map(a=>a.position[2])),zMax=Math.max(...atoms.map(a=>a.position[2]));
    cell[2]=zMax-zMin+p.vacuum;
    for(const atom of atoms){atom.position[2]+=p.vacuum/2-zMin;for(let i=0;i<2;i++)atom.position[i]=((atom.position[i]%cell[i])+cell[i])%cell[i];}
    const species=nitrogen?['C','N','H']:['C','H'];
    const ordered=species.flatMap(element=>atoms.filter(a=>a.element===element));
    const counts=Object.fromEntries(species.map(element=>[element,atoms.filter(a=>a.element===element).length]));
    const name=nitrogen?'L01_CN_starting_guess':'L01_CC_starting_guess';
    const text=[name+' - geometric draft, not author coordinates','1',...cell.map((v,i)=>[0,1,2].map(j=>j===i?v.toFixed(10):'0').join(' ')),species.join(' '),species.map(s=>counts[s]).join(' '),'Selective dynamics','Cartesian',...ordered.map(a=>a.position.map(v=>v.toFixed(10)).join(' ')+' '+a.free.map(f=>f?'T':'F').join(' '))].join('\n');
    return {key:nitrogen?'CN':'CC',name:name+'.vasp',text,counts,cell,atoms:ordered,heavyAtoms:per*layers,carbonLayers:layers,nitrogenSite:nitrogen?nIndex+1:null,nitrogenPOSCAR:nitrogen?ordered.findIndex(a=>a.element==='N')+1:null,dimerSites:[nIndex+1,partner+1],mode:'geometric-starting-guess-not-relaxed'};
  }
  function generatePair(raw){const p=settings(raw);return {settings:p,models:[makeModel(p,false),makeModel(p,true)],mode:'geometric-reconstruction-not-author-coordinates'};}
  function buildStudy(pair,profile){
    const p=pair.settings,id=uid('P'),cellModel=`${p.nx}×${p.ny}×${p.pucZ} PUC / ${2*p.pucZ} carbon planes / vacuum ${p.vacuum} Å`;
    const assumptions=[`Construction values: a=${p.a} Å; C–C=${p.cc} Å; C–H=${p.ch} Å; C–N=${(p.cc*.945).toFixed(6)} Å.`,...profile.assumptions].join(' ');
    const configs=pair.models.map(model=>({id:uid('C'),label:model.key==='CC'?'Reference · N-free C–C dimer':'Nitrogen-promoted hypothesis · surface C–N dimer',orientation:'(100) family; model normal [001]',termination:'H-terminated, reconstructed 2×1 geometric starting model',cellModel,nitrogenSite:model.key==='CC'?'N-free':'surface-embedded N; construction site '+model.nitrogenSite,adsorbate:'Clean starting slab; reaction states are separate missing inputs',charge:'0',spin:'2',origin:'reconstructed',sourceId:'L01',locator:'arXiv:2011.04921v1 §1, §§2.1–2.2; Supplement §§1.2–3',assumptions:assumptions.slice(0,2000),optimized:false,attachment:{name:model.name,text:model.text}}));
    return {id,question:'Does surface-embedded nitrogen lower the carbon-insertion barrier at a diamond (100) dimer?',criterion:'Focused comparison: relax one N-free C–C reference slab and one surface-embedded C–N slab. Primary outcome is the within-branch activation barrier: C–C direct state 4→6 versus C–N states 4→5→6. Do not compare raw total energies between C–C and C–N because their compositions differ. Reaction-state coordinates are not generated by this slab builder; add reviewed state geometries before NEB.',sourceIds:['L01'],protocol:{engine:'VASP',xc:'PBE',cutoff:'600',kpoints:'1 1 1',pseudo:'',convergence:'L01 reference: SCF 0.1 meV; forces 0.05 eV/Å. Reproduce cutoff, cell, slab and vacuum convergence; review spin and dipole correction. PAW dataset version remains required.',vacuum:String(p.vacuum),layers:String(2*p.pucZ),scf:'0.0001',force:'0.05',fixedLayers:'0'},configurations:configs,groups:[]};
  }
  function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
  function zipStore(files){
    const encoder=new TextEncoder(),local=[],central=[];let offset=0;
    const u16=(view,pos,value)=>view.setUint16(pos,value,true),u32=(view,pos,value)=>view.setUint32(pos,value>>>0,true);
    const concat=chunks=>{const out=new Uint8Array(chunks.reduce((n,x)=>n+x.length,0));let at=0;for(const chunk of chunks){out.set(chunk,at);at+=chunk.length;}return out;};
    const date=((2026-1980)<<9)|(11<<5)|16;
    for(const [path,content] of files){const name=encoder.encode(path),data=encoder.encode(content),crc=crc32(data),stamp=offset;
      const head=new Uint8Array(30+name.length),h=new DataView(head.buffer);u32(h,0,0x04034b50);u16(h,4,20);u16(h,6,0);u16(h,8,0);u16(h,10,0);u16(h,12,date);u32(h,14,crc);u32(h,18,data.length);u32(h,22,data.length);u16(h,26,name.length);u16(h,28,0);head.set(name,30);local.push(head,data);offset+=head.length+data.length;
      const record=new Uint8Array(46+name.length),c=new DataView(record.buffer);u32(c,0,0x02014b50);u16(c,4,20);u16(c,6,20);u16(c,8,0);u16(c,10,0);u16(c,12,0);u16(c,14,date);u32(c,16,crc);u32(c,20,data.length);u32(c,24,data.length);u16(c,28,name.length);u16(c,30,0);u16(c,32,0);u16(c,34,0);u16(c,36,0);u32(c,38,0);u32(c,42,stamp);record.set(name,46);central.push(record);
    }
    const centralBytes=concat(central),end=new Uint8Array(22),e=new DataView(end.buffer);u32(e,0,0x06054b50);u16(e,4,0);u16(e,6,0);u16(e,8,files.length);u16(e,10,files.length);u32(e,12,centralBytes.length);u32(e,16,offset);u16(e,20,0);
    return concat([...local,centralBytes,end]);
  }
  function calculationBundle(pair,profile){
    const p=pair.settings,files=[],add=(path,body)=>files.push([path,body.endsWith('\n')?body:body+'\n']);
    const root='L01-two-model-comparison/';
    const targets=[
      {model:pair.models.find(m=>m.key==='CC'),dir:'01-reference-CC',title:'Reference / N-free C–C',species:['C','H'],focus:'Direct state 4 → 6; reported PBE barrier 0.959 eV.'},
      {model:pair.models.find(m=>m.key==='CN'),dir:'02-nitrogen-CN',title:'Nitrogen-promoted hypothesis / surface C–N',species:['C','N','H'],focus:'States 4 → 5 → 6; reported PBE barriers 0.057 eV and 0.283 eV.'}
    ];
    add(root+'README.md',`# Focused two-model calculation plan\n\n## Research question\nDoes surface-embedded nitrogen lower the carbon-insertion activation barrier at a diamond (100) dimer?\n\n## Comparison\n- **Reference (weaker N-assisted hypothesis):** N-free C–C surface dimer; relax the geometric starting slab in \`${targets[0].dir}/\`.\n- **Nitrogen-promoted hypothesis:** surface C–N dimer; relax the geometric starting slab in \`${targets[1].dir}/\`.\n- **Primary metric:** compare barriers within each reaction branch: C–C direct 4→6 versus C–N 4→5→6. Never subtract raw total energies across C–C and C–N compositions.\n\n## Paper benchmarks (reference only, not results from this bundle)\n- C–C direct 4→6: 0.959 eV.\n- C–N 4→5: 0.057 eV; 5→6: 0.283 eV.\n- The paper reports an approximately 400-fold rate enhancement for its defined ring-opening/closing mechanism.\n\nSource: ${profile.title}; ${profile.version}; Main text Table 1 and §§2.1–2.2. Values are method- and model-specific comparison targets, not computed outputs from these files.\n\n## Required sequence\n1. Inspect both generated POSCARs and relax each slab using the included draft VASP inputs.\n2. Reconstruct or obtain the paper's state-4/5/6 coordinates. Those coordinates are deliberately not fabricated here.\n3. Build separate climbing-NEB paths in \`03-pathway-drafts/\`: C–C 4→6; C–N 4→5 and 5→6. The paper reports that C–C state 5 is not a stable minimum, so no C–C 4→5→6 path is defined.\n4. Validate atom ordering, endpoint composition, spin, cell, PAW datasets, convergence and dipole treatment before running.\n\n## Status and limits\nAll coordinates are unrelaxed geometric starting guesses, not author coordinates. The included slab-relaxation inputs and NEB settings are drafts. No DFT calculation has run. NEB endpoints/images are missing; use licensed, matching PAW datasets and converge the slab/cutoff/k-point setup locally. Adjust the job script for your cluster.\n`);
    for(const item of targets){const {model,dir,title,species,focus}=item,base=root+dir+'/';
      add(base+'POSCAR',model.text);
      add(base+'INCAR.draft',[`SYSTEM = L01_${model.key}_surface_relaxation_draft`,'ENCUT = 600','EDIFF = 1E-4','EDIFFG = -0.05','ISPIN = 2','GGA = PE','LREAL = Auto','IBRION = 2','NSW = 200','ISIF = 2','LDIPOL = .TRUE.','IDIPOL = 3','# Review spin, dipole center, smearing and convergence before production.','# Draft geometry only; relax and inspect the output before barrier calculations.'].join('\n'));
      add(base+'KPOINTS',['Gamma-only surface mesh (paper setting)','0','Gamma','1 1 1','0 0 0'].join('\n'));
      add(base+'POTCAR.manifest',[`status: required-from-your-licensed-VASP-library`,`species_order: ${species.join(' ')}`,`functional: PBE / PAW`,`source: ${profile.title}`,`validation: select matching PAW datasets; record versions and checksums`,`POTCAR file is intentionally not included.`].join('\n'));
      add(base+'job.slurm.draft',['#!/bin/bash',`#SBATCH --job-name=L01_${model.key}_relax`,'#SBATCH --nodes=1','#SBATCH --ntasks=32','#SBATCH --time=24:00:00','set -euo pipefail','# Adjust resources, partition, module and working directory for your cluster.','module load <your-vasp-module>','srun vasp_std > vasp.out'].join('\n'));
      add(base+'README.md',`# ${title}\n\n${focus}\n\nContains a generated, unrelaxed POSCAR plus draft INCAR, KPOINTS, PAW manifest and Slurm script. This is a slab relaxation starting point, not the adsorbed state or an NEB endpoint. See the bundle root README for scientific basis and required follow-up.`);
      add(base+'run-manifest.json',JSON.stringify({status:'draft-not-run',paper:profile.source_id,question:'Does surface-embedded nitrogen lower the carbon-insertion barrier at a diamond (100) dimer?',model:model.key,comparisonRole:title,task:'relax-clean-surface-starting-model',engine:'VASP',xc:'PBE',reportedReference:{cutoff_eV:600,kpoints:'1 1 1',scf_eV:0.0001,force_eV_per_angstrom:0.05},construction:p,structureStatus:'unrelaxed-geometric-guess-not-author-coordinates',blocking:['independent geometry review','matching licensed PAW datasets','convergence checks','cluster profile'],reactionPath:{planned:item.model.key==='CC'?'C–C state 4 → 6':'C–N state 4 → 5 → 6',endpointCoordinates:'missing; not generated'}},null,2));
    }
    const neb=[['CC_4_to_6','C–C direct state 4 → 6',['C','H']],['CN_4_to_5','C–N state 4 → 5',['C','N','H']],['CN_5_to_6','C–N state 5 → 6',['C','N','H']]];
    for(const [name,title,species] of neb){const dir=root+'03-pathway-drafts/'+name+'/';
      add(dir+'README.md',`# ${title}\n\nVASP climbing-NEB input template only. Supply reviewed, relaxed endpoint POSCARs from the same branch, with identical cell, composition and atom ordering, before creating VASP's 00/ and final-image directories. Intermediate images and energies are not included. Species order for the licensed PAW dataset: ${species.join(' ')}. ${name==='CC_4_to_6'?'The paper reports that C–C state 5 is not a stable minimum, so this is the direct pathway.':''}\n`);
      add(dir+'INCAR.draft',['SYSTEM = L01_'+name+'_NEB_DRAFT','ENCUT = 600','EDIFF = 1E-4','EDIFFG = -0.05','ISPIN = 2','GGA = PE','LREAL = Auto','IBRION = 3','POTIM = 0','NSW = 200','ISIF = 2','IMAGES = 5','SPRING = -5','LCLIMB = .TRUE.','LDIPOL = .TRUE.','IDIPOL = 3','# Add validated endpoint folders 00 and 06 plus images 01–05.','# Check VASP version, spin, atom mapping and dipole settings before use.'].join('\n'));
      add(dir+'KPOINTS',['Gamma-only surface mesh (paper setting)','0','Gamma','1 1 1','0 0 0'].join('\n'));
      add(dir+'POTCAR.manifest',[`status: required-from-your-licensed-VASP-library`,`species_order: ${species.join(' ')}`,`functional: PBE / PAW`,`validation: must match this branch's endpoint POSCAR species and order`,`POTCAR file is intentionally not included.`].join('\n'));
    }
    add(root+'manifest.json',JSON.stringify({status:'draft-not-run',paper:{id:profile.source_id,title:profile.title,version:profile.version,url:profile.url},researchQuestion:'Does surface-embedded nitrogen lower the carbon-insertion barrier at a diamond (100) dimer?',models:targets.map(({model,dir,title,focus})=>({id:model.key,directory:dir,role:title,focus,coordinateFile:dir+'/POSCAR'})),comparison:{primaryMetric:'within-branch activation barrier',branches:['C–C 4→6','C–N 4→5→6'],crossCompositionTotalEnergySubtraction:false},paperBenchmarks_eV:{CC_4_to_6:0.959,CN_4_to_5:0.057,CN_5_to_6:0.283,source:'Main text Table 1; benchmarks only, not generated results'},missingReactionEndpoints:true,calculationHasRun:false},null,2));
    return files;
  }
  function create({profile,createViewer,onSave,onChange,onBack,initial}){
    let host,viewer,pair,active='CN',notice='',accepted=false,options={...DEFAULTS,...initial};
    const labels={a:'Lattice constant (Å)',nx:'In-plane repeat nx',ny:'In-plane repeat ny (even)',pucZ:'Thickness in primitive-cell units (even)',vacuum:'Total periodic vacuum gap (Å)',cc:'Assumed C–C dimer length (Å)',ch:'Assumed C–H bond length (Å)'};
    function render(){if(!host)return;const model=pair?.models.find(m=>m.key===active);
      host.innerHTML=`<div class="headline"><div class="small">SURFACE COMPUTE / PAPER → FOCUSED COMPARISON</div><div class="row between"><h1>Test the paper’s central claim</h1><button type="button" class="button" data-pm-action="back">Back to problem</button></div><p class="muted">One question. Two matched surface models. One shared DFT protocol. Reaction pathways stay explicit until their endpoint structures are available.</p></div>
      <section class="panel"><div class="row between"><h2>1 · What the paper actually reports</h2><a href="${esc(profile.url)}" target="_blank" rel="noopener noreferrer">Read paper & supplement ↗</a></div><p class="small">${esc(profile.version)}</p><div class="tablebox" style="margin-top:16px"><table><thead><tr><th>Parameter</th><th>Reported value</th><th>Source location</th></tr></thead><tbody>${profile.reported.map(r=>`<tr><td>${esc(r.field)}</td><td>${esc(r.value)}</td><td>${esc(r.locator)}</td></tr>`).join('')}</tbody></table></div><div class="notice" style="margin-top:16px">${esc(profile.coordinate_status)}</div></section>
      <section class="panel"><h2>2 · Define the shared slab model</h2><div class="fields">${Object.keys(labels).map(k=>`<label>${labels[k]}<input type="number" data-pm-field="${k}" value="${esc(options[k])}" step="${['nx','ny','pucZ'].includes(k)?'1':'0.001'}"></label>`).join('')}</div><details class="model-assumptions"><summary>Construction assumptions and limitations</summary><ul>${profile.assumptions.map(v=>`<li>${esc(v)}</li>`).join('')}</ul></details><label class="check"><input type="checkbox" data-pm-accept ${accepted?'checked':''}>I understand these are unrelaxed geometric guesses, with assumed bond lengths and atom positions.</label><button type="button" class="button primary" data-pm-action="generate" ${accepted?'':'disabled'}>Generate the two comparison models</button><p class="small" role="status" data-pm-notice>${esc(notice)}</p></section>
      ${model?`<section class="panel"><h2>3 · Inspect the two model configurations</h2><label>Configuration<select data-pm-model><option value="CC" ${active==='CC'?'selected':''}>Reference · N-free C–C dimer</option><option value="CN" ${active==='CN'?'selected':''}>Nitrogen-promoted hypothesis · surface C–N dimer</option></select></label><div class="inventory-counts"><div><strong>${model.atoms.length}</strong><span>Total atoms</span></div><div><strong>${model.carbonLayers}</strong><span>Carbon planes</span></div><div><strong>${model.counts.N||0}</strong><span>N atoms</span></div></div><p class="small" style="margin-top:14px">${esc(Object.entries(model.counts).map(([k,v])=>k+': '+v).join(' · '))} · Cell: ${model.cell.map(v=>v.toFixed(4)).join(' × ')} Å</p>${model.nitrogenSite?`<p class="small">N construction site ${model.nitrogenSite}; N atom ${model.nitrogenPOSCAR} in the species-grouped POSCAR. These indices use different orderings.</p>`:''}<div class="notice" style="margin-top:14px">These are two clean-slab relaxation starting points—not the state-4 reactants or transition states. The paper’s PBE pathway benchmarks are 0.959 eV for C–C 4→6, and 0.057 / 0.283 eV for C–N 4→5 / 5→6. Benchmarks are references, not calculations performed by this website.</div><div class="row"><button type="button" class="button" data-pm-action="download">Download current POSCAR</button><button type="button" class="button" data-pm-action="spec">Export model specification</button><button type="button" class="button primary" data-pm-action="bundle">Download two-model VASP bundle (.zip)</button></div></section><div data-pm-viewer></div><section class="panel"><h2>4 · Calculation sequence</h2><div class="item"><h3>01 · Relax the two slabs</h3><p class="muted">The bundle includes POSCAR, draft INCAR, KPOINTS, a PAW manifest and a Slurm script for each model.</p></div><div class="item"><h3>02 · Add the paper’s reaction states</h3><p class="muted">Supply reviewed state-4/6 geometries for C–C and state-4/5/6 geometries for C–N. This builder does not invent adsorbate or transition-state coordinates.</p></div><div class="item"><h3>03 · Run separate climbing-NEB paths</h3><p class="muted">C–C: 4→6. C–N: 4→5 and 5→6. The paper reports that C–C state 5 is unstable, so it is excluded.</p></div><div class="notice">The ZIP includes draft NEB settings and checklists, but no endpoints/images or computed energies. Have a DFT/HPC environment configured to run; the website does not submit calculations.</div><div class="row"><button type="button" class="button primary" data-pm-action="save">Add the two models to Research Planner</button></div></section>`:''}`;
      if(model){if(!viewer)viewer=createViewer();viewer.mount(host.querySelector('[data-pm-viewer]'),'en');viewer.loadFile(model.name,model.text);}
    }
    function download(name,body,type){const url=URL.createObjectURL(new Blob([body],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
    function bind(){
      host.addEventListener('input',e=>{e.stopPropagation();if(e.target.dataset.pmField){options[e.target.dataset.pmField]=e.target.value;pair=null;notice='Parameters changed. Generate again to refresh the coordinates.';const status=host.querySelector('[data-pm-notice]');if(status)status.textContent=notice;host.querySelectorAll('[data-pm-action="download"],[data-pm-action="spec"],[data-pm-action="save"],[data-pm-model]').forEach(el=>el.disabled=true);onChange?.(clone(options));}});
      host.addEventListener('change',e=>{e.stopPropagation();if(e.target.hasAttribute('data-pm-accept')){accepted=e.target.checked;render();}if(e.target.hasAttribute('data-pm-model')){active=e.target.value;render();}});
      host.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;e.stopPropagation();try{
        switch(b.dataset.pmAction){
          case 'back':onBack?.();break;
          case 'generate':if(!accepted)return;pair=generatePair(options);notice='Two geometric starting models generated. Both require relaxation.';render();break;
          case 'download':{const model=pair.models.find(m=>m.key===active);download(model.name,model.text,'text/plain');break;}
          case 'spec':download('L01-model-specification.json',JSON.stringify({source:profile,settings:pair.settings,status:pair.mode,models:pair.models.map(({atoms,text,...m})=>m)},null,2),'application/json');break;
          case 'bundle':{const bytes=zipStore(calculationBundle(pair,profile));const url=URL.createObjectURL(new Blob([bytes],{type:'application/zip'}));const a=document.createElement('a');a.href=url;a.download='L01-two-model-VASP-drafts.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);break;}
          case 'save':if(onSave?.(buildStudy(pair,profile))===false)throw new Error('Could not add this study. Export existing plans or check storage/size limits.');break;
        }
      }catch(error){notice=error.message;render();}});
    }
    return {mount(target){if(host!==target){host=target;bind();}render();},restore(value){options={...DEFAULTS,...value};pair=null;render();}};
  }
  const api={DEFAULTS,settings,generatePair,buildStudy,calculationBundle,zipStore,create};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else scope.SurfacePaperModel=api;
})(globalThis);
