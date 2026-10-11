/* Anonymous, best-effort first touch. No cookies, names, full URLs or query text sent. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.UnityGrowth=api;api.start(root);}})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 const endpoint='https://unity-analytics.vercel.app/api/public/growth',key='unity-growth-v1',ttl=30*86400000;
 const sources=['google','instagram','line','tunagate','direct','other','unknown'];
 const validId=id=>typeof id==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id);
 function classify(url,referrer){
  try{const source=new URL(url).searchParams.get('utm_source');if(['google','instagram','line','tunagate'].includes(source))return source;}catch{}
  if(!referrer)return 'direct';
  try{const h=new URL(referrer).hostname.toLowerCase();if(['google.com','www.google.com','google.co.jp','www.google.co.jp'].includes(h))return 'google';if(['instagram.com','www.instagram.com','l.instagram.com'].includes(h))return 'instagram';if(['line.me','www.line.me','lin.ee'].includes(h))return 'line';if(['tunagate.com','www.tunagate.com'].includes(h))return 'tunagate';if(h==='nyokki519.github.io')return 'unknown';}catch{}
  return 'other';
 }
 function decorate(href,id,source){
  if(!validId(id))return href;
  try{const u=new URL(href);if(u.origin!=='https://nyokki519.github.io'||u.pathname!=='/Unity_S/')return href;u.searchParams.set('unity_journey',id);u.searchParams.set('unity_source',sources.includes(source)?source:'unknown');return u.href;}catch{return href;}
 }
 function createJourney(c,now){
  if(c.navigator?.doNotTrack==='1'||c.navigator?.globalPrivacyControl===true)return null;
  try{
   const u=new URL(c.url),isForm=u.origin==='https://nyokki519.github.io'&&u.pathname==='/Unity_S/';
   let previous;try{previous=JSON.parse(c.storage.getItem(key)||'null');}catch{}
   const forwarded=isForm?u.searchParams.get('unity_journey'):null;
   if(!validId(forwarded)&&previous&&validId(previous.id)&&sources.includes(previous.source)&&Number.isFinite(previous.createdAt)&&previous.createdAt<=now&&now-previous.createdAt<ttl)return previous;
   const id=validId(forwarded)?forwarded:c.uuid();if(!validId(id))return null;
   const source=validId(forwarded)&&sources.includes(u.searchParams.get('unity_source'))?u.searchParams.get('unity_source'):classify(c.url,c.referrer);
   const value={id,source,createdAt:now};c.storage.setItem(key,JSON.stringify(value));return value;
  }catch{return null;}
 }
 function start(w){
  if(w.location.origin!=='https://nyokki519.github.io'||!['/unityHP/','/unityHP/cafe-community/','/Unity_S/'].includes(w.location.pathname))return;
  let journey=null;try{journey=createJourney({navigator:w.navigator,url:w.location.href,referrer:w.document.referrer,storage:w.sessionStorage,uuid:()=>w.crypto.randomUUID()},Date.now());}catch{}if(!journey)return;
  const sent=new Set();let stopped=false;
  function record(stage){
   if(stopped||sent.has(stage)||!['visit','registration_click','form_view','form_submit'].includes(stage))return;sent.add(stage);
   try{w.fetch(endpoint,{method:'POST',mode:'cors',credentials:'omit',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify({journeyId:journey.id,source:journey.source,stage}),keepalive:true}).then(r=>{if(r.status===503)stopped=true;}).catch(()=>{});}catch{}
  }
  function links(){w.document.querySelectorAll('a[href]').forEach(a=>{const url=decorate(a.href,journey.id,journey.source);if(url!==a.href)a.href=url;});}
  const isForm=w.location.pathname==='/Unity_S/';record(isForm?'form_view':'visit');if(!isForm)links();
  w.document.addEventListener('click',e=>{const a=e.target?.closest?.('a[href]');if(!a)return;const decorated=decorate(a.href,journey.id,journey.source);try{const u=new URL(decorated);if(u.origin==='https://nyokki519.github.io'&&u.pathname==='/Unity_S/'){a.href=decorated;record('registration_click');}}catch{}},true);
  if(!isForm&&w.MutationObserver)new w.MutationObserver(links).observe(w.document.body,{childList:true,subtree:true});
  const form=isForm?w.document.getElementById('form'):null;
  if(form){
   const entry=w.UnityGrowthConfig?.formEntry;
   if(typeof entry==='string'&&/^entry\.\d{1,20}$/.test(entry)){const input=w.document.createElement('input');input.type='hidden';input.name=entry;input.value=journey.id;form.appendChild(input);}
   form.addEventListener('submit',()=>record('form_submit'),true);
   // The existing no-cors promise does NOT establish Google acceptance.
   if(w.history?.replaceState){try{const u=new URL(w.location.href);u.searchParams.delete('unity_journey');u.searchParams.delete('unity_source');w.history.replaceState(w.history.state,'',u.pathname+u.search+u.hash);}catch{}}
  }
 }
 return {classify,decorate,createJourney,start};
});
