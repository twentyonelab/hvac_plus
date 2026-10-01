/* =====================================================================
   HVAC+  — warstwa językowa PL ⇄ EN
   Silnik pisze teksty po polsku; ta warstwa podmienia je w locie:
   węzły tekstowe DOM, atrybuty (title / placeholder / aria-label / alt),
   napisy na canvasie (fillText / strokeText / measureText) i okna
   alert / confirm / prompt. Dzięki temu jeden kod obsługuje oba języki.
   Język: ?lang=en|pl w adresie > zapamiętany wybór > polski.
   Słownik: js/i18n-en.js (ładowany wcześniej).
   ===================================================================== */
(function(){
'use strict';
const LS='hvacplus.lang';
const qs=new URLSearchParams(location.search).get('lang');
let saved=null; try{ saved=localStorage.getItem(LS); }catch(e){}
let lang = (qs==='en'||qs==='pl') ? qs : (saved==='en'||saved==='pl') ? saved : 'pl';

/* ---- słownik: klucze normalizowane tak samo jak tekst wejściowy ---- */
const NUM=/\d+(?:[.,  ]\d+)*/g;
const norm=s=>s.replace(/\s+/g,' ').replace(NUM,'{n}');
const D=new Map(), DL=new Map();
const SRC=window.I18N_EN||{};
const EXACT=new Set();           // klucze z „=” — tylko pełne trafienie, nigdy fragment zdania
for(const k0 in SRC){
  const exact=k0[0]==='='&&k0.length>1, k=exact? k0.slice(1) : k0;
  const nk=norm(k.trim()); D.set(nk,SRC[k0]); if(exact) EXACT.add(nk);
  const lk=nk.toLowerCase(), up=nk===nk.toUpperCase()&&nk!==lk;
  if(!DL.has(lk)||!up) if(!(up&&DL.has(lk))) DL.set(lk,SRC[k0]);
}
/* fragmenty do podmiany w zdaniach składanych w locie — najdłuższe najpierw */
const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const frag=[...D.keys()].filter(k=>k.length>1 && !EXACT.has(k) && D.get(k)!==k && /[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]/.test(k)).sort((a,b)=>b.length-a.length);
const FRAG_RE=frag.length? new RegExp('(?<![\\p{L}\\p{N}])(?:'+frag.map(esc).join('|')+')(?![\\p{L}\\p{N}])','giu') : null;

/* liczby: polski przecinek dziesiętny w tekstach stałych → kropka */
function enNum(x){
  if(/^\d+,\d{1,2}$/.test(x)||/^\d+,\d{4,}$/.test(x)) return x.replace(',','.');
  return x.replace(/(\d)[  ](?=\d{3})/g,'$1,');
}
function fill(tpl,nums){ let i=0; return tpl.replace(/\{n\}/g,()=> i<nums.length? enNum(nums[i++]) : ''); }
const caseLike=(src,out)=>{
  if(src.length>1 && src===src.toUpperCase() && src!==src.toLowerCase()) return out.toUpperCase();
  if(src[0]===src[0].toLowerCase() && src[0]!==src[0].toUpperCase()) return out[0].toLowerCase()+out.slice(1);
  if(src[0]===src[0].toUpperCase()) return out[0].toUpperCase()+out.slice(1);
  return out;
};
function lookup(k){
  let v=D.get(k); if(v!=null) return v;
  v=DL.get(k.toLowerCase()); if(v!=null) return caseLike(k,v);
  return null;
}
const TPL=new Map();            // znormalizowany klucz → szablon EN (albo null = bez zmian)
function templ(key){
  if(TPL.has(key)) return TPL.get(key);
  let v=lookup(key);
  if(v==null && FRAG_RE){
    let hit=false;
    const r=key.replace(FRAG_RE,m=>{ const t=lookup(m); if(t==null) return m; hit=true; return t; });
    v=hit? r : null;
  }
  if(v!=null) v=v.replace(/„/g,'“');
  if(TPL.size>8000) TPL.clear();
  TPL.set(key,v); return v;
}
function tr(s){
  if(lang!=='en'||s==null) return s;
  s=String(s); if(!/[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]/.test(s)) return s;
  const m=/^(\s*)([\s\S]*?)(\s*)$/.exec(s), core=m[2];
  const nums=[]; const key=core.replace(/\s+/g,' ').replace(NUM,x=>{ nums.push(x); return '{n}'; });
  // wiele linii (alert, akapity szablonu): całość tylko przy dokładnym trafieniu, inaczej linia po linii
  if(core.indexOf('\n')>=0){
    const whole=lookup(key);
    if(whole==null) return s.split('\n').map(tr).join('\n');
    return m[1]+fill(whole.replace(/„/g,'“'),nums)+m[3];
  }
  const t=templ(key); if(t==null) return s;
  return m[1]+fill(t,nums)+m[3];
}

/* ---- DOM: tłumaczenie w miejscu, z pamięcią oryginału ---- */
const TXT=new WeakMap();        // węzeł tekstowy → {o: oryginał PL, t: tekst EN}
const ATR=new WeakMap();        // element → {attr: {o,t}}
const ATTRS=['title','placeholder','aria-label','alt'];
const SKIP=/^(SCRIPT|STYLE|TEXTAREA)$/;
function doText(n){
  const p=n.parentNode; if(!p||SKIP.test(p.nodeName)) return;
  const cur=n.data, rec=TXT.get(n);
  if(rec && rec.t===cur) return;
  const t=tr(cur); if(t===cur){ TXT.delete(n); return; }
  TXT.set(n,{o:cur,t}); n.data=t;
}
function doAttrs(el){
  for(const a of ATTRS){ if(!el.hasAttribute(a)) continue;
    const cur=el.getAttribute(a); let rec=ATR.get(el); const r=rec&&rec[a];
    if(r && r.t===cur) continue;
    const t=tr(cur); if(t===cur) continue;
    if(!rec){ rec={}; ATR.set(el,rec); } rec[a]={o:cur,t}; el.setAttribute(a,t);
  }
}
function walk(root){
  if(lang!=='en'||!root) return;
  if(root.nodeType===3){ doText(root); return; }
  if(root.nodeType!==1&&root.nodeType!==9&&root.nodeType!==11) return;
  if(root.nodeType===1){ if(SKIP.test(root.nodeName)) return; doAttrs(root); }
  const it=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);
  let n; while((n=it.nextNode())){
    if(n.nodeType===3) doText(n);
    else if(!SKIP.test(n.nodeName)) doAttrs(n);
  }
}
function restore(){
  const it=document.createTreeWalker(document.documentElement,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);
  let n; while((n=it.nextNode())){
    if(n.nodeType===3){ const r=TXT.get(n); if(r){ if(n.data===r.t) n.data=r.o; TXT.delete(n); } }
    else { const rec=ATR.get(n); if(rec){ for(const a in rec){ if(n.getAttribute(a)===rec[a].t) n.setAttribute(a,rec[a].o); } ATR.delete(n); } }
  }
}
const mo=new MutationObserver(ms=>{
  if(lang!=='en') return;
  for(const m of ms){
    if(m.type==='childList') m.addedNodes.forEach(walk);
    else if(m.type==='characterData') doText(m.target);
    else if(m.type==='attributes') doAttrs(m.target);
  }
});
mo.observe(document,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:ATTRS});

