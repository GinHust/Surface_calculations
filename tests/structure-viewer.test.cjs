const {test} = require('node:test');
const assert = require('node:assert/strict');
const {prepareFile, normalizePOSCAR, demo} = require('../src/structure-viewer.js');

function poscar(scale = '1', mode = 'Direct', position = '.25 .5 .75') {
  return ['Test', scale, '2 0 0', '0 3 0', '0 0 4', 'C', '1', mode, position].join('\n');
}
const lines = text => text.split('\n');

test('direct coordinates stay fractional while lattice is scaled', () => {
  const out = lines(normalizePOSCAR(poscar('2')));
  assert.deepEqual(out.slice(1, 5), ['1', '4 0 0', '0 6 0', '0 0 8']);
  assert.equal(out[8], '0.25 0.5 0.75');
});
test('Cartesian coordinates use the same scale as the cell', () => {
  const out = lines(normalizePOSCAR(poscar('2', 'Cartesian')));
  assert.equal(out[8], '0.5 1 1.5');
});
test('negative scale encodes target volume, not negative lengths', () => {
  const out = lines(normalizePOSCAR(poscar('-192')));
  assert.deepEqual(out.slice(2, 5), ['4 0 0', '0 6 0', '0 0 8']);
});
test('three scale factors apply by Cartesian component, including a skew cell', () => {
  const out = lines(normalizePOSCAR(poscar('2 3 4', 'Cartesian').replace('2 0 0', '2 1 0')));
  assert.deepEqual(out.slice(2, 5), ['4 3 0', '0 9 0', '0 0 16']);
  assert.equal(out[8], '0.5 1.5 3');
});
test('lowercase selective dynamics and K Cartesian notation are recognized', () => {
  const out = lines(normalizePOSCAR(poscar('2', 'selective dynamics\nk', '.25 .5 .75 T F T')));
  assert.equal(out[7], 'Cartesian');
  assert.equal(out[8], '0.5 1 1.5');
});
test('bare POSCAR/CONTCAR names and VASP extensions load', () => {
  for (const name of ['POSCAR', 'CONTCAR', 'POSCAR.relaxed', 'slab.VASP', 'slab.poscar']) {
    assert.equal(prepareFile(name, demo).format, 'vasp');
  }
});
test('missing species, singular cells and incomplete coordinates are rejected', () => {
  assert.throws(() => normalizePOSCAR(poscar().replace('C\n1', '1')), /species/);
  assert.throws(() => normalizePOSCAR(poscar().replace('0 0 4', '0 0 0')), /invalid/);
  assert.throws(() => normalizePOSCAR(poscar().replace('C\n1', 'C\n2')), /invalid/);
  assert.throws(() => normalizePOSCAR(poscar('NaN')), /invalid/);
  assert.throws(() => normalizePOSCAR(poscar('2 -3 4')), /invalid/);
});
test('XYZ reads only the first frame and supports scientific notation', () => {
  const out = prepareFile('test.xyz', '2\nFrame 1\nC 0 0 0\nH 1D-1 0 0\n1\nFrame 2\nO 0 0 0');
  assert.equal(out.text, '2\nFrame 1\nC 0 0 0\nH 0.1 0 0');
});
test('malformed files and limits fail without silently accepting partial models', () => {
  assert.throws(() => prepareFile('test.xyz', '2\nMissing atom\nC 0 0 0'), /invalid/);
  assert.throws(() => prepareFile('test.xyz', '1\nBad coordinate\nC NaN 0 0'), /invalid/);
  assert.throws(() => prepareFile('test.xyz', '10001\nToo many'), /limit/);
  assert.throws(() => prepareFile('test.in', 'ATOMIC_POSITIONS'), /format/);
  assert.throws(() => prepareFile('test.cif', 'data_empty'), /invalid/);
});
