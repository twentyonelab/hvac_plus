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
    if(groups[id]===true) g.classList.add('collapsed');
    else if(groups[id]===undefined && id==='legend') g.classList.add('collapsed');
    $('.tgroup-h',g).addEventListener('click',()=>{
      g.classList.toggle('collapsed');
      groups[id]=g.classList.contains('collapsed'); saveGroups();
    });
  });
  function revealTool(t){
    const b=document.querySelector('.tbtn[data-tool="'+t+'"]'); const g=b&&b.closest('.tgroup');
    if(g&&g.classList.contains('collapsed')){ g.classList.remove('collapsed'); groups[g.dataset.group]=false; saveGroups(); }
  }
  const _setTool=window.setTool;
  window.setTool=function(t){ _setTool(t); revealTool(t); };

  /* ---------- przełącznik kondygnacji (pigułki) + tytuł sceny ---------- */
  window.renderFloorbar=function(){
    const fb=document.getElementById('floorbar'); fb.innerHTML='';
    state.floors.forEach((f,i)=>{
      const b=document.createElement('button'); b.type='button'; b.textContent=f.name; b.title='Pokaż kondygnację: '+f.name;
      b.className=(i===state.activeFloor&&!window.__mode3D)?'active':'';
      b.onclick=()=>{ if(window.__mode3D){ v3SwitchTab('proj'); setMode3D(false); } state.activeFloor=i; sel=null; refreshAll(); fitView(); };
      fb.appendChild(b);
    });
    const add=document.createElement('button'); add.type='button'; add.className='fb-add'; add.title='Dodaj kondygnację'; add.innerHTML=icon('plus');
    add.onclick=()=>{ snapshot(); state.floors.push(newFloor(state.floors.length===1?'Piętro':'Kondygnacja '+(state.floors.length+1))); state.activeFloor=state.floors.length-1; refreshAll(); };
    fb.appendChild(add);
    const b3=document.createElement('button'); b3.type='button'; b3.className='b3d'+(window.__mode3D?' active':'');
    b3.innerHTML=icon('box')+'<span>'+(window.__mode3D?'2D':'3D')+'</span>';
    b3.title=window.__mode3D?'Wróć do edycji rzutu':'Widok 3D instalacji (aksonometria)';
    b3.onclick=()=>{ if(!window.setMode3D) return; if(window.__mode3D){ v3SwitchTab('proj'); setMode3D(false); } else { v3SwitchTab('v3d'); setMode3D(true); } };
    fb.appendChild(b3);
    updateStage();
  };

  function updateStage(){
    const f=F(); if(!f) return;
    const C=window.CALC||{};
    const title=$('#stageTitle'), sub=$('#stageSubTxt');
    const name=(state.name||$('#projName').value||'').trim();
    if(window.__mode3D){
      title.textContent='Widok 3D';
      sub.textContent=`${name||'Projekt bez nazwy'} · aksonometria · ${state.floors.length} ${state.floors.length===1?'kondygnacja':'kondygnacje'}`;
      return;
    }
    title.textContent=f.name||'Kondygnacja';
    const area=f.rooms.reduce((a,r)=>a+(((C.rooms||{})[r.id]||{}).area||0),0);
    const parts=[name||'Projekt bez nazwy', `${f.rooms.length} ${f.rooms.length===1?'pomieszczenie':f.rooms.length<5&&f.rooms.length>0?'pomieszczenia':'pomieszczeń'}`];
    if(area>0) parts.push(`${fmt(area,1)} m²`);
    if(!f.pxPerM) parts.push('skala nieskalibrowana');
    sub.textContent=parts.join(' · ');
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
  $('#projName').addEventListener('input',e=>{ state.name=e.target.value; updateStage(); });

  /* ---------- fonty: przerysuj canvas po załadowaniu Outfit ---------- */
  if(document.fonts&&document.fonts.ready) document.fonts.ready.then(()=>{ try{ draw(); }catch(e){} });

  /* ---------- start ---------- */
  renderFloorbar(); updateKpis();
})();
