const AGENTS=[
 {id:'finance',ico:'💰',name:'재정매니저',color:'blue',desc:'수입·지출·예산·저축·현금흐름을 정리해요.',ask:'"예산 짜줘"',hint:'가계부, 지출 내역 등'},
 {id:'investing',ico:'📈',name:'투자매니저',color:'green',desc:'자산배분·종목 비교·투자 일지로 감정매매를 줄여요.',ask:'"포트폴리오 점검"',hint:'투자 일지, 종목 자료 등'},
 {id:'reading',ico:'📚',name:'독서큐레이터',color:'orange',desc:'책 추천, 독서 계획, 핵심 정리와 글쓰기까지.',ask:'"책 추천해줘"',hint:'독서 노트, 읽을 책 목록 등'},
 {id:'routine',ico:'🌤️',name:'루틴매니저',color:'pink',desc:'아침·저녁 루틴과 주간 계획, 실천 점검을 도와요.',ask:'"오늘 점검"',hint:'주간 계획, 습관 기록 등'},
 {id:'english',ico:'🗣️',name:'영어공부매니저',color:'purple',desc:'수준에 맞는 학습, 대화 연습, 자연스러운 교정.',ask:'"오늘 영어"',hint:'학습 자료, 표현 노트 등'}
];
const $=s=>document.querySelector(s);
const esc=t=>t.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const size=n=>n<1024?n+' B':n<1048576?(n/1024).toFixed(1)+' KB':(n/1048576).toFixed(1)+' MB';

// ---- IndexedDB (브라우저 로컬 저장)
let dbp;
function db(){return dbp||(dbp=new Promise((res,rej)=>{
  const r=indexedDB.open('sigan-yeohaeng',1);
  r.onupgradeneeded=()=>r.result.createObjectStore('files',{keyPath:'id',autoIncrement:true}).createIndex('agent','agent');
  r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);
}));}
async function tx(mode,fn){const d=await db();return new Promise((res,rej)=>{
  const t=d.transaction('files',mode),st=t.objectStore('files'),q=fn(st);
  t.oncomplete=()=>res(q&&q.result);t.onerror=()=>rej(t.error);});}
const list=a=>tx('readonly',st=>st.index('agent').getAll(a));
const add=f=>tx('readwrite',st=>st.add(f));
const del=id=>tx('readwrite',st=>st.delete(id));
const get=id=>tx('readonly',st=>st.get(id));

// ---- UI
let cur=AGENTS[0].id;
function renderTabs(){
  $('#tabs').innerHTML=AGENTS.map(a=>`<button role="tab" class="tab ${a.id===cur?'on':''}" data-id="${a.id}">${a.ico} ${a.name}</button>`).join('');
}
async function renderPanel(){
  const a=AGENTS.find(x=>x.id===cur), files=(await list(cur)).sort((x,y)=>y.added-x.added);
  $('#panel').innerHTML=`
   <div class="head c-${a.color}"><div class="ico">${a.ico}</div>
     <div><h3>${a.name}</h3><p>${a.desc}</p><code>${a.ask}</code></div></div>
   <label class="drop" id="drop">
     <input type="file" id="file" multiple hidden>
     <b>＋ 자료 올리기</b><span>파일을 끌어다 놓거나 눌러서 선택 · ${a.hint}</span>
   </label>
   <ul class="files">${files.length?files.map(f=>`
     <li><span class="fn">📄 ${esc(f.name)}</span><span class="fs">${size(f.size)}</span>
     <button data-dl="${f.id}">받기</button><button data-rm="${f.id}" class="rm">삭제</button></li>`).join('')
     :'<li class="empty">아직 올린 자료가 없어요.</li>'}</ul>`;
  const drop=$('#drop'),inp=$('#file');
  inp.onchange=()=>upload(inp.files);
  ['dragover','dragenter'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('over')}));
  ['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('over')}));
  drop.addEventListener('drop',e=>upload(e.dataTransfer.files));
}
async function upload(fs){
  for(const f of fs){
    if(f.size>50*1048576){alert(f.name+' — 50MB를 넘어서 올릴 수 없어요.');continue;}
    await add({agent:cur,name:f.name,type:f.type,size:f.size,added:Date.now(),blob:f});
  }
  renderPanel();
}
$('#tabs').onclick=e=>{const b=e.target.closest('.tab');if(!b)return;cur=b.dataset.id;history.replaceState(null,'','#'+cur);renderTabs();renderPanel();};
$('#panel').onclick=async e=>{
  const dl=e.target.dataset.dl,rm=e.target.dataset.rm;
  if(dl){const f=await get(+dl),a=document.createElement('a');a.href=URL.createObjectURL(f.blob);a.download=f.name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
  if(rm&&confirm('이 자료를 삭제할까요?')){await del(+rm);renderPanel();}
};
const h=location.hash.slice(1);if(AGENTS.some(a=>a.id===h))cur=h;
renderTabs();renderPanel().catch(()=>{$('#panel').innerHTML='<p class="note">이 브라우저에서는 자료 저장을 쓸 수 없어요.</p>';});
