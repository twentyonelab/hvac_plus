/* =====================================================================
   HVAC+ planer — widok 3D+ (three.js)

   Osobny widok obok aksonometrii rysowanej na canvasie. Tamta jest szybka
   i „techniczna”; ta jest bryłowa: ściany z rzeczywistą grubością, otwory
   drzwiowe i okienne, stropy, instalacja jako rury pod sufitem — i można
   po tym chodzić z poziomu oczu.

   Skąd biorą się ściany, skoro model projektu ich nie ma? Z obrysów
   pomieszczeń: przestrzeń MIĘDZY dwoma obrysami to właśnie ściana, a jej
   grubość mierzymy sondując w bok od krawędzi. Krawędź bez sąsiada to
   ściana zewnętrzna. Otwory wstawiamy tam, gdzie muszą być, żeby dało się
   przejść: w każdej ścianie wewnętrznej dłuższej niż 1,5 m — drzwi, w każdej
   zewnętrznej dłuższej niż 2 m — okno. To założenie, nie projekt stolarki:
   model nie zna położenia drzwi, bo rzut ich nie niesie.

   Trzy.js wczytujemy z repozytorium (assets/vendor), nie z CDN — aplikacja
   ma działać także bez internetu.
   ===================================================================== */
import * as THREE from '../assets/vendor/three.module.min.js';

const DEG = Math.PI/180;
const COL = {
  sup:0x2D62BE, exh:0xD12E4F, fresh:0x248964, out:0xA57327, mix:0x8154B6, none:0xB4B7BD,
  wall:0xF0EDE7, wallExt:0xE4DFD6, floor:0xB39A78, ceil:0xFBFAF8, ground:0xE3E7E9,
  ahu:0x4A4B50, riser:0x6B6D73, person:0x4A4B50, sel:0xA9EBC9
};
const WALL_EXT = 0.25, DOOR_W = 0.9, DOOR_H = 2.05, WIN_W = 1.5, WIN_SILL = 0.9, WIN_HEAD = 2.15;
const EYE = 1.65, BODY = 0.28;

let renderer, scene, camera, root, grp={}, cvs, lampa, swiatla={};
let started=false, isOpen=false, raf=0, needRender=true;
let orbit={az:-38*DEG, el:26*DEG, dist:26, tx:0, ty:1.3, tz:0};
let walk=null, colliders=[], floorsY=[], modelC={x:0,z:0}, bounds=null;
/* przesunięcia kondygnacji względem siebie — te same, co w aksonometrii:
   po pionach o tym samym numerze, a bez nich po środku obrysu */
let FT=new Map();
let layers={walls:true, net:true, rooms:true, people:true};
const keys={};

/* ---------- pomocnicze ---------- */
const mat=(c,o)=>new THREE.MeshLambertMaterial({color:c, transparent:o!=null&&o<1, opacity:o??1, side:THREE.DoubleSide});
const MATS={};
function M(name,c,o){ return MATS[name]||(MATS[name]=mat(c,o)); }
function floorY(fi){ return floorsY[fi]||0; }
function P(f,p){ const t=FT.get(f)||{ppm:f.pxPerM||45,dx:0,dy:0};
  return {x:p.x/t.ppm+t.dx-modelC.x, z:p.y/t.ppm+t.dy-modelC.z}; }

