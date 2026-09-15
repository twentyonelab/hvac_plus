/* Generator testowych rzutów architektonicznych — odtworzenie patologii z realnych
   rysunków: łańcuchy wymiarowe dotykające ścian, osie kreskowo-punktowe przez cały
   rysunek, meble przylegające do ścian, opisy, drzwi ze skrzydłem i łukiem, okna,
   ściany szare / czarne / kreskowane. Skala znana (ppm), więc ground truth = m². */
(function(){
const PLANS = {

A: { id:'A', title:'A — ściany szare, gęsta wymiarówka, osie kreskowo-punktowe (jak rzut mieszkania)',
  ppm:80, margin:1.7, W:5.70, H:10.54, style:'gray', wall:0.26,
  rooms:[
    {x0:0.26,y0:0.26,x1:2.97,y1:4.86,  n:'SYPIALNIA', a:'12,47 m²'},
    {x0:3.09,y0:0.26,x1:5.44,y1:4.86,  n:'SYPIALNIA', a:'10,81 m²'},
    {x0:0.26,y0:4.98,x1:2.97,y1:7.20,  n:'HOL',       a:'6,02 m²'},
    {x0:3.09,y0:4.98,x1:5.44,y1:7.20,  n:'ŁAZIENKA',  a:'5,22 m²'},
    {x0:0.26,y0:7.32,x1:2.40,y1:10.28, n:'KUCHNIA',   a:'6,33 m²'},
    {x0:2.52,y0:7.32,x1:5.44,y1:10.28, n:'POKÓJ OGÓLNY', a:'8,64 m²'}
  ],
  doors:[ {x:2.97,y:2.20,len:0.90,o:'v',sw:1}, {x:3.09,y:5.60,len:0.80,o:'v',sw:-1},
          {x:1.30,y:4.86,len:0.90,o:'h',sw:1}, {x:4.10,y:4.86,len:0.90,o:'h',sw:-1},
          {x:1.10,y:7.20,len:0.90,o:'h',sw:1}, {x:3.60,y:7.20,len:1.10,o:'h',sw:-1},
          {x:2.40,y:8.60,len:0.90,o:'v',sw:1} ],
  wins:[ {x:0.80,y:0.26,len:1.50,o:'h'}, {x:3.60,y:0.26,len:1.50,o:'h'},
         {x:0.26,y:1.40,len:1.20,o:'v'}, {x:5.44,y:5.30,len:0.80,o:'v'},
         {x:0.70,y:10.28,len:1.30,o:'h'}, {x:3.20,y:10.28,len:2.00,o:'h'} ],
  furn:[ {t:'bed', x0:0.30,y0:0.40,x1:1.80,y1:2.50}, {t:'wardrobe',x0:0.30,y0:2.70,x1:0.90,y1:4.60},
         {t:'box', x0:2.20,y0:0.40,x1:2.93,y1:1.60}, {t:'bed', x0:3.60,y0:0.40,x1:5.10,y1:2.50},
         {t:'wardrobe',x0:4.80,y0:2.80,x1:5.40,y1:4.70},
         {t:'box', x0:3.13,y0:5.02,x1:3.83,y1:5.72}, {t:'box', x0:4.60,y0:6.20,x1:5.40,y1:7.16},
         {t:'kitchen',x0:0.30,y0:7.40,x1:0.90,y1:10.20}, {t:'kitchen',x0:0.95,y0:7.36,x1:2.36,y1:7.96},
         {t:'sofa', x0:4.40,y0:7.50,x1:5.40,y1:9.60}, {t:'table',x0:2.90,y0:9.10,x1:4.10,y1:10.10} ],
  axes:[{o:'v',at:0.13},{o:'v',at:5.57},{o:'h',at:6.40},{o:'h',at:0.13},{o:'h',at:10.41}],
  dims:{levels:2, inner:[{o:'v',at:2.30,y0:0.30,y1:4.80},{o:'v',at:3.55,y0:0.30,y1:2.40},
                          {o:'h',at:4.50,x0:0.30,x1:2.90},{o:'h',at:6.05,x0:3.15,x1:5.40}]} },

B: { id:'B', title:'B — ściany pełne czarne, wymiary wewnątrz pomieszczeń, klatka schodowa',
  ppm:70, margin:1.5, W:11.50, H:7.92, style:'black', wall:0.25,
  rooms:[
    {x0:0.25,y0:0.25,x1:3.64,y1:3.32,  n:'SYPIALNIA', a:''},
    {x0:3.76,y0:0.25,x1:6.77,y1:3.32,  n:'HOL',       a:''},
    {x0:0.25,y0:3.44,x1:4.72,y1:7.67,  n:'SYPIALNIA', a:''},
    {x0:4.84,y0:3.44,x1:6.77,y1:7.67,  n:'ŁAZIENKA',  a:''},
    {x0:6.89,y0:0.25,x1:11.25,y1:7.67, n:'POKÓJ DZIENNY', a:''}
  ],
  doors:[ {x:3.64,y:1.10,len:0.90,o:'v',sw:1}, {x:4.72,y:5.00,len:0.90,o:'v',sw:-1},
          {x:5.20,y:3.44,len:0.80,o:'h',sw:1}, {x:6.77,y:1.40,len:1.00,o:'v',sw:1},
          {x:2.00,y:3.44,len:0.90,o:'h',sw:-1} ],
  wins:[ {x:0.25,y:0.90,len:1.60,o:'v'}, {x:0.25,y:4.40,len:1.80,o:'v'},
         {x:11.25,y:0.80,len:1.40,o:'v'}, {x:11.25,y:2.60,len:1.40,o:'v'}, {x:11.25,y:4.60,len:2.20,o:'v'},
         {x:7.60,y:0.25,len:2.60,o:'h'} ],
  furn:[ {t:'bed',x0:0.35,y0:0.60,x1:2.30,y1:2.10}, {t:'wardrobe',x0:2.50,y0:2.60,x1:3.58,y1:3.26},
         {t:'bed',x0:0.35,y0:4.00,x1:2.50,y1:5.60}, {t:'wardrobe',x0:2.80,y0:6.90,x1:4.66,y1:7.60},
         {t:'stairs',x0:4.30,y0:0.35,x1:6.70,y1:2.60},
         {t:'box',x0:4.95,y0:3.55,x1:5.70,y1:4.30}, {t:'box',x0:4.95,y0:6.40,x1:6.70,y1:7.60},
         {t:'kitchen',x0:6.95,y0:4.60,x1:7.70,y1:7.60}, {t:'sofa',x0:9.10,y0:1.80,x1:11.18,y1:3.00},
         {t:'table',x0:9.30,y0:5.40,x1:11.10,y1:7.20} ],
  axes:[],
  dims:{levels:1, inner:[{o:'h',at:1.30,x0:0.30,x1:3.60},{o:'v',at:1.60,y0:0.30,y1:3.28},
                          {o:'h',at:5.90,x0:0.30,x1:4.68},{o:'v',at:5.30,y0:3.50,y1:7.62},
                          {o:'h',at:2.20,x0:6.95,x1:11.20},{o:'v',at:9.90,y0:0.30,y1:7.62},
                          {o:'h',at:4.90,x0:4.90,x1:6.72}]} },

C: { id:'C', title:'C — ściany kreskowane (inwentaryzacja), linia przekroju A-A, balony opisowe',
  ppm:75, margin:1.9, W:10.65, H:10.10, style:'hatch', wall:0.38,
  rooms:[
    {x0:0.38,y0:0.38,x1:5.62,y1:4.90,  n:'1.6  Pokój', a:'23,68 m²'},
    {x0:5.86,y0:0.38,x1:10.27,y1:4.90, n:'1.7  Pokój', a:'19,93 m²'},
    {x0:0.38,y0:5.14,x1:10.27,y1:6.32, n:'1.2  Korytarz', a:'11,67 m²'},
    {x0:0.38,y0:6.56,x1:4.35,y1:9.72,  n:'1.5  Pokój', a:'12,55 m²'},
    {x0:4.59,y0:6.56,x1:6.00,y1:9.72,  n:'1.4  Łazienka', a:'4,46 m²'},
    {x0:6.24,y0:6.56,x1:10.27,y1:9.72, n:'1.3  Kuchnia', a:'12,73 m²'}
  ],
  doors:[ {x:2.60,y:4.90,len:0.90,o:'h',sw:1}, {x:7.60,y:4.90,len:0.90,o:'h',sw:-1},
          {x:2.00,y:6.32,len:0.90,o:'h',sw:1}, {x:5.10,y:6.32,len:0.80,o:'h',sw:-1},
          {x:7.40,y:6.32,len:0.90,o:'h',sw:1}, {x:5.62,y:2.20,len:0.90,o:'v',sw:1} ],
  wins:[ {x:1.40,y:0.38,len:1.76,o:'h'}, {x:3.60,y:0.38,len:1.44,o:'h'},
         {x:6.60,y:0.38,len:1.76,o:'h'}, {x:8.60,y:0.38,len:1.44,o:'h'},
         {x:0.38,y:2.00,len:1.80,o:'v'}, {x:0.38,y:7.40,len:1.36,o:'v'},
         {x:1.60,y:9.72,len:1.80,o:'h'}, {x:7.20,y:9.72,len:1.05,o:'h'}, {x:10.27,y:7.60,len:1.20,o:'v'} ],
  furn:[ {t:'box',x0:0.45,y0:0.45,x1:1.50,y1:2.20}, {t:'table',x0:2.30,y0:1.60,x1:3.90,y1:3.20},
         {t:'bed',x0:6.00,y0:0.50,x1:7.80,y1:2.60}, {t:'wardrobe',x0:9.20,y0:0.50,x1:10.20,y1:3.00},
         {t:'kitchen',x0:6.30,y0:6.62,x1:10.20,y1:7.22}, {t:'kitchen',x0:6.30,y0:7.30,x1:6.90,y1:9.60},
         {t:'box',x0:4.66,y0:6.62,x1:5.40,y1:7.40}, {t:'box',x0:4.66,y0:8.90,x1:5.94,y1:9.66},
         {t:'stairs',x0:10.40,y0:1.20,x1:11.60,y1:4.20},
         {t:'sofa',x0:0.50,y0:8.20,x1:2.40,y1:9.60} ],
  axes:[{o:'h',at:5.73,section:true}],
  balloons:[ {x:-0.95,y:1.30,t:'SZ1',tx:0.10},{x:-0.95,y:7.80,t:'SZ2',tx:0.10},
             {x:11.60,y:5.73,t:'A',tx:10.40},{x:2.20,y:-0.95,t:'OZ5',ty:0.20},
             {x:7.10,y:-0.95,t:'OZ5',ty:0.20},{x:5.20,y:10.70,t:'OZ3',ty:9.90} ],
  dims:{levels:2, inner:[{o:'h',at:2.60,x0:0.42,x1:5.58},{o:'h',at:2.60,x0:5.90,x1:10.23},
                          {o:'v',at:0.90,y0:0.42,y1:4.86},{o:'v',at:3.20,y0:6.60,y1:9.68}]} }
};

function draw(spec){
  const ppm=spec.ppm, MG=spec.margin*ppm;
  const W=Math.round(spec.W*ppm+2*MG), H=Math.round(spec.H*ppm+2*MG);
  const c=document.createElement('canvas'); c.width=W; c.height=H;
  const g=c.getContext('2d');
  const X=m=>MG+m*ppm, Y=m=>MG+m*ppm, S=m=>m*ppm;
  g.fillStyle='#fff'; g.fillRect(0,0,W,H);
  g.lineCap='butt'; g.lineJoin='miter';
  const thin=Math.max(1,Math.round(ppm/90)), med=Math.max(1,Math.round(ppm/55));

  /* ---------- ŚCIANY: bryła minus pomieszczenia ---------- */
  const bb={x0:0,y0:0,x1:spec.W,y1:spec.H};
  const wallPath=()=>{ const p=new Path2D();
    p.rect(X(bb.x0),Y(bb.y0),S(spec.W),S(spec.H));
    spec.rooms.forEach(r=>p.rect(X(r.x0),Y(r.y0),S(r.x1-r.x0),S(r.y1-r.y0)));
    return p; };
  const wp=wallPath();
  if(spec.style==='black'){ g.fillStyle='#141414'; g.fill(wp,'evenodd'); }
  else if(spec.style==='gray'){ g.fillStyle='#c9c9c9'; g.fill(wp,'evenodd');
    g.strokeStyle='#000'; g.lineWidth=thin; g.stroke(wp); }
  else { // kreskowanie 45°
    g.save(); g.clip(wp,'evenodd');
    g.strokeStyle='#000'; g.lineWidth=Math.max(1,thin*0.8);
    const step=Math.max(4,Math.round(ppm*0.055));
    for(let d=-H;d<W+H;d+=step){ g.beginPath(); g.moveTo(d,0); g.lineTo(d+H,H); g.stroke(); }
    g.restore();
    g.strokeStyle='#000'; g.lineWidth=thin; g.stroke(wp);
  }

  /* ---------- OTWORY: drzwi i okna ---------- */
  const hole=(d,f)=>{                       // wycięcie w ścianie (dokładnie na grubość)
    const t=spec.wall*(f||1.02);
    if(d.o==='h'){ g.fillStyle='#fff'; g.fillRect(X(d.x),Y(d.y)-S(t/2),S(d.len),S(t)); }
    else { g.fillStyle='#fff'; g.fillRect(X(d.x)-S(t/2),Y(d.y),S(t),S(d.len)); }
  };
  (spec.wins||[]).forEach(w=>{ hole(w);
    g.strokeStyle='#000'; g.lineWidth=thin;
    const t=spec.wall;
    if(w.o==='h'){ for(const o of [-t/2,-t/6,t/6,t/2]){ g.beginPath();
        g.moveTo(X(w.x),Y(w.y)+S(o)); g.lineTo(X(w.x+w.len),Y(w.y)+S(o)); g.stroke(); }
      g.beginPath(); g.moveTo(X(w.x),Y(w.y)-S(t/2)); g.lineTo(X(w.x),Y(w.y)+S(t/2));
      g.moveTo(X(w.x+w.len),Y(w.y)-S(t/2)); g.lineTo(X(w.x+w.len),Y(w.y)+S(t/2)); g.stroke(); }
    else { for(const o of [-t/2,-t/6,t/6,t/2]){ g.beginPath();
        g.moveTo(X(w.x)+S(o),Y(w.y)); g.lineTo(X(w.x)+S(o),Y(w.y+w.len)); g.stroke(); }
      g.beginPath(); g.moveTo(X(w.x)-S(t/2),Y(w.y)); g.lineTo(X(w.x)+S(t/2),Y(w.y));
      g.moveTo(X(w.x)-S(t/2),Y(w.y+w.len)); g.lineTo(X(w.x)+S(t/2),Y(w.y+w.len)); g.stroke(); }
  });
  (spec.doors||[]).forEach(d=>{ hole(d);
    g.strokeStyle='#000'; g.lineWidth=thin;
    const L=S(d.len);
    if(d.o==='v'){ const x=X(d.x), y=Y(d.y), s=d.sw;
      g.beginPath(); g.moveTo(x,y); g.lineTo(x+s*L,y); g.stroke();              // skrzydło
      g.beginPath(); g.arc(x,y,L,s>0?0:Math.PI, s>0?Math.PI/2:Math.PI*1.5, s<0); g.stroke(); }
    else { const x=X(d.x), y=Y(d.y), s=d.sw;
      g.beginPath(); g.moveTo(x,y); g.lineTo(x,y+s*L); g.stroke();
      g.beginPath(); g.arc(x,y,L,s>0?Math.PI/2:Math.PI*1.5, s>0?Math.PI:0, s<0); g.stroke(); }
  });

  /* ---------- MEBLE (cienka kreska, przylegają do ścian) ---------- */
  g.strokeStyle='#000'; g.lineWidth=thin;
  (spec.furn||[]).forEach(f=>{
    const x=X(f.x0), y=Y(f.y0), w=S(f.x1-f.x0), h=S(f.y1-f.y0);
    g.strokeRect(x,y,w,h);
    if(f.t==='kitchen'||f.t==='wardrobe'){ g.beginPath(); g.moveTo(x,y); g.lineTo(x+w,y+h); g.moveTo(x+w,y); g.lineTo(x,y+h); g.stroke(); }
    if(f.t==='bed'){ g.strokeRect(x+w*0.06,y+h*0.05,w*0.88,h*0.22);
      g.beginPath(); g.moveTo(x,y+h*0.32); g.lineTo(x+w,y+h*0.32); g.stroke(); }
    if(f.t==='sofa'){ g.strokeRect(x+w*0.12,y+h*0.12,w*0.76,h*0.76); }
    if(f.t==='table'){ const n=4; for(let i=0;i<n;i++){ const a=Math.PI/2*i;
      g.strokeRect(x+w/2+Math.cos(a)*w*0.36-w*0.09, y+h/2+Math.sin(a)*h*0.36-h*0.09, w*0.18,h*0.18); } }
    if(f.t==='stairs'){ const n=9; for(let i=1;i<n;i++){ const yy=y+h*i/n;
      g.beginPath(); g.moveTo(x,yy); g.lineTo(x+w,yy); g.stroke(); }
      g.beginPath(); g.moveTo(x+w*0.5,y); g.lineTo(x+w*0.5,y+h); g.stroke(); }
  });

  /* ---------- OSIE kreskowo-punktowe / linia przekroju ---------- */
  (spec.axes||[]).forEach(a=>{
    g.strokeStyle='#000'; g.lineWidth=a.section?med:thin;
    g.setLineDash(a.section?[S(0.5),S(0.12),S(0.08),S(0.12)]:[S(0.35),S(0.12),S(0.06),S(0.12)]);
    g.beginPath();
    if(a.o==='v'){ g.moveTo(X(a.at),Y(-spec.margin*0.7)); g.lineTo(X(a.at),Y(spec.H+spec.margin*0.7)); }
    else { g.moveTo(X(-spec.margin*0.7),Y(a.at)); g.lineTo(X(spec.W+spec.margin*0.7),Y(a.at)); }
    g.stroke(); g.setLineDash([]);
  });

  /* ---------- ŁAŃCUCHY WYMIAROWE (linie pomocnicze dotykają ścian) ---------- */
  const tick=(x,y,ang)=>{ const r=S(0.09); g.beginPath();
    g.moveTo(x-Math.cos(ang)*r,y-Math.sin(ang)*r); g.lineTo(x+Math.cos(ang)*r,y+Math.sin(ang)*r); g.stroke(); };
  const dimH=(x0,x1,y,txt)=>{ g.strokeStyle='#000'; g.lineWidth=thin;
    g.beginPath(); g.moveTo(X(x0),Y(y)); g.lineTo(X(x1),Y(y)); g.stroke();
    tick(X(x0),Y(y),Math.PI/4); tick(X(x1),Y(y),Math.PI/4);
    g.fillStyle='#000'; g.font=`${Math.round(ppm*0.14)}px sans-serif`; g.textAlign='center';
    g.fillText(txt||String(Math.round((x1-x0)*100)),(X(x0)+X(x1))/2,Y(y)-S(0.07)); };
  const dimV=(y0,y1,x,txt)=>{ g.strokeStyle='#000'; g.lineWidth=thin;
    g.beginPath(); g.moveTo(X(x),Y(y0)); g.lineTo(X(x),Y(y1)); g.stroke();
    tick(X(x),Y(y0),Math.PI/4); tick(X(x),Y(y1),Math.PI/4);
    g.save(); g.translate(X(x)-S(0.07),(Y(y0)+Y(y1))/2); g.rotate(-Math.PI/2);
    g.fillStyle='#000'; g.font=`${Math.round(ppm*0.14)}px sans-serif`; g.textAlign='center';
    g.fillText(txt||String(Math.round((y1-y0)*100)),0,0); g.restore(); };
  const ext=(x0,y0,x1,y1)=>{ g.strokeStyle='#000'; g.lineWidth=thin;
    g.beginPath(); g.moveTo(X(x0),Y(y0)); g.lineTo(X(x1),Y(y1)); g.stroke(); };
  const lv=(spec.dims&&spec.dims.levels)||1;
  const xs=[0]; spec.rooms.forEach(r=>{ xs.push(r.x0,r.x1); }); xs.push(spec.W);
  const ys=[0]; spec.rooms.forEach(r=>{ ys.push(r.y0,r.y1); }); ys.push(spec.H);
  const ux=[...new Set(xs.map(v=>+v.toFixed(2)))].sort((a,b)=>a-b);
  const uy=[...new Set(ys.map(v=>+v.toFixed(2)))].sort((a,b)=>a-b);
  for(let L=1;L<=lv;L++){
    const off=0.45+0.45*L;
    // góra i dół — łańcuch szczegółowy (L=1) i całkowity (L=2)
    const seq = L===1? ux : [0,spec.W];
    for(let i=0;i<seq.length-1;i++){ dimH(seq[i],seq[i+1],-off); dimH(seq[i],seq[i+1],spec.H+off); }
    seq.forEach(v=>{ ext(v,-off-0.18,v,-0.05); ext(v,spec.H+0.05,v,spec.H+off+0.18); });
    const seqY = L===1? uy : [0,spec.H];
    for(let i=0;i<seqY.length-1;i++){ dimV(seqY[i],seqY[i+1],-off); dimV(seqY[i],seqY[i+1],spec.W+off); }
    seqY.forEach(v=>{ ext(-off-0.18,v,-0.05,v); ext(spec.W+0.05,v,spec.W+off+0.18,v); });
  }
  ((spec.dims&&spec.dims.inner)||[]).forEach(d=>{
    if(d.o==='h') dimH(d.x0,d.x1,d.at); else dimV(d.y0,d.y1,d.at);
  });

  /* ---------- BALONY OPISOWE z odnośnikiem dotykającym ściany ---------- */
  (spec.balloons||[]).forEach(b=>{
    g.strokeStyle='#000'; g.lineWidth=thin; g.beginPath();
    g.arc(X(b.x),Y(b.y),S(0.22),0,7); g.stroke();
    g.beginPath(); g.moveTo(X(b.x),Y(b.y));
    g.lineTo(X(b.tx!=null?b.tx:b.x), Y(b.ty!=null?b.ty:b.y)); g.stroke();
    g.fillStyle='#000'; g.font=`${Math.round(ppm*0.12)}px sans-serif`; g.textAlign='center';
    g.fillText(b.t,X(b.x),Y(b.y)+S(0.04));
  });

  /* ---------- OPISY POMIESZCZEŃ ---------- */
  spec.rooms.forEach(r=>{
    const cx=(X(r.x0)+X(r.x1))/2, cy=(Y(r.y0)+Y(r.y1))/2;
    g.fillStyle='#000'; g.textAlign='center';
    g.font=`600 ${Math.round(ppm*0.165)}px sans-serif`; g.fillText(r.n,cx,cy);
    if(r.a){ g.font=`${Math.round(ppm*0.145)}px sans-serif`; g.fillText(r.a,cx,cy+S(0.24)); }
  });
  /* tabelka rysunkowa w rogu */
  g.strokeStyle='#000'; g.lineWidth=thin;
  g.strokeRect(X(spec.W-2.6),Y(spec.H+0.9),S(2.6),S(0.7));
  g.font=`${Math.round(ppm*0.13)}px sans-serif`; g.textAlign='left'; g.fillStyle='#000';
  g.fillText('Rzut '+spec.id+'  1:100',X(spec.W-2.5),Y(spec.H+1.3));

  return {url:c.toDataURL('image/png'), W, H, ppm,
    truth: spec.rooms.map(r=>({n:r.n, m2:+((r.x1-r.x0)*(r.y1-r.y0)).toFixed(2)}))};
}
window.__PLANS=PLANS;
window.__genPlan=name=>draw(PLANS[name]);
})();
/* wariant „skan”: szarawe tło, szum i lekkie rozmycie — jak zdjęcie/ksero rzutu */
(function(){
 const base=window.__genPlan;
 window.__genScan=function(name){
   const r=base(name);
   return new Promise(res=>{
     const im=new Image();
     im.onload=()=>{
       const c=document.createElement('canvas'); c.width=r.W; c.height=r.H;
       const g=c.getContext('2d');
       g.fillStyle='#f0ece6'; g.fillRect(0,0,r.W,r.H);       // papier
       g.filter='blur(0.6px)'; g.drawImage(im,0,0); g.filter='none';
       const d=g.getImageData(0,0,r.W,r.H);
       for(let i=0;i<d.data.length;i+=4){ const n=(Math.random()*26-13)|0;
         d.data[i]=Math.max(0,Math.min(255,d.data[i]+n));
         d.data[i+1]=Math.max(0,Math.min(255,d.data[i+1]+n));
         d.data[i+2]=Math.max(0,Math.min(255,d.data[i+2]+n)); }
       g.putImageData(d,0,0);
       res({url:c.toDataURL('image/jpeg',0.72), W:r.W, H:r.H, ppm:r.ppm, truth:r.truth});
     };
     im.src=r.url;
   });
 };
})();
