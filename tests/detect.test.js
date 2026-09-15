/* Stanowisko pomiarowe rozpoznawania pomieszczeń.
   Generuje trzy rzuty o typowych patologiach (ściany szare / czarne / kreskowane,
   łańcuchy wymiarowe, osie kreskowo-punktowe, meble przy ścianach, opisy) plus
   wariant „skan” (szare tło, szum, JPEG), puszcza detekcję i porównuje
   powierzchnie z geometrią wzorcową.

   Użycie:  python3 -m http.server 8765 &   node tests/detect.test.js [A,B,C,C*]
   Wymaga playwright (chromium).  */
const { chromium } = require(process.env.PLAYWRIGHT_PATH||'playwright');
const LAB=__dirname+'/';
const OPT_DEFAULT={thresh:190,gapM:0,minArea:1.5,minInr:0.6,rect:true,ocr:false,clear:true,wallBounded:false,wallM:0.3};
(async()=>{
 const only=process.argv[2]||null, optOv=process.argv[3]?JSON.parse(process.argv[3]):{};
 const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1500,height:950}});
 const errs=[]; p.on('pageerror',e=>errs.push('ERR '+e.message.slice(0,200)));
 await p.route('**cdnjs.cloudflare.com/**', r=>r.abort());
 await p.goto('http://localhost:8765/',{waitUntil:'domcontentloaded'}); await p.waitForTimeout(1200);
 await p.addScriptTag({path:LAB+'plans.js'});
 const names=only?only.split(','):['A','B','C','C*'];
 for(const nm of names){
   const info=await p.evaluate(async n=>{ const scan=n.endsWith('*');
     const r= scan? await window.__genScan(n.slice(0,-1)) : window.__genPlan(n);
     const f=F(); f.bg=r.url; f.bgW=r.W; f.bgH=r.H; f.pxPerM=r.ppm; f.bgPrevK=1;
     f.rooms=[]; f.nodes=[]; f.segs=[]; f.roi=null; f.maskPrev=null;
     state.name='TEST '+n; if(window.bgCache) delete window.bgCache[f.id];
     return {W:r.W,H:r.H,ppm:r.ppm,truth:r.truth};}, nm);
   // podkład musi się wczytać zanim ruszy analiza
   await p.evaluate(()=>new Promise(res=>{const im=new Image(); im.onload=res; im.onerror=res; im.src=F().bg;}));
   await p.evaluate(()=>{ if(window.maskCache) maskCache.key=''; refreshAll(); fitView(); });
   const t0=Date.now();
   await p.evaluate(o=>detectRooms(o), {...OPT_DEFAULT, ...optOv});
   await p.waitForTimeout(150);
   const got=await p.evaluate(()=>F().rooms.map(r=>({m2:+(polyArea(r.pts)/F().pxPerM**2).toFixed(2), n:r.pts.length})));
   const truth=info.truth;
   // dopasowanie: każdemu oczekiwanemu pokojowi szukamy wykrytego o zbliżonej powierzchni
   const used=new Set(); let hit=0, dev=[];
   truth.forEach(t=>{ let bi=-1,bd=1e9;
     got.forEach((g,i)=>{ if(used.has(i))return; const d=Math.abs(g.m2-t.m2)/t.m2; if(d<bd){bd=d;bi=i;} });
     if(bi>=0&&bd<=0.25){ used.add(bi); hit++; dev.push(+(bd*100).toFixed(0)); } else dev.push(null); });
   console.log(`\n=== PLAN ${nm} === ${info.W}x${info.H}px @${info.ppm}px/m   ${Date.now()-t0} ms`);
   console.log('oczekiwane :', truth.map(t=>`${t.n}=${t.m2}`).join('  '));
   console.log('wykryte    :', got.map(g=>g.m2).sort((a,b)=>b-a).join(', ')||'—');
   console.log(`TRAFIONE ${hit}/${truth.length}   odchyłki[%]: ${dev.map(d=>d==null?'×':d).join(' ')}`);
   if(process.env.SHOTS) await p.screenshot({path:LAB+'det_'+nm+'.png'});
 }
 if(errs.length) console.log('\nBŁĘDY:',errs.join(' | '));
 await b.close();
})().catch(e=>{console.log('FAIL',e.message.slice(0,400));process.exit(1);});
