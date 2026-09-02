/* ============================ WIDOK 3D — AKSONOMETRIA INSTALACJI ============================ */
/* Rysowany na głównym canvasie (#cv) po włączeniu zakładki „3D”. Czysty canvas 2D — bez bibliotek,
   działa offline. Kondygnacje wyrównywane po pionach o tym samym numerze (fallback: środek obrysu).  */
let mode3D=false;
const v3={theta:-35*Math.PI/180, elev:34*Math.PI/180, scale:38, ox:0, oy:0, explode:0,
          showRooms:true, showLabels:true, showFlows:true, showBg:true, showGrid:true, showWalls:true,
          drag:null, hover:null, fitted:false, hits:[]};
const V3_SLAB=0.30, V3_DUCT_DROP=0.30, V3_EXH_DROP=0.14, V3_PPM_FALLBACK=40;
const V3_COL={sup:'#2D62BE',exh:'#D12E4F',fresh:'#248964',out:'#A57327',mix:'#8154B6',none:'#B4B7BD',flxNone:'#D3D5DA'};

function v3RoomColor(role){
  return role==='exh'?'rgba(209,46,79,':role==='both'?'rgba(129,84,182,':role==='sup'?'rgba(45,98,190,':role==='excluded'?'rgba(142,144,150,':'rgba(142,144,150,';
}
/* podłogi w 3D: ten sam kolor rozbielony o połowę (jak tła w rzucie) */
function v3RoomFill(role){
  return role==='exh'?'rgba(232,150,167,':role==='both'?'rgba(192,169,218,':role==='sup'?'rgba(150,176,222,':'rgba(198,199,202,';
}
function v3CenterOf(f,ppm){
  const xs=[],ys=[];
  f.rooms.forEach(r=>r.pts.forEach(p=>{xs.push(p.x);ys.push(p.y);}));
  if(!xs.length) f.nodes.forEach(n=>{xs.push(n.x);ys.push(n.y);});
  if(!xs.length&&f.bg&&f.bgW){ xs.push(0,f.bgW); ys.push(0,f.bgH); }
  if(!xs.length) return null;
  return {x:(Math.min(...xs)+Math.max(...xs))/2/ppm, y:(Math.min(...ys)+Math.max(...ys))/2/ppm};
}
/* model 3D w metrach: kondygnacje, przesunięcia, poziomy */
function build3D(){
  const floors=[]; let z=0;
  state.floors.forEach((f,fi)=>{
    const ppm=f.pxPerM||V3_PPM_FALLBACK;
    const h=f.h||2.7;
    floors.push({f,fi,ppm,uncal:!f.pxPerM,z0:z,h,zd:z+h-V3_DUCT_DROP,zc:z+h,dx:0,dy:0,aligned:fi?'':'odniesienie'});
    z+=h+V3_SLAB+(v3.explode||0);
  });
  floors.forEach((fl,i)=>{
    if(!i) return;
    const prev=floors[i-1], pairs=[];
    fl.f.nodes.filter(n=>n.type==='riser').forEach(n=>{
      const m=prev.f.nodes.find(k=>k.type==='riser'&&(k.num||1)===(n.num||1)); if(m) pairs.push([n,m]);
    });
    if(pairs.length){
      let dx=0,dy=0;
      pairs.forEach(([n,m])=>{ dx+=(m.x/prev.ppm+prev.dx)-n.x/fl.ppm; dy+=(m.y/prev.ppm+prev.dy)-n.y/fl.ppm; });
      fl.dx=dx/pairs.length; fl.dy=dy/pairs.length; fl.aligned=`po pionach (${pairs.length})`;
    } else {
      const c1=v3CenterOf(prev.f,prev.ppm), c0=v3CenterOf(fl.f,fl.ppm);
      if(c1&&c0){ fl.dx=c1.x+prev.dx-c0.x; fl.dy=c1.y+prev.dy-c0.y; }
      fl.aligned='po środku obrysu (brak wspólnych pionów)';
    }
  });
  const roofZ=floors.length? floors[floors.length-1].zc+0.5 : 3;
  return {floors,roofZ};
}
/* środek bryły w świecie — punkt, wokół którego obraca się widok */
function v3Pivot(model){
  const m=model||build3D();
  let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9,z0=1e9,z1=-1e9,any=false;
  m.floors.forEach(fl=>{
    const pts=[];
    fl.f.rooms.forEach(r=>r.pts.forEach(p=>pts.push(p)));
    fl.f.nodes.forEach(n=>pts.push(n));
    if(!pts.length&&fl.f.bg&&fl.f.bgW) pts.push({x:0,y:0},{x:fl.f.bgW,y:fl.f.bgH});
    pts.forEach(p=>{ const w=v3W(fl,p); any=true;
      x0=Math.min(x0,w.X); x1=Math.max(x1,w.X); y0=Math.min(y0,w.Y); y1=Math.max(y1,w.Y); });
    z0=Math.min(z0,fl.z0); z1=Math.max(z1,fl.zc);
  });
  if(!any) return {X:0,Y:0,Z:(m.roofZ||3)/2};
  return {X:(x0+x1)/2, Y:(y0+y1)/2, Z:(z0+z1)/2};
}
/* zmiana kątów z zachowaniem punktu obrotu w tym samym miejscu na ekranie */
function v3Orbit(theta,elev,pivot,anchor){
  const p=pivot||v3Pivot();
  const a=anchor||v3P(p.X,p.Y,p.Z);
  v3.theta=theta; v3.elev=elev;
  const q=v3P(p.X,p.Y,p.Z);
  v3.ox+=a.x-q.x; v3.oy+=a.y-q.y;
}