/* ---- canvas i okna dialogowe ---- */
const P=CanvasRenderingContext2D.prototype;
['fillText','strokeText','measureText'].forEach(k=>{
  const o=P[k]; P[k]=function(t,...a){ return o.call(this, lang==='en'? tr(t) : t, ...a); };
});
['alert','confirm'].forEach(k=>{ const o=window[k].bind(window); window[k]=m=>o(tr(m)); });
{ const o=window.prompt.bind(window); window.prompt=(m,d)=>o(tr(m),d); }
if(navigator.clipboard&&navigator.clipboard.writeText){
  const o=navigator.clipboard.writeText.bind(navigator.clipboard);
  navigator.clipboard.writeText=s=> o(lang==='en'? String(s).split('\n').map(l=>l.split(';').map(tr).join(';')).join('\n') : s);
}

/* ---- dane demo w wybranym języku ---- */
function demo(p){
  if(lang!=='en') return p;
  const q=JSON.parse(JSON.stringify(p));
  q.name=tr(q.name); q.author=tr(q.author);
  (q.floors||[]).forEach(f=>{ f.name=tr(f.name); (f.rooms||[]).forEach(r=>{ if(r.name) r.name=tr(r.name); }); });
  return q;
}
const DEMO_NAMES=['Projekt demo','Demo project'];

/* ---- przełącznik ---- */
function locale(){ return lang==='en'?'en-GB':'pl-PL'; }
function syncChrome(){
  document.documentElement.lang=lang;
  window.HVAC_LOCALE=locale();
  document.querySelectorAll('#langSwitch [data-lang]').forEach(b=>{
    const on=b.dataset.lang===lang; b.classList.toggle('active',on); b.setAttribute('aria-pressed',on?'true':'false');
  });
}
function setLang(l){
  if(l!=='en'&&l!=='pl'||l===lang) return;
  if(lang==='en') restore();
  lang=l; TPL.clear();
  try{ localStorage.setItem(LS,l); }catch(e){}
  try{ const u=new URL(location.href); u.searchParams.set('lang',l); history.replaceState(null,'',u); }catch(e){}
  syncChrome();
  // nietknięty projekt demo — wczytaj ponownie, żeby nazwy pomieszczeń były w nowym języku
  try{
    if(typeof state!=='undefined' && DEMO_NAMES.includes(state.name) && typeof undoDepth==='function' && undoDepth()===0 && typeof loadDemo==='function') loadDemo();
    else if(typeof refreshAll==='function') refreshAll();
  }catch(e){}
  if(lang==='en') walk(document.documentElement);
  try{ if(typeof setHint==='function' && typeof TOOL_HINTS!=='undefined' && typeof tool!=='undefined') setHint(TOOL_HINTS[tool]||''); }catch(e){}
  try{ window.dispatchEvent(new Event('resize')); }catch(e){}
}
window.HVAC_LOCALE=locale();
window.I18N={ get lang(){ return lang; }, set:setLang, t:tr, apply:walk, demo, locale };

document.addEventListener('DOMContentLoaded',()=>{
  syncChrome();
  document.querySelectorAll('#langSwitch [data-lang]').forEach(b=>b.addEventListener('click',()=>setLang(b.dataset.lang)));
  if(lang==='en') walk(document.documentElement);
});
if(lang==='en' && document.documentElement) walk(document.documentElement);
})();