/* ---------- scena ---------- */
function initGL(){
  cvs=document.getElementById('glcv');
  renderer=new THREE.WebGLRenderer({canvas:cvs, antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
  renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=0.98;
  /* cienie są tu warunkiem sensownego wnętrza: bez nich słońce świeci przez
     ściany i pokój jest jednolicie szary. Z cieniami światło wpada oknami. */
  renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  scene=new THREE.Scene();
  scene.background=new THREE.Color(0xF2F3F5);
  scene.fog=new THREE.Fog(0xF2F3F5, 60, 190);
  camera=new THREE.PerspectiveCamera(70,1,0.05,600);   // szerszy kadr — we wnętrzu widać podłogę i sufit
  const hemi=new THREE.HemisphereLight(0xffffff,0xD8DDE3,2.4); scene.add(hemi);
  const sun=new THREE.DirectionalLight(0xfff6e8,2.4); sun.position.set(16,24,11); scene.add(sun);
  sun.castShadow=true; sun.shadow.mapSize.set(2048,2048);
  const sc=sun.shadow.camera; sc.left=-28; sc.right=28; sc.top=28; sc.bottom=-28; sc.near=1; sc.far=90;
  sun.shadow.bias=-0.0008; sun.shadow.normalBias=0.02;
  const fill=new THREE.DirectionalLight(0xdfe8ff,0.8); fill.position.set(-16,12,-12); scene.add(fill);
  swiatla={hemi,sun,fill};
  /* wnętrze bez okien byłoby jednolicie szare — lampa przy oku daje bryłę
     i cienie na krawędziach; w orbicie jest zgaszona */
  lampa=new THREE.PointLight(0xfff4e6, 0, 14, 1.4); lampa.visible=false; scene.add(lampa);
  root=new THREE.Group(); scene.add(root);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(400,400), M('ground',COL.ground));
  ground.rotation.x=-Math.PI/2; ground.position.y=-0.02; scene.add(ground);
  started=true;
}

/* ---------- geometria ścian ---------- */
function wallMesh(a,b,t,y0,y1,material){
  const dx=b.x-a.x, dz=b.z-a.z, L=Math.hypot(dx,dz);
  if(L<0.02||y1-y0<0.02) return null;
  const m=new THREE.Mesh(new THREE.BoxGeometry(L,y1-y0,t),material);
  m.castShadow=true; m.receiveShadow=true;
  m.position.set((a.x+b.x)/2,(y0+y1)/2,(a.z+b.z)/2);
  m.rotation.y=-Math.atan2(dz,dx);
  return m;
}
/* ściana z otworem: lewy słupek, prawy słupek, nadproże, ewentualny podokiennik */
function addWall(g,a,b,t,y0,h,material,op,fi){
  const dx=b.x-a.x, dz=b.z-a.z, L=Math.hypot(dx,dz);
  if(L<0.05) return;
  const ux=dx/L, uz=dz/L, at=s=>({x:a.x+ux*s, z:a.z+uz*s});
  const add=m=>{ if(m) g.add(m); };
  const block=(p,q,r)=>colliders.push({fi,ax:p.x,az:p.z,bx:q.x,bz:q.z,r:t/2+r});
  if(!op || L < op.w+0.7){ add(wallMesh(a,b,t,y0,y0+h,material)); block(a,b,BODY); return; }
  const s0=(L-op.w)/2, s1=s0+op.w, p0=at(s0), p1=at(s1);
  add(wallMesh(a,p0,t,y0,y0+h,material));
  add(wallMesh(p1,b,t,y0,y0+h,material));
  if(op.h1<h) add(wallMesh(p0,p1,t,y0+op.h1,y0+h,material));      // nadproże
  if(op.h0>0) add(wallMesh(p0,p1,t,y0,y0+op.h0,material));        // podokiennik
  block(a,p0,BODY); block(p1,b,BODY);
  if(op.h0>0) block(p0,p1,BODY);                                   // przez okno się nie przejdzie
}
/* grubość ściany przy krawędzi: sondujemy w bok, aż trafimy w sąsiednie pomieszczenie */
function wallThickness(f,mid,nx,ny){
  const ppm=f.pxPerM||45;
  for(let d=0.04; d<=0.44; d+=0.03){
    const q={x:mid.x+nx*d*ppm, y:mid.y+ny*d*ppm};
    if(f.rooms.some(o=>pointInPoly(q,o.pts))) return {t:d, ext:false};
  }
  return {t:WALL_EXT, ext:true};
}
function buildWalls(f,fi,g){
  const ppm=f.pxPerM||45, h=f.h||2.7, y0=floorY(fi), seen=new Set();
  f.rooms.forEach(r=>{
    const c=polyCentroid(r.pts);
    for(let i=0;i<r.pts.length;i++){
      const p=r.pts[i], q=r.pts[(i+1)%r.pts.length];
      const dx=q.x-p.x, dy=q.y-p.y, L=Math.hypot(dx,dy);
      if(L<0.25*ppm) continue;
      let nx=dy/L, ny=-dx/L;
      const mid={x:(p.x+q.x)/2, y:(p.y+q.y)/2};
      if((mid.x+nx-c.x)*nx+(mid.y+ny-c.y)*ny < 0){ nx=-nx; ny=-ny; }   // normalna na zewnątrz pokoju
      let {t,ext}=wallThickness(f,mid,nx,ny);
      /* Obrysy pomieszczeń bywają rysowane na styk (bez szczeliny na ścianę) —
         wtedy „zmierzona” grubość to 4 cm i ściana wygląda jak kartka. Ustawiamy
         minimum 10 cm i sadzamy ją na styku, po połowie w każdą stronę. */
      let off=t/2;
      if(!ext && t<0.10){ t=0.10; off=0; }
      if(ext) t=Math.max(t,WALL_EXT);
      /* ścianę budujemy w osi pasma między obrysami, więc sąsiedzi dają ten sam
         klucz i nie dublujemy jej */
      const cx=mid.x+nx*off*ppm, cy=mid.y+ny*off*ppm;
      const key=Math.round(cx/4)+'_'+Math.round(cy/4)+'_'+Math.round(((Math.atan2(dy,dx)%Math.PI)+Math.PI)%Math.PI*12);
      if(seen.has(key)) continue; seen.add(key);
      const A=P(f,{x:p.x+nx*off*ppm, y:p.y+ny*off*ppm});
      const B=P(f,{x:q.x+nx*off*ppm, y:q.y+ny*off*ppm});
      const Lm=Math.hypot(B.x-A.x,B.z-A.z);
      const material=ext? M('we',COL.wallExt) : M('wi',COL.wall);
      let op=null;
      if(!ext && Lm>=1.5) op={w:DOOR_W, h0:0, h1:DOOR_H};
      if(ext && Lm>=2.0) op={w:WIN_W, h0:WIN_SILL, h1:Math.min(WIN_HEAD,h-0.1)};
      addWall(g,A,B,t,y0,h,material,op,fi);
    }
  });
}
/* podłoga i sufit pomieszczenia z obrysu */
function slab(f,r,y,material){
  const sh=new THREE.Shape();
  r.pts.forEach((p,i)=>{ const q=P(f,p); i? sh.lineTo(q.x,-q.z) : sh.moveTo(q.x,-q.z); });
  const geo=new THREE.ShapeGeometry(sh); geo.rotateX(-Math.PI/2); geo.translate(0,y,0);
  const m=new THREE.Mesh(geo,material); m.receiveShadow=true; return m;
}
/* ---------- instalacja ---------- */
function tube(g,pts,y,d,color){
  const material=M('t'+color.toString(16), color);
  for(let i=1;i<pts.length;i++){
    const a=pts[i-1], b=pts[i];
    const dx=b.x-a.x, dz=b.z-a.z, L=Math.hypot(dx,dz);
    if(L<0.02) continue;
    const m=new THREE.Mesh(new THREE.CylinderGeometry(d/2,d/2,L,12),material); m.castShadow=true;
    m.position.set((a.x+b.x)/2,y,(a.z+b.z)/2);
    m.rotation.order='YXZ'; m.rotation.set(0,-Math.atan2(dz,dx),Math.PI/2);
    g.add(m);
    const j=new THREE.Mesh(new THREE.SphereGeometry(d/2,10,8),material);
    j.position.set(b.x,y,b.z); g.add(j);
  }
}
function buildNet(f,fi,g){
  const C=window.CALC||{}, h=f.h||2.7, y0=floorY(fi), yDuct=y0+h-0.22;
  const R=(typeof buildRoutes==='function')? buildRoutes(f) : {};
  f.segs.forEach(s=>{
    const raw=R[s.id]||[]; if(raw.length<2) return;
    const res=(C.segs||{})[s.id]||{};
    const color= res.side==='sup'?COL.sup : res.side==='exh'?COL.exh
               : res.side==='fresh'?COL.fresh : res.side==='out'?COL.out
               : res.side==='mix'?COL.mix : COL.none;
    const d = s.kind==='flx' ? 0.09*Math.sqrt(res.tubes||1) : Math.max(0.09,(res.d||125)/1000);
    tube(g, raw.map(p=>P(f,p)), yDuct, d, color);
  });
  f.nodes.forEach(n=>{
    const q=P(f,n);
    if(n.type==='term_sup'||n.type==='term_exh'){
      const color=n.type==='term_sup'?COL.sup:COL.exh;
      const m=new THREE.Mesh(new THREE.CylinderGeometry(0.085,0.085,0.035,18),M('t'+color.toString(16),color));
      m.position.set(q.x,y0+h-0.02,q.z); g.add(m);
      const dl=Math.max(0.05,(y0+h-0.02)-yDuct);
      const drop=new THREE.Mesh(new THREE.CylinderGeometry(0.045,0.045,dl,10),M('t'+color.toString(16),color));
      drop.position.set(q.x,yDuct+dl/2,q.z); g.add(drop);
    }
    else if(n.type==='ahu'){
      const m=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.62,0.6),M('ahu',COL.ahu));
      m.position.set(q.x,y0+h-0.45,q.z); g.add(m);
    }
    else if(n.type==='man_sup'||n.type==='man_exh'){
      const color=n.type==='man_sup'?COL.sup:COL.exh;
      const m=new THREE.Mesh(new THREE.BoxGeometry(0.55,0.2,0.3),M('t'+color.toString(16),color));
      m.position.set(q.x,y0+h-0.25,q.z); g.add(m);
    }
    else if(n.type==='riser'){
      const m=new THREE.Mesh(new THREE.CylinderGeometry(0.11,0.11,h,14),M('riser',COL.riser));
      m.position.set(q.x,y0+h/2,q.z); g.add(m);
    }
    else if(n.type==='intake'||n.type==='exhout'){
      const color=n.type==='intake'?COL.fresh:COL.out;
      const m=new THREE.Mesh(new THREE.BoxGeometry(0.42,0.42,0.22),M('t'+color.toString(16),color));
      m.position.set(q.x,y0+h-0.55,q.z); g.add(m);
    }
  });
}
function buildPeople(f,fi,g){
  const y0=floorY(fi);
  f.nodes.filter(n=>n.type==='person').forEach(n=>{
    if(window.__simPersonAlpha && window.__simPersonAlpha(n)<=0.05) return;
    const pose=(window.__simPersonPose&&window.__simPersonPose(n))||n;
    const q=P(f,pose);
    const body=new THREE.Mesh(new THREE.CapsuleGeometry(0.17,0.86,4,10),M('person',COL.person));
    body.position.set(q.x,y0+0.6,q.z); g.add(body);
    const head=new THREE.Mesh(new THREE.SphereGeometry(0.115,12,10),M('person',COL.person));
    head.position.set(q.x,y0+1.32,q.z); g.add(head);
  });
  (window.__simGuests? window.__simGuests():[]).filter(gu=>gu.fi===fi).forEach(gu=>{
    const f2=state.floors[gu.fi], q=P(f2,gu);
    const body=new THREE.Mesh(new THREE.CapsuleGeometry(0.16,0.8,4,10),M('guest',0x8E9096));
    body.position.set(q.x,y0+0.57,q.z); g.add(body);
    const head=new THREE.Mesh(new THREE.SphereGeometry(0.11,12,10),M('guest',0x8E9096));
    head.position.set(q.x,y0+1.26,q.z); g.add(head);
  });
}

