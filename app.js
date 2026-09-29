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

// ---- 로컬 저장 (IndexedDB, 이 기기 브라우저 안)
let dbp;
function db(){return dbp||(dbp=new Promise((res,rej)=>{
  const r=indexedDB.open('sigan-yeohaeng',1);
  r.onupgradeneeded=()=>r.result.createObjectStore('files',{keyPath:'id',autoIncrement:true}).createIndex('agent','agent');
  r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);
}));}
async function tx(mode,fn){const d=await db();return new Promise((res,rej)=>{
  const t=d.transaction('files',mode),st=t.objectStore('files'),q=fn(st);
  t.oncomplete=()=>res(q&&q.result);t.onerror=()=>rej(t.error);});}
const lList=a=>tx('readonly',st=>st.index('agent').getAll(a));
const lAdd=f=>tx('readwrite',st=>st.add(f));
const lDel=id=>tx('readwrite',st=>st.delete(id));
const lGet=id=>tx('readonly',st=>st.get(id));

// ---- 클라우드 저장 (비공개 GitHub 저장소) — 토큰은 이 기기 브라우저에만 저장
const CFG_KEY='sigan-cloud';
const DEFAULT_REPO='captinysk-cloud/sigan-yeohaeng-data';
const cfg=()=>{try{return JSON.parse(localStorage.getItem(CFG_KEY)||'null')}catch(e){return null}};
const enc=p=>p.split('/').map(encodeURIComponent).join('/');
async function gh(path,opt={}){
  const c=cfg();
  const r=await fetch('https://api.github.com/repos/'+c.repo+'/contents/'+path,
    {...opt,headers:{Authorization:'Bearer '+c.token,Accept:'application/vnd.github+json',...(opt.headers||{})}});
  if(!r.ok&&r.status!==404)throw new Error('GitHub '+r.status);
  return r;
}
const toB64=f=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(',')[1]);r.onerror=rej;r.readAsDataURL(f)});
const PREFIX=/^(\d+)__(.*)$/;
async function cList(a){
  const r=await gh(enc(a));if(r.status===404)return[];
  return(await r.json()).filter(x=>x.type==='file').map(x=>{
    const m=x.name.match(PREFIX);
    return{id:x.path+'|'+x.sha,name:m?m[2]:x.name,size:x.size,added:m?+m[1]:0};});
}
async function cAdd(f){
  const path=f.agent+'/'+f.added+'__'+f.name;
  const r=await gh(enc(path),{method:'PUT',body:JSON.stringify({message:'upload '+f.name,content:await toB64(f.blob)})});
  if(r.status===404)throw new Error('저장소를 찾을 수 없어요');
}
async function cDel(id){const[path,sha]=id.split('|');await gh(enc(path),{method:'DELETE',body:JSON.stringify({message:'delete',sha})});}
async function cGet(id){
  const path=id.split('|')[0];
  const r=await gh(enc(path),{headers:{Accept:'application/vnd.github.raw'}});
  const base=path.split('/').pop(),m=base.match(PREFIX);
  return{name:m?m[2]:base,blob:await r.blob()};
}
const cloud=()=>!!cfg();
const list=a=>cloud()?cList(a):lList(a);
const add=f=>cloud()?cAdd(f):lAdd(f);
const del=id=>cloud()?cDel(id):lDel(id);
const get=id=>cloud()?cGet(id):lGet(id);
const key=v=>cloud()?v:+v;