/* rzut aksonometryczny: świat [m] -> ekran [px CSS]; n = „bliskość” do sortowania malarskiego */
function v3P(X,Y,Z,cam){
  const c=cam||v3;
  const ct=Math.cos(c.theta), st=Math.sin(c.theta), ce=Math.cos(c.elev), se=Math.sin(c.elev);
  const xr=X*ct-Y*st, yr=X*st+Y*ct;
  return {x:xr*c.scale+c.ox, y:(yr*se-Z*ce)*c.scale+c.oy, n:yr*ce+Z*se};
}
function v3ToCam(cam){ const c=cam||v3; const ct=Math.cos(c.theta), st=Math.sin(c.theta), ce=Math.cos(c.elev), se=Math.sin(c.elev); return {x:st*ce,y:ct*ce,z:se}; }
function v3W(fl,p){ return {X:p.x/fl.ppm+fl.dx, Y:p.y/fl.ppm+fl.dy}; }

function v3Bounds(model,cam){
  const pts=[];
  model.floors.forEach(fl=>{
    const f=fl.f, corners=[];
    f.rooms.forEach(r=>r.pts.forEach(p=>corners.push(p)));
    f.nodes.forEach(n=>corners.push(n));
    if(!corners.length&&f.bg&&f.bgW){ corners.push({x:0,y:0},{x:f.bgW,y:0},{x:0,y:f.bgH},{x:f.bgW,y:f.bgH}); }
    corners.forEach(p=>{ const w=v3W(fl,p); pts.push(v3P(w.X,w.Y,fl.z0,cam)); pts.push(v3P(w.X,w.Y,fl.zc,cam)); });
  });
  if(!pts.length){ [[0,0],[10,0],[0,8],[10,8]].forEach(([X,Y])=>{ pts.push(v3P(X,Y,0,cam)); pts.push(v3P(X,Y,model.roofZ,cam)); }); }
  const xs=pts.map(p=>p.x), ys=pts.map(p=>p.y);
  return {minx:Math.min(...xs),maxx:Math.max(...xs),miny:Math.min(...ys),maxy:Math.max(...ys)};
}
function fit3D(cam,W,H,pad){
  cam=cam||v3; W=W||cv.clientWidth; H=H||cv.clientHeight; pad=pad==null?70:pad;
  const model=build3D();
  const probe={theta:cam.theta,elev:cam.elev,scale:1,ox:0,oy:0};
  const b=v3Bounds(model,probe);
  const w=Math.max(1e-3,b.maxx-b.minx), h=Math.max(1e-3,b.maxy-b.miny);
  cam.scale=Math.max(2,Math.min((W-2*pad)/w,(H-2*pad)/h,400));
  cam.ox=W/2-(b.minx+b.maxx)/2*cam.scale;
  cam.oy=H/2-(b.miny+b.maxy)/2*cam.scale;
  if(cam===v3){ v3.fitted=true; draw(); }
}
/* pudełko: 8 narożników + widoczne ściany */
function v3Box(g,cam,X0,Y0,Z0,sx,sy,sz,fill,edge){
  const c=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]].map(([a,b,d])=>v3P(X0+a*sx,Y0+b*sy,Z0+d*sz,cam));
  const faces=[{i:[4,5,6,7],n:[0,0,1]},{i:[0,1,5,4],n:[0,-1,0]},{i:[1,2,6,5],n:[1,0,0]},{i:[2,3,7,6],n:[0,1,0]},{i:[3,0,4,7],n:[-1,0,0]},{i:[0,3,2,1],n:[0,0,-1]}];
  const tc=v3ToCam(cam);
  faces.forEach(fc=>{
    const vis=fc.n[0]*tc.x+fc.n[1]*tc.y+fc.n[2]*tc.z;
    if(vis<=0) return;
    const shade=0.55+0.45*vis;
    g.beginPath(); fc.i.forEach((k,j)=>j?g.lineTo(c[k].x,c[k].y):g.moveTo(c[k].x,c[k].y)); g.closePath();
    g.fillStyle=v3Shade(fill,shade); g.fill(); g.strokeStyle=edge||'rgba(28,28,30,.55)'; g.lineWidth=1; g.stroke();
  });
  return c;
}
function v3Shade(hex,k){ // przyciemnienie koloru #rrggbb o współczynnik k (0..1)
  const m=/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex); if(!m) return hex;
  const [r,g,b]=[1,2,3].map(i=>Math.round(parseInt(m[i],16)*k));
  return `rgb(${r},${g},${b})`;
}
function v3Cyl(g,cam,X,Y,Z,r,h,fill){ // krótki walec pionowy (anemostat / zawór)
  const top=[],bot=[]; for(let a=0;a<=24;a++){ const t=a/24*2*Math.PI; top.push(v3P(X+r*Math.cos(t),Y+r*Math.sin(t),Z+h,cam)); bot.push(v3P(X+r*Math.cos(t),Y+r*Math.sin(t),Z,cam)); }
  g.beginPath(); bot.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y)); g.fillStyle=v3Shade(fill,0.7); g.fill();
  g.beginPath(); top.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y)); g.fillStyle=fill; g.fill(); g.strokeStyle='rgba(255,255,255,.8)'; g.lineWidth=1; g.stroke();
}
/* główne rysowanie. g: kontekst 2D; W,H: rozmiar w px CSS; cam: kamera; opts.report -> bez podpowiedzi */
function render3D(g,W,H,cam,opts){
  cam=cam||v3; opts=opts||{};
  const C=window.CALC||{}, model=build3D(), tc=v3ToCam(cam);
  v3.hits=[];
  const dpr=opts.dpr||1;
  g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,W*dpr,H*dpr);
  g.setTransform(dpr,0,0,dpr,0,0);
  // tło
  const grd=g.createLinearGradient(0,0,0,H); grd.addColorStop(0,'#FAFAFB'); grd.addColorStop(1,'#E4E6EA'); g.fillStyle=grd; g.fillRect(0,0,W,H);
  // zakres w planie [m]
  let minX=1e9,maxX=-1e9,minY=1e9,maxY=-1e9;
  model.floors.forEach(fl=>{ const f=fl.f; const pts=[...f.rooms.flatMap(r=>r.pts),...f.nodes]; if(!pts.length&&f.bg&&f.bgW) pts.push({x:0,y:0},{x:f.bgW,y:f.bgH});
    pts.forEach(p=>{ const w=v3W(fl,p); minX=Math.min(minX,w.X);maxX=Math.max(maxX,w.X);minY=Math.min(minY,w.Y);maxY=Math.max(maxY,w.Y); }); });
  if(minX>maxX){ minX=0;maxX=10;minY=0;maxY=8; }
  // siatka terenu 1 m
  if(v3.showGrid){
    const step=(maxX-minX>45||maxY-minY>45)?5:1, x0=Math.floor(minX-2), x1=Math.ceil(maxX+2), y0=Math.floor(minY-2), y1=Math.ceil(maxY+2);
    g.strokeStyle='rgba(28,28,30,.10)'; g.lineWidth=1; g.beginPath();
    for(let X=x0;X<=x1;X+=step){ const a=v3P(X,y0,0,cam), b=v3P(X,y1,0,cam); g.moveTo(a.x,a.y); g.lineTo(b.x,b.y); }
    for(let Y=y0;Y<=y1;Y+=step){ const a=v3P(x0,Y,0,cam), b=v3P(x1,Y,0,cam); g.moveTo(a.x,a.y); g.lineTo(b.x,b.y); }
    g.stroke();
    // podziałka
    const a=v3P(x0,y1,0,cam), b=v3P(x0+step,y1,0,cam);
    g.strokeStyle='#8E9096'; g.lineWidth=2; g.beginPath(); g.moveTo(a.x,a.y); g.lineTo(b.x,b.y); g.stroke();
    g.fillStyle='#8E9096'; g.font='11px Outfit, Segoe UI'; g.textAlign='left'; g.fillText(`${step} m`,b.x+4,b.y+4);
  }
  const font=(w,s)=>`${w||''} ${s}px Outfit, Segoe UI`.trim();
  // kolejność malarska: kondygnacje od dołu; w kondygnacji: strop -> pomieszczenia -> ściany -> przewody -> węzły
  model.floors.forEach(fl=>{
    const f=fl.f;
    // ---- podkład rastrowy na stropie (transformacja afiniczna) ----
    if(v3.showBg&&f.bg){
      let img=bgCache[f.id];
      if(!img||img.src!==f.bg){ img=new Image(); img.src=f.bg; bgCache[f.id]=img; img.onload=()=>{ f.bgW=img.naturalWidth; f.bgH=img.naturalHeight; draw(); }; }
      if(img.complete&&img.naturalWidth){
        const p0=v3P(fl.dx,fl.dy,fl.z0,cam), pu=v3P(1/fl.ppm+fl.dx,fl.dy,fl.z0,cam), pv=v3P(fl.dx,1/fl.ppm+fl.dy,fl.z0,cam);
        g.save(); g.setTransform(dpr*(pu.x-p0.x),dpr*(pu.y-p0.y),dpr*(pv.x-p0.x),dpr*(pv.y-p0.y),dpr*p0.x,dpr*p0.y);
        g.globalAlpha=0.45;
        const R=f.roi; if(R){ const x0=Math.max(0,Math.min(R.x0,R.x1)), y0=Math.max(0,Math.min(R.y0,R.y1)), x1=Math.min(img.naturalWidth,Math.max(R.x0,R.x1)), y1=Math.min(img.naturalHeight,Math.max(R.y0,R.y1)); g.drawImage(img,x0,y0,x1-x0,y1-y0,x0,y0,x1-x0,y1-y0); }
        else g.drawImage(img,0,0);
        g.restore(); g.setTransform(dpr,0,0,dpr,0,0);
      }
    }
    // ---- pomieszczenia: podłoga + ściany szkieletowe ----
    if(v3.showRooms){
      const rooms=f.rooms.map(r=>{ const c=polyCentroid(r.pts), w=v3W(fl,c); return {r,n:v3P(w.X,w.Y,fl.z0,cam).n}; }).sort((a,b)=>a.n-b.n);
      rooms.forEach(({r})=>{
        const t=ROOM_TYPES[r.type]||{}, col=v3RoomColor(t.role), fillCol=v3RoomFill(t.role);
        const flo=r.pts.map(p=>{ const w=v3W(fl,p); return v3P(w.X,w.Y,fl.z0,cam); });
        g.beginPath(); flo.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y)); g.closePath();
        g.fillStyle=fillCol+(f.bg&&v3.showBg?'0.26)':'0.32)'); g.fill();
        if(window.CTRL&&CTRL.connected&&CTRL.roomCO2&&CTRL.roomCO2[r.id]!=null){ const c2=CTRL.roomCO2[r.id]; g.fillStyle=co2Color(c2,Math.min(0.5,Math.max(0,(c2-500)/1400))); g.fill(); }
        g.strokeStyle=col+'0.9)'; g.lineWidth=1.4; g.stroke();
        if(v3.showWalls){
          const cei=r.pts.map(p=>{ const w=v3W(fl,p); return v3P(w.X,w.Y,fl.zc,cam); });
          // ściany: tylne półprzezroczyste, wszystkie krawędzie jasne
          for(let i=0;i<r.pts.length;i++){
            const j=(i+1)%r.pts.length, a=v3W(fl,r.pts[i]), b=v3W(fl,r.pts[j]);
            const nx=(b.Y-a.Y), ny=-(b.X-a.X); // normalna (dowolny znak) — ściana widoczna „od tyłu”, gdy odwrócona od kamery
            const dot=nx*tc.x+ny*tc.y; const inside=polyCentroid(r.pts); const mid={x:(r.pts[i].x+r.pts[j].x)/2,y:(r.pts[i].y+r.pts[j].y)/2};
            const outward=((mid.x-inside.x)*nx+(mid.y-inside.y)*ny)>0? 1:-1;
            const back = dot*outward<0; // ściana odwrócona od kamery = tylna (nie zasłania wnętrza)
            if(back){ g.beginPath(); g.moveTo(flo[i].x,flo[i].y); g.lineTo(flo[j].x,flo[j].y); g.lineTo(cei[j].x,cei[j].y); g.lineTo(cei[i].x,cei[i].y); g.closePath();
              g.fillStyle=col+'0.06)'; g.fill(); }
          }
          g.strokeStyle=col+'0.35)'; g.lineWidth=1; g.beginPath();
          cei.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y)); g.closePath();
          flo.forEach((p,i)=>{ g.moveTo(p.x,p.y); g.lineTo(cei[i].x,cei[i].y); });
          g.stroke();
        }
        if(v3.showLabels){
          const c=polyCentroid(r.pts), w=v3W(fl,c), P=v3P(w.X,w.Y,fl.z0,cam), info=(C.rooms||{})[r.id];
          g.fillStyle='#1C1C1E'; g.textAlign='center'; g.font=font(600,Math.max(9,Math.min(13,cam.scale*0.3)));
          g.fillText(roomName(r),P.x,P.y);
          if(zoningOn()){ const z=roomZone(r); if(z){ const tw=g.measureText(roomName(r)).width; g.font=font(700,9.5); g.fillStyle=ZONES[z].c; g.fillText(ZONES[z].short,P.x+tw/2+11,P.y); g.fillStyle='#1C1C1E'; } }
          if(window.CTRL&&CTRL.connected&&CTRL.roomCO2&&CTRL.roomCO2[r.id]!=null){ const c2=CTRL.roomCO2[r.id]; g.font=font(700,10); g.fillStyle=co2Color(c2,1); g.fillText(`CO₂ ${fmt(c2)}`,P.x,P.y+24); }
          if(info&&(info.sup||info.exh)){ g.font=font('',Math.max(8,Math.min(11,cam.scale*0.25))); g.fillStyle='#6B6D73';
            g.fillText((info.sup?`N ${fmt(info.sup)}`:'')+(info.sup&&info.exh?' · ':'')+(info.exh?`W ${fmt(info.exh)}`:'')+' m³/h',P.x,P.y+12); }
        }
      });
    }
    // ---- przewody na poziomie zd ----
    const R3=buildRoutes(f);
    const segs=f.segs.map(s=>{ const pts=R3[s.id]||[]; if(pts.length<2) return null;
      const mid=pts[Math.floor(pts.length/2)], w=v3W(fl,mid); return {s,pts,n:v3P(w.X,w.Y,fl.zd,cam).n}; }).filter(Boolean).sort((a,b)=>a.n-b.n);
    segs.forEach(({s,pts})=>{
      const res=(C.segs||{})[s.id]||{};
      const col= s.kind==='flx' ? (res.side==='sup'?V3_COL.sup:res.side==='exh'?V3_COL.exh:res.side==='mix'?V3_COL.mix:V3_COL.flxNone)
                                : (res.side==='fresh'?V3_COL.fresh:res.side==='out'?V3_COL.out:res.side==='sup'?V3_COL.sup:res.side==='exh'?V3_COL.exh:res.side==='mix'?V3_COL.mix:V3_COL.none);
      const zSeg=fl.zd-((res.side==='exh'||res.side==='out')?V3_EXH_DROP:0); // wywiew poziom niżej — trasy się nie pokrywają
      const sp=pts.map(p=>{ const w=v3W(fl,p); return v3P(w.X,w.Y,zSeg,cam); });
      const isSel=sel&&sel.kind==='seg'&&sel.id===s.id&&fl.fi===state.activeFloor;
      g.lineCap='round'; g.lineJoin='round';
      if(s.kind==='flx'){
        const tubes=res.tubes||1, wpx=Math.max(2.2,Math.min(9,(state.flxDia/1000)*cam.scale*Math.min(tubes,3)));
        g.beginPath(); sp.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));
        g.strokeStyle=isSel?'#4ECB95':col; g.lineWidth=wpx+2; g.globalAlpha=.35; g.stroke(); g.globalAlpha=1;
        g.setLineDash([Math.max(4,wpx*1.6),Math.max(3,wpx)]); if(window.CTRL&&CTRL.connected){ const lq=CTRL.live.segs[s.id]||0, lk=res.q?Math.min(1.6,lq/res.q):1; g.lineDashOffset=-CTRL.dash*lk; g.lineWidth=wpx*Math.max(0.5,lk); } else g.lineWidth=wpx; g.stroke(); g.setLineDash([]); g.lineDashOffset=0;
      } else {
        const d=res.d||125, wpx=Math.max(3,Math.min(18,d/1000*cam.scale));
        g.beginPath(); sp.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));
        g.strokeStyle=v3Shade(col,0.75); g.lineWidth=wpx+2; g.stroke();
        g.strokeStyle=isSel?'#4ECB95':col; g.lineWidth=wpx; g.stroke();
        g.strokeStyle='rgba(255,255,255,.45)'; g.lineWidth=Math.max(1,wpx*0.28); g.stroke();
      }
      if(v3.showFlows&&res.q){
        const m=labelPoint(sp,s.kind);
        const label= (window.CTRL&&CTRL.connected) ? `${fmt(CTRL.live.segs[s.id]||0)} m³/h ▶` : (s.kind==='flx' ? `${fmt(res.q)} m³/h · ${res.tubes}×FLX${state.flxDia}` : `${fmt(res.q)} m³/h · Ø${res.d}`);
        g.font=font(600,10); g.textAlign='center'; const tw=g.measureText(label).width;
        g.fillStyle='rgba(255,255,255,.85)'; g.fillRect(m.x-tw/2-3,m.y-17,tw+6,13); g.fillStyle='#1C1C1E'; g.fillText(label,m.x,m.y-7);
      }
    });
    // ---- piony (do wyższej kondygnacji) ----
    f.nodes.filter(n=>n.type==='riser').forEach(n=>{
      const up=model.floors.slice(fl.fi+1).find(o=>o.f.nodes.some(k=>k.type==='riser'&&(k.num||1)===(n.num||1)));
      const w=v3W(fl,n); const a=v3P(w.X,w.Y,fl.zd,cam);
      if(up){ const b=v3P(w.X,w.Y,up.zd,cam);
        g.strokeStyle='#4A4B50'; g.lineWidth=Math.max(4,Math.min(16,0.16*cam.scale)); g.lineCap='round'; g.beginPath(); g.moveTo(a.x,a.y); g.lineTo(b.x,b.y); g.stroke();
        g.strokeStyle='rgba(255,255,255,.4)'; g.lineWidth=Math.max(1,0.04*cam.scale); g.stroke();
      }
      g.fillStyle='#4A4B50'; g.beginPath(); g.arc(a.x,a.y,Math.max(4,0.1*cam.scale),0,7); g.fill(); g.strokeStyle='#fff'; g.lineWidth=1.5; g.stroke();
      g.fillStyle='#fff'; g.font=font(700,Math.max(8,Math.min(11,0.12*cam.scale))); g.textAlign='center'; g.textBaseline='middle'; g.fillText('P'+(n.num||1),a.x,a.y); g.textBaseline='alphabetic';
      v3.hits.push({x:a.x,y:a.y,n,fl});
    });
    // ---- węzły (sortowane po bliskości) ----
    const nodes=f.nodes.filter(n=>n.type!=='riser').map(n=>{ const w=v3W(fl,n); return {n,w,nn:v3P(w.X,w.Y,fl.zd,cam).n}; }).sort((a,b)=>a.nn-b.nn);
    nodes.forEach(({n,w})=>{
      const info=(C.nodes||{})[n.id]||{};
      const isSel=sel&&sel.kind==='node'&&sel.id===n.id&&fl.fi===state.activeFloor;
      let top;
      if(n.type==='ahu'){
        const sx=0.7,sy=0.55,sz=1.15, X=w.X-sx/2, Y=w.Y-sy/2;
        const a=v3P(w.X,w.Y,fl.z0+sz,cam), b=v3P(w.X,w.Y,fl.zd,cam);
        g.strokeStyle='#4A4B50'; g.lineWidth=Math.max(3,0.12*cam.scale); g.beginPath(); g.moveTo(a.x,a.y); g.lineTo(b.x,b.y); g.stroke();
        v3Box(g,cam,X,Y,fl.z0,sx,sy,sz,isSel?'#A9EBC9':'#2F3033','rgba(255,255,255,.35)');
        top=v3P(w.X,w.Y,fl.z0+sz,cam);
        g.fillStyle='#fff'; g.font=font(700,Math.max(8,Math.min(12,0.14*cam.scale))); g.textAlign='center'; g.textBaseline='middle';
        const cp=v3P(w.X,w.Y,fl.z0+sz*0.55,cam); g.fillText('HRU',cp.x,cp.y); g.textBaseline='alphabetic';
        if(v3.showLabels&&C.unit){ g.fillStyle='#2F3033'; g.font=font(600,10.5); g.fillText(`21LAB ${C.unit.model}`,top.x,top.y-14); }
      } else if(n.type==='man_sup'||n.type==='man_exh'){
        const s=0.42, col=n.type==='man_sup'?V3_COL.sup:V3_COL.exh, zm=fl.zd-(n.type==='man_exh'?V3_EXH_DROP:0);
        v3Box(g,cam,w.X-s/2,w.Y-s/2,zm-0.12,s,s,0.24,isSel?'#A9EBC9':col,'rgba(255,255,255,.5)');
        top=v3P(w.X,w.Y,fl.zd+0.12,cam);
      } else if(n.type==='term_sup'||n.type==='term_exh'){
        const col=n.type==='term_sup'?V3_COL.sup:V3_COL.exh, r=0.125;
        const zt=fl.zd-(n.type==='term_exh'?V3_EXH_DROP:0);
        const a=v3P(w.X,w.Y,zt,cam), b=v3P(w.X,w.Y,fl.zd-0.22-V3_EXH_DROP,cam);
        g.strokeStyle=col; g.lineWidth=Math.max(2,0.08*cam.scale); g.beginPath(); g.moveTo(a.x,a.y); g.lineTo(b.x,b.y); g.stroke();
        v3Cyl(g,cam,w.X,w.Y,fl.zd-0.26-V3_EXH_DROP,r,0.05,isSel?'#A9EBC9':col);
        top=b;
        if(v3.showFlows&&info.q){ const LIVE=window.CTRL&&CTRL.connected; const q=LIVE?(CTRL.live.nodes[n.id]??info.q):info.q; g.fillStyle=LIVE?'#22815E':col; g.font=font(600,9.5); g.textAlign='center'; g.fillText(`${fmt(q)}`,top.x,top.y+Math.max(10,0.2*cam.scale)); }
      } else if(n.type==='intake'||n.type==='exhout'){
        const col=n.type==='intake'?V3_COL.fresh:V3_COL.out, s=0.35;
        const a=v3P(w.X,w.Y,fl.zd,cam), b=v3P(w.X,w.Y,model.roofZ,cam);
        g.strokeStyle=v3Shade(col,0.8); g.lineWidth=Math.max(4,Math.min(14,0.16*cam.scale)); g.lineCap='round'; g.beginPath(); g.moveTo(a.x,a.y); g.lineTo(b.x,b.y); g.stroke();
        v3Box(g,cam,w.X-s/2,w.Y-s/2,model.roofZ,s,s,0.3,isSel?'#A9EBC9':col,'rgba(255,255,255,.5)');
        top=v3P(w.X,w.Y,model.roofZ+0.3,cam);
        if(v3.showLabels){ g.fillStyle=col; g.font=font(600,10); g.textAlign='center'; g.fillText(n.type==='intake'?'czerpnia':'wyrzutnia',top.x,top.y-6); }
      }
      else if(n.type==='person'){
        v3Cyl(g,cam,w.X,w.Y,fl.z0,0.17,1.25,isSel?'#A9EBC9':'#7B5CC1');
        const hp=v3P(w.X,w.Y,fl.z0+1.45,cam); g.beginPath(); g.arc(hp.x,hp.y,Math.max(3,0.12*cam.scale),0,7); g.fillStyle=isSel?'#A9EBC9':'#9E85D6'; g.fill(); g.strokeStyle='#fff'; g.lineWidth=1; g.stroke();
        top=v3P(w.X,w.Y,fl.z0+1.7,cam);
      }
      if(top) v3.hits.push({x:top.x,y:top.y,n,fl});
    });
    // ---- etykieta kondygnacji ----
    if(v3.showLabels){
      // etykieta przy skrajnie lewym narożniku obrysu kondygnacji (na poziomie stropu)
      const cand=[...f.rooms.flatMap(r=>r.pts),...f.nodes]; if(!cand.length&&f.bg&&f.bgW) cand.push({x:0,y:0},{x:f.bgW,y:0},{x:0,y:f.bgH},{x:f.bgW,y:f.bgH});
      if(cand.length){
        let P=null; cand.forEach(p=>{ const w=v3W(fl,p), q=v3P(w.X,w.Y,fl.z0,cam); if(!P||q.x<P.x) P=q; });
        g.fillStyle=fl.fi===state.activeFloor?'#1C1C1E':'#8E9096'; g.font=font(700,12.5); g.textAlign='right';
        g.fillText(f.name+(fl.uncal?' (skala ~)':''),P.x-10,P.y+4);
        g.strokeStyle='rgba(142,144,150,.5)'; g.lineWidth=1; g.beginPath(); g.moveTo(P.x-8,P.y); g.lineTo(P.x,P.y); g.stroke();
      }
    }
  });
  // ---- podpowiedź / ostrzeżenia ----
  if(!opts.report){
    if(window.drawLiveBadge&&g===ctx) drawLiveBadge();
    const unc=model.floors.filter(x=>x.uncal).map(x=>x.f.name);
    if(unc.length){ g.fillStyle='rgba(192,48,72,.9)'; g.font=font(600,11.5); g.textAlign='left';
      g.fillText(`Uwaga: skala nieskalibrowana (${unc.join(', ')}) — przyjęto ${V3_PPM_FALLBACK} px/m. Skalibruj w widoku 2D.`,12,H-34); }
    if(v3.hover){ const h=v3.hover, d=NODE_DEFS[h.n.type], info=(C.nodes||{})[h.n.id]||{};
      const txt=`${d.label}${h.n.type==='riser'?' '+(h.n.num||1):''} · ${h.fl.f.name}${info.q?` · ${fmt(info.q)} m³/h`:''}`;
      g.font=font(600,11.5); const tw=g.measureText(txt).width;
      g.fillStyle='rgba(28,28,30,.92)'; g.fillRect(h.x+10,h.y-26,tw+12,20); g.fillStyle='#fff'; g.textAlign='left'; g.fillText(txt,h.x+16,h.y-12); }
  }
  return model;
}
function draw3D(){
  const dpr=devicePixelRatio, W=cv.clientWidth, H=cv.clientHeight;
  if(!v3.fitted) fit3D(v3,W,H);
  const model=render3D(ctx,W,H,v3,{dpr});
  document.getElementById('stScale').textContent=`3D: obrót ${Math.round(-v3.theta*180/Math.PI)}°, nachylenie ${Math.round(v3.elev*180/Math.PI)}°`;
  document.getElementById('stSel').textContent=`kondygnacje: ${model.floors.map(x=>x.f.name+(x.aligned&&x.fi?' ⟵ '+x.aligned:'')).join(' | ')}`;
}
/* obraz do raportu */
function render3DImage(W,H,o){
  W=W||1400; H=H||860; o=o||{};
  const oc=document.createElement('canvas'); oc.width=W; oc.height=H;
  const cam={theta:o.theta??v3.theta,elev:o.elev??v3.elev,scale:1,ox:0,oy:0};
  const savedExplode=v3.explode; if(o.explode!=null) v3.explode=o.explode;
  const model=build3D(), b=v3Bounds(model,cam), pad=50;
  cam.scale=Math.max(2,Math.min((W-2*pad)/Math.max(1e-3,b.maxx-b.minx),(H-2*pad)/Math.max(1e-3,b.maxy-b.miny),400));
  cam.ox=W/2-(b.minx+b.maxx)/2*cam.scale; cam.oy=H/2-(b.miny+b.maxy)/2*cam.scale;
  const sv={hover:v3.hover}; v3.hover=null;
  render3D(oc.getContext('2d'),W,H,cam,{dpr:1,report:true});
  v3.hover=sv.hover; v3.explode=savedExplode;
  return oc.toDataURL('image/png');
}
/* ---------- tryb 3D: przełączanie ---------- */
function setMode3D(on){
  on=!!on; if(mode3D===on){ draw(); return; }
  mode3D=on; window.__mode3D=on; draft=null; mouse.panStart=null; mouse.dragNode=null; v3.drag=null; v3.hover=null;
  cv.style.cursor= on?'grab':(tool==='pan'?'grab':tool==='select'?'default':'crosshair');
  document.getElementById('dropzone').classList.toggle('show', !on && (()=>{const f=F();return !f.bg&&!f.rooms.length&&!f.nodes.length;})());
  if(on){ setHint('Widok 3D: przeciągaj, aby obracać · kółko — zoom · prawy przycisk / Shift — przesuwanie · „Dopasuj” — wyśrodkuj. Przycisk „2D” w lewym górnym rogu wraca do edycji rzutu.'); v3.fitted=false; }
  else setHint(TOOL_HINTS[tool]||'');
  renderFloorbar(); draw();
}
function v3SwitchTab(p){
  currentPane=p;
  document.querySelectorAll('#tabs button').forEach(x=>x.classList.toggle('active',x.dataset.pane===p));
  document.querySelectorAll('.pane').forEach(x=>x.classList.toggle('active',x.id==='pane-'+p));
  renderPane(p);
}
/* zakładka „3D” w panelu bocznym */
function render3DPane(el){
  const deg=r=>Math.round(r*180/Math.PI);
  const model=build3D();
  el.innerHTML=`
  <h3>Widok 3D instalacji (aksonometria)</h3>
  <p class="note">Model wyświetlany jest na głównym obszarze roboczym. <b>Przeciągaj</b> myszą, aby obracać; <b>kółko</b> — zoom; <b>prawy przycisk</b> lub <b>Shift</b> — przesuwanie. Kondygnacje ustawiane są jedna nad drugą i wyrównywane po pionach o tym samym numerze.</p>
  <div class="field"><label>Obrót [°]</label><input type="range" id="v3theta" min="-180" max="180" step="1" value="${-deg(v3.theta)}" style="width:150px"><span id="v3thetaV" style="width:34px;font-size:12px">${-deg(v3.theta)}°</span></div>
  <div class="field"><label>Nachylenie [°]</label><input type="range" id="v3elev" min="5" max="89" step="1" value="${deg(v3.elev)}" style="width:150px"><span id="v3elevV" style="width:34px;font-size:12px">${deg(v3.elev)}°</span></div>
  <div class="field"><label>Rozsunięcie kondygnacji [m]</label><input type="range" id="v3expl" min="0" max="4" step="0.25" value="${v3.explode}" style="width:150px"><span id="v3explV" style="width:34px;font-size:12px">${v3.explode} m</span></div>
  <div style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0">
    <button class="btn" id="v3iso">Izometria</button><button class="btn" id="v3top">Z góry</button><button class="btn" id="v3front">Z przodu</button><button class="btn" id="v3side">Z boku</button><button class="btn" id="v3fit">Dopasuj</button>
  </div>
  <h4>Warstwy</h4>
  <div class="field"><label>Podkład (rzut) na stropie</label><input type="checkbox" id="v3bg" ${v3.showBg?'checked':''}></div>
  <div class="field"><label>Pomieszczenia</label><input type="checkbox" id="v3rooms" ${v3.showRooms?'checked':''}></div>
  <div class="field"><label>Ściany (szkielet)</label><input type="checkbox" id="v3walls" ${v3.showWalls?'checked':''}></div>
  <div class="field"><label>Opisy</label><input type="checkbox" id="v3labels" ${v3.showLabels?'checked':''}></div>
  <div class="field"><label>Przepływy na przewodach</label><input type="checkbox" id="v3flows" ${v3.showFlows?'checked':''}></div>
  <div class="field"><label>Siatka terenu</label><input type="checkbox" id="v3grid" ${v3.showGrid?'checked':''}></div>
  <h4>Kondygnacje w modelu</h4>
  <table class="dt"><tr><th>Kondygnacja</th><th class="num">Poziom [m]</th><th class="num">H [m]</th><th>Wyrównanie</th></tr>
  ${model.floors.map(x=>`<tr><td>${esc(x.f.name)}${x.uncal?' <span style="color:var(--err)">(skala ~)</span>':''}</td><td class="num">${fmt(x.z0,2)}</td><td class="num">${fmt(x.h,2)}</td><td style="font-size:11px">${esc(x.aligned)}</td></tr>`).join('')}
  </table>
  <p class="note">Przewody prowadzone są wyłącznie w pionie i poziomie (skośne odcinki zamieniane na kolana). Rysowane są ${V3_DUCT_DROP} m pod stropem (przestrzeń sufitu podwieszanego), wywiew ${V3_EXH_DROP} m niżej niż nawiew, równoległe trasy rozsunięte w pasy, strop ${V3_SLAB} m. Czerpnia i wyrzutnia wyprowadzone ponad najwyższą kondygnację. Jeśli na kondygnacjach nie ma wspólnych pionów, rzuty są nakładane środkami obrysów — postaw węzły „Pion” o tym samym numerze na obu kondygnacjach, aby wyrównać je precyzyjnie.</p>
  <button class="btn" id="v3png">Pobierz obraz PNG</button>
  <button class="btn" id="v3back">← Wróć do edycji 2D</button>`;
  const th=el.querySelector('#v3theta'), ev=el.querySelector('#v3elev'), ex=el.querySelector('#v3expl');
  th.addEventListener('input',()=>{ v3.theta=-th.value*Math.PI/180; el.querySelector('#v3thetaV').textContent=th.value+'°'; draw(); });
  ev.addEventListener('input',()=>{ v3.elev=+ev.value*Math.PI/180; el.querySelector('#v3elevV').textContent=ev.value+'°'; draw(); });
  ex.addEventListener('input',()=>{ v3.explode=+ex.value; el.querySelector('#v3explV').textContent=ex.value+' m'; v3.fitted=false; draw(); });
  const setCam=(t,e)=>{ v3.theta=t*Math.PI/180; v3.elev=e*Math.PI/180; v3.fitted=false; render3DPane(el); draw(); };
  el.querySelector('#v3iso').onclick=()=>setCam(-35,34);
  el.querySelector('#v3top').onclick=()=>setCam(0,89);
  el.querySelector('#v3front').onclick=()=>setCam(0,12);
  el.querySelector('#v3side').onclick=()=>setCam(90,12);
  el.querySelector('#v3fit').onclick=()=>fit3D();
  [['v3bg','showBg'],['v3rooms','showRooms'],['v3walls','showWalls'],['v3labels','showLabels'],['v3flows','showFlows'],['v3grid','showGrid']].forEach(([id,k])=>{
    el.querySelector('#'+id).addEventListener('change',e=>{ v3[k]=e.target.checked; draw(); });
  });
  el.querySelector('#v3png').onclick=()=>{ const a=document.createElement('a'); a.href=render3DImage(1800,1100); a.download=(state.name||'instalacja')+'_3D.png'; a.click(); draw(); };
  el.querySelector('#v3back').onclick=()=>{ v3SwitchTab('proj'); setMode3D(false); };
}
/* ---------- zdarzenia myszy w trybie 3D (przechwytywane przed obsługą 2D) ---------- */
cv.addEventListener('wheel',e=>{ if(!mode3D) return; e.preventDefault(); e.stopImmediatePropagation();
  const k=e.deltaY<0?1.15:1/1.15; v3.scale=Math.min(600,Math.max(2,v3.scale*k));
  v3.ox=e.offsetX-(e.offsetX-v3.ox)*k; v3.oy=e.offsetY-(e.offsetY-v3.oy)*k; draw();
},{passive:false,capture:true});
cv.addEventListener('mousedown',e=>{ if(!mode3D) return; e.stopImmediatePropagation();
  const pan=e.button!==0||e.shiftKey||tool==='pan'||spaceDown;
  const pv=v3Pivot(), an=v3P(pv.X,pv.Y,pv.Z);
  v3.drag={mx:e.offsetX,my:e.offsetY,theta:v3.theta,elev:v3.elev,ox:v3.ox,oy:v3.oy,pan,pivot:pv,anchor:an}; cv.style.cursor=pan?'grabbing':'move';
},true);
cv.addEventListener('mousemove',e=>{ if(!mode3D) return; e.stopImmediatePropagation();
  if(v3.drag){ const dx=e.offsetX-v3.drag.mx, dy=e.offsetY-v3.drag.my;
    if(v3.drag.pan){ v3.ox=v3.drag.ox+dx; v3.oy=v3.drag.oy+dy; }
    else { /* przednia ściana podąża za kursorem, obrót wokół środka bryły */
      v3.ox=v3.drag.ox; v3.oy=v3.drag.oy;
      v3Orbit(v3.drag.theta-dx*0.005,
              Math.min(89*Math.PI/180,Math.max(5*Math.PI/180,v3.drag.elev+dy*0.004)),
              v3.drag.pivot, v3.drag.anchor); }
    draw(); return; }
  // hover po węzłach
  let best=null,bd=14; v3.hits.forEach(h=>{ const d=Math.hypot(h.x-e.offsetX,h.y-e.offsetY); if(d<bd){bd=d;best=h;} });
  if((best&&best.n)!==(v3.hover&&v3.hover.n)){ v3.hover=best; draw(); }
  document.getElementById('stCoords').textContent = best? `${NODE_DEFS[best.n.type].label} · ${best.fl.f.name}` : '—';
},true);
window.addEventListener('mouseup',()=>{ if(!mode3D) return; if(v3.drag){ v3.drag=null; cv.style.cursor='grab'; if(currentPane==='v3d'){ const th=document.getElementById('v3theta'); if(th){ th.value=Math.round(-v3.theta*180/Math.PI); document.getElementById('v3thetaV').textContent=th.value+'°'; const ev=document.getElementById('v3elev'); ev.value=Math.round(v3.elev*180/Math.PI); document.getElementById('v3elevV').textContent=ev.value+'°'; } } } },true);
cv.addEventListener('click',e=>{ if(!mode3D) return; e.stopImmediatePropagation();
  // kliknięcie węzła: zaznacz i pokaż właściwości (kondygnacja węzła staje się aktywna)
  let best=null,bd=14; v3.hits.forEach(h=>{ const d=Math.hypot(h.x-e.offsetX,h.y-e.offsetY); if(d<bd){bd=d;best=h;} });
  if(best){ state.activeFloor=best.fl.fi; sel={kind:'node',id:best.n.id}; renderFloorbar(); renderProps(); draw(); }
},true);
cv.addEventListener('dblclick',e=>{ if(!mode3D) return; e.stopImmediatePropagation(); fit3D(); },true);
/* narzędzia rysowania wyłączają widok 3D */
document.querySelectorAll('#toolbar .tbtn[data-tool]').forEach(b=>b.addEventListener('click',()=>{ if(mode3D&&b.dataset.tool!=='pan'&&b.dataset.tool!=='select'){ v3SwitchTab('proj'); setMode3D(false); } }));
['btnAutoRooms','btnAutoTerms','btnMask','btnRoiClear'].forEach(id=>{ const b=document.getElementById(id); if(b) b.addEventListener('click',()=>{ if(mode3D){ v3SwitchTab('proj'); setMode3D(false); } },true); });