/* ---------- budowa całego modelu ---------- */
function build(){
  if(!started) return;
  while(root.children.length) root.remove(root.children[0]);
  colliders=[]; floorsY=[]; grp={}; FT=new Map();
  let z=0;
  const m3=(typeof build3D==='function')? build3D() : null;
  state.floors.forEach((f,fi)=>{
    const fl=m3&&m3.floors[fi];
    FT.set(f,{ppm:(fl?fl.ppm:(f.pxPerM||45)), dx:fl?fl.dx:0, dy:fl?fl.dy:0});
    floorsY.push(z); z+=(f.h||2.7)+0.30;
  });
  // środek modelu, żeby bryła stała w początku układu
  const all=[];
  state.floors.forEach(f=>{ const t=FT.get(f);
    f.rooms.forEach(r=>r.pts.forEach(p=>all.push({x:p.x/t.ppm+t.dx,z:p.y/t.ppm+t.dy})));
    f.nodes.forEach(n=>all.push({x:n.x/t.ppm+t.dx,z:n.y/t.ppm+t.dy})); });
  if(all.length){
    const xs=all.map(p=>p.x), zs=all.map(p=>p.z);
    modelC={x:(Math.min(...xs)+Math.max(...xs))/2, z:(Math.min(...zs)+Math.max(...zs))/2};
    bounds={w:Math.max(...xs)-Math.min(...xs), d:Math.max(...zs)-Math.min(...zs), h:z};
  } else { modelC={x:0,z:0}; bounds={w:8,d:8,h:3}; }
  grp.rooms=new THREE.Group(); grp.walls=new THREE.Group();
  grp.ceil=new THREE.Group(); grp.net=new THREE.Group(); grp.people=new THREE.Group();
  state.floors.forEach((f,fi)=>{
    const h=f.h||2.7, y0=floorY(fi);
    f.rooms.forEach(r=>{
      const t=(ROOM_TYPES[r.type]||{});
      const col = t.role==='exh'?0xC9C2BA : t.role==='both'?0xBCAE9A : t.role==='sup'?COL.floor
                : t.role==='excluded'?0x9C9C99 : 0xC4BAA8;
      grp.rooms.add(slab(f,r,y0+0.01,M('fl'+col.toString(16),col)));
      grp.ceil.add(slab(f,r,y0+h-0.01,M('ce',COL.ceil)));
    });
    buildWalls(f,fi,grp.walls);
    buildNet(f,fi,grp.net);
    buildPeople(f,fi,grp.people);
  });
  root.add(grp.rooms,grp.walls,grp.ceil,grp.net,grp.people);
  grp.ceil.visible=false;
  applyLayers();
  needRender=true;
}
function applyLayers(){
  if(!grp.walls) return;
  grp.walls.visible=layers.walls; grp.net.visible=layers.net;
  grp.rooms.visible=layers.rooms; grp.people.visible=layers.people;
  grp.ceil.visible=!!walk && layers.walls;
  needRender=true;
}

