const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

test('paper search accepts only app messages and preserves results when reopened with the same query',()=>{
  const events={},closeEvents={},buttonEvents={};
  const app={contentWindow:{}};
  let opens=0,loads=0,focuses=0,lastURL='';
  const dialog={open:false,showModal(){this.open=true;opens++;},close(){this.open=false;closeEvents.close();},addEventListener:(type,fn)=>closeEvents[type]=fn};
  const searchFrame={set src(value){loads++;lastURL=value;}};
  const fullPage={href:''};
  const elements={'codex-visualization':app,'paper-search-dialog':dialog,'paper-search-frame':searchFrame,'paper-search-full':fullPage,'paper-search-close':{addEventListener:(type,fn)=>buttonEvents[type]=fn}};
  const context={URL,document:{getElementById:id=>elements[id],activeElement:{focus:()=>focuses++}},window:{location:{href:'https://example.com/lab/index.html'},addEventListener:(type,fn)=>events[type]=fn}};
  new vm.Script(fs.readFileSync(require.resolve('../src/paper-search-bridge.js'),'utf8')).runInNewContext(context);
  events.message({source:{},data:{type:'surface-paper-search',query:'untrusted'}});assert.equal(opens,0);
  const query='diamond N & CH3 <script>test</script>';
  events.message({source:app.contentWindow,data:{type:'surface-paper-search',query}});
  assert.equal(opens,1);const url=new URL(lastURL);assert.equal(url.origin,'https://example.com');assert.equal(url.pathname,'/lab/literature-search.html');assert.equal(url.searchParams.get('q'),query);assert.equal(url.searchParams.get('embedded'),'1');
  assert.equal(new URL(fullPage.href).searchParams.get('embedded'),null);
  buttonEvents.click();assert.equal(dialog.open,false);assert.equal(focuses,1);
  events.message({source:app.contentWindow,data:{type:'surface-paper-search',query}});assert.equal(opens,2);assert.equal(loads,1);
  events.message({source:app.contentWindow,data:{type:'surface-paper-search',query:'x'.repeat(1000)}});assert.equal(new URL(lastURL).searchParams.get('q').length,300);
});

test('embedded literature search inherits keywords and keeps online results above the reference collection',()=>{
  const source=fs.readFileSync(require.resolve('../src/literature-search.html'),'utf8');
  const query={value:''},classes=[];
  const setup=source.slice(source.indexOf('var $='),source.indexOf('var translations='));
  new vm.Script(setup).runInNewContext({URLSearchParams,window:{location:{search:'?embedded=1&q=diamond%20nitrogen'}},document:{getElementById:()=>query,body:{classList:{add:value=>classes.push(value)}}}});
  assert.equal(query.value,'diamond nitrogen');assert.deepEqual(classes,['embedded']);
  assert(source.includes('body.embedded #curatedReferences{display:none}'));
  assert(source.includes('<details class="panel" id="curatedReferences">'));
  for(const m of source.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
  const app=fs.readFileSync(require.resolve('../src/app.html'),'utf8');assert(app.includes('Find papers online'));assert(app.includes('Find related papers'));assert(!app.includes('class="nav" data-go="plan"'));
});

test('selected papers transfer only from the same-origin search iframe and pending standalone selection waits for app readiness',()=>{
  const events={},sent=[],paper={title:'Selected paper',abstract:'A test abstract.'},app={contentWindow:{postMessage:value=>sent.push(value)}},search={contentWindow:{}};
  const dialog={open:true,close(){this.open=false;},addEventListener(){}};
  const elements={'codex-visualization':app,'paper-search-dialog':dialog,'paper-search-frame':search,'paper-search-full':{},'paper-search-close':{addEventListener(){}}};
  const context={URL,JSON,sessionStorage:{getItem:()=>JSON.stringify(paper),removeItem(){}},document:{getElementById:id=>elements[id]},window:{location:{href:'https://example.com/index.html',origin:'https://example.com'},addEventListener:(k,fn)=>events[k]=fn}};
  new vm.Script(fs.readFileSync(require.resolve('../src/paper-search-bridge.js'),'utf8')).runInNewContext(context);
  events.message({source:search.contentWindow,origin:'https://evil.example',data:{type:'surface-paper-selected',paper}});assert.equal(sent.length,0);
  events.message({source:app.contentWindow,data:{type:'surface-paper-reader-ready'}});assert.equal(sent.length,1);assert.equal(sent[0].paper.title,paper.title);assert.equal(dialog.open,false);
  events.message({source:search.contentWindow,origin:'https://example.com',data:{type:'surface-paper-selected',paper}});assert.equal(sent.length,2);
});
