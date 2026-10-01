/* Test pokrycia tłumaczenia EN.
   Przechodzi całą aplikację w trybie ?lang=en (puste i demo, wszystkie zakładki,
   właściwości obiektów, sterowanie, widoki 3D/3D+, symulacja doby, raport,
   rozpoznawanie pomieszczeń, automatyka) i wypisuje teksty, w których zostały
   polskie słowa. Brakujące hasła dopisz do js/i18n-en.js.

   Użycie:  python3 -m http.server 8765 &   node tests/i18n.test.js
   Wymaga playwright (chromium).  */
const { chromium } = require(process.env.PLAYWRIGHT_PATH||'playwright');
const HOOK = "(()=>{\n const T=window.__T=new Set(); const add=(s,src)=>{ if(s==null) return; s=String(s); if(/[A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]/.test(s)) T.add(src+'\\u0001'+s); };\n window.__add=add;\n const P=CanvasRenderingContext2D.prototype;\n ['fillText','strokeText'].forEach(k=>{const o=P[k]; P[k]=function(t,...a){add(t,'C');return o.call(this,t,...a)}});\n window.alert=m=>add(m,'A'); window.confirm=m=>{add(m,'A');return false}; window.prompt=(m,d)=>{add(m,'A');return null}; window.print=()=>{};\n const scanNode=n=>{\n  if(n.nodeType===3){ const p=n.parentNode; if(p&&/^(SCRIPT|STYLE)$/.test(p.nodeName)) return; add(n.data,'T'); return; }\n  if(n.nodeType!==1) return;\n  ['title','placeholder','aria-label','alt'].forEach(a=>{ if(n.hasAttribute&&n.hasAttribute(a)) add(n.getAttribute(a),'@'); });\n  if(n.nodeName==='SCRIPT'||n.nodeName==='STYLE'||n.nodeName==='svg') return;\n  n.childNodes.forEach(scanNode);\n };\n window.__scan=()=>{ if(window.I18N&&I18N.lang==='en') I18N.apply(document.documentElement); scanNode(document.documentElement); };\n const later=/lang=en/.test(location.search); let Q=[];\n const proc=m=>{ if(later&&m.target&&!m.target.isConnected) return; if(m.type==='childList') m.addedNodes.forEach(n=>{ if(!later||n.isConnected) scanNode(n); }); else if(m.type==='characterData') scanNode(m.target); else add(m.target.getAttribute(m.attributeName),'@'); };\n new MutationObserver(ms=>{ if(!later){ ms.forEach(proc); return; } if(!Q.length) setTimeout(()=>{ const q=Q; Q=[]; q.forEach(proc); },0); Q.push(...ms); })\n  .observe(document,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','placeholder','aria-label','alt']});\n})();\n";
(async()=>{
 const b=await chromium.launch({args:['--use-gl=swiftshader']}); const p=await b.newPage({viewport:{width:1500,height:950}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.route('**cdnjs.cloudflare.com/**', r=>r.abort());
 await p.addInitScript(HOOK);
 await p.goto('http://localhost:8765/?lang=en',{waitUntil:'domcontentloaded'}); await p.waitForTimeout(1500);
 const ev=async(f,a)=>{ try{ return await p.evaluate(f,a);}catch(e){ errs.push('EV '+e.message.slice(0,200)); } };
 const W=ms=>p.waitForTimeout(ms);
 await ev(()=>__scan());
 // pusty projekt: komunikaty
 await ev(()=>{ state=freshState(); refreshAll(); });
 await ev(()=>{ ['proj','bilans','siec','dobor','bom','zgod','ster'].forEach(x=>document.querySelector(`#tabs [data-pane=${x}]`).click()); });
 await ev(()=>{ try{autoConnect()}catch(e){} try{autoTerminals()}catch(e){} try{autoOccupants()}catch(e){} try{autoDetectDialog()}catch(e){} });
 await ev(()=>{ for(const t of Object.keys(TOOL_HINTS)) setTool(t); setTool('select'); });
 await ev(()=>{ document.getElementById('btnLoad'); });
 // demo
 await ev(()=>loadDemo()); await W(300);
 for(const x of ['proj','bilans','siec','dobor','bom','zgod','ster']){ await ev(x=>document.querySelector(`#tabs [data-pane=${x}]`).click(),x); await W(150); await ev(()=>__scan()); }
 // każdy obiekt
 await ev(()=>{ state.floors.forEach((f,fi)=>{ state.activeFloor=fi;
   f.rooms.forEach(r=>{ sel={kind:'room',floor:fi,id:r.id}; renderProps(); __scan(); setRoomEdit(r.id); renderProps(); __scan(); setRoomEdit(null); });
   f.nodes.forEach(n=>{ sel={kind:'node',floor:fi,id:n.id}; renderProps(); __scan(); });
   f.segs.forEach(s=>{ sel={kind:'seg',floor:fi,id:s.id}; renderProps(); __scan(); });
   draw(); }); state.activeFloor=0; sel=null; renderProps(); refreshAll(); });
 // typy pomieszczeń: każdy typ na jednym pokoju
 await ev(()=>{ const f=F(); const r=f.rooms[0]; const t0=r.type; for(const k of Object.keys(ROOM_TYPES)){ r.type=k; refreshAll(); sel={kind:'room',floor:0,id:r.id}; renderProps(); ['bilans','zgod','proj'].forEach(x=>{renderPane(x); __scan();}); } r.type=t0; sel=null; refreshAll(); });
 // sterowanie – klikaj przyciski
 await ev(()=>document.querySelector('#tabs [data-pane=ster]').click());
 for(let i=0;i<3;i++){ await ev(()=>{ document.querySelectorAll('#pane-ster button').forEach(bt=>{ try{bt.click()}catch(e){} }); __scan(); }); await W(400); }
 await ev(()=>{ document.querySelectorAll('#pane-ster select').forEach(s=>{ [...s.options].forEach(o=>{ s.value=o.value; s.dispatchEvent(new Event('change',{bubbles:true})); __scan(); }); }); });
 await W(800); await ev(()=>{ try{ctrlDisconnect()}catch(e){} __scan(); });
 // projekt: kliknij checkboxy/selecty
 await ev(()=>document.querySelector('#tabs [data-pane=proj]').click());
 await ev(()=>{ document.querySelectorAll('#pane-proj select').forEach(s=>{ const v=s.value; [...s.options].forEach(o=>{ s.value=o.value; s.dispatchEvent(new Event('change',{bubbles:true})); __scan(); }); }); });
 await ev(()=>{ document.querySelectorAll('#pane-proj input[type=checkbox]').forEach(c=>{ c.click(); __scan(); c.click(); }); });
 await ev(()=>loadDemo());
 // widoki, focus, popupy
 for(const f of ['segs','nodes','rooms','co2','all']) await ev(f=>{ setFocusMode(f); },f);
 await ev(()=>{ document.querySelectorAll('.vbtn[data-pop],#orbBtn,#legendBtn').forEach(b=>{ b.click(); __scan(); b.click(); }); });
 await ev(()=>document.querySelector('[data-mode="3d"]').click()); await W(1200); await ev(()=>__scan());
 await ev(()=>document.querySelector('[data-mode="3dp"]').click()); await W(3000); await ev(()=>__scan());
 await ev(()=>document.querySelector('#glWalk')&&document.querySelector('#glWalk').click()); await W(500);
 await ev(()=>document.querySelector('[data-mode="2d"]').click()); await W(500);
 // fullscreen panelu
 await ev(()=>{ document.getElementById('sideFs').click(); }); await W(300); await ev(()=>__scan()); await ev(()=>{ document.getElementById('sideClose').click(); });
 // symulacja
 await ev(()=>document.getElementById('simBtn').click()); await W(500);
 for(let m=0;m<1440;m+=20){ await ev(m=>{ HvacSim.setMin&&HvacSim.setMin(m); },m); await W(25); }
 await ev(()=>{ document.querySelectorAll('#simSheet [data-pane], #simSheet button').forEach(()=>{}); __scan(); });
 await ev(()=>document.getElementById('simClose').click()); await W(200);
 // raport
 await ev(()=>{ recalc(); buildReport(); __scan(); });
 // detekcja na planie testowym
 await p.addScriptTag({path:__dirname+'/plans.js'});
 await ev(async()=>{ state=freshState(); const r=window.__genPlan('A'); const f=F(); f.bg=r.url; f.bgW=r.W; f.bgH=r.H; f.pxPerM=0; refreshAll(); autoDetectDialog(); __scan(); f.pxPerM=r.ppm; refreshAll(); autoDetectDialog(); __scan(); });
 await W(300);
 await ev(()=>{ const d=document.getElementById('dlgDetect'); if(d){ const b=[...d.querySelectorAll('button')]; b.forEach(x=>__add(x.textContent,'T')); } });
 await ev(async()=>{ await new Promise(res=>{const im=new Image(); im.onload=res; im.onerror=res; im.src=F().bg;}); });
 await ev(()=>{ detectRooms({thresh:190,gapM:0,minArea:1.5,minInr:0.6,rect:true,ocr:false,clear:true,wallBounded:false,wallM:0.3}); }); await W(1500);
 await ev(()=>{ autoTerminals(); autoOccupants(); autoConnect(); refreshAll(); __scan(); }); await W(300);
 await ev(()=>{ ['proj','bilans','siec','dobor','bom','zgod'].forEach(x=>{renderPane(x); __scan();}); });
 await ev(()=>{ rotateFloor(true); rotateFloor(false); setSnap(false); setSnap(true); __scan(); });
 await ev(()=>{ document.getElementById('btnMask').click(); }); await W(500);
 const out=await ev(()=>[...__T]);
 const PL=/[ąćęłńśźżĄĆĘŁŃŚŹŻ]|ó(?!w)|(?<![\w])(w|z|na|nie|lub|oraz|dla|po|od|się|jest|są|pokoje|nawiew|wywiew|kanał|przewód|strefa|pion|brak|wg|przy|tryb|osób)(?![\w])/;
 const IGNORE=/zmysłów|Kraków|^\d+:\d+ i /;   // marka, nazwa miasta, znacznik „i” w logu Modbus
 const left=[...new Set(out.map(e=>e.split('\u0001')[1].trim().replace(/\s+/g,' ')))].filter(s=>PL.test(s)&&!IGNORE.test(s)).sort();
 left.forEach(s=>console.log('  PL │',s));
 console.log(`\nteksty: ${out.length}   nieprzetłumaczone: ${left.length}   błędy strony: ${errs.length}`);
 errs.forEach(e=>console.log('  ERR',e));
 process.exitCode = left.length||errs.length ? 1 : 0;
 await b.close();
})();