/* ---------- kamery ---------- */
function fit(){
  const r=Math.max(bounds?bounds.w:10,bounds?bounds.d:10);
  orbit.dist=Math.max(9,r*1.25); orbit.tx=0; orbit.tz=0; orbit.ty=(bounds?bounds.h:3)/2;
  orbit.az=-38*DEG; orbit.el=26*DEG; needRender=true;
}
function applyCam(){
  if(walk){
    camera.rotation.order='YXZ';
    camera.rotation.set(walk.pitch,walk.yaw,0);
    camera.position.set(walk.pos.x, floorY(walk.fi)+EYE, walk.pos.z);
  } else {
    const ce=Math.cos(orbit.el), se=Math.sin(orbit.el);
    camera.position.set(orbit.tx+orbit.dist*ce*Math.sin(orbit.az),
                        orbit.ty+orbit.dist*se,
                        orbit.tz+orbit.dist*ce*Math.cos(orbit.az));
    camera.lookAt(orbit.tx,orbit.ty,orbit.tz);
  }
}
function resize(){
  if(!renderer||!cvs) return;
  const w=cvs.clientWidth||1, h=cvs.clientHeight||1;
  renderer.setSize(w,h,false);
  camera.aspect=w/h; camera.updateProjectionMatrix(); needRender=true;
}
/* ---------- chodzenie ---------- */
function hitWall(x,z,fi){
  for(const c of colliders){
    if(c.fi!==fi) continue;
    const dx=c.bx-c.ax, dz=c.bz-c.az, L2=dx*dx+dz*dz;
    let t=L2? ((x-c.ax)*dx+(z-c.az)*dz)/L2 : 0;
    t=Math.max(0,Math.min(1,t));
    const px=c.ax+dx*t, pz=c.az+dz*t;
    if((x-px)**2+(z-pz)**2 < c.r*c.r) return true;
  }
  return false;
}
function enterWalk(){
  const f=F(); const fi=state.activeFloor;
  let start={x:0,z:0}, yaw=0;
  if(f.rooms.length){
    /* stajemy na środku największego pomieszczenia i patrzymy wzdłuż jego
       dłuższego boku — wtedy w kadrze jest całe wnętrze, a nie ściana z metra */
    const big=f.rooms.slice().sort((a,b)=>polyArea(b.pts)-polyArea(a.pts))[0];
    start=P(f,polyCentroid(big.pts));
    const xs=big.pts.map(p=>p.x), ys=big.pts.map(p=>p.y);
    yaw = (Math.max(...xs)-Math.min(...xs)) >= (Math.max(...ys)-Math.min(...ys)) ? Math.PI/2 : 0;
  }
  walk={yaw,pitch:-0.06,pos:start,fi};
  /* wewnątrz gasimy słońce: bez cieni świeciłoby przez ściany i wnętrze byłoby
     jednolicie białe. Bryłę robi lampa przy oku — i to ona daje głębię. */
  lightsFor(true);
  grp.ceil.visible=layers.walls;
  cvs.requestPointerLock?.();
  document.getElementById('glWalk').classList.add('on');
  document.getElementById('glHint').hidden=false;
  needRender=true;
}
function lightsFor(inside){
  if(!swiatla.hemi) return;
  swiatla.hemi.intensity = inside? 1.15 : 2.4;
  swiatla.sun.intensity  = 2.4;
  swiatla.fill.intensity = inside? 0.30 : 0.8;
  if(lampa){ lampa.visible=!!inside; lampa.intensity=inside?2.5:0; }   // delikatne doświetlenie przy oku
  needRender=true;
}
function exitWalk(){
  walk=null; if(grp.ceil) grp.ceil.visible=false;
  lightsFor(false);
  if(document.pointerLockElement===cvs) document.exitPointerLock();
  document.getElementById('glWalk').classList.remove('on');
  document.getElementById('glHint').hidden=true;
  needRender=true;
}
let last=0;
function loop(ts){
  raf=requestAnimationFrame(loop);
  const dt=Math.min(0.05,(ts-last)/1000||0); last=ts;
  if(walk){
    const sp=(keys.shift?3.6:1.9)*dt;
    let fx=0,fz=0;
    if(keys.w||keys.arrowup) fz+=1;
    if(keys.s||keys.arrowdown) fz-=1;
    if(keys.a||keys.arrowleft) fx-=1;
    if(keys.d||keys.arrowright) fx+=1;
    if(fx||fz){
      const L=Math.hypot(fx,fz); fx/=L; fz/=L;
      const sin=Math.sin(walk.yaw), cos=Math.cos(walk.yaw);
      const mx=(-sin*fz+cos*fx)*sp, mz=(-cos*fz-sin*fx)*sp;
      const nx=walk.pos.x+mx, nz=walk.pos.z+mz;
      if(!hitWall(nx,walk.pos.z,walk.fi)) walk.pos.x=nx;
      if(!hitWall(walk.pos.x,nz,walk.fi)) walk.pos.z=nz;
      needRender=true;
    }
  }
  if(needRender){
    applyCam();
    if(lampa&&walk) lampa.position.copy(camera.position);
    renderer.render(scene,camera); needRender=false;
  }
}

