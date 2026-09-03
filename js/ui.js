/* =====================================================================
   HVAC+ planer — warstwa UI (21 Apps Design System)
   Nakładka na silnik (engine-core / engine-3d / engine-ctrl):
   - zwijane grupy narzędzi w lewej szynie,
   - przełącznik kondygnacji jako pigułki + tytuł sceny,
   - pasek KPI w panelu prawym,
   - drobiazgi: fonty na canvasie, zapamiętywanie stanu UI.
   Silnik pozostaje bez zmian funkcjonalnych — podmieniamy tylko globalne
   funkcje renderujące (renderFloorbar, refreshAll, setTool).
   ===================================================================== */
(function(){
  'use strict';
  const $=(s,r)=>(r||document).querySelector(s);
  const icon=(n)=>`<svg class="i"><use href="#i-${n}"/></svg>`;

  /* ---------- zwijane grupy narzędzi ---------- */
  const KEY='hvacplus.ui.groups';
  let groups={};
  try{ groups=JSON.parse(localStorage.getItem(KEY)||'{}')||{}; }catch(e){ groups={}; }
  const saveGroups=()=>{ try{ localStorage.setItem(KEY,JSON.stringify(groups)); }catch(e){} };
  document.querySelectorAll('.tgroup').forEach(g=>{
    const id=g.dataset.group;
    const COLLAPSED_BY_DEFAULT=['auto','edit'];
    if(groups[id]===true) g.classList.add('collapsed');
    else if(groups[id]===undefined && COLLAPSED_BY_DEFAULT.includes(id)) g.classList.add('collapsed');
    $('.tgroup-h',g).addEventListener('click',()=>{
      g.classList.toggle('collapsed');
      groups[id]=g.classList.contains('collapsed'); saveGroups();
    });
  });
  function revealTool(t){
    const b=document.querySelector('[data-tool="'+t+'"]'); const g=b&&b.closest('.tgroup');
    if(g&&g.classList.contains('collapsed')){ g.classList.remove('collapsed'); groups[g.dataset.group]=false; saveGroups(); }
  }
  const _setTool=window.setTool;
  window.setTool=function(t){
    _setTool(t); revealTool(t);
    document.querySelectorAll('.vbtn[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===t));
  };

  /* ---------- przełącznik kondygnacji (pigułki) + tytuł sceny ---------- */
  window.renderFloorbar=function(){
    const fb=document.getElementById('floorbar'); fb.innerHTML='';
    state.floors.forEach((f,i)=>{
      const b=document.createElement('button'); b.type='button'; b.textContent=f.name; b.title='Pokaż kondygnację: '+f.name;
      b.className=(i===state.activeFloor&&!window.__mode3D)?'active':'';
      b.onclick=()=>{ if(window.__mode3D) setMode3D(false); state.activeFloor=i; sel=null; refreshAll(); fitView(); };
      fb.appendChild(b);
    });
    const add=document.createElement('button'); add.type='button'; add.className='fb-add'; add.title='Dodaj kondygnację'; add.innerHTML=icon('plus');
    add.onclick=()=>{ snapshot(); state.floors.push(newFloor(state.floors.length===1?'Piętro':'Kondygnacja '+(state.floors.length+1))); state.activeFloor=state.floors.length-1; refreshAll(); };
    fb.appendChild(add);
    updateStage(); syncMode();
  };

  function updateStage(){
    const el=$('#projName');
    if(el && document.activeElement!==el) el.value = state.name||'';
  }

  /* ---------- KPI w panelu prawym ---------- */
  function updateKpis(){
    const C=window.CALC||{}, B=C.balance||{}, P=C.press||{};
    $('#kpiV').textContent=B.V?`${fmt(B.V)} m³/h`:'—';
    $('#kpiP').textContent=(P.max!=null&&!isNaN(P.max)&&C.hasAhu)?`${fmt(P.max)} Pa`:'—';
    const u=$('#kpiU'); u.textContent=C.unit?C.unit.model:(state.floors.some(f=>f.nodes.some(n=>n.type==='ahu'))?'brak doboru':'—'); u.classList.toggle('long',u.textContent.length>10);
    $('#kpiU').title=C.unit?`${C.unit.model} — ${C.unit.v100} m³/h @100 Pa, odzysk ${C.unit.eta}%`:'';
  }
  const _refreshAll=window.refreshAll;
  window.refreshAll=function(){ _refreshAll(); updateKpis(); };

  /* nazwa projektu → podtytuł sceny na żywo */
  $('#projName').addEventListener('input',e=>{ state.name=e.target.value; });

  /* ---------- panel projektu: pełny ekran ---------- */
  const side=$('#side');
  function sideFull(on){
    side.classList.toggle('fs',on);
    $('#sideFs').hidden=on; $('#sideMin').hidden=!on; $('#sideClose').hidden=!on;
    document.body.classList.toggle('side-fs',on);
  }
  $('#sideFs').addEventListener('click',()=>sideFull(true));
  $('#sideMin').addEventListener('click',()=>sideFull(false));
  $('#sideClose').addEventListener('click',()=>sideFull(false));
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&side.classList.contains('fs')) sideFull(false);
    if(e.key.toLowerCase()==='f'&&!/input|textarea|select/i.test((e.target.tagName||''))&&!e.ctrlKey&&!e.metaKey)
      sideFull(!side.classList.contains('fs'));
  });

  /* ---------- kafelek pogody na rysunku ---------- */
  function syncWeatherCard(){
    const W=window.HvacWeather, card=$('#wxCard');
    if(!card) return;
    const r=W&&W.last;
    const v=(x,u,d=0)=> x==null? '—' : `${fmt(x,d)} ${u}`;
    card.hidden=false;
    if(!r){
      /* brak odczytu: kafelek zostaje na swoim miejscu i mówi, czego brakuje */
      card.classList.add('empty','min');
      $('#wxTemp').textContent='Pogoda';
      $('#wxDesc').textContent=(state.weatherPlace||'').trim()
        ? (W&&W.lastError? 'próba nieudana — ponowi się' : 'pobieranie…')
        : 'kliknij, aby podać lokalizację';
      card.title='Pogoda z Open-Meteo — kliknij, aby ustawić lokalizację w zakładce Sterowanie';
      return;
    }
    card.classList.remove('empty');
    $('#wxTemp').textContent = r.tempC==null? '—' : `${fmt(r.tempC,1)} °C`;
    $('#wxDesc').textContent = `zewnętrznie · ${r.text||'—'}`;
    $('#wxHum').textContent  = v(r.humidity,'%');
    $('#wxWind').textContent = v(r.windKmh,'km/h',0);
    $('#wxRad').textContent  = v(r.radiationWm2,'W/m²');
    $('#wxPlace').textContent= r.place||'—';
    card.title = `Odczyt ${r.ts}${W.ageMinutes()!=null?` (${W.ageMinutes()} min temu)`:''} · Open-Meteo`;
  }
  $('#wxCard').addEventListener('click',()=>{
    const card=$('#wxCard');
    if(card.classList.contains('empty')){       // bez odczytu: prowadzimy do ustawienia lokalizacji
      const t=document.querySelector('#tabs button[data-pane="ster"]');
      if(t){ t.click(); setTimeout(()=>{ const i=document.getElementById('wtPlace'); if(i){ i.focus(); i.select(); } },120); }
      return;
    }
    card.classList.toggle('min');
  });
  window.syncWeatherCard=syncWeatherCard;
  syncWeatherCard();
  setInterval(()=>{                     // odświeżenie kafelka; moduł sam pilnuje limitów zapytań
    const place=(state.weatherPlace||'').trim();
    if(place && window.HvacWeather) HvacWeather.read({place}).then(syncWeatherCard);
    else syncWeatherCard();
  }, 60000);
  if((state.weatherPlace||'').trim() && window.HvacWeather)
    HvacWeather.read({place:state.weatherPlace}).then(syncWeatherCard);

  /* ---------- legenda (przycisk w prawym dolnym rogu sceny) ---------- */
  const lgBtn=$('#legendBtn'), lgPop=$('#legendPop');
  const lgSet=open=>{ lgPop.hidden=!open; lgBtn.setAttribute('aria-expanded',String(open)); };
  lgSet(false);   // po otwarciu aplikacji legenda jest zwinięta
  try{ localStorage.removeItem('hvacplus.ui.legend'); }catch(e){}
  lgBtn.addEventListener('click',e=>{ e.stopPropagation(); lgSet(lgPop.hidden); });
  document.addEventListener('click',e=>{ if(!lgPop.hidden && !$('#legend').contains(e.target)) lgSet(false); });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!lgPop.hidden) lgSet(false); });

  /* =====================================================================
     NAKŁADKI NA OBSZARZE SCHEMATU
     Lewa góra — praca z rysunkiem: tryb widoku, kamera i warstwy,
     narzędzia wskazywania, edycja (cofnij / przywróć / usuń).
     Prawa góra — jak patrzę: zoom (lupa) i pod nią ustawienia obrotu 3D.
     ===================================================================== */
  const is3D = ()=>!!window.__mode3D;

  /* ---------- rozwijane panele ---------- */
  const popBtns = Array.from(document.querySelectorAll('[data-pop]'));
  function closePops(keep){
    popBtns.forEach(b=>{ const el=$('#'+b.dataset.pop); if(!el||el===keep) return;
      el.hidden=true; b.classList.remove('active'); });
  }
  popBtns.forEach(b=>b.addEventListener('click',e=>{
    e.stopPropagation();
    const el=$('#'+b.dataset.pop); if(!el) return;
    const willOpen=el.hidden;
    closePops(el);
    el.hidden=!willOpen; b.classList.toggle('active',willOpen);
    if(willOpen&&el.id==='orbPop') syncOrbit();
  }));
  document.addEventListener('click',e=>{ if(!e.target.closest('.vpop')&&!e.target.closest('[data-pop]')) closePops(); });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape') closePops(); });

  /* ---------- tryb widoku 2D / 3D ---------- */
  $('#modeSwitch').addEventListener('click',e=>{
    const b=e.target.closest('button[data-mode]'); if(!b) return;
    const want=b.dataset.mode==='3d';
    if(want!==is3D()&&window.setMode3D) setMode3D(want);
  });

  function syncMode(){
    const on=is3D();
    document.querySelectorAll('#modeSwitch button').forEach(b=>
      b.classList.toggle('active',(b.dataset.mode==='3d')===on));
    // kamera jest dostępna też w 2D (wybór widoku przełącza na 3D);
    // suwaki obrotu mają sens tylko w 3D
    $('#camBtn').title = on?'Widok i kamera':'Widok 3D i kamera';
    $('#orbBtn').hidden=!on;
    if(!on){ const o=$('#orbPop'); if(o) o.hidden=true; $('#orbBtn').classList.remove('active'); }
    // warstwy: rzutu albo modelu
    const l2=$('#layPop [data-layers="2d"]'), l3=$('#layPop [data-layers="3d"]');
    if(l2&&l3){ l2.hidden=on; l3.hidden=!on; }
    // narzędzia wskazywania działają w obu trybach, ale znaczą co innego
    const selBtn=$('.vbtn[data-tool="select"]'), panBtn=$('.vbtn[data-tool="pan"]');
    if(selBtn) selBtn.title = on?'Obracaj bryłę (przeciąganie)':'Wybierz / edytuj';
    if(panBtn) panBtn.title = on?'Przesuń model (przeciąganie)':'Przesuń widok';
    sync2dLayers();
  }

  /* ---------- kamera (3D) ---------- */
  const CAMS={iso:[-35,34],top:[0,89],front:[0,12],side:[90,12]};
  $('#camPop').addEventListener('click',e=>{
    const b=e.target.closest('[data-cam]'); if(!b) return;
    if(!is3D()&&window.setMode3D) setMode3D(true);
    const k=b.dataset.cam;
    if(k==='fit'){ if(window.fit3D) fit3D(); draw(); return; }
    const [t,el]=CAMS[k]; v3.theta=t*Math.PI/180; v3.elev=el*Math.PI/180;
    v3.fitted=false; if(window.fit3D) fit3D(); draw(); syncOrbit();
    document.querySelectorAll('#camPop [data-cam]').forEach(x=>x.classList.toggle('active',x===b));
  });
  $('#camPng').addEventListener('click',()=>{
    if(!window.render3DImage) return;
    const a=document.createElement('a');
    a.href=render3DImage(1800,1100);
    a.download=((state.name||'instalacja').replace(/[^\w\dąćęłńóśźżĄĆĘŁŃÓŚŹŻ -]/gi,'')||'instalacja')+'_3D.png';
    a.click(); draw();
  });

  /* ---------- styl wyświetlania: wyróżnienie jednej warstwy ---------- */
  $('#focusPop').addEventListener('click',e=>{
    const b=e.target.closest('[data-focus]'); if(!b) return;
    setFocusMode(b.dataset.focus);
    syncFocus();
  });
  function syncFocus(){
    const m=(typeof focusMode==='string')?focusMode:'all';
    document.querySelectorAll('#focusPop [data-focus]').forEach(b=>b.classList.toggle('active',b.dataset.focus===m));
    $('#focusBtn').classList.toggle('on',m!=='all');
    const note=$('#focusNote');
    if(m==='co2'){
      const live=window.CTRL&&CTRL.connected;
      note.textContent = live
        ? 'Pomieszczenia barwione stężeniem CO₂ z symulacji centrali; instalacja przygaszona.'
        : 'Podgląd CO₂ wymaga połączenia w zakładce „Sterowanie” — bez niego pomieszczenia mają barwy typów.';
    } else note.textContent='Wyróżniona warstwa zostaje w pełnym kolorze, reszta rysunku staje się szara i ledwie widoczna (20%). Działa tak samo w rzucie 2D i w widoku 3D.';
  }

  /* ---------- warstwy ---------- */
  document.querySelectorAll('#layPop [data-v3]').forEach(cb=>{
    cb.checked=!!v3[cb.dataset.v3];
    cb.addEventListener('change',()=>{ v3[cb.dataset.v3]=cb.checked; draw(); });
  });
  const bgChk=$('#lay2dBg'), lbChk=$('#lay2dLabels');
  bgChk.addEventListener('change',()=>{ const f=F(); if(!f) return; f.bgAlpha=bgChk.checked?0.65:0; draw(); });
  lbChk.addEventListener('change',()=>{ show2dLabels=lbChk.checked; draw(); });
  function sync2dLayers(){
    const f=F(); if(!f) return;
    bgChk.checked=(f.bgAlpha??0.65)>0;
    bgChk.disabled=!f.bg;
    bgChk.closest('.vchk').title=f.bg?'':'Ta kondygnacja nie ma wgranego podkładu';
    lbChk.checked=show2dLabels;
  }

  /* ---------- ustawienia obrotu (3D) ---------- */
  const th=$('#v3theta'), ev=$('#v3elev'), ex=$('#v3expl');
  function syncOrbit(){
    if(typeof v3==='undefined') return;   // v3 to const skryptu, nie właściwość window
    th.value=Math.round(-v3.theta*180/Math.PI); $('#v3thetaV').textContent=th.value+'°';
    ev.value=Math.round(v3.elev*180/Math.PI);   $('#v3elevV').textContent=ev.value+'°';
    ex.value=v3.explode;                        $('#v3explV').textContent=v3.explode+' m';
  }
  th.addEventListener('input',()=>{ v3Orbit(-th.value*Math.PI/180, v3.elev); $('#v3thetaV').textContent=th.value+'°'; draw(); });
  ev.addEventListener('input',()=>{ v3Orbit(v3.theta, ev.value*Math.PI/180); $('#v3elevV').textContent=ev.value+'°'; draw(); });
  ex.addEventListener('input',()=>{ v3.explode=+ex.value; $('#v3explV').textContent=ex.value+' m'; v3.fitted=false; draw(); });
  window.addEventListener('mouseup',()=>{ if(is3D()&&!$('#orbPop').hidden) syncOrbit(); });

  /* ---------- narzędzia wskazywania ---------- */
  document.querySelectorAll('.vbtn[data-tool]').forEach(b=>
    b.addEventListener('click',()=>setTool(b.dataset.tool)));

  /* ---------- edycja: cofnij / przywróć / usuń ---------- */
  $('#btnRedo').addEventListener('click',()=>{ if(window.redo) redo(); });
  let editSig='';
  function syncEdit(){
    const sig=(canUndo()?1:0)+'|'+(canRedo()?1:0)+'|'+(sel?1:0);
    if(sig===editSig) return; editSig=sig;
    $('#btnUndo').disabled=!canUndo();
    $('#btnRedo').disabled=!canRedo();
    $('#btnDelete').disabled=!sel;
  }

  /* stan przycisków odświeżamy przy każdym przerysowaniu (tanie, z sygnaturą) */
  const _drawUi=window.draw;
  window.draw=function(){ _drawUi(); syncEdit(); };

  /* ---------- podpowiedzi same gasną, żeby nie zasłaniały rysunku ---------- */
  const _setHint=window.setHint; let hintT=0;
  window.setHint=function(t){
    _setHint(t); clearTimeout(hintT);
    if(t) hintT=setTimeout(()=>_setHint(''),7000);
  };

  /* ---------- fonty: przerysuj canvas po załadowaniu Outfit ---------- */
  if(document.fonts&&document.fonts.ready) document.fonts.ready.then(()=>{ try{ draw(); }catch(e){} });

  /* ---------- start ---------- */
  renderFloorbar(); updateKpis(); syncMode(); syncOrbit(); setTool(tool); syncFocus();
})();
