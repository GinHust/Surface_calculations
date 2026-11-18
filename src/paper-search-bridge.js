/* Keep online search outside the sandboxed calculation app. */
(function () {
  'use strict';
  const app=document.getElementById('codex-visualization');
  const dialog=document.getElementById('paper-search-dialog');
  const searchFrame=document.getElementById('paper-search-frame');
  const fullPage=document.getElementById('paper-search-full');
  let lastQuery=null,previousFocus=null,pendingPaper=null,analyzing=false;
  const pendingKey='surface-paper-to-read-v1';
  try{const raw=sessionStorage.getItem(pendingKey);if(raw){pendingPaper=JSON.parse(raw);sessionStorage.removeItem(pendingKey);}}catch(_){}
  function deliverPaper(paper){app.contentWindow.postMessage({type:'surface-paper-selected',paper},'*');if(dialog.open)dialog.close();}
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
    if(event.source===searchFrame.contentWindow&&event.origin===window.location.origin&&event.data?.type==='surface-paper-selected'){
      const paper=event.data.paper;if(paper&&typeof paper.title==='string'&&JSON.stringify(paper).length<160000)deliverPaper(paper);return;
    }
    if(event.source!==app.contentWindow)return;
    if(event.data?.type==='surface-paper-search'){open(event.data.query);return;}
    if(event.data?.type==='surface-paper-reader-ready'){if(pendingPaper){deliverPaper(pendingPaper);pendingPaper=null;}return;}
    if(event.data?.type==='surface-paper-analysis'){
      const {requestId,endpoint,token,payload}=event.data;
      if(typeof requestId!=='string'||requestId.length>100)return;
      const reply=(value)=>app.contentWindow.postMessage({type:'surface-paper-analysis-result',requestId,...value},'*');
      (async()=>{
        if(analyzing){reply({error:'Another paper analysis is already running.'});return;}
        try{
          const url=new URL(endpoint);if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/analyze'||url.search||url.hash)throw Error('Use an HTTPS analysis service URL ending in /analyze.');
          if(typeof token!=='string'||token.length>1000||JSON.stringify(payload).length>1024*1024)throw Error('Invalid analysis request.');
          analyzing=true;const response=await fetch(url.href,{method:'POST',headers:{'Content-Type':'application/json',...(token?{'Authorization':'Bearer '+token}:{})},body:JSON.stringify(payload),signal:AbortSignal.timeout(225000)});
          const result=await response.json();if(!response.ok)throw Error(result.error||'Analysis service error ('+response.status+').');
          if(JSON.stringify(result).length>200000)throw Error('Analysis response exceeds the supported limit.');reply({analysis:result.analysis});
        }catch(error){reply({error:error.message||'Could not reach the analysis service.'});}finally{analyzing=false;}
      })();
    }
  });
})();