/* ---------- wejście / wyjście ---------- */
function open(){
  if(isOpen) return;
  if(!started){ initGL(); }
  isOpen=true;
  document.body.classList.add('gl-on');
  document.getElementById('glwrap').hidden=false;
  if(window.setMode3D && window.__mode3D) setMode3D(false);
  build(); fit(); resize();
  if(!raf) raf=requestAnimationFrame(loop);
  syncButtons();
  setHint('Widok 3D+ — przeciągnij, aby obrócić bryłę. „Zwiedzaj” wchodzi do środka: WASD, mysz rozgląda, Esc wychodzi.');
}
function close(){
  if(!isOpen) return;
  exitWalk(); isOpen=false;
  document.body.classList.remove('gl-on');
  document.getElementById('glwrap').hidden=true;
  cancelAnimationFrame(raf); raf=0;
  syncButtons();
}
function syncButtons(){
  const on=!!window.__mode3D;
  document.querySelectorAll('#modeSwitch button').forEach(b=>{
    const m=b.dataset.mode;
    b.classList.toggle('active', isOpen? m==='3dp' : (m===(on?'3d':'2d')));
  });
}

/* ---------- podpięcie ---------- */
document.getElementById('modeSwitch').addEventListener('click',e=>{
  const b=e.target.closest('button[data-mode]'); if(!b) return;
  if(b.dataset.mode==='3dp') open(); else close();
});
document.getElementById('glFit').addEventListener('click',()=>{ exitWalk(); fit(); });
document.getElementById('glWalk').addEventListener('click',()=>{ walk? exitWalk() : enterWalk(); });
document.getElementById('glClose').addEventListener('click',()=>{ close(); document.querySelector('#modeSwitch button[data-mode="2d"]').click(); });
document.querySelectorAll('#glbar [data-lay]').forEach(b=>b.addEventListener('click',()=>{
  const k=b.dataset.lay; layers[k]=!layers[k]; b.classList.toggle('off',!layers[k]); applyLayers();
}));
document.getElementById('glFloor').addEventListener('change',e=>{
  const fi=+e.target.value;
  state.activeFloor=fi; if(window.renderFloorbar) renderFloorbar();
  if(walk){ const f=state.floors[fi];
    const big=f.rooms.slice().sort((a,b)=>polyArea(b.pts)-polyArea(a.pts))[0];
    walk.fi=fi; if(big) walk.pos=P(f,polyCentroid(big.pts)); }
  needRender=true;
});

