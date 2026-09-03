/* =====================================================================
   HVAC+ planer — symulacja doby

   Pokazuje, jak instalacja pracuje przez 24 godziny: pogoda z Open-Meteo
   nadaje poziom temperatury zewnętrznej, pora dnia steruje obłożeniem
   i trybem centrali, a rysunek ciemnieje na noc. Liczy moc potrzebną do
   ogrzania powietrza wentylacyjnego, temperaturę nawiewu i to, ile
   oszczędza odzysk ciepła.

   Model jest prosty i jawny (poniżej), bo ma pokazywać zależności,
   a nie zastępować obliczeń projektowych.
   ===================================================================== */
(function(){
  'use strict';

  const RHO = 1.2, CP = 1005;        // powietrze: gęstość [kg/m³], ciepło właściwe [J/(kg·K)]
  const SFP = 0.35;                  // moc wentylatorów [W na m³/h] — rząd wielkości dla central domowych
  const STEP = 5;                    // krok symulacji [min]

  const S = { open:false, playing:false, min:8*60, speed:180, raf:0, t0:0 };

  const $ = s => document.querySelector(s);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const hhmm = m => String(Math.floor(m/60)%24).padStart(2,'0')+':'+String(Math.round(m)%60).padStart(2,'0');

  /* ---------- warunki zewnętrzne w ciągu doby ---------- */
  function weatherBase(){
    const w = window.HvacWeather && HvacWeather.last;
    return {
      temp: (w && w.tempC!=null) ? w.tempC : 6,          // brak pogody → typowy dzień przejściowy
      rad:  (w && w.radiationWm2!=null) ? w.radiationWm2 : null,
      cloud:(w && w.cloudCover!=null) ? w.cloudCover : null,
      place: w ? w.place : null,
      real: !!(w && w.tempC!=null)
    };
  }
  /* dobowy przebieg temperatury: minimum ok. 5:00, maksimum ok. 15:00 */
  const toutAt = (min,base) => base.temp + 4.5*Math.sin((min/60-9)/24*2*Math.PI);
  /* wysokość słońca zastępczo: doba równonocy, wschód ~6:00, zachód ~19:00 */
  const sunAt  = min => clamp(Math.sin((min/60-6.5)/13*Math.PI), 0, 1);

  /* ---------- obłożenie i tryb centrali ---------- */
  function occupancyAt(min, persons){
    const h = min/60;
    if(h < 6.5 || h >= 22.5) return { n:persons, tryb:'noc',    k:0.60 };   // sen: obniżenie (Az3:2000)
    if(h >= 8 && h < 16)     return { n:Math.max(1,Math.round(persons*0.2)), tryb:'dom pusty', k:0.45 };
    if(h >= 17 && h < 19)    return { n:persons, tryb:'gotowanie', k:1.20 }; // okresowy wywiew z kuchni
    return { n:persons, tryb:'obecność', k:1.00 };
  }

  /* ---------- jedna chwila symulacji ---------- */
  function pointAt(min, ctxData){
    const { base, V, eta, tRoom, persons } = ctxData;
    const tOut = toutAt(min, base);
    const occ  = occupancyAt(min, persons);
    const v    = V * occ.k;                                   // strumień bieżący [m³/h]
    /* odszranianie: poniżej −3 °C wymiennik pracuje gorzej */
    const etaT = tOut < -3 ? eta*0.82 : eta;
    const tSup = tOut + etaT*(tRoom - tOut);
    const dT   = Math.max(0, tRoom - tOut);
    const qBez = v/3600 * RHO * CP * dT;                      // moc bez odzysku [W]
    const qZ   = qBez * (1-etaT);                             // moc po odzysku [W]
    return { min, tOut, tSup, v, occ, qBez, qZ, save:qBez-qZ, fan:v*SFP, sun:sunAt(min) };
  }

  function simContext(){
    const C = window.CALC||{}, B = C.balance||{};
    return {
      base: weatherBase(),
      V: B.V || 200,
      eta: (C.unit && C.unit.eta ? C.unit.eta : 85)/100,
      tRoom: (window.CTRL && CTRL.tRoom) ? CTRL.tRoom : 21,
      persons: B.persons || 4
    };
  }

  /* ---------- przebieg całej doby (do wykresu i sum) ---------- */
  let cache = { key:'', pts:[], sum:null };
  function dayCurve(){
    const c = simContext();
    const key = [c.base.temp, c.V, c.eta, c.tRoom, c.persons].join('|');
    if(cache.key===key) return cache;
    const pts=[];
    let eBez=0, eZ=0, eFan=0;
    for(let m=0; m<1440; m+=STEP){
      const p = pointAt(m, c);
      pts.push(p);
      const h = STEP/60;
      eBez += p.qBez*h/1000; eZ += p.qZ*h/1000; eFan += p.fan*h/1000;   // kWh
    }
    cache = { key, pts, sum:{ eBez, eZ, eFan, save:eBez-eZ, ctx:c } };
    return cache;
  }

  /* ---------- wykres mocy w ciągu doby ---------- */
  function drawChart(){
    const cv = $('#simChart'); if(!cv) return;
    const { pts, sum } = dayCurve();
    const dpr = devicePixelRatio||1;
    const w = cv.clientWidth||600, h = cv.clientHeight||116;
    cv.width = Math.round(w*dpr); cv.height = Math.round(h*dpr);
    const g = cv.getContext('2d');
    g.setTransform(dpr,0,0,dpr,0,0);
    g.clearRect(0,0,w,h);

    const maxQ = Math.max(1, ...pts.map(p=>p.qBez));
    const X = m => m/1440*w;
    const Y = q => h-14 - (q/maxQ)*(h-26);

    /* pasy nocy i dnia */
    pts.forEach((p,i)=>{
      const x=X(p.min), x2=X(p.min+STEP);
      g.fillStyle = p.sun>0.02 ? `rgba(255,238,190,${0.10+0.22*p.sun})` : 'rgba(28,32,60,.07)';
      g.fillRect(x,0,x2-x+0.6,h);
    });

    const area=(key,fill)=>{
      g.beginPath(); g.moveTo(X(0),Y(0));
      pts.forEach(p=>g.lineTo(X(p.min),Y(p[key])));
      g.lineTo(X(1440),Y(0)); g.closePath(); g.fillStyle=fill; g.fill();
    };
    area('qBez','rgba(209,46,79,.20)');     // moc bez odzysku
    area('qZ',  'rgba(45,98,190,.34)');     // moc po odzysku

    g.beginPath(); pts.forEach((p,i)=> i?g.lineTo(X(p.min),Y(p.qBez)):g.moveTo(X(p.min),Y(p.qBez)));
    g.strokeStyle='rgba(209,46,79,.75)'; g.lineWidth=1.4; g.stroke();
    g.beginPath(); pts.forEach((p,i)=> i?g.lineTo(X(p.min),Y(p.qZ)):g.moveTo(X(p.min),Y(p.qZ)));
    g.strokeStyle='#2D62BE'; g.lineWidth=1.8; g.stroke();

    /* godziny */
    g.font='9px Outfit, Segoe UI'; g.fillStyle='rgba(28,28,30,.45)'; g.textAlign='center';
    for(let hh=0; hh<=24; hh+=6){ const x=X(hh*60);
      g.fillText(String(hh).padStart(2,'0')+':00', clamp(x,16,w-16), h-3); }

    /* znacznik bieżącej chwili */
    const x=X(S.min);
    g.strokeStyle='#1C1C1E'; g.lineWidth=1.4; g.beginPath(); g.moveTo(x,0); g.lineTo(x,h-12); g.stroke();
    g.fillStyle='#1C1C1E'; g.beginPath(); g.arc(x,Y(pointAt(S.min,sum.ctx).qZ),3,0,7); g.fill();

    /* opis skali */
    g.textAlign='left'; g.fillStyle='rgba(28,28,30,.55)';
    g.fillText(`0 – ${Math.round(maxQ)} W · czerwone: bez odzysku · niebieskie: po odzysku`,6,10);
  }

  /* ---------- mieszkańcy obecni w danej chwili ---------- */
  let present = new Set();
  const fade = new Map();
  function updatePresence(n){
    const ids=[];
    state.floors.forEach(f=>f.nodes.forEach(x=>{ if(x.type==='person') ids.push(x.id); }));
    ids.sort();
    present = new Set(ids.slice(0, Math.min(n, ids.length)));
  }
  window.__simPersonAlpha = node => {
    if(!S.open) return 1;
    const target = present.has(node.id) ? 1 : 0;
    if(!S.playing){ fade.set(node.id,target); return target; }
    let a = fade.get(node.id); if(a==null) a=target;
    a += (target-a)*0.16; if(Math.abs(target-a)<0.02) a=target;
    fade.set(node.id,a);
    return a;
  };

  /* ---------- odczyty ---------- */
  function refresh(){
    const { sum } = dayCurve();
    const p = pointAt(S.min, sum.ctx);
    updatePresence(p.occ.n);
    const f1 = (x,u,d=0)=> `${x.toLocaleString('pl-PL',{minimumFractionDigits:d,maximumFractionDigits:d})} ${u}`;
    $('#simClock').textContent = hhmm(S.min);
    $('#simPhase').textContent = p.sun>0.02 ? (p.sun>0.5?'dzień':'świt / zmierzch') : 'noc';
    $('#simTsup').textContent = f1(p.tSup,'°C',1);
    $('#simTout').textContent = f1(p.tOut,'°C',1);
    $('#simPow').textContent  = f1(p.qZ+p.fan,'W');
    $('#simSave').textContent = f1(p.save,'W');
    $('#simDay').textContent  = `${f1(sum.eZ+sum.eFan,'',1)} / ${f1(sum.save,'kWh',1)}`;
    $('#simOcc').textContent  = `${p.occ.n} os. · ${p.occ.tryb}`;
    $('#simOcc').title        = `strumień bieżący ${Math.round(p.v)} m³/h`;
    drawChart();
    if(window.draw) draw();
  }

  /* ---------- pora dnia na rysunku (nakładka na draw) ---------- */
  const _draw = window.draw;
  window.draw = function(){
    _draw();
    if(!S.open) return;
    const night = 1 - sunAt(S.min);
    if(night<=0.02) return;
    const a = 0.50*night;
    const w = cv.clientWidth, h = cv.clientHeight;
    ctx.save();
    ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
    ctx.globalCompositeOperation='multiply';
    ctx.fillStyle=`rgba(96,110,165,${a})`;              // kolory gasną i chłodnieją
    ctx.fillRect(0,0,w,h);
    ctx.globalCompositeOperation='source-over';
    ctx.fillStyle=`rgba(12,16,34,${a*0.34})`;           // ogólne przyciemnienie
    ctx.fillRect(0,0,w,h);
    ctx.restore();
  };

  /* ---------- pętla odtwarzania ---------- */
  function tick(ts){
    S.raf=0; if(!S.playing) return;
    const dt = S.t0 ? (ts-S.t0)/1000 : 0; S.t0=ts;
    S.min = (S.min + dt*S.speed/60) % 1440;
    refresh();
    S.raf = requestAnimationFrame(tick);
  }
  function play(on){
    S.playing = on;
    S.t0 = 0;
    $('#simPlay').innerHTML = `<svg class="i"><use href="#i-${on?'pause':'play2'}"/></svg>`;
    if(on){ S.raf = requestAnimationFrame(tick); }
    else if(S.raf){ cancelAnimationFrame(S.raf); S.raf=0; }
  }
  function open(on){
    S.open=on;
    $('#simSheet').hidden=!on;
    $('#simBtn').classList.toggle('on',on);
    document.body.classList.toggle('sim-open',on);
    cv.classList.toggle('sim-gray',on);             // na razie cały rysunek w szarości
    if(!on){ play(false); fade.clear(); } else { cache.key=''; refresh(); }
    if(window.syncWeatherCard) syncWeatherCard();
    if(window.draw) draw();
  }

  /* ---------- podpięcie ---------- */
  $('#simBtn').addEventListener('click',()=>open(!S.open));
  $('#simClose').addEventListener('click',()=>open(false));
  $('#simPlay').addEventListener('click',()=>play(!S.playing));
  /* przewijanie po wykresie — ta sama skala co dane, więc kropka nigdy się nie rozjeżdża */
  (function(){
    const chart=$('#simChart'); let scrub=false;
    const setFromX=e=>{
      const r=chart.getBoundingClientRect();
      S.min=clamp((e.clientX-r.left)/r.width,0,1)*1439;
      refresh();
    };
    chart.addEventListener('pointerdown',e=>{ scrub=true; chart.setPointerCapture(e.pointerId);
      if(S.playing) play(false); setFromX(e); });
    chart.addEventListener('pointermove',e=>{ if(scrub) setFromX(e); });
    chart.addEventListener('pointerup',e=>{ scrub=false; try{chart.releasePointerCapture(e.pointerId);}catch(_){} });
    chart.addEventListener('pointercancel',()=>{ scrub=false; });
  })();
  $('#simSpeed').addEventListener('change',e=>{ S.speed=+e.target.value; S.t0=0; });
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape' && S.open) open(false);
    if(e.key===' ' && S.open && e.target===document.body){ e.preventDefault(); play(!S.playing); }
  });
  window.addEventListener('resize',()=>{ if(S.open) drawChart(); });

  /* przeliczenie po zmianie projektu albo pogody */
  const _refreshAll = window.refreshAll;
  window.refreshAll = function(){ _refreshAll(); if(S.open){ cache.key=''; refresh(); } };

  window.HvacSim = { open, get state(){ return {...S}; }, dayCurve };
})();