// ---- 탭 · 패널
let cur=AGENTS[0].id;
function renderTabs(){
  $('#tabs').innerHTML=AGENTS.map(a=>`<button role="tab" class="tab ${a.id===cur?'on':''}" data-id="${a.id}">${a.ico} ${a.name}</button>`).join('');
}
async function renderPanel(){
  const a=AGENTS.find(x=>x.id===cur);
  let files,loadErr='';
  try{files=(await list(cur)).sort((x,y)=>y.added-x.added);}
  catch(e){files=[];loadErr=`<p class="err">자료를 불러오지 못했어요 (${esc(e.message)}). 토큰을 확인해 주세요.</p>`;}
  $('#panel').innerHTML=`
   <div class="head c-${a.color}"><div class="ico">${a.ico}</div>
     <div><h3>${a.name}</h3><p>${a.desc}</p><code>${a.ask}</code></div></div>
   <label class="drop" id="drop">
     <input type="file" id="file" multiple hidden>
     <b>＋ 자료 올리기</b><span>파일을 끌어다 놓거나 눌러서 선택 · ${a.hint}</span>
   </label>${loadErr}
   <ul class="files">${files.length?files.map(f=>`
     <li><span class="fn">📄 ${esc(f.name)}</span><span class="fs">${size(f.size)}</span>
     <button data-dl="${esc(String(f.id))}">받기</button><button data-rm="${esc(String(f.id))}" class="rm">삭제</button></li>`).join('')
     :'<li class="empty">아직 올린 자료가 없어요.</li>'}</ul>`;
  const drop=$('#drop'),inp=$('#file');
  inp.onchange=()=>upload(inp.files);
  ['dragover','dragenter'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('over')}));
  ['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('over')}));
  drop.addEventListener('drop',e=>upload(e.dataTransfer.files));
}
async function upload(fs){
  const max=cloud()?25:50;
  for(const f of fs){
    if(f.size>max*1048576){alert(f.name+' — '+max+'MB를 넘어서 올릴 수 없어요.');continue;}
    try{await add({agent:cur,name:f.name,type:f.type,size:f.size,added:Date.now(),blob:f});}
    catch(e){alert(f.name+' 올리기 실패: '+e.message);}
  }
  renderPanel();
}
$('#tabs').onclick=e=>{const b=e.target.closest('.tab');if(!b)return;cur=b.dataset.id;history.replaceState(null,'','#'+cur);renderTabs();renderPanel();};
$('#panel').onclick=async e=>{
  const dl=e.target.dataset.dl,rm=e.target.dataset.rm;
  if(dl){
    try{const f=await get(key(dl)),a=document.createElement('a');
      a.href=URL.createObjectURL(f.blob);a.download=f.name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
    catch(err){alert('받기 실패: '+err.message);}
  }
  if(rm&&confirm('이 자료를 삭제할까요?')){
    try{await del(key(rm));}catch(err){alert('삭제 실패: '+err.message);}
    renderPanel();
  }
};

// ---- 여러 기기 동기화
function renderSync(){
  const c=cfg(),el=$('#sync');
  if(c){
    el.innerHTML=`<div class="sync-on">☁️ <b>여러 기기 동기화 켜짐</b> · ${esc(c.repo)} <button id="mig">이 기기 자료 옮기기</button> <button id="off">연결 해제</button></div>`;
    $('#off').onclick=()=>{if(confirm('이 기기에서 연결을 해제할까요? (저장소의 자료는 그대로 남아요)')){localStorage.removeItem(CFG_KEY);renderSync();renderPanel();}};
    $('#mig').onclick=migrate;
  }else{
    el.innerHTML=`<details><summary>☁️ 여러 기기에서 쓰기</summary><div class="sync-form">
     <p>비공개 GitHub 저장소를 자료 보관함으로 써요. 기기마다 한 번씩 연결하면 어디서든 같은 자료가 보여요.</p>
     <ol><li>GitHub → Settings → Developer settings → <b>Fine-grained tokens</b>에서 새 토큰을 만들어요.</li>
     <li>Repository access는 <b>${DEFAULT_REPO.split('/')[1]}</b> 하나만, Permissions → <b>Contents: Read and write</b>로 설정해요.</li>
     <li>만든 토큰을 아래에 붙여넣어요. 토큰은 이 기기 브라우저에만 저장돼요.</li></ol>
     <input id="repo" value="${DEFAULT_REPO}" aria-label="저장소">
     <input id="tok" type="password" placeholder="github_pat_..." aria-label="토큰" autocomplete="off">
     <button id="on" class="btn-s">연결하기</button><p class="err" id="serr"></p></div></details>`;
    $('#on').onclick=connect;
  }
}
async function connect(){
  const repo=$('#repo').value.trim(),token=$('#tok').value.trim(),err=$('#serr');
  if(!repo||!token){err.textContent='저장소와 토큰을 모두 입력해 주세요.';return;}
  err.textContent='확인 중…';
  try{
    const r=await fetch('https://api.github.com/repos/'+repo,{headers:{Authorization:'Bearer '+token}});
    if(!r.ok)throw new Error('접근 실패('+r.status+')');
    const info=await r.json();
    if(!info.private){err.textContent='공개 저장소예요. 자료가 노출되니 비공개 저장소만 연결할 수 있어요.';return;}
    if(info.permissions&&!info.permissions.push){err.textContent='쓰기 권한이 없어요. Contents: Read and write를 확인해 주세요.';return;}
    localStorage.setItem(CFG_KEY,JSON.stringify({repo,token}));
    renderSync();renderPanel();
  }catch(e){err.textContent='연결 실패: '+e.message;}
}
async function migrate(){
  let n=0;
  try{for(const a of AGENTS)for(const f of await lList(a.id)){await cAdd(f);await lDel(f.id);n++;}}
  catch(e){alert('옮기기 중단: '+e.message);}
  alert(n?n+'개 자료를 클라우드로 옮겼어요.':'옮길 자료가 없어요.');renderPanel();
}

const h=location.hash.slice(1);if(AGENTS.some(a=>a.id===h))cur=h;
renderTabs();renderSync();
renderPanel().catch(()=>{$('#panel').innerHTML='<p class="note">이 브라우저에서는 자료 저장을 쓸 수 없어요.</p>';});
