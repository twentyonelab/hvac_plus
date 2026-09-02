/* =====================================================================
   HVAC+ planer — przeciąganie kart urządzeń na rzut (drag & drop)
   Karta z szyny narzędzi unosi się za kursorem (przechył zależny od
   prędkości), nad rzutem pokazuje podświetlone pomieszczenie i podgląd
   symbolu w miejscu upuszczenia. Upuszczenie wstawia węzeł tą samą
   ścieżką co kliknięcie narzędziem (placeNodeAt w engine-core.js).
   Pointer Events — działa myszą, piórem i palcem, bez zależności.
   ===================================================================== */
(function(){
  'use strict';

  const THRESHOLD = 5;      // px — dopiero po tym ruchu zaczynamy przeciąganie
  const LERP      = 0.42;   // wygładzanie pozycji karty (widoczny „bezwład”)
  const TILT_MAX  = 9;      // ° — maksymalny przechył karty przy szybkim ruchu

  const cards = Array.from(document.querySelectorAll('.dcard[data-tool]'));
  if(!cards.length) return;

  const wrap = document.getElementById('canvaswrap');
  let drag = null;      // trwające przeciąganie
  let preview = null;   // {type,x,y,room} — podgląd rysowany na canvasie
  let pop = null;       // {x,y,r,t0} — błysk po upuszczeniu
  let raf = 0;
  let justDragged = false;   // blokuje klik-„uzbrój narzędzie” po przeciągnięciu

  /* ---------- podgląd i błysk na canvasie (nakładka na draw) ---------- */
  const _draw = window.draw;
  window.draw = function(){
    _draw();
    if(window.__mode3D) return;
    if(preview) drawPreview(preview);
    if(pop) drawPop();
  };

  function worldCtx(){
    ctx.save();
    ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
    ctx.translate(view.x,view.y); ctx.scale(view.z,view.z);
  }
  const lw = k => k/view.z;

  function drawPreview(p){
    const d = NODE_DEFS[p.type]; if(!d) return;
    const col = d.c || d.color || '#12314e';
    const r = d.r/view.z*Math.min(view.z,1.6);
    worldCtx();

    // pomieszczenie, w które trafi element
    if(p.room && p.room.pts && p.room.pts.length>2){
      ctx.beginPath();
      p.room.pts.forEach((q,i)=> i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));
      ctx.closePath();
      ctx.fillStyle='rgba(78,203,149,.10)'; ctx.fill();
      ctx.strokeStyle='#4ecb95'; ctx.lineWidth=lw(2); ctx.setLineDash([lw(7),lw(5)]); ctx.stroke(); ctx.setLineDash([]);
    }

    // prowadnice do krawędzi rysunku
    ctx.strokeStyle='rgba(28,28,30,.16)'; ctx.lineWidth=lw(1); ctx.setLineDash([lw(4),lw(4)]);
    ctx.beginPath();
    ctx.moveTo(p.x-lw(2000),p.y); ctx.lineTo(p.x+lw(2000),p.y);
    ctx.moveTo(p.x,p.y-lw(2000)); ctx.lineTo(p.x,p.y+lw(2000));
    ctx.stroke(); ctx.setLineDash([]);

    // pulsujący pierścień celu
    const t=(performance.now()%1400)/1400;
    ctx.beginPath(); ctx.arc(p.x,p.y,r*(1.9+0.25*Math.sin(t*Math.PI*2)),0,7);
    ctx.strokeStyle='rgba(78,203,149,.9)'; ctx.lineWidth=lw(1.8); ctx.setLineDash([lw(5),lw(4)]); ctx.stroke(); ctx.setLineDash([]);

    // symbol elementu — jak w rysunku docelowym, tylko półprzezroczysty
    ctx.globalAlpha=0.85;
    ctx.beginPath();
    if(p.type==='person'){
      ctx.arc(p.x,p.y-r*0.55,r*0.42,0,7); ctx.fillStyle=col; ctx.fill();
      ctx.beginPath(); ctx.moveTo(p.x-r*0.75,p.y+r*0.9);
      ctx.quadraticCurveTo(p.x-r*0.8,p.y-r*0.15,p.x,p.y-r*0.1);
      ctx.quadraticCurveTo(p.x+r*0.8,p.y-r*0.15,p.x+r*0.75,p.y+r*0.9);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle='#fff'; ctx.lineWidth=lw(1.2); ctx.stroke();
    } else {
      if(p.type==='ahu') ctx.rect(p.x-r*1.4,p.y-r,r*2.8,r*2); else ctx.arc(p.x,p.y,r,0,7);
      ctx.fillStyle=col; ctx.fill();
      ctx.strokeStyle='#fff'; ctx.lineWidth=lw(1.6); ctx.stroke();
      ctx.fillStyle='#fff'; ctx.font=`700 ${r*0.9}px Outfit, Segoe UI`; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(d.sym||'',p.x,p.y+r*0.05);
    }
    ctx.globalAlpha=1;

    // etykieta z nazwą i pomieszczeniem
    const label = d.label + (p.room ? ' → '+(typeof roomName==='function'?roomName(p.room):(p.room.name||'')) : '');
    ctx.font=`600 ${lw(11.5)}px Outfit, Segoe UI`; ctx.textAlign='center'; ctx.textBaseline='top';
    const tw=ctx.measureText(label).width, pad=lw(6), h=lw(17), y=p.y-r*2.4-h;
    ctx.fillStyle='rgba(28,28,30,.92)';
    if(ctx.roundRect){ ctx.beginPath(); ctx.roundRect(p.x-tw/2-pad,y,tw+pad*2,h,lw(8)); ctx.fill(); }
    else ctx.fillRect(p.x-tw/2-pad,y,tw+pad*2,h);
    ctx.fillStyle='#fff'; ctx.fillText(label,p.x,y+lw(3));
    ctx.restore();
  }

  function drawPop(){
    const dt=(performance.now()-pop.t0)/420;
    if(dt>=1){ pop=null; return; }
    worldCtx();
    const e=1-Math.pow(1-dt,3);
    ctx.beginPath(); ctx.arc(pop.x,pop.y,pop.r*(0.9+e*2.6),0,7);
    ctx.strokeStyle=`rgba(78,203,149,${(1-dt)*0.9})`; ctx.lineWidth=lw(3*(1-dt)+0.6); ctx.stroke();
    ctx.restore();
    requestAnimationFrame(()=>draw());
  }

  /* ---------- pętla animacji karty ---------- */
  function tick(){
    raf=0; if(!drag) return;
    const g=drag.ghost;
    // poza rzutem: karta trzymana w miejscu chwytu; nad rzutem: odsunięta,
    // by nie przykrywać podglądu symbolu i pierścienia celu
    drag.tx = drag.over ? drag.px+16 : drag.px-drag.off.x;
    drag.ty = drag.over ? drag.py+18 : drag.py-drag.off.y;
    drag.rx += (drag.tx-drag.rx)*LERP;
    drag.ry += (drag.ty-drag.ry)*LERP;
    const vx=drag.tx-drag.rx;
    const tilt=Math.max(-TILT_MAX,Math.min(TILT_MAX,vx*0.45));
    const scale=drag.over?0.94:1.03;
    g.style.transform=`translate3d(${drag.rx}px,${drag.ry}px,0) rotate(${tilt.toFixed(2)}deg) scale(${scale})`;
    if(Math.abs(vx)>0.4||Math.abs(drag.ty-drag.ry)>0.4||drag.over) raf=requestAnimationFrame(tick);
  }
  const schedule=()=>{ if(!raf) raf=requestAnimationFrame(tick); };

  /* ---------- start / ruch / koniec ---------- */
  cards.forEach(card=>{
    card.setAttribute('draggable','false');
    card.addEventListener('dragstart',e=>e.preventDefault());   // natywny DnD przeszkadza
    card.addEventListener('pointerdown',e=>{
      if(e.button!==0||drag) return;
      const start={x:e.clientX,y:e.clientY};
      const rect=card.getBoundingClientRect();
      const off={x:e.clientX-rect.left,y:e.clientY-rect.top};
      let armed=false;
      try{ card.setPointerCapture(e.pointerId); }catch(_){}

      const move=ev=>{
        if(!armed){
          if(Math.hypot(ev.clientX-start.x,ev.clientY-start.y)<THRESHOLD) return;
          armed=true; begin(card,ev,off,rect);
        }
        onMove(ev);
      };
      const up=ev=>{
        document.removeEventListener('pointermove',move);
        document.removeEventListener('pointerup',up);
        document.removeEventListener('pointercancel',up);
        try{ card.releasePointerCapture(e.pointerId); }catch(_){}
        if(armed){ ev.preventDefault(); justDragged=true; setTimeout(()=>{justDragged=false;},0); finish(ev); }
      };
      document.addEventListener('pointermove',move);
      document.addEventListener('pointerup',up);
      document.addEventListener('pointercancel',up);
    });
  });

  function begin(card,e,off,rect){
    const ghost=card.cloneNode(true);
    ghost.className='dghost '+Array.from(card.classList).filter(c=>c!=='dcard').join(' ');
    ghost.style.width=rect.width+'px';
    document.body.appendChild(ghost);
    card.classList.add('dragging');
    document.body.classList.add('dnd');
    wrap.classList.add('dnd');
    drag={type:card.dataset.tool,card,ghost,off,
          px:e.clientX,py:e.clientY,
          tx:e.clientX-off.x,ty:e.clientY-off.y,
          rx:e.clientX-off.x,ry:e.clientY-off.y,
          over:false,hint:ghost.querySelector('.tx em'),
          hint0:(card.querySelector('.tx em')||{}).textContent||''};
    schedule();
  }

  function onMove(e){
    if(!drag) return;
    drag.px=e.clientX; drag.py=e.clientY;

    const r=cv.getBoundingClientRect();
    const inside = !window.__mode3D &&
      e.clientX>=r.left && e.clientX<=r.right && e.clientY>=r.top && e.clientY<=r.bottom;

    if(inside){
      const w=s2w(e.clientX-r.left,e.clientY-r.top);
      const room=(typeof roomAt==='function')?roomAt(w):null;
      preview={type:drag.type,x:w.x,y:w.y,room};
      if(drag.hint){
        drag.hint.textContent = room
          ? (typeof roomName==='function'?roomName(room):(room.name||'pomieszczenie'))
          : 'upuść, aby wstawić';
      }
    } else {
      preview=null;
      if(drag.hint) drag.hint.textContent=drag.hint0;
    }
    if(inside!==drag.over){
      drag.over=inside;
      drag.ghost.classList.toggle('over',inside);
      wrap.classList.toggle('dnd-over',inside);
    }
    schedule();
    draw();
  }

  function finish(e){
    const d=drag; drag=null;
    if(raf){ cancelAnimationFrame(raf); raf=0; }
    d.card.classList.remove('dragging');
    document.body.classList.remove('dnd');
    wrap.classList.remove('dnd','dnd-over');

    const placed = d.over && preview && !window.__mode3D;
    const at = placed ? {x:preview.x,y:preview.y} : null;
    preview=null;

    if(placed && typeof placeNodeAt==='function'){
      // karta „wpada” w miejsce upuszczenia, potem wstawiamy węzeł
      const r=cv.getBoundingClientRect(), s=w2s({x:at.x,y:at.y});
      const px=r.left+s.x/devicePixelRatio, py=r.top+s.y/devicePixelRatio;
      d.ghost.classList.add('back');
      d.ghost.style.transform=`translate3d(${px-24}px,${py-20}px,0) scale(.35)`;
      const n=placeNodeAt(d.type,at,{armSelect:false});
      const def=NODE_DEFS[d.type]||{};
      pop={x:at.x,y:at.y,r:(def.r||10)/view.z*Math.min(view.z,1.6),t0:performance.now()};
      draw();
      // ostrzeżenie silnika (element poza obrysem) jest ważniejsze niż potwierdzenie
      const needsRoom = d.type==='term_sup'||d.type==='term_exh'||d.type==='person';
      if(!(needsRoom && n && !n.roomId))
        toast(def.label+' wstawiony — przeciągnij kolejną kartę albo połącz przewodami.');
    } else {
      // powrót na miejsce
      const rect=d.card.getBoundingClientRect();
      d.ghost.classList.add('back');
      d.ghost.style.transform=`translate3d(${rect.left}px,${rect.top}px,0) scale(.9)`;
      draw();
    }
    setTimeout(()=>d.ghost.remove(),260);
  }

  /* Esc przerywa przeciąganie */
  document.addEventListener('keydown',e=>{
    if(e.key!=='Escape'||!drag) return;
    const d=drag; drag=null; preview=null;
    if(raf){ cancelAnimationFrame(raf); raf=0; }
    d.card.classList.remove('dragging');
    document.body.classList.remove('dnd');
    wrap.classList.remove('dnd','dnd-over');
    d.ghost.classList.add('back'); setTimeout(()=>d.ghost.remove(),260);
    draw();
  });

  /* karty działają też jak dawne przyciski narzędzi (klik = uzbrój narzędzie) */
  cards.forEach(card=>card.addEventListener('click',()=>{ if(!justDragged) setTool(card.dataset.tool); }));
  const _setTool=window.setTool;
  window.setTool=function(t){
    _setTool(t);
    cards.forEach(c=>c.classList.toggle('active',c.dataset.tool===t));
  };
})();
