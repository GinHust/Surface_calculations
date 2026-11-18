/* Shared evidence contract and deterministic DFT draft packaging. No model code executes. */
(function(scope){
  'use strict';
  const reading=typeof module!=='undefined'&&module.exports?require('./paper-reading.js'):scope.SurfacePaperReading;
  const fields={engine:['VASP','QE'],xc:['PBE','HSE06'],cutoff_eV:null,ecutwfc_Ry:null,ecutrho_Ry:null,ediff_eV:null,conv_thr_Ry:null,force_eV_A:null,kmesh:null,spin:['1','2']};
  const roles=['reader','methods','planner','reviewer'];
  function text(v,max=3000){if(typeof v!=='string'||!v.trim()||v.length>max)throw Error('Invalid workflow text.');return v;}
  function list(v,max){if(!Array.isArray(v)||v.length>max)throw Error('Invalid workflow list.');return v;}
  function refs(v,segments,required=true){
    if(!list(v,5).length){if(required)throw Error('Workflow claim needs a citation.');return [];}
    const citation={modelType:'undetermined',researchQuestion:'Review',hypothesis:'Review',target:'Review',controls:'Review',missing:[],citations:v};
    return reading.verifyAnalysis({findings:[],questions:[],definition:citation},segments).definition.citations;
  }
  function methods(raw,segments){
    if(!raw)throw Error('Missing methods result.');
    const seen=new Set(),settings=list(raw.settings,11).map(s=>{
      if(!Object.hasOwn(fields,s.key)||seen.has(s.key))throw Error('Unknown or duplicate DFT setting.');seen.add(s.key);
      const value=text(s.value,100);
      if(fields[s.key]&&!fields[s.key].includes(value))throw Error('Unsupported DFT setting value.');
      if(s.key==='kmesh'){if(!/^\d{1,3} \d{1,3} \d{1,3}$/.test(value)||value.split(' ').some(n=>+n<1))throw Error('Invalid k-point mesh.');}
      else if(!fields[s.key]&&(!/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)||!Number.isFinite(+value)||+value<=0))throw Error('Invalid numeric DFT setting.');
      return {key:s.key,value,citations:refs(s.citations,segments)};
    });
    return {settings,structure:text(raw.structure),citations:refs(raw.citations,segments),missing:list(raw.missing,30).map(v=>text(v,1000))};
  }
  function calculations(raw,segments){
    const seen=new Set();return list(raw,12).map(c=>{
      if(!/^c[1-9]\d?$/.test(c.id)||seen.has(c.id)||!['relax','scf','dos','neb'].includes(c.task))throw Error('Invalid calculation step.');
      const dependencies=list(c.dependencies,12).map(d=>{if(!seen.has(d))throw Error('Calculation dependencies must precede their consumer.');return d;});seen.add(c.id);
      return {id:c.id,task:c.task,purpose:text(c.purpose),dependencies,citations:refs(c.citations,segments)};
    });
  }
  function review(raw,segments){
    if(!raw||!['needs_revision','researcher_review_required'].includes(raw.decision))throw Error('Invalid reviewer decision.');
    return {decision:raw.decision,checks:list(raw.checks,20).map(c=>{
      if(!['blocker','warning','note'].includes(c.severity))throw Error('Invalid review severity.');
      return {severity:c.severity,message:text(c.message),citations:refs(c.citations,segments,false)};
    })};
  }
  function verify(raw,segments){
    if(!raw||raw.version!==1||!Array.isArray(raw.agents)||raw.agents.length!==4)throw Error('Incomplete multi-agent run.');
    return {version:1,agents:raw.agents.map((a,i)=>{if(a.role!==roles[i]||a.status!=='completed')throw Error('Incomplete agent stage.');return {role:a.role,status:'completed',model:text(a.model,200)};}),methods:methods(raw.methods,segments),calculations:calculations(raw.calculations,segments),review:review(raw.review,segments)};
  }
  function bundle(session,engine='VASP'){
    if(!['VASP','QE'].includes(engine))throw Error('Unsupported DFT engine.');
    const segments=reading.allSegments(session.papers),analysis=reading.verifyAnalysis(session.analysis,segments),w=verify(session.analysis.multiAgent,segments);
    const settings=Object.fromEntries(w.methods.settings.map(s=>[s.key,s.value])),files={};
    const blockers=[...analysis.definition.missing,...w.methods.missing,...w.review.checks.filter(c=>c.severity==='blocker').map(c=>c.message),
      'Supply and review atomic coordinates for every configuration and reaction endpoint.',
      'Supply matching local pseudopotentials, convergence tests, spin/charge and boundary conditions.',
      'Review all parameter interpretations against the original paper; quote matching is not scientific validation.'];
    if(w.review.decision==='needs_revision')blockers.push('Reviewer requests revision before calculation preparation can be accepted.');
    // Cross-engine values are never converted or silently reused.
    const matched=settings.engine===(engine==='QE'?'QE':'VASP');
    if(!matched)blockers.push('Selected engine does not match a cited engine; all numerical protocol fields remain unresolved.');
    const get=k=>matched?settings[k]:undefined;
    const line=(name,key)=>get(key)?name+' = '+get(key):'# TODO '+name+' — not established for this engine';
    for(const c of w.calculations){const path=c.id+'-'+c.task+'/';
      if(engine==='VASP'){
        files[path+'INCAR.draft']=['# Paper-derived draft; resolve manifest blockers before use',line('GGA','xc')==='GGA = PBE'?'GGA = PE':get('xc')==='HSE06'?'# TODO configure and verify the complete HSE06 protocol':line('GGA','xc'),line('ENCUT','cutoff_eV'),line('EDIFF','ediff_eV'),line('ISPIN','spin'),get('force_eV_A')?'EDIFFG = -'+get('force_eV_A'):'# TODO EDIFFG',c.task==='relax'?'# TODO IBRION, NSW, ISIF and selective dynamics':c.task==='dos'?'NSW = 0\nICHARG = 11\n# Requires matching converged SCF CHGCAR; verify DOS mesh':c.task==='scf'?'NSW = 0':'# TODO relaxed endpoints, atom mapping, IMAGES and NEB implementation'].join('\n')+'\n';
        if(get('kmesh'))files[path+'KPOINTS.draft']='Cited mesh; verify centering and shifts\n0\n# TODO Gamma or Monkhorst-Pack\n'+get('kmesh')+'\n# TODO mesh shifts\n';
        else files[path+'KPOINTS.draft']='# TODO k-point mesh, centering and shifts; not established by supplied evidence\n';
      }else{
        const calc={relax:'relax',scf:'scf',dos:'nscf',neb:'scf'}[c.task];
        files[path+'pw.in.draft']="! Draft; resolve TODO fields, do not submit as-is\n&CONTROL\n calculation = '"+calc+"'\n prefix = '"+c.id+"'\n/\n&SYSTEM\n ibrav = 0\n"+(get('ecutwfc_Ry')?' ecutwfc = '+get('ecutwfc_Ry'):' ! TODO ecutwfc (Ry)')+'\n'+(get('ecutrho_Ry')?' ecutrho = '+get('ecutrho_Ry'):' ! TODO ecutrho (Ry)')+"\n ! TODO nat, ntyp, functional, spin, occupations, charge\n/\n&ELECTRONS\n"+(get('conv_thr_Ry')?' conv_thr = '+get('conv_thr_Ry'):' ! TODO conv_thr (Ry)')+'\n/\n'+(c.task==='relax'?'&IONS\n ! TODO ion_dynamics\n/\n':'')+'! TODO ATOMIC_SPECIES with matching local UPFs\n! TODO CELL_PARAMETERS and ATOMIC_POSITIONS\n'+(get('kmesh')?'! Cited mesh: '+get('kmesh')+'; TODO confirm offsets and K_POINTS card':'! TODO K_POINTS')+'\n'+(c.task==='neb'?'! Requires a separate neb.x path input and reviewed endpoints\n':'')+(c.task==='dos'?'! Requires converged SCF data and a separate dos.x input\n':'');
      }
      files[path+'requirements.json']=JSON.stringify({status:'blocked-draft',...c,structure:'missing',pseudopotentials:'user-supplied local files required',dependencies:c.dependencies},null,2);
    }
    const manifest={version:1,status:'blocked-draft-not-run',engine,calculationHasRun:false,question:analysis.definition,agents:w.agents,methods:w.methods,calculations:w.calculations,review:w.review,blockers:[...new Set(blockers)],papers:session.papers.map(p=>({id:p.id,title:p.title,doi:p.doi,scope:p.scope})),files:Object.keys(files)};
    files['manifest.json']=JSON.stringify(manifest,null,2);
    files['evidence.json']=JSON.stringify({papers:session.papers,analysis:session.analysis,answers:session.answers},null,2);
    files['README.md']='# Paper → DFT research draft\n\nStatus: BLOCKED DRAFT. No DFT calculation has run.\n\n'+analysis.definition.researchQuestion+'\n\n## Resolve before use\n'+manifest.blockers.map(v=>'- '+v).join('\n')+'\n\nEach calculation has a separate directory. Follow dependencies in manifest.json. Files with .draft contain unresolved fields and are deliberately incomplete. Never substitute raw energies across different compositions. Paper text and source passages are in evidence.json.\n';
    return {files,manifest};
  }
  // USTAR archive; bytes are encoded explicitly for Vietnamese and paper symbols.
  function tar(files){const enc=new TextEncoder(),chunks=[];for(const [name,content] of Object.entries(files)){
    if(!/^[\w./-]+$/.test(name)||name.includes('..')||name.length>99)throw Error('Invalid archive path.');
    const data=enc.encode(content),h=new Uint8Array(512);const put=(at,s)=>h.set(enc.encode(s),at),oct=(n,width)=>n.toString(8).padStart(width-1,'0')+'\0';
    put(0,name);put(100,oct(420,8));put(108,oct(0,8));put(116,oct(0,8));put(124,oct(data.length,12));put(136,oct(0,12));h.fill(32,148,156);put(156,'0');put(257,'ustar\0');put(263,'00');put(148,h.reduce((n,b)=>n+b,0).toString(8).padStart(6,'0')+'\0 ');
    chunks.push(h,data,new Uint8Array((512-data.length%512)%512));
  }chunks.push(new Uint8Array(1024));const output=new Uint8Array(chunks.reduce((n,b)=>n+b.length,0));let at=0;for(const b of chunks){output.set(b,at);at+=b.length;}return output;}
  const api={methods,calculations,review,verify,bundle,tar,roles};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else scope.SurfacePaperWorkflow=api;
})(typeof globalThis!=='undefined'?globalThis:this);
