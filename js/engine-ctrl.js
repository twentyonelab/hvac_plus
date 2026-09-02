/* ============================ STEROWANIE — WIRTUALNE POŁĄCZENIE Z CENTRALĄ 21LAB ============================ */
/* Cyfrowy bliźniak sterowania: emuluje aplikację HRQ-PremAIR-GATE (tryby Away/Home/Boost/Party/Auto) i moduł
   HRQ-Modbus (RTU, RS485, 19200 8E1, slave 2 — rejestry wg instrukcji 21LAB „Instrukcja-modbus-PremAIR”).
   Na razie WIRTUALNIE: brak fizycznego łącza; symulacja odpowiada na te same rejestry, więc po podłączeniu
   bramki Modbus-TCP wystarczy podmienić warstwę transportu (funkcja ctrlTransport). */
const CTRL={
  connected:false, link:'virtual', host:'192.168.1.50', port:502, slave:2,
  mode:'home',            // away | home | boost | party | auto
  speedReg:2,             // 41000: 0 OFF, 1-3 speed, 4 override, 5 auto, 6 boost
  zoneMode:'auto',        // auto (harmonogram) | day | night
  sched:{dayStart:6.5, nightStart:22.5},
  clock:null, clockSpeed:60, simT:0, lastTick:0, dash:0,
  fanSup:0, fanExh:0, tOut:6, tRoom:21, tExh:21, tSup:18, rh:48, co2:620, bypass:0, preheat:0, defrost:0,
  filterDays:74, filterDirty:0, error:0, holdUntil:0,
  damper:{1:100,2:100}, live:{q:0,nodes:{},segs:{}}, log:[], raf:0, bomOn:true
};
const CTRL_MODES={
  away: {label:'Away',  k:0.5,  reg:1, desc:'nieobecność — wydajność obniżona (speed 1)'},
  home: {label:'Home',  k:1.0,  reg:2, desc:'tryb normalny — strumień projektowy (speed 2)'},
  party:{label:'Party', k:1.2,  reg:3, desc:'więcej osób — +20% (speed 3)'},
  boost:{label:'Boost', k:1.4,  reg:6, desc:'intensywne wietrzenie / gotowanie — maks. (czasowo)'},
  auto: {label:'Auto',  k:null, reg:5, desc:'wg czujników CO₂ / RH (HRQ-PremAIR-SENS)'}
};
function ctrlLog(dir,txt){ const t=ctrlClockStr(); CTRL.log.unshift(`${t} ${dir} ${txt}`); if(CTRL.log.length>60) CTRL.log.pop(); const el=document.getElementById('ctLog'); if(el) el.innerHTML=CTRL.log.map(esc).join('<br>'); }
function ctrlClockStr(){ const h=Math.floor(CTRL.clock/3600)%24, m=Math.floor(CTRL.clock/60)%60; return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`; }
function ctrlIsDay(){ const h=(CTRL.clock/3600)%24; return h>=CTRL.sched.dayStart&&h<CTRL.sched.nightStart; }
function ctrlFactor(){ // współczynnik wydajności względem strumienia projektowego
  if(CTRL.mode!=='auto') return CTRL_MODES[CTRL.mode].k;
  const kCO2=Math.min(1.4,Math.max(0.5,0.5+(CTRL.co2-600)/900)), kRH=CTRL.rh>65?1.2:CTRL.rh>58?1.0:0.6;
  return Math.max(kCO2,kRH);
}
/* transport: tu wpięcie prawdziwego łącza (Modbus-TCP przez bramkę RS485 / API bramki HRQ-PremAIR-GATE) */
async function ctrlTransport(fn,addr,vals){
  if(CTRL.link!=='virtual'){ ctrlLog('✗',`brak łącza ${CTRL.link} — tryb wirtualny`); }
  await new Promise(r=>setTimeout(r,120+Math.random()*80)); // opóźnienie RTU
  return fn===3? modbusRead(addr,vals) : modbusWrite(addr,vals);
}
/* mapa rejestrów HRQ-Modbus (wg instrukcji 21LAB) */
function modbusRegs(){
  const f=x=>Math.round(x*10)/10;
  return [
    {a:41000,n:'Prędkość wentylacji (0 OFF,1-3,4 Override,5 Auto,6 Boost)',v:CTRL.speedReg,rw:false},
    {a:41001,n:'Wentylator wywiewny [%]',v:Math.round(CTRL.fanExh),rw:false},
    {a:41002,n:'Wentylator nawiewny [%]',v:Math.round(CTRL.fanSup),rw:false},
    {a:41003,n:'Kod błędu (0 brak)',v:CTRL.error,rw:false},
    {a:41005,n:'Temperatura pomieszczenia [°C] (FLOAT)',v:f(CTRL.tRoom),rw:false},
    {a:41007,n:'Temperatura zewnętrzna [°C]',v:f(CTRL.tOut),rw:false},
    {a:41009,n:'Temperatura powietrza usuwanego [°C]',v:f(CTRL.tExh),rw:false},
    {a:41011,n:'Temperatura nawiewu [°C]',v:f(CTRL.tSup),rw:false},
    {a:41013,n:'Nagrzewnica wstępna [%]',v:Math.round(CTRL.preheat),rw:false},
    {a:41014,n:'Filtr zabrudzony (0/1)',v:CTRL.filterDirty,rw:false},
    {a:41015,n:'Odszranianie (0/1)',v:CTRL.defrost,rw:false},
    {a:41016,n:'Bypass [%]',v:Math.round(CTRL.bypass),rw:false},
    {a:41500,n:'Żądana prędkość systemu (RW)',v:CTRL.speedReg,rw:true},
    {a:42000,n:'Reset licznika filtra (RW, 1=reset)',v:0,rw:true},
    {a:42001,n:'Wilgotność wewnętrzna [%]',v:Math.round(CTRL.rh),rw:false},
    {a:42003,n:'Speed 1 — nawiew [%] (RW)',v:Math.round(CTRL.preset[1]),rw:true},
    {a:42005,n:'Speed 2 — nawiew [%] (RW)',v:Math.round(CTRL.preset[2]),rw:true},
    {a:42007,n:'Speed 3 — nawiew [%] (RW)',v:Math.round(CTRL.preset[3]),rw:true},
    {a:49060,n:'Harmonogram aktywny (0/1)',v:CTRL.zoneMode==='auto'?1:0,rw:true}
  ];
}
function modbusRead(addr,cnt){ const regs=modbusRegs(); const out=[]; for(let a=addr;a<addr+(cnt||1);a++){ const r=regs.find(x=>x.a===a); out.push(r?r.v:0); } ctrlLog('←',`03 rd ${addr}×${cnt||1} → [${out.join(', ')}]`); return out; }
function modbusWrite(addr,vals){
  const v=+vals[0]; ctrlLog('→',`16 wr ${addr} = ${v}`);
  if(addr===41500){ const m={0:'away',1:'away',2:'home',3:'party',5:'auto',6:'boost'}[v]; if(m){ ctrlSetMode(m,true); if(v===0){ CTRL.speedReg=0; } } }
  else if(addr===42000&&v===1){ CTRL.filterDays=0; CTRL.filterDirty=0; }
  else if(addr===42003) CTRL.preset[1]=Math.max(0,Math.min(80,v));
  else if(addr===42005) CTRL.preset[2]=Math.max(0,Math.min(100,v));
  else if(addr===42007) CTRL.preset[3]=Math.max(0,Math.min(100,v));
  else if(addr===49060) CTRL.zoneMode=v?'auto':(ctrlIsDay()?'day':'night');
  else ctrlLog('✗',`rejestr ${addr} tylko do odczytu / nieobsługiwany (exception 02)`);
  return [v];
}
window.CTRL=CTRL; CTRL.preset={1:35,2:60,3:80}; // wentylatory [%] dla speed 1-3 — przeliczane przy połączeniu z doboru centrali
function ctrlSetMode(m,fromBus){
  CTRL.mode=m; CTRL.speedReg=CTRL_MODES[m].reg;
  if(m==='boost') CTRL.holdUntil=CTRL.clock+30*60; // boost 30 min, potem powrót do Home (timer override)
  if(!fromBus) ctrlLog('→',`aplikacja: tryb ${CTRL_MODES[m].label} (41500=${CTRL.speedReg})`);
  ctrlRefreshPane();
}
/* symulacja jednego kroku (dt w sekundach czasu symulowanego) */
function ctrlTick(dt){
  const C=window.CALC||{}, B=C.balance||{}, V=B.V||0, unit=C.unit;
  CTRL.clock=(CTRL.clock+dt)%86400;
  if(CTRL.mode==='boost'&&CTRL.clock>CTRL.holdUntil&&CTRL.holdUntil>0){ CTRL.holdUntil=0; ctrlSetMode('home',true); ctrlLog('i','koniec Boost (timer) → Home'); }
  // strefy: przepustnice (harmonogram lub ręcznie) — płynny przejazd siłownika ~90 s
  const day= CTRL.zoneMode==='auto'? ctrlIsDay() : CTRL.zoneMode==='day';
  const Z=state.zoning||{}; const zOn=zoningOn()&&C.zoning&&C.zoning.z[1].rooms&&C.zoning.z[2].rooms;
  const tgt={1: zOn?(day?(Z.dayZ1??40):100):100, 2: zOn?(day?100:(Z.nightZ2??30)):100};
  [1,2].forEach(k=>{ const d=tgt[k]-CTRL.damper[k]; CTRL.damper[k]+=Math.sign(d)*Math.min(Math.abs(d),dt*100/90); });
  // wydajność
  const vMax=unit?unit.v100:350; const k=Math.min(ctrlFactor(), V?vMax/V:9); const qTot=Math.round(V*k); // ograniczenie wydajnością centrali
  const fan=Math.min(100,qTot/vMax*100);
  CTRL.fanSup+= (fan-CTRL.fanSup)*Math.min(1,dt/20); CTRL.fanExh=CTRL.fanSup*(1+(CTRL.rh>60?0.03:0));
  // temperatury (dobowy sinus), odzysk wg sprawności centrali, bypass latem
  const h=CTRL.clock/3600; CTRL.tOut=CTRL.tOutBase+5*Math.sin((h-9)/24*2*Math.PI);
  const eta=(unit?unit.eta:85)/100;
  const summer=CTRL.tOut>CTRL.tRoom+1; CTRL.bypass+=((summer?100:0)-CTRL.bypass)*Math.min(1,dt/60);
  const etaEff=eta*(1-CTRL.bypass/100);
  CTRL.tSup=CTRL.tOut+etaEff*(CTRL.tRoom-CTRL.tOut);
  CTRL.defrost= CTRL.tOut<-4?1:0; CTRL.preheat=CTRL.tOut<-4?Math.min(100,(-4-CTRL.tOut)*12):0;
  CTRL.tExh=CTRL.tRoom-0.3;
  // CO2 — bilans domu (fallback bez mieszkańców na rzucie) oraz model per pomieszczenie
  const persons=B.persons||4, vol=Object.values(C.rooms||{}).reduce((s,r)=>s+(r.vol||0),0)||300;
  const present= (CTRL.mode==='away')?0.2:(C.personsFromPlan?1.0:(h>=8&&h<16?0.4:1.0));
  const gen=persons*present*18/1000;                 // m³ CO2/h (18 l/h·os)
  const dCO2=((gen*1e6)-(CTRL.co2-420)*Math.max(qTot,20))/vol*dt/3600;
  CTRL.co2=Math.max(420,CTRL.co2+dCO2);
  const rhTarget=45+(present*10)+(CTRL.mode==='boost'?-6:0)+(h>=18&&h<21?8:0);
  CTRL.rh+=(rhTarget-CTRL.rh)*Math.min(1,dt/1800);
  CTRL.filterDays+=dt/86400; CTRL.filterDirty=CTRL.filterDays>90?1:0;
  // strumienie „live” na rysunku: anemostaty nawiewne wg strefy, wywiew ∝ k
  const live={q:qTot,nodes:{},segs:{}};
  (C.terms||[]).forEach(t=>{
    const inf=C.nodes[t.id]||{}; let q=inf.q||0;
    if(t.side==='sup'&&zOn){ const room=C.rooms[t.roomId]; const z=room?room.zone:0;
      if(z){ // przejazd przepustnicy strefy redukowanej: 0 = położenie nominalne, 1 = scenariusz dzień/noc
        const cutZ=day?1:2, tgtCut=day?(Z.dayZ1??40):(Z.nightZ2??30);
        const p=tgtCut>=100?1:Math.min(1,Math.max(0,(100-CTRL.damper[cutZ])/(100-tgtCut)));
        const scen= day? (inf.qDay??q) : (inf.qNight??q);
        q = q + (scen-q)*p;
      } }
    live.nodes[t.id]=Math.round(q*k);
    (C.termPaths&&C.termPaths[t.id]||[]).forEach(s=>{ live.segs[s.id]=(live.segs[s.id]||0)+q*k; });
  });
  ['intake','exhout'].forEach(tp=>{ (C.ambPaths&&C.ambPaths[tp]||[]).forEach(s=>{ live.segs[s.id]=qTot; }); });
  CTRL.live=live;
  // ---- CO2 per pomieszczenie: dC/dt = (generacja − (C − C_in)·q_in)/V ----
  CTRL.roomCO2=CTRL.roomCO2||{};
  const qSupRoom={}, qExhRoom={};
  (C.terms||[]).forEach(t=>{ if(!t.roomId) return; const q=live.nodes[t.id]||0; if(t.side==='sup') qSupRoom[t.roomId]=(qSupRoom[t.roomId]||0)+q; else qExhRoom[t.roomId]=(qExhRoom[t.roomId]||0)+q; });
  const rooms=Object.values(C.rooms||{}).filter(r=>r.vol>0&&r.role!=='excluded');
  // powietrze przepływowe do pomieszczeń wywiewnych = średnia z pokoi nawiewnych (ważona strumieniem)
  let mixNum=0,mixDen=0; rooms.forEach(r=>{ const q=qSupRoom[r.id]||0; if(q>0){ mixNum+=(CTRL.roomCO2[r.id]??600)*q; mixDen+=q; } });
  const cMix= mixDen? mixNum/mixDen : 600;
  let exNum=0,exDen=0;
  rooms.forEach(r=>{
    const c0=CTRL.roomCO2[r.id]??600;
    const occ=(C.occByRoom||{})[r.id]||0;
    const genR= occ*present*18/1000*1e6;             // ppm·m³/h
    const qs=qSupRoom[r.id]||0, qe=qExhRoom[r.id]||0;
    const qIn= qs>0? qs : (qe>0? qe : 3);             // pom. bez anemostatu: minimalna wymiana ~3 m³/h (nieszczelności)
    const cIn= qs>0? 420 : cMix;
    const dC=(genR-(c0-cIn)*qIn)/r.vol*dt/3600;
    const c1=Math.max(400,Math.min(5000,c0+dC));
    CTRL.roomCO2[r.id]=c1;
    if(qe>0){ exNum+=c1*qe; exDen+=qe; }
  });
  if(C.personsFromPlan&&exDen) CTRL.co2=exNum/exDen;  // czujnik w powietrzu usuwanym (kanał wywiewny)
}
function ctrlLoop(ts){
  if(!CTRL.connected) return;
  if(!CTRL.lastTick) CTRL.lastTick=ts;
  const dtReal=(ts-CTRL.lastTick)/1000; CTRL.lastTick=ts;
  CTRL.simT+=dtReal;
  ctrlTick(Math.min(dtReal,0.5)*CTRL.clockSpeed);
  CTRL.dash+=dtReal*(20+40*ctrlFactor());
  if(CTRL.simT>1){ CTRL.simT=0; ctrlRefreshPane(); }
  draw();
  CTRL.raf=requestAnimationFrame(ctrlLoop);
}
async function ctrlConnect(){
  if(CTRL.connected) return;
  const C=window.CALC||{};
  ctrlLog('i',`łączenie: ${CTRL.link==='virtual'?'symulator centrali (wirtualnie)':CTRL.link==='modbus'?`Modbus-TCP ${CTRL.host}:${CTRL.port} → RS485 slave ${CTRL.slave}, 19200 8E1`:'bramka HRQ-PremAIR-GATE (chmura 21LAB)'}`);
  const now=new Date(); CTRL.clock=now.getHours()*3600+now.getMinutes()*60;
  const mo=now.getMonth(); CTRL.tOutBase=[-1,0,4,9,14,17,19,19,14,9,4,0][mo];
  // presety prędkości z doboru: speed 2 = strumień projektowy
  const V=(C.balance||{}).V||0, vMax=C.unit?C.unit.v100:350;
  CTRL.preset={1:Math.round(V*0.5/vMax*100),2:Math.round(V/vMax*100),3:Math.round(Math.min(100,V*1.2/vMax*100))};
  CTRL.connected=true; CTRL.lastTick=0; CTRL.roomCO2={}; ctrlRefreshPane();
  await ctrlTransport(3,41000,17); await ctrlTransport(3,41500,1);
  ctrlLog('i',`centrala: ${C.unit?('21LAB '+C.unit.model):'(brak doboru)'} · presety speed1/2/3 = ${CTRL.preset[1]}/${CTRL.preset[2]}/${CTRL.preset[3]} %`);
  if(CTRL.link!=='virtual') ctrlLog('!', 'UWAGA: łącze fizyczne niedostępne w tej wersji — dane pochodzą z symulatora');
  CTRL.raf=requestAnimationFrame(ctrlLoop);
}
function ctrlDisconnect(){ CTRL.connected=false; cancelAnimationFrame(CTRL.raf); CTRL.live={q:0,nodes:{},segs:{}}; ctrlLog('i','rozłączono'); ctrlRefreshPane(); draw(); }
/* ---------- panel boczny ---------- */
function renderSter(el){
  const C=window.CALC||{}, on=CTRL.connected;
  el.innerHTML=`
  <h3>Sterowanie centralą (wirtualne połączenie)</h3>
  <p class="note">Cyfrowy bliźniak sterowania 21LAB: aplikacja <b>HRQ-PremAIR-GATE</b> (tryby Away / Home / Party / Boost / Auto, czujniki CO₂ i RH) oraz moduł <b>HRQ-Modbus</b> (RTU RS485, 19200 8E1, slave 2, funkcje 03/16). Na razie odpowiada symulator — po podłączeniu bramki wystarczy podmienić warstwę transportu.</p>
  <h4>Połączenie</h4>
  <div class="field"><label>Łącze</label><select id="ctLink" ${on?'disabled':''}>
    <option value="virtual" ${CTRL.link==='virtual'?'selected':''}>Symulator centrali (wirtualnie)</option>
    <option value="modbus" ${CTRL.link==='modbus'?'selected':''}>HRQ-Modbus przez bramkę Modbus-TCP</option>
    <option value="gate" ${CTRL.link==='gate'?'selected':''}>HRQ-PremAIR-GATE (API chmury — brak publicznej dokumentacji)</option></select></div>
  ${CTRL.link==='modbus'?`<div class="field"><label>Bramka IP:port</label><input type="text" id="ctHost" value="${esc(CTRL.host)}:${CTRL.port}" ${on?'disabled':''}></div>
  <div class="field"><label>Adres slave (std. 2, parowanie 207)</label><input type="number" id="ctSlave" value="${CTRL.slave}" ${on?'disabled':''}></div>`:''}
  <div style="display:flex;gap:6px;align-items:center;margin:6px 0">
    ${on?`<button class="btn danger" id="ctDisc">Rozłącz</button><span class="pill ok">● online · ${CTRL.link==='virtual'?'symulacja':CTRL.link}</span>`:`<button class="btn acc" id="ctConn">Połącz</button><span class="pill" style="background:#eee;color:#666">○ offline</span>`}
  </div>
  <div id="ctLive">${on?renderSterLive():'<p class="note">Po połączeniu na rysunku (2D i 3D) pojawią się bieżące strumienie, animowany przepływ w przewodach i położenie przepustnic strefowych.</p>'}</div>
  <h4>Zestawienie</h4>
  <div class="field"><label>Dodaj do BOM: GATE + Modbus + czujniki + panel</label><input type="checkbox" id="ctBom" ${CTRL.bomOn?'checked':''}></div>
  <h4>Log komunikacji</h4>
  <div id="ctLog" style="font:10.5px/1.4 Consolas,monospace;background:#0f1b27;color:#bfe0ff;border-radius:8px;padding:8px;max-height:150px;overflow:auto;white-space:pre-wrap">${CTRL.log.map(esc).join('<br>')}</div>
  <details class="src" style="margin-top:8px"><summary>Źródła (dokumentacja producenta central)</summary>Instrukcja „Moduł komunikacji Modbus HRQ-Modbus” (alnor.com.pl, rejestry 41000–49062); artykuł „Sterowanie rekuperacją” (HRQ-PremAIR-BUT-LM11/LM04, SENS-CO2/RH, GATE); instrukcja HRU-MinistAIR. Model termiczny i czujników — symulacja własna.</details>`;
  const lk=el.querySelector('#ctLink'); if(lk) lk.addEventListener('change',e=>{ CTRL.link=e.target.value; renderSter(el); });
  const hs=el.querySelector('#ctHost'); if(hs) hs.addEventListener('change',e=>{ const [h,p]=e.target.value.split(':'); CTRL.host=h||CTRL.host; CTRL.port=+p||502; });
  const sl=el.querySelector('#ctSlave'); if(sl) sl.addEventListener('change',e=>{ CTRL.slave=+e.target.value||2; });
  const cb=el.querySelector('#ctConn'); if(cb) cb.addEventListener('click',()=>{ ctrlConnect().then(()=>renderSter(el)); });
  const db=el.querySelector('#ctDisc'); if(db) db.addEventListener('click',()=>{ ctrlDisconnect(); renderSter(el); });
  el.querySelector('#ctBom').addEventListener('change',e=>{ CTRL.bomOn=e.target.checked; refreshAll(); });
  bindSterLive(el);
}
function renderSterLive(){
  const C=window.CALC||{}, B=C.balance||{}, k=ctrlFactor(), m=CTRL_MODES[CTRL.mode];
  const day=CTRL.zoneMode==='auto'?ctrlIsDay():CTRL.zoneMode==='day';
  const zOn=zoningOn()&&C.zoning&&C.zoning.z[1].rooms&&C.zoning.z[2].rooms;
  const bar=(k,col)=>`<div style="flex:1;background:#eef2f6;border-radius:6px;height:14px;position:relative;overflow:hidden"><div style="width:${CTRL.damper[k]}%;height:100%;background:${col};opacity:.8"></div><span style="position:absolute;left:6px;top:0;font-size:10px;line-height:14px;color:#123">${ZONES[k].short} · ${Math.round(CTRL.damper[k])}% otw.</span></div>`;
  return `
  <h4>Panel użytkownika (jak w aplikacji)</h4>
  <div style="display:flex;gap:4px;flex-wrap:wrap;margin:4px 0">${Object.entries(CTRL_MODES).map(([id,mm])=>`<button class="btn ${CTRL.mode===id?'acc':''}" data-mode="${id}" title="${mm.desc}">${mm.label}</button>`).join('')}</div>
  <p class="note" style="margin-top:2px">${esc(m.desc)}${CTRL.mode==='boost'&&CTRL.holdUntil?` · pozostało ${Math.max(0,Math.round((CTRL.holdUntil-CTRL.clock)/60))} min`:''}</p>
  <div class="kpi"><b>${fmt(CTRL.live.q)} m³/h</b><span>strumień bieżący (${Math.round((CTRL.live.q/((C.balance||{}).V||1))*100)}% proj.${C.unit&&CTRL.live.q>=C.unit.v100-1?' · limit centrali':''})</span></div>
  <div class="kpi"><b>${Math.round(CTRL.fanSup)} / ${Math.round(CTRL.fanExh)} %</b><span>wentylatory naw. / wyw.</span></div>
  <div class="kpi"><b>${CTRL.tOut.toFixed(1)} → ${CTRL.tSup.toFixed(1)} °C</b><span>zewn. → nawiew (odzysk ${C.unit?C.unit.eta:85}%)</span></div>
  <div class="kpi"><b>${CTRL.tRoom.toFixed(1)} °C</b><span>pomieszczenie · usuwane ${CTRL.tExh.toFixed(1)} °C</span></div>
  <div class="kpi"><b>${Math.round(CTRL.co2)} ppm</b><span>CO₂ ${(C.personsFromPlan?'w powietrzu usuwanym':'(SENS-CO2)')} ${CTRL.co2>1000?'<span class="pill warn">wysokie</span>':'<span class="pill ok">OK</span>'}</span></div>
  <div class="kpi"><b>${Math.round(CTRL.rh)} %</b><span>wilgotność (SENS-RH)</span></div>
  <div class="kpi"><b>${Math.round(CTRL.bypass)} %</b><span>bypass ${CTRL.defrost?'· <span class="pill warn">odszranianie</span>':''}</span></div>
  <div class="kpi"><b>${Math.round(CTRL.filterDays)} dni</b><span>filtry ${CTRL.filterDirty?'<span class="pill err">wymień</span>':'<span class="pill ok">OK</span>'} <a href="#" id="ctFilt">reset</a></span></div>
  <h4>Strefy (przepustnice S1 / S2)</h4>
  ${zOn?`<div style="display:flex;gap:4px;margin:4px 0"><button class="btn ${CTRL.zoneMode==='auto'?'acc':''}" data-zone="auto">Harmonogram</button><button class="btn ${CTRL.zoneMode==='day'?'acc':''}" data-zone="day">Dzień</button><button class="btn ${CTRL.zoneMode==='night'?'acc':''}" data-zone="night">Noc</button><span class="pill ${day?'warn':'sup'}" style="align-self:center">${day?'☀ dzień':'☾ noc'}</span></div>
  <div style="display:flex;gap:6px;margin:6px 0">${bar(1,ZONES[1].c)}${bar(2,ZONES[2].c)}</div>
  <div class="field"><label>Harmonogram: dzień od / noc od</label><span><input type="number" id="ctDay" step="0.5" min="0" max="24" value="${CTRL.sched.dayStart}" style="width:58px"> / <input type="number" id="ctNight" step="0.5" min="0" max="24" value="${CTRL.sched.nightStart}" style="width:58px"> h</span></div>`
  :`<p class="note">Strefowanie wyłączone lub brak pomieszczeń w jednej ze stref (zakładka Projekt).</p>`}
  <h4>Czas symulacji</h4>
  <div class="field"><label>Zegar centrali: <b id="ctClock">${ctrlClockStr()}</b></label><span>tempo <select id="ctSpeed"><option value="1" ${CTRL.clockSpeed==1?'selected':''}>×1</option><option value="60" ${CTRL.clockSpeed==60?'selected':''}>×60</option><option value="600" ${CTRL.clockSpeed==600?'selected':''}>×600</option></select></span></div>
  <input type="range" id="ctHour" min="0" max="1439" value="${Math.floor(CTRL.clock/60)}" style="width:100%">
  <h4>Rejestry HRQ-Modbus (slave ${CTRL.slave})</h4>
  <table class="dt" style="font-size:10.8px"><tr><th>Adres</th><th>Opis</th><th class="num">Wartość</th></tr>
  ${modbusRegs().map(r=>`<tr><td>${r.a}</td><td>${esc(r.n)}</td><td class="num">${r.rw?`<input type="number" data-reg="${r.a}" value="${r.v}" style="width:62px;text-align:right;border:1px solid var(--line);border-radius:4px;padding:1px 4px">`:`<b>${r.v}</b>`}</td></tr>`).join('')}</table>
  <p class="note">Pola edytowalne = zapis funkcją 16 (holding). Zapis 41500 zmienia tryb tak, jak zrobiłaby to aplikacja lub sterownik BUT-LM04.</p>`;
}
function bindSterLive(el){
  el.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{ ctrlSetMode(b.dataset.mode); }));
  el.querySelectorAll('[data-zone]').forEach(b=>b.addEventListener('click',()=>{ CTRL.zoneMode=b.dataset.zone; ctrlLog('→',`strefy: ${b.dataset.zone==='auto'?'harmonogram (49060=1)':b.dataset.zone}`); ctrlRefreshPane(); }));
  const d=el.querySelector('#ctDay'); if(d) d.addEventListener('change',e=>{ CTRL.sched.dayStart=+e.target.value; });
  const n=el.querySelector('#ctNight'); if(n) n.addEventListener('change',e=>{ CTRL.sched.nightStart=+e.target.value; });
  const sp=el.querySelector('#ctSpeed'); if(sp) sp.addEventListener('change',e=>{ CTRL.clockSpeed=+e.target.value; });
  const hr=el.querySelector('#ctHour'); if(hr) hr.addEventListener('input',e=>{ CTRL.clock=+e.target.value*60; const c=document.getElementById('ctClock'); if(c) c.textContent=ctrlClockStr(); });
  const ft=el.querySelector('#ctFilt'); if(ft) ft.addEventListener('click',e=>{ e.preventDefault(); ctrlTransport(16,42000,[1]); });
  el.querySelectorAll('input[data-reg]').forEach(i=>i.addEventListener('change',e=>{ ctrlTransport(16,+i.dataset.reg,[+e.target.value]); }));
}
let ctrlPaneBusy=false;
function ctrlRefreshPane(){
  if(currentPane!=='ster') return;
  const el=document.getElementById('ctLive'); if(!el) return;
  if(document.activeElement&&el.contains(document.activeElement)&&document.activeElement.tagName==='INPUT'&&document.activeElement.type!=='range') return; // nie przerywaj edycji
  const hr=el.querySelector('#ctHour'); if(hr&&hr.matches(':active')) return;
  el.innerHTML=CTRL.connected?renderSterLive():'';
  bindSterLive(el);
}
/* nakładka LIVE na rysunku 2D */
function drawLiveBadge(){
  if(!CTRL.connected) return;
  const H=cv.clientHeight; const m=CTRL_MODES[CTRL.mode];
  const day=CTRL.zoneMode==='auto'?ctrlIsDay():CTRL.zoneMode==='day';
  const txt=`● LIVE · ${m.label} · ${fmt(CTRL.live.q)} m³/h · ${ctrlClockStr()} ${zoningOn()?(day?'☀ dzień':'☾ noc'):''} · CO₂ ${Math.round(CTRL.co2)} ppm`;
  ctx.save(); ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
  ctx.font='600 12px Outfit, Segoe UI'; const tw=ctx.measureText(txt).width;
  ctx.fillStyle='rgba(13,122,63,.92)'; ctx.beginPath(); ctx.roundRect(10,H-60,tw+18,24,12); ctx.fill();
  ctx.fillStyle='#fff'; ctx.textAlign='left'; ctx.fillText(txt,19,H-43); ctx.restore();
}
/* BOM: elementy sterowania */
function ctrlBOM(C,add){
  if(!CTRL.bomOn||!C.unit) return;
  add('HRQ-PremAIR-GATE','Bramka internetowa — sterowanie z aplikacji mobilnej (Android/iOS)',1,'szt.','zdalny dostęp, harmonogram, powiadomienia o filtrach');
  add('HRQ-Modbus','Moduł komunikacji Modbus RTU (RS485, 19200 8E1) — integracja BMS / dom inteligentny',1,'szt.','rejestry 41000–49062 wg instrukcji 21LAB');
  add('HRQ-PremAIR-BUT-LM04','Sterownik bezprzewodowy 4-przyciskowy z trybem Auto (Away/Home/Boost/Party/Auto)',1,'szt.');
  add('HRQ-PremAIR-SENS-CO2','Czujnik CO₂ bezprzewodowy — sterowanie wydajnością w trybie Auto',1,'szt.','salon / sypialnia główna');
  add('HRQ-PremAIR-SENS-RH','Czujnik wilgotności bezprzewodowy — łazienka',1,'szt.');
}
