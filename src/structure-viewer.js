/* 3Dmol.js integration. Coordinates stay in memory in this browser tab. */
(function (scope) {
  'use strict';
  const LIBRARY_URL = 'https://cdn.jsdelivr.net/npm/3dmol@2.5.5/build/3Dmol-min.js';
  const MAX_ATOMS = 10000;
  const MAX_BYTES = 5 * 1024 * 1024;
  const elements = new Set(('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og').split(' '));
  const fail = key => { throw new Error(key); };
  const tokens = line => (line || '').trim().split(/\s+/);
  const number = value => Number(String(value).replace(/[dD]/g, 'e'));
  function triple(line) {
    const values = tokens(line).slice(0, 3).map(number);
    if (values.length !== 3 || values.some(v => !Number.isFinite(v))) fail('invalid');
    return values;
  }
  function determinant(m) {
    const [a, b, c] = m;
    return a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
  }
  // Normalize VASP scaling to 1 before passing to 3Dmol, whose VASP parser
  // does not support negative volumes or three independent scale factors.
  function normalizePOSCAR(text) {
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
    if (lines.length < 8) fail('invalid');
    const scale = tokens(lines[1]).map(number);
    const lattice = lines.slice(2, 5).map(triple);
    const volume = Math.abs(determinant(lattice));
    if (!Number.isFinite(volume) || volume < 1e-12) fail('invalid');
    if (![1, 3].includes(scale.length) || scale.some(v => !Number.isFinite(v) || v === 0)) fail('invalid');
    if (scale.length === 3 && scale.some(v => v < 0)) fail('invalid');
    const s = scale.length === 3 ? scale : Array(3).fill(scale[0] < 0 ? Math.cbrt(-scale[0] / volume) : scale[0]);
    const species = tokens(lines[5]);
    if (species.every(v => /^\d+$/.test(v))) fail('species');
    if (species.some(v => !elements.has(v))) fail('species');
    const counts = tokens(lines[6]).map(Number);
    if (counts.length !== species.length || counts.some(v => !Number.isSafeInteger(v) || v < 0)) fail('invalid');
    const count = counts.reduce((a, b) => a + b, 0);
    if (count < 1) fail('invalid');
    if (count > MAX_ATOMS) fail('limit');
    let start = 7;
    if (/^s/i.test(lines[start].trim())) start++;
    const mode = (lines[start] || '').trim();
    if (!/^[dck]/i.test(mode)) fail('invalid');
    const cartesian = /^[ck]/i.test(mode);
    const positions = lines.slice(start + 1, start + 1 + count).map(triple);
    if (positions.length !== count) fail('invalid');
    return [lines[0].trim() || 'Structure', '1', ...lattice.map(v => v.map((x, i) => x * s[i]).join(' ')), species.join(' '), counts.join(' '), cartesian ? 'Cartesian' : 'Direct', ...positions.map(v => v.map((x, i) => cartesian ? x * s[i] : x).join(' '))].join('\n');
  }
  function prepareFile(name, text) {
    if (!text.trim()) fail('invalid');
    if (text.length > MAX_BYTES) fail('size');
    if (/\.xyz$/i.test(name)) {
      const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
      const count = Number(lines[0].trim());
      if (!Number.isSafeInteger(count) || count < 1) fail('invalid');
      if (count > MAX_ATOMS) fail('limit');
      if (lines.length < count + 2) fail('invalid');
      const positions = lines.slice(2, count + 2).map(line => {
        const [elem, ...coords] = tokens(line);
        if (!elements.has(elem)) fail('species');
        return elem + ' ' + triple(coords.join(' ')).join(' ');
      });
      return {format: 'xyz', text: [count, lines[1], ...positions].join('\n')};
    }
    if (/\.cif$/i.test(name)) {
      if (!/_atom_site_(?:fract|Cartn)[_.]x\b/i.test(text)) fail('invalid');
      return {format: 'cif', text};
    }
    if (/\.(?:vasp|poscar|contcar)$/i.test(name) || /^(?:POSCAR|CONTCAR)(?:[._-].*)?$/i.test(name)) {
      return {format: 'vasp', text: normalizePOSCAR(text)};
    }
    fail('format');
  }
  const demo = ['Diamond cubic cell - ideal geometry, visualization only', '3.567', '1 0 0', '0 1 0', '0 0 1', 'C', '8', 'Direct', '0 0 0', '0 .5 .5', '.5 0 .5', '.5 .5 0', '.25 .25 .25', '.25 .75 .75', '.75 .25 .75', '.75 .75 .25'].join('\n');
  const labels = {
    title: ['원자 구조 뷰어', 'Atomic Structure Viewer'],
    choose: ['구조 파일 열기', 'Open structure file'],
    sample: ['다이아몬드 예제', 'Diamond example'],
    formats: ['POSCAR / CONTCAR · .vasp · .cif · .xyz (첫 프레임) · 최대 5 MB / 10,000 원자', 'POSCAR / CONTCAR · .vasp · .cif · .xyz (first frame) · Up to 5 MB / 10,000 atoms'],
    top: ['위 · XY', 'Top · XY'], front: ['앞 · XZ', 'Front · XZ'], side: ['옆 · YZ', 'Side · YZ'], free: ['자유 회전', 'Free rotation'],
    fit: ['화면 맞춤', 'Fit'], plus: ['확대', 'Zoom in'], minus: ['축소', 'Zoom out'],
    cell: ['단위 셀', 'Unit cell'], bonds: ['추정 결합', 'Inferred bonds'],
    png: ['PNG 저장', 'Save PNG'], clear: ['구조 지우기', 'Clear structure'],
    empty: ['파일을 열거나 다이아몬드 예제를 선택하세요.', 'Open a file or choose the diamond example.'],
    loading: ['구조를 불러오는 중…', 'Loading structure…'],
    hint: ['직교 투영 · XY/XZ/YZ는 파일의 Cartesian 축 기준입니다. 자유 회전에서는 드래그로 회전합니다.', 'Orthographic projection · XY/XZ/YZ follow the file’s Cartesian axes. Drag to rotate in Free rotation mode.'],
    privacy: ['파일은 이 탭에서만 처리됩니다. 새로고침 후 다시 열어 주세요. 결합은 거리로 추정하며 계산 입력 검증을 의미하지 않습니다.', 'Files are processed in this tab only; reopen after refreshing. Bonds are inferred from distance. Viewing does not validate calculation inputs.'],
    demo: ['이상적 다이아몬드 단위 셀 예제 · 표면 slab 또는 계산 결과가 아닙니다.', 'Ideal diamond unit-cell example · Not a surface slab or a calculation result.'],
    loaded: ['원자', 'atoms'], noCell: ['셀 정보 없음', 'No cell data'],
    format: ['지원 형식: POSCAR, CONTCAR, .vasp, .cif, .xyz. QE .in은 먼저 변환해 주세요.', 'Use POSCAR, CONTCAR, .vasp, .cif or .xyz. Convert QE .in files first.'],
    invalid: ['구조를 읽을 수 없습니다. 원자 수, 셀 및 좌표를 확인하세요.', 'Could not read this structure. Check the atom count, cell and coordinates.'],
    species: ['원소 기호를 확인하세요. POSCAR에는 원소 이름 행이 필요합니다.', 'Check element symbols. POSCAR must include an element-name line.'],
    size: ['최대 파일 크기는 5 MB입니다.', 'The maximum file size is 5 MB.'],
    limit: ['최대 10,000개 원자를 표시할 수 있습니다.', 'This viewer supports up to 10,000 atoms.'],
    library: ['뷰어 라이브러리를 불러오지 못했습니다. 인터넷 연결을 확인하고 다시 열어 주세요.', 'Could not load the viewer library. Check your internet connection and reopen the file.'],
    webgl: ['WebGL을 사용할 수 없습니다. 하드웨어 가속을 지원하는 브라우저에서 열어 주세요.', 'WebGL is unavailable. Open in a browser with hardware acceleration.'],
    export: ['이미지를 저장하지 못했습니다.', 'Could not save the image.']
  };
  let libraryPromise;
  function loadLibrary() {
    if (scope.$3Dmol) return Promise.resolve(scope.$3Dmol);
    if (!libraryPromise) libraryPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const timer = setTimeout(() => done(false), 20000);
      function done(ok) {
        clearTimeout(timer);
        script.onload = script.onerror = null;
        if (ok && scope.$3Dmol) resolve(scope.$3Dmol);
        else { script.remove(); libraryPromise = null; reject(new Error('library')); }
      }
      script.src = LIBRARY_URL;
      script.onload = () => done(true);
      script.onerror = () => done(false);
      document.head.appendChild(script);
    });
    return libraryPromise;
  }
  function create({onLoad, onClear} = {}) {
    const panel = document.createElement('section');
    panel.className = 'panel structure-panel';
    panel.dataset.userContent = '';
    panel.innerHTML = `<div class="row between"><h2 data-sv-text="title"></h2><a href="https://3dmol.org/" target="_blank" rel="noopener noreferrer">3Dmol.js</a></div>
      <div class="row"><label class="structure-file"><span data-sv-text="choose"></span><input type="file" data-sv-file aria-describedby="sv-formats"></label><button type="button" class="button" data-sv-action="sample" data-sv-text="sample"></button></div>
      <p class="small" id="sv-formats" data-sv-text="formats"></p>
      <div class="tabs structure-toolbar" role="group"><button type="button" class="button" data-sv-view="top" data-sv-text="top"></button><button type="button" class="button" data-sv-view="front" data-sv-text="front"></button><button type="button" class="button" data-sv-view="side" data-sv-text="side"></button><button type="button" class="button" data-sv-view="free" data-sv-text="free"></button><button type="button" class="button" data-sv-action="fit" data-sv-text="fit"></button><button type="button" class="button" data-sv-action="plus" data-sv-text="plus"></button><button type="button" class="button" data-sv-action="minus" data-sv-text="minus"></button></div>
      <div class="structure-stage"><div class="structure-canvas" role="img"></div><div class="structure-empty" data-sv-text="empty"></div></div>
      <p class="small structure-status" role="status" aria-live="polite"></p><p class="small structure-error" role="alert" hidden></p>
      <div class="row between"><div class="row"><label class="check"><input type="checkbox" data-sv-cell checked><span data-sv-text="cell"></span></label><label class="check"><input type="checkbox" data-sv-bonds checked><span data-sv-text="bonds"></span></label></div><div class="row"><button type="button" class="button" data-sv-action="png" data-sv-text="png"></button><button type="button" class="button" data-sv-action="clear" data-sv-text="clear"></button></div></div>
      <p class="small structure-note" data-sv-text="hint"></p><p class="small" data-sv-text="privacy"></p>`;
    const canvas = panel.querySelector('.structure-canvas');
    const status = panel.querySelector('.structure-status');
    const error = panel.querySelector('.structure-error');
    const cell = panel.querySelector('[data-sv-cell]');
    const bonds = panel.querySelector('[data-sv-bonds]');
    let locale = 'en', viewer, model, record, angle = 'top', pending = false, request = 0, errorKey = '';
    const t = key => labels[key][locale === 'en' ? 1 : 0];
    function update() {
      panel.querySelectorAll('[data-sv-text]').forEach(el => { el.textContent = t(el.dataset.svText); });
      canvas.setAttribute('aria-label', t('title') + ' · ' + t(angle));
      panel.querySelector('.structure-empty').hidden = Boolean(model);
      panel.querySelector('.structure-empty').textContent = t(pending ? 'loading' : 'empty');
      panel.querySelectorAll('button').forEach(b => { b.disabled = pending || (!model && b.dataset.svAction !== 'sample'); });
      panel.querySelectorAll('[data-sv-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.svView === angle)));
      cell.disabled = pending || !record?.hasCell;
      bonds.disabled = pending || !model;
      status.textContent = pending ? t('loading') : record ? `${record.name} · ${record.count} ${t('loaded')} · ${record.hasCell ? 'Å' : t('noCell')}${record.demo ? ' · ' + t('demo') : ''}` : '';
      error.hidden = !errorKey;
      error.textContent = errorKey ? t(errorKey) : '';
    }
    function orient(next) {
      angle = next;
      if (!viewer || !model) return;
      viewer.setConfig({disableMouse: next !== 'free'});
      viewer.setProjection('orthographic');
      const view = viewer.getView();
      // Quaternion components occupy indices 4–7 (x,y,z,w).
      view.splice(4, 4, 0, 0, 0, 1);
      viewer.setView(view);
      if (next === 'front') viewer.rotate(90, 'x');
      if (next === 'side') viewer.rotate(90, 'y');
      if (next === 'free') { viewer.rotate(60, 'x'); viewer.rotate(30, 'y'); }
      viewer.zoomTo();
      viewer.render();
      update();
    }
    function style() {
      if (!model) return;
      viewer.setStyle({}, {sphere: {scale: .28, colorscheme: 'Jmol'}, ...(bonds.checked ? {stick: {radius: .1, colorscheme: 'Jmol'}} : {})});
      viewer.removeUnitCell(model);
      if (cell.checked && record.hasCell) viewer.addUnitCell(model, {box: {color: '#5b8496'}, alabel: 'a', blabel: 'b', clabel: 'c'});
      viewer.render();
    }
    async function load(name, read, isDemo = false) {
      const token = ++request;
      pending = true; errorKey = ''; update();
      let candidate;
      try {
        const text = await read();
        if (token !== request) return;
        const prepared = prepareFile(name, text);
        const lib = await loadLibrary();
        if (token !== request) return;
        if (!viewer) {
          try { viewer = lib.createViewer(canvas, {backgroundColor: '#f7fafb', antialias: true, orthographic: true, disableMouse: true}); }
          catch (_) { fail('webgl'); }
          if (!viewer) fail('webgl');
        }
        candidate = viewer.addModel(prepared.text, prepared.format, {doAssembly: true, duplicateAssemblyAtoms: true, normalizeAssembly: true});
        const atoms = candidate.selectedAtoms({});
        if (!atoms.length || atoms.some(a => !elements.has(a.elem) || ![a.x, a.y, a.z].every(Number.isFinite))) fail('invalid');
        if (atoms.length > MAX_ATOMS) fail('limit');
        if (model) { viewer.removeUnitCell(model); viewer.removeModel(model); }
        model = candidate; candidate = null;
        record = {name, count: atoms.length, hasCell: Boolean(model.getCrystData()), demo: isDemo, format: prepared.format, text: prepared.format === 'vasp' ? text : null};
        style(); orient('top');
        onLoad?.(record);
      } catch (err) {
        if (candidate) viewer.removeModel(candidate);
        if (token === request) errorKey = labels[err.message] ? err.message : 'invalid';
      } finally {
        if (token === request) { pending = false; update(); }
      }
    }
    panel.addEventListener('change', e => {
      if (e.target.matches('[data-sv-file]')) {
        const file = e.target.files[0];
        e.target.value = '';
        if (file) load(file.name, () => { if (file.size > MAX_BYTES) fail('size'); return file.text(); });
      } else if (e.target === cell || e.target === bonds) style();
    });
    panel.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      if (b.dataset.svView) { orient(b.dataset.svView); return; }
      switch (b.dataset.svAction) {
        case 'sample': load('diamond-demo.vasp', () => Promise.resolve(demo), true); break;
        case 'fit': viewer.zoomTo(); viewer.render(); break;
        case 'plus': viewer.zoom(1.2); viewer.render(); break;
        case 'minus': viewer.zoom(1 / 1.2); viewer.render(); break;
        case 'clear':
          request++; viewer.removeUnitCell(model); viewer.removeAllModels(); viewer.render();
          model = record = null; errorKey = ''; update(); onClear?.(); break;
        case 'png':
          try { const a = document.createElement('a'); viewer.render(); a.href = viewer.pngURI(); a.download = record.name.replace(/\.[^.]+$/, '') + '-' + angle + '.png'; a.click(); }
          catch (_) { errorKey = 'export'; update(); }
          break;
      }
    });
    // Keep one canvas/context while the surrounding app rerenders or changes pages.
    new ResizeObserver(() => { if (viewer && canvas.isConnected && canvas.clientWidth) { viewer.resize(); viewer.render(); } }).observe(canvas);
    return {
      loadFile(name, text) { return load(name, () => Promise.resolve(text)); },
      mount(host, nextLocale) { locale = 'en'; host.appendChild(panel); update(); if (viewer) { viewer.resize(); viewer.render(); } }
    };
  }
  const api = {create, prepareFile, normalizePOSCAR, demo};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else scope.SurfaceStructureViewer = api;
})(globalThis);
