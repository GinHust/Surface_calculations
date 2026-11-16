const {test}=require('node:test');
const assert=require('node:assert/strict');
const model=require('../src/paper-model.js');
const planner=require('../src/research-planner.js');
const viewer=require('../src/structure-viewer.js');
const profile=require('../data/l01-model.json');
const sources=require('../data/literature-seed.json').sources;
const distance=(a,b,cell)=>Math.hypot(...a.map((v,i)=>{const d=v-b[i];return d-Math.round(d/cell[i])*cell[i];}));

test('L01 drafts reproduce the declared lattice-site count and the explicit C-H -> N construction rule',()=>{
  const pair=model.generatePair(),[cc,cn]=pair.models;
  assert.equal(pair.settings.a,3.573);assert.equal(cc.heavyAtoms,240);assert.equal(cc.carbonLayers,12);
  assert.deepEqual(cc.counts,{C:240,H:40});assert.deepEqual(cn.counts,{C:239,N:1,H:39});
  assert.equal(cc.atoms.length,280);assert.equal(cn.atoms.length,279);
  assert.equal(cn.nitrogenPOSCAR,240);assert.equal(cn.atoms[239].element,'N');
  const host=cn.atoms.find(a=>a.element==='N');assert.equal(host.layer,11);assert(!cn.atoms.some(a=>a.element==='H'&&a.hostSite===host.site));
  for(const item of pair.models)assert.equal(viewer.prepareFile(item.name,item.text).format,'vasp');
});
test('vacuum, dimers, bonds and selective-dynamics constraints are encoded in the exported coordinates',()=>{
  const pair=model.generatePair();
  for(const item of pair.models){
    const z=item.atoms.map(a=>a.position[2]);assert(Math.abs(Math.min(...z)-5)<1e-8);assert(Math.abs(item.cell[2]-Math.max(...z)-5)<1e-8);
    for(const atom of item.atoms){assert(atom.position.every(Number.isFinite));assert.equal(atom.free[0],atom.layer>=8);assert.equal(atom.free[1],atom.layer>=8);assert.equal(atom.free[2],true);}
    const [a,b]=item.dimerSites.map(id=>item.atoms.find(a=>a.site===id));
    assert(Math.abs(distance(a.position,b.position,item.cell)-(item.key==='CN'?1.54*.945:1.54))<1e-8);
    for(const h of item.atoms.filter(a=>a.element==='H')){const c=item.atoms.find(a=>a.site===h.hostSite);assert(Math.abs(distance(h.position,c.position,item.cell)-1.09)<1e-8);}
    let minimum=Infinity;for(let i=0;i<item.atoms.length;i++)for(let j=i+1;j<item.atoms.length;j++)minimum=Math.min(minimum,distance(item.atoms[i].position,item.atoms[j].position,item.cell));
    assert(minimum>.75,`Overlapping generated atoms: ${minimum}`);
    assert(item.text.includes('Selective dynamics\nCartesian'));assert(item.text.includes('F F T'));assert(item.text.includes('T T T'));
  }
});
test('invalid cells and unsupported repeat choices are rejected instead of producing misleading structures',()=>{
  for(const options of [{a:NaN},{ny:3},{nx:1},{pucZ:3},{vacuum:0},{cc:0},{ch:5},{nx:10,ny:10,pucZ:12}])assert.throws(()=>model.generatePair(options));
  const small=model.generatePair({nx:2,ny:2,pucZ:2});assert.equal(small.models[0].heavyAtoms,16);
});
test('paper-to-planner export supplies two drafts and explicitly missing reaction endpoints, never cross-composition NEB',()=>{
  const pair=model.generatePair(),study=model.buildStudy(pair,profile);
  assert.equal(study.configurations.length,7);assert.equal(study.configurations.filter(c=>c.attachment).length,2);assert.equal(study.groups.length,3);
  assert.equal(study.protocol.cutoff,'600');assert.equal(study.protocol.kpoints,'1 1 1');assert.equal(study.protocol.vacuum,'10');assert.equal(study.protocol.layers,'12');
  for(const g of study.groups){const left=study.configurations.find(c=>c.id===g.left),right=study.configurations.find(c=>c.id===g.right);assert.equal(left.nitrogenSite,right.nitrogenSite);assert.equal(left.attachment,null);assert.equal(right.attachment,null);assert(planner.validateGroup(study,g,viewer.prepareFile).includes('structure'));}
  const raw={version:1,locale:'en',activeId:study.id,studies:[study]};const restored=planner.validateDocument(raw,sources.map(s=>s.id),viewer.prepareFile);assert.deepEqual(restored,raw);
  assert(study.configurations.filter(c=>c.attachment).every(c=>c.assumptions.includes('Construction values:')));
  assert(planner.jobPlan(study,viewer.prepareFile).jobs.filter(j=>j.groupId).every(j=>j.status==='blocked'));
  assert(!study.configurations.some(c=>c.label.includes('C–C · state 5')));
});

test('planner accepts a generated study without replacing existing problems or losing coordinate files',()=>{
  const ui=planner.create({sources,parser:viewer.prepareFile});const original=ui.snapshot();const study=model.buildStudy(model.generatePair(),profile);
  assert.equal(ui.addStudy(study),true);const result=ui.snapshot();assert.equal(result.studies.length,2);assert.equal(result.studies[0].id,original.studies[0].id);assert.equal(result.activeId,study.id);assert.equal(result.studies[1].configurations.filter(c=>c.attachment).length,2);
});
