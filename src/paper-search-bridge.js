/* Keep online search outside the sandboxed calculation app. */
(function () {
  'use strict';
  const app=document.getElementById('codex-visualization');
  const dialog=document.getElementById('paper-search-dialog');
  const searchFrame=document.getElementById('paper-search-frame');
  const fullPage=document.getElementById('paper-search-full');
  let lastQuery=null,previousFocus=null;
  function open(query) {
    query=(typeof query==='string'?query:'').trim().slice(0,300)||'nitrogen incorporation diamond';
    const url=new URL('./literature-search.html',window.location.href);
    url.searchParams.set('q',query);
    fullPage.href=url.href;
    url.searchParams.set('embedded','1');
    if(lastQuery!==query){searchFrame.src=url.href;lastQuery=query;}
    if(!dialog.open){previousFocus=document.activeElement;dialog.showModal();}
  }
  document.getElementById('paper-search-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>previousFocus?.focus());
  window.addEventListener('message',event=>{
    if(event.source!==app.contentWindow||event.data?.type!=='surface-paper-search')return;
    open(event.data.query);
  });
})();
