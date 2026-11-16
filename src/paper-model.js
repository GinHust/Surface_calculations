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
    const configs=[];
    for(const branch of ['CC','CN'])for(const state of branch==='CC'?[1,4,6]:[1,4,5,6]){
      const model=pair.models.find(m=>m.key===branch);
      configs.push({id:uid('C'),label:`L01 ${branch==='CC'?'C–C':'C–N'} · state ${state}${state===1?' · geometric start':' · coordinates required'}`,orientation:'(100) family; model normal [001]',termination:'H, 2×1 reconstructed geometric guess',cellModel,nitrogenSite:branch==='CC'?'N-free':`surface-embedded N; construction site ${model.nitrogenSite}`,adsorbate:state===1?'none':state===4?'CH2 adsorbed':state===5?'CH2, open ring':'incorporated C / closed ring',charge:'0',spin:'2',origin:'reconstructed',sourceId:'L01',locator:'arXiv:2011.04921v1 §1, §§2.1–2.2; Supplement §1.2',assumptions:state===1?assumptions.slice(0,2000):'Reaction-state coordinates are missing. Generate or import a reviewed structure within this branch; the state-1 base slab is not a reaction endpoint.',optimized:false,attachment:state===1?{name:model.name,text:model.text}:null});
    }
    const groups=[];
    for(const [branch,from,to] of [['CC',4,6],['CN',4,5],['CN',5,6]]){
      const match=state=>configs.find(c=>c.label.startsWith(`L01 ${branch==='CC'?'C–C':'C–N'} · state ${state}`)).id;
      groups.push({id:uid('G'),label:`${branch==='CC'?'C–C':'C–N'} ring pathway ${from}→${to}`,type:'neb',left:match(from),right:match(to),variable:`Within-branch reaction ${from}→${to}`,reference:'',mappingReviewed:false});
    }
    return {id,question:'Does surface-embedded nitrogen lower the carbon-insertion barrier at a diamond (100) dimer?',criterion:'Relax the two starting surfaces. Supply state-4/5/6 geometries and calculate the C–C 4→6 and C–N 4→5→6 pathways separately. Compare within-branch barriers; never subtract raw total energies across the different C/N/H compositions.',sourceIds:['L01'],protocol:{engine:'VASP',xc:'PBE',cutoff:'600',kpoints:'1 1 1',pseudo:'',convergence:'L01 reference: SCF 0.1 meV; forces 0.05 eV/Å. Reproduce cutoff, cell, slab and vacuum convergence; review spin and dipole correction. PAW dataset version remains required.',vacuum:String(p.vacuum),layers:String(2*p.pucZ),scf:'0.0001',force:'0.05',fixedLayers:'0'},configurations:configs,groups};
  }
  function create({profile,createViewer,onSave,onChange,onBack,initial}){
    let host,viewer,pair,active='CN',notice='',accepted=false,options={...DEFAULTS,...initial};
    const labels={a:'Lattice constant (Å)',nx:'In-plane repeat nx',ny:'In-plane repeat ny (even)',pucZ:'Thickness in primitive-cell units (even)',vacuum:'Total periodic vacuum gap (Å)',cc:'Assumed C–C dimer length (Å)',ch:'Assumed C–H bond length (Å)'};
    function render(){if(!host)return;const model=pair?.models.find(m=>m.key===active);
      host.innerHTML=`<div class="headline"><div class="small">SURFACE COMPUTE / PAPER → STRUCTURE</div><div class="row between"><h1>Build a model from L01</h1><button type="button" class="button" data-pm-action="back">Back to problem</button></div><p class="muted">Read the evidence, review construction assumptions, generate starting coordinates and inspect them before any calculation.</p></div>
      <section class="panel"><div class="row between"><h2>1 · What the paper actually reports</h2><a href="${esc(profile.url)}" target="_blank" rel="noopener noreferrer">Read paper & supplement ↗</a></div><p class="small">${esc(profile.version)}</p><div class="tablebox" style="margin-top:16px"><table><thead><tr><th>Parameter</th><th>Reported value</th><th>Source location</th></tr></thead><tbody>${profile.reported.map(r=>`<tr><td>${esc(r.field)}</td><td>${esc(r.value)}</td><td>${esc(r.locator)}</td></tr>`).join('')}</tbody></table></div><div class="notice" style="margin-top:16px">${esc(profile.coordinate_status)}</div></section>
      <section class="panel"><h2>2 · Define the starting structure</h2><div class="fields">${Object.keys(labels).map(k=>`<label>${labels[k]}<input type="number" data-pm-field="${k}" value="${esc(options[k])}" step="${['nx','ny','pucZ'].includes(k)?'1':'0.001'}"></label>`).join('')}</div><details class="model-assumptions"><summary>Construction assumptions and limitations</summary><ul>${profile.assumptions.map(v=>`<li>${esc(v)}</li>`).join('')}</ul></details><label class="check"><input type="checkbox" data-pm-accept ${accepted?'checked':''}>I understand these are unrelaxed geometric guesses, with assumed bond lengths and atom positions.</label><button type="button" class="button primary" data-pm-action="generate" ${accepted?'':'disabled'}>Generate C–C and C–N starting structures</button><p class="small" role="status" data-pm-notice>${esc(notice)}</p></section>
      ${model?`<section class="panel"><h2>3 · Inspect the generated coordinates</h2><label>Configuration<select data-pm-model><option value="CC" ${active==='CC'?'selected':''}>C–C reference surface</option><option value="CN" ${active==='CN'?'selected':''}>C–N surface-embedded nitrogen</option></select></label><div class="inventory-counts"><div><strong>${model.atoms.length}</strong><span>Total atoms</span></div><div><strong>${model.carbonLayers}</strong><span>Carbon planes</span></div><div><strong>${model.counts.N||0}</strong><span>N atoms</span></div></div><p class="small" style="margin-top:14px">${esc(Object.entries(model.counts).map(([k,v])=>k+': '+v).join(' · '))} · Cell: ${model.cell.map(v=>v.toFixed(4)).join(' × ')} Å</p>${model.nitrogenSite?`<p class="small">N construction site ${model.nitrogenSite}; N atom ${model.nitrogenPOSCAR} in the species-grouped POSCAR. These indices use different orderings.</p>`:''}<div class="notice" style="margin-top:14px">No relaxation, adsorption geometry or transition state has been calculated. The two starting files have different compositions and are not NEB endpoints.</div><div class="row"><button type="button" class="button" data-pm-action="download">Download current POSCAR</button><button type="button" class="button" data-pm-action="spec">Export model specification</button></div></section><div data-pm-viewer></div><section class="panel"><h2>4 · Define the calculations still required</h2><p class="muted">Save seven configuration records: two coordinate-bearing starting guesses plus five missing reaction-state structures. Three NEB groups stay blocked until those endpoints are supplied and relaxed.</p><div class="notice" style="margin-top:15px">C–C: state 4 → 6. C–N: state 4 → 5 → 6. The C–C branch must not assume a stable state 5.</div><button type="button" class="button primary" data-pm-action="save">Add configurations & pathways to Planner</button></section>`:''}`;
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
          case 'save':if(onSave?.(buildStudy(pair,profile))===false)throw new Error('Could not add this study. Export existing plans or check storage/size limits.');break;
        }
      }catch(error){notice=error.message;render();}});
    }
    return {mount(target){if(host!==target){host=target;bind();}render();},restore(value){options={...DEFAULTS,...value};pair=null;render();}};
  }
  const api={DEFAULTS,settings,generatePair,buildStudy,create};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else scope.SurfacePaperModel=api;
})(globalThis);