/* obrót / zoom myszą */
let drag=null;
cvsEvents();
function cvsEvents(){
  const c=document.getElementById('glcv');
  c.addEventListener('pointerdown',e=>{
    if(walk){ c.requestPointerLock?.(); return; }
    drag={x:e.clientX,y:e.clientY,pan:e.shiftKey||e.button===2};
    c.setPointerCapture(e.pointerId);
  });
  c.addEventListener('pointermove',e=>{
    if(walk){
      if(document.pointerLockElement===c){
        walk.yaw-=e.movementX*0.0026;
        walk.pitch=Math.max(-1.2,Math.min(1.2,walk.pitch-e.movementY*0.0026));
        needRender=true;
      }
      return;
    }
    if(!drag) return;
    const dx=e.clientX-drag.x, dy=e.clientY-drag.y; drag.x=e.clientX; drag.y=e.clientY;
    if(drag.pan){
      const s=orbit.dist*0.0016;
      orbit.tx-=(dx*Math.cos(orbit.az)-0)*s; orbit.tz+=(dx*Math.sin(orbit.az))*s;
      orbit.ty+=dy*s;
    } else {
      orbit.az-=dx*0.006;
      orbit.el=Math.max(-4*DEG,Math.min(86*DEG,orbit.el+dy*0.005));
    }
    needRender=true;
  });
  c.addEventListener('pointerup',e=>{ drag=null; try{c.releasePointerCapture(e.pointerId);}catch(_){} });
  c.addEventListener('contextmenu',e=>e.preventDefault());
  c.addEventListener('wheel',e=>{ if(walk) return; e.preventDefault();
    orbit.dist=Math.max(2.2,Math.min(220,orbit.dist*(e.deltaY>0?1.12:1/1.12))); needRender=true; },{passive:false});
}
addEventListener('keydown',e=>{
  if(!isOpen) return;
  const k=e.key.toLowerCase();
  if(k==='escape'&&walk){ exitWalk(); return; }
  keys[k]=true; keys.shift=e.shiftKey;
  if(walk&&['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)) e.preventDefault();
});
addEventListener('keyup',e=>{ keys[e.key.toLowerCase()]=false; keys.shift=e.shiftKey; });
document.addEventListener('pointerlockchange',()=>{
  if(isOpen&&walk&&document.pointerLockElement!==cvs){ /* wyjście z blokady zostawia tryb zwiedzania */ }
});
addEventListener('resize',()=>{ if(isOpen) resize(); });

/* przebudowa po zmianie projektu */
const _refresh=window.refreshAll;
window.refreshAll=function(){ _refresh(); if(isOpen){ build(); fillFloors(); } };
function fillFloors(){
  const sel=document.getElementById('glFloor');
  const cur=state.activeFloor;
  sel.innerHTML=state.floors.map((f,i)=>`<option value="${i}"${i===cur?' selected':''}>${f.name}</option>`).join('');
}
fillFloors();
window.HvacGL={open,close,isOpen:()=>isOpen,rebuild:()=>{ if(isOpen) build(); },
  /* haki testowe: podejrzenie i ustawienie kamery zwiedzania */
  __pos:()=>walk?{x:+walk.pos.x.toFixed(2),z:+walk.pos.z.toFixed(2),yaw:+walk.yaw.toFixed(2),fi:walk.fi}:null,
  __place:(x,z,yaw,pitch)=>{ if(walk){ walk.pos={x,z}; walk.yaw=yaw; walk.pitch=pitch; needRender=true; } },
  __room:(name)=>{ const f=F(); const r=f.rooms.find(q=>roomName(q).includes(name))||f.rooms[0];
    const c=P(f,polyCentroid(r.pts)); return {name:roomName(r),x:+c.x.toFixed(2),z:+c.z.toFixed(2)}; },
  __stats:()=>({sciany:grp.walls?grp.walls.children.length:0, instalacja:grp.net?grp.net.children.length:0,
    kolizje:colliders.length, kondygnacje:floorsY.length})
};
