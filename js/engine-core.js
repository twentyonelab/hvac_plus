'use strict';
/* =====================================================================
   HVAC+  — dane normowe i katalog 21LAB
   Podstawy: PN-83/B-03430 + Az3:2000, WT (t.j. Dz.U. 2022 poz. 1225),
   PN-EN 12599, PN-87/B-02151/02, WTWiO COBRTI INSTAL zeszyt 5 (2002)
   ===================================================================== */

// ---- typy pomieszczeń: role 'exh' (wywiew normowy), 'sup' (nawiew), 'transfer', 'excluded'
const ROOM_TYPES = {
  kuchnia_gaz:   {label:'Kuchnia — kuchenka gazowa',       role:'exh', flow:p=>70,  ref:'PN-83/B-03430 p.2.1.2', boost:true},
  kuchnia_el:    {label:'Kuchnia — kuchenka elektryczna',  role:'exh', flow:p=>p>3?50:30, ref:'PN-83/B-03430 p.2.1.2', boost:true},
  kuchnia_bez_okna:{label:'Kuchnia bez okna (elektr.)',    role:'exh', flow:p=>50,  ref:'PN-83/B-03430 p.2.1.2', boost:true},
  lazienka:      {label:'Łazienka',                        role:'exh', flow:p=>50,  ref:'PN-83/B-03430 p.2.1.2'},
  wc:            {label:'WC oddzielne',                    role:'exh', flow:p=>30,  ref:'PN-83/B-03430 p.2.1.2'},
  garderoba:     {label:'Pom. bez okna (garderoba, spiżarnia)', role:'exh', flow:p=>15, ref:'PN-83/B-03430 p.2.1.2'},
  pralnia:       {label:'Pralnia / suszarnia domowa',      role:'exh', flow:p=>30,  ref:'interpretacja PN-83/B-03430 (pom. wilgotne)'},
  pokoj_oddzielony:{label:'Pokój oddzielony (>2 drzwi / inna kondygnacja)', role:'both', flow:p=>30, ref:'PN-83/B-03430 p.2.1.2', wExh:30},
  sypialnia:     {label:'Sypialnia',                       role:'sup', osoby:2},
  pokoj:         {label:'Pokój / gabinet',                 role:'sup', osoby:1},
  salon:         {label:'Salon / pokój dzienny',           role:'sup', osoby:2},
  salon_aneks:   {label:'Salon z aneksem kuchennym (el.)', role:'both', osoby:2, aneks:true, flow:p=>p>3?50:30, boost:true, ref:'PN-83/B-03430 p.2.1.2 (kuchnia el.)'},
  komunikacja:   {label:'Hol / komunikacja / wiatrołap',   role:'transfer'},
  kotlownia:     {label:'Kotłownia',                       role:'excluded', warn:'Kotłownia wymaga niezależnej wentylacji (nawiew/wywiew wg wymagań urządzeń grzewczych) — NIE podłączać do rekuperacji.'},
  garaz:         {label:'Garaż',                           role:'excluded', warn:'Garaż: wentylacja niezależna, min. 1,5 wym./h dla garażu ogrzewanego (WT §108) — NIE podłączać do rekuperacji.'}
};

const NORMS = {
  minPerPerson: 20,          // m³/h·os — WT §149 ust.1 + PN-83/B-03430/Az3
  kitchenBoost: 120,         // m³/h — okresowy wywiew intensywny z kuchni
  nightReduction: 0.6,       // dopuszczalna redukcja do 60% (Az3:2000)
  recoveryMinEta: 50,        // % — WT §151 (dla V ≥ 500 m³/h)
  recoveryThreshold: 500,    // m³/h
  noise: {pokojeDzien:35, pokojeNoc:25, kuchniaSanit:40}, // dB(A) — PN-87/B-02151/02
  tolRoom: 20, tolSystem: 15, // % — odchyłki strumieni wg PN-EN 12599 (odbiór)
  vMax: {main:4.0, branch:3.5, flx:3.0, terminal:2.5}     // m/s — praktyka projektowa (Malicki)
};

// ---- system FLX-REKU (21LAB)
const FLX_SYS = {
  75: {code:'FLX-HDPE-75',   dInner:0.063, qMax:30, dpm:q=>0.0035*q*q, plenum:'FLX-PLO-EPP-75', manifold:'FLX-PLO-EPP-R-75'},
  90: {code:'FLX-HDPE-A-90', dInner:0.075, qMax:45, dpm:q=>0.0014*q*q, plenum:'FLX-PLO-EPP-90', manifold:'FLX-PLO-EPP-R-90'}
};
// ryczałtowe opory elementów [Pa] przy przepływie nominalnym
const LUMP = {plenumValve:20, manifold:10, silencer:15, intakeZeta:2.5, ahuConnZeta:0.5};

// ---- kanały spiro 21LAB (kody z sufiksem L = uszczelka EPDM, kl. szczelności D wg PN-EN 12237)
const SPIRO_D = [100,125,160,200,250,315];
const SPIRO_ROUGHNESS = 0.00015; // m — stal ocynkowana

// ---- centrale 21LAB HRU (wydajność przy 100 Pa wg kart katalogowych alnor.com.pl)
const AHU_LIST = [
  {model:'HRU-MinistAIR-250',  v100:250, eta:96,   duct:160, noise:'48 dB(A) Lw', power:'106 W', note:'kompaktowa, nagrzewnica wstępna, wersje L/R/entalpiczna'},
  {model:'HRU-MinistAIR-325',  v100:325, eta:95.5, duct:160, noise:'49 dB(A) Lw', power:'160 W', note:'kompaktowa'},
  {model:'HRU-MinistAIR-350',  v100:350, eta:93.7, duct:160, noise:'53 dB(A) Lw', power:'177 W', note:'klasa A/A+, czujnik RH, nagrzewnica 1500 W'},
  {model:'HRU-SlimAIR-250',    v100:250, eta:93.6, duct:160, noise:'—', power:'115 W', note:'podwieszana, wys. 242 mm'},
  {model:'HRU-SlimAIR-350',    v100:350, eta:94.0, duct:160, noise:'—', power:'123 W', note:'podwieszana, wys. 300 mm'},
  {model:'HRU-SlimAIR-500',    v100:500, eta:95.2, duct:200, noise:'—', power:'207 W', note:'podwieszana, wys. 300 mm'},
  {model:'HRU-PremAIR-350',    v100:350, eta:93.1, duct:160, noise:'—', power:'—',    note:'obudowa EPP, wymiennik przeciwprądowy, aplikacja mobilna'},
  {model:'HRU-PremAIR-450',    v100:450, eta:91.7, duct:200, noise:'—', power:'—',    note:'obudowa EPP'},
  {model:'HRU-PremAIR-500',    v100:500, eta:82.6, duct:200, noise:'—', power:'—',    note:'obudowa EPP'}
];

// ---- pozostały asortyment (do BOM)
const CAT = {
  silencer: d=>`SIL-${d}-600 (tłumik akustyczny L=600, wełna szklana)`,
  combi:   d=>`CWS-COMBI-${d} (czerpnio-wyrzutnia ścienna do rekuperacji)`,
  intake:  d=>`UELA-AL-${d} (czerpnia ścienna aluminiowa)`,
  exhout:  d=>`USAV-${d} (wyrzutnia ścienna z siatką)`,
  valveSup:d=>`KN-${d} (zawór nawiewny talerzowy, metal)`,
  valveExh:d=>`KW-${d} (zawór wywiewny talerzowy, metal)`,
  pipe:    d=>`SPR-L-${d} (rura spiro z uszczelką, kl. D)`,
  bend90:  d=>`BPL-90-${d} (kolano tłoczone 90° z uszczelką)`,
  bend45:  d=>`BPL-45-${d} (kolano tłoczone 45° z uszczelką)`,
  nipple:  d=>`ILPL-${d} (nypel łączący z uszczelką)`,
  damper:  d=>`GBL-${d} (przepustnica irysowa z króćcem pomiarowym)`,
  insul:   d=>`ALSDL-PE-L-${d} (przewód izolowany term.-akust., paroszczelny)`,
  fix:     'FLX-FIX-75-10-1 (mocowania przewodów FLX, opak. 10 szt.)',
  oring:   s=>`FLX-O-${s} (uszczelka o-ring, 2 szt. na złącze)`,
  cap:     s=>`FLX-CS-PVC-${s} (zaślepka wolnego króćca rozdzielacza)`
};

/* ============================ STAN ============================ */
const newFloor = (name)=>({id:uid(), name, h:2.7, bg:null, bgW:0, bgH:0, pxPerM:0, rooms:[], nodes:[], segs:[]});
let state;
function freshState(){
  return {
    name:'', persons:4, flxDia:75, combi:true, kitchenHood:false,
    zoning:{on:true, dayZ1:40, nightZ2:30},
    floors:[newFloor('Parter')], activeFloor:0,
    author:'', date: new Date().toISOString().slice(0,10)
  };
}
state = freshState();
/* projekt demonstracyjny — dom parter + poddasze; ładowany na start, żeby program nie zaczynał od pustej karty */
const DEMO_PROJECT={"name":"DEMO — dom jednorodzinny, parter + poddasze (5 osób)","persons":5,"flxDia":90,"combi":true,"kitchenHood":true,"floors":[{"id":"iddr1g7cb","name":"Parter","h":2.7,"bg":null,"bgW":0,"bgH":0,"pxPerM":45,"rooms":[{"id":"id6j9qlwf","pts":[{"x":70,"y":70},{"x":232,"y":70},{"x":232,"y":227.5},{"x":70,"y":227.5}],"type":"kuchnia_gaz","name":"1/12 Kuchnia","areaOverride":12.41,"osoby":null,"hOverride":null,"flowOverride":null},{"id":"id3sioxzx","pts":[{"x":232,"y":70},{"x":277,"y":70},{"x":277,"y":227.5},{"x":232,"y":227.5}],"type":"garderoba","name":"1/13 Spiżarnia","areaOverride":2.16,"osoby":null,"hOverride":null,"flowOverride":null},{"id":"idqm9k14s","pts":[{"x":277,"y":70},{"x":348.99999999999994,"y":70},{"x":348.99999999999994,"y":227.5},{"x":277,"y":227.5}],"type":"garderoba","name":"1/1 Wiatrołap","areaOverride":3.79,"osoby":null,"hOverride":null,"flowOverride":null},{"id":"idy90xtc9","pts":[{"x":349,"y":70},{"x":403,"y":70},{"x":403,"y":227.5},{"x":349,"y":227.5}],"type":"wc","name":"1/3 WC","areaOverride":1.87,"osoby":null,"hOverride":null,"flowOverride":null},{"id":"id4axnqhe","pts":[{"x":403,"y":70},{"x":484.00000000000006,"y":70},{"x":484.00000000000006,"y":227.5},{"x":403,"y":227.5}],"type":"garderoba","name":"1/2 Garderoba","areaOverride":3.87,"osoby":null,"hOverride":null,"flowOverride":null},{"id":"id5z1jhn1","pts":[{"x":483.99999999999994,"y":70},{"x":592,"y":70},{"x":592,"y":227.5},{"x":483.99999999999994,"y":227.5}],"type":"kotlownia","name":"1/4 Pom. techniczne","areaOverride":6.72,"osoby":null,"hOverride":null,"flowOverride":null},{"id":"idkdy7kb6","pts":[{"x":592,"y":70},{"x":767.5,"y":70},{"x":767.5,"y":227.5},{"x":592,"y":227.5}],"type":"sypialnia","name":"1/9 Sypialnia","areaOverride":13.51,"osoby":2,"hOverride":null,"flowOverride":null},{"id":"idjig5fd5","pts":[{"x":767.5,"y":70},{"x":844,"y":70},{"x":844,"y":227.5},{"x":767.5,"y":227.5}],"type":"garderoba","name":"1/10 Garderoba","areaOverride":5.63,"osoby":null,"hOverride":null,"flowOverride":null},{"id":"idnnjrh09","pts":[{"x":70,"y":227.5},{"x":844,"y":227.5},{"x":844,"y":263.5},{"x":70,"y":263.5}],"type":"komunikacja","name":"1/7 Komunikacja","areaOverride":14.24,"osoby":null,"hOverride":null,"flowOverride":null},{"id":"idft9zsko","pts":[{"x":70,"y":263.5},{"x":538,"y":263.5},{"x":538,"y":430},{"x":70,"y":430}],"type":"salon","name":"1/5 Salon","areaOverride":38.65,"osoby":3,"hOverride":null,"flowOverride":null},{"id":"idwtrl9cu","pts":[{"x":538,"y":263.5},{"x":727.0000000000001,"y":263.5},{"x":727.0000000000001,"y":430},{"x":538,"y":430}],"type":"salon","name":"1/6 Jadalnia","areaOverride":15.33,"osoby":2,"hOverride":null,"flowOverride":null},{"id":"idbh10aho","pts":[{"x":727,"y":263.5},{"x":790,"y":263.5},{"x":790,"y":430},{"x":727,"y":430}],"type":"lazienka","name":"1/11 Łazienka","areaOverride":4.8,"osoby":null,"hOverride":null,"flowOverride":null},{"id":"idcrzqk76","pts":[{"x":790,"y":263.5},{"x":844,"y":263.5},{"x":844,"y":430},{"x":790,"y":430}],"type":"garderoba","name":"1/8 Schowek","areaOverride":2.77,"osoby":null,"hOverride":null,"flowOverride":null},{"id":"id30t9a0l","pts":[{"x":475,"y":466.00000000000006},{"x":790,"y":466.00000000000006},{"x":790,"y":664},{"x":475,"y":664}],"type":"garaz","name":"1/14 Garaż","areaOverride":30.21,"osoby":null,"hOverride":null,"flowOverride":null}],"nodes":[{"id":"id68fyezj","type":"ahu","x":538,"y":146.5},{"id":"idobviiao","type":"intake","x":538,"y":47.5},{"id":"idvd6ru8r","type":"exhout","x":502,"y":47.5},{"id":"idzshcpxv","type":"man_sup","x":340,"y":245.5},{"id":"idjce12ar","type":"man_exh","x":457,"y":245.5},{"id":"id2ls3ym0","type":"riser","x":619,"y":245.5,"num":1,"extraLen":3.2},{"id":"idplrisyr","type":"riser","x":655,"y":245.5,"num":2,"extraLen":3.2},{"id":"idd7psxj8","type":"term_exh","x":148.75001749999996,"y":148.75001749999996,"roomId":"id6j9qlwf","auto":true},{"id":"idy8uol15","type":"term_exh","x":103.75000749999998,"y":103.75000749999998,"roomId":"id6j9qlwf","auto":true},{"id":"idquaw320","type":"term_exh","x":256.0625055,"y":94.06250549999999,"roomId":"id3sioxzx","auto":true},{"id":"id16vyqsv","type":"term_exh","x":314.1875085,"y":107.18750849999998,"roomId":"idqm9k14s","auto":true},{"id":"id9ciphp6","type":"term_exh","x":377.4375065,"y":98.43750649999998,"roomId":"idy90xtc9","auto":true},{"id":"id2jzxjmh","type":"term_exh","x":444.5625095,"y":111.56250949999998,"roomId":"id4axnqhe","auto":true},{"id":"id2xk0cic","type":"term_sup","x":672.4375165,"y":150.43751649999996,"roomId":"idkdy7kb6","auto":true},{"id":"id55fh9wj","type":"term_exh","x":804.6875085,"y":111.56250949999998,"roomId":"idjig5fd5","auto":true},{"id":"idtqt2t3d","type":"term_sup","x":154.50000649999998,"y":348.0000065,"roomId":"idft9zsko","auto":true},{"id":"idqoo43hk","type":"term_sup","x":310.50001849999995,"y":348.0000065,"roomId":"idft9zsko","auto":true},{"id":"idp7l17pt","type":"term_sup","x":619.3750155,"y":344.87501549999996,"roomId":"idwtrl9cu","auto":true},{"id":"idnf26nnh","type":"term_exh","x":757.0625065,"y":298.1875075,"roomId":"idbh10aho","auto":true},{"id":"idwsw6qru","type":"term_exh","x":815.4375055,"y":293.5625065,"roomId":"idcrzqk76","auto":true},{"id":"occ1","type":"person","x":649.75,"y":178.75,"roomId":"idkdy7kb6"},{"id":"occ2","type":"person","x":677.75,"y":178.75,"roomId":"idkdy7kb6"},{"id":"occ3","type":"person","x":274.0,"y":376.75,"roomId":"idft9zsko"}],"segs":[{"id":"idlbnah6o","kind":"duct","a":"id68fyezj","b":"idobviiao","pts":[],"extraLen":0},{"id":"idnssgz3t","kind":"duct","a":"id68fyezj","b":"idvd6ru8r","pts":[],"extraLen":0},{"id":"id6t4oq46","kind":"duct","a":"id68fyezj","b":"idzshcpxv","pts":[{"x":538,"y":245.5}],"extraLen":0},{"id":"idqcxaaoj","kind":"duct","a":"id68fyezj","b":"idjce12ar","pts":[{"x":483.99999999999994,"y":245.5}],"extraLen":0},{"id":"id46h4o7j","kind":"duct","a":"id68fyezj","b":"id2ls3ym0","pts":[{"x":583,"y":245.5}],"extraLen":0},{"id":"idwmyk4tn","kind":"duct","a":"id68fyezj","b":"idplrisyr","pts":[{"x":601,"y":245.5}],"extraLen":0},{"id":"idjor1rzy","kind":"flx","a":"idzshcpxv","b":"id2xk0cic","pts":[],"extraLen":0},{"id":"idftks2ce","kind":"flx","a":"idzshcpxv","b":"idtqt2t3d","pts":[],"extraLen":0},{"id":"idig0pwzx","kind":"flx","a":"idzshcpxv","b":"idqoo43hk","pts":[],"extraLen":0},{"id":"id2b1wdml","kind":"flx","a":"idzshcpxv","b":"idp7l17pt","pts":[],"extraLen":0},{"id":"idsif26gz","kind":"flx","a":"idjce12ar","b":"idd7psxj8","pts":[],"extraLen":0},{"id":"ide8czx44","kind":"flx","a":"idjce12ar","b":"idy8uol15","pts":[],"extraLen":0},{"id":"id9so9p2z","kind":"flx","a":"idjce12ar","b":"idquaw320","pts":[],"extraLen":0},{"id":"idxt5hpjq","kind":"flx","a":"idjce12ar","b":"id16vyqsv","pts":[],"extraLen":0},{"id":"id5ljawl8","kind":"flx","a":"idjce12ar","b":"id9ciphp6","pts":[],"extraLen":0},{"id":"idscyckx5","kind":"flx","a":"idjce12ar","b":"id2jzxjmh","pts":[],"extraLen":0},{"id":"idot5zu94","kind":"flx","a":"idjce12ar","b":"id55fh9wj","pts":[],"extraLen":0},{"id":"idps7prb7","kind":"flx","a":"idjce12ar","b":"idnf26nnh","pts":[],"extraLen":0},{"id":"idpeqdfid","kind":"flx","a":"idjce12ar","b":"idwsw6qru","pts":[],"extraLen":0}]},{"id":"idrzrrx47","name":"Poddasze","h":2.6,"bg":null,"bgW":0,"bgH":0,"pxPerM":45,"rooms":[{"id":"idzqb1rq6","pts":[{"x":70,"y":70},{"x":331,"y":70},{"x":331,"y":241},{"x":70,"y":241}],"type":"pokoj","name":"2/3 Pokój 1","areaOverride":21.51,"osoby":2,"hOverride":null,"flowOverride":null},{"id":"id2hgj5sn","pts":[{"x":331,"y":70},{"x":412,"y":70},{"x":412,"y":241},{"x":331,"y":241}],"type":"lazienka","name":"2/4 Łazienka","areaOverride":6.81,"osoby":null,"hOverride":null,"flowOverride":null},{"id":"idys6erhq","pts":[{"x":412,"y":70},{"x":731.5,"y":70},{"x":731.5,"y":241},{"x":412,"y":241}],"type":"pokoj","name":"2/5 Pokój 2","areaOverride":26.84,"osoby":2,"hOverride":null,"flowOverride":null},{"id":"idri1fljo","pts":[{"x":731.5,"y":70},{"x":776.5,"y":70},{"x":776.5,"y":241},{"x":731.5,"y":241}],"type":"pralnia","name":"2/7 Pralnia","areaOverride":3.79,"osoby":null,"hOverride":null,"flowOverride":null},{"id":"idrgdtqqm","pts":[{"x":70,"y":241},{"x":250,"y":241},{"x":250,"y":326.49999999999994},{"x":70,"y":326.49999999999994}],"type":"komunikacja","name":"2/2 Komunikacja","areaOverride":7.53,"osoby":null,"hOverride":null,"flowOverride":null},{"id":"id1uwk08j","pts":[{"x":250,"y":241},{"x":520,"y":241},{"x":520,"y":326.49999999999994},{"x":250,"y":326.49999999999994}],"type":"komunikacja","name":"2/6 Antresola","areaOverride":11.44,"osoby":null,"hOverride":null,"flowOverride":null},{"id":"idl1x3cdi","pts":[{"x":520,"y":241},{"x":650.5,"y":241},{"x":650.5,"y":326.49999999999994},{"x":520,"y":326.49999999999994}],"type":"komunikacja","name":"2/1 Antresola","areaOverride":5.4,"osoby":null,"hOverride":null,"flowOverride":null}],"nodes":[{"id":"idj3nczel","type":"riser","x":160,"y":281.5,"num":1,"extraLen":3.2},{"id":"idmggevnj","type":"riser","x":196,"y":281.5,"num":2,"extraLen":3.2},{"id":"idbk565ak","type":"man_sup","x":304,"y":281.5},{"id":"idvg0j41g","type":"man_exh","x":385,"y":281.5},{"id":"idxbaacvc","type":"term_sup","x":153.37501149999997,"y":153.37501149999997,"roomId":"idzqb1rq6","auto":true},{"id":"idw0kex3z","type":"term_exh","x":371.3750085,"y":110.37500849999998,"roomId":"id2hgj5sn","auto":true},{"id":"idmw5hmey","type":"term_sup","x":496.3125095,"y":154.31250949999998,"roomId":"idys6erhq","auto":true},{"id":"iduv3p917","type":"term_exh","x":752.8750045,"y":96.12500549999999,"roomId":"idri1fljo","auto":true},{"id":"occ4","type":"person","x":170.5,"y":185.5,"roomId":"idzqb1rq6"},{"id":"occ5","type":"person","x":541.75,"y":185.5,"roomId":"idys6erhq"}],"segs":[{"id":"idxco3gz8","kind":"duct","a":"idj3nczel","b":"idbk565ak","pts":[],"extraLen":0},{"id":"idi9fupb5","kind":"duct","a":"idmggevnj","b":"idvg0j41g","pts":[],"extraLen":0},{"id":"idaioe6ii","kind":"flx","a":"idbk565ak","b":"idxbaacvc","pts":[],"extraLen":0},{"id":"idfcjf6ee","kind":"flx","a":"idbk565ak","b":"idmw5hmey","pts":[],"extraLen":0},{"id":"idezkzl1b","kind":"flx","a":"idvg0j41g","b":"idw0kex3z","pts":[],"extraLen":0},{"id":"id5f1i4gq","kind":"flx","a":"idvg0j41g","b":"iduv3p917","pts":[],"extraLen":0}]}],"activeFloor":0,"author":"HVAC+ / 21 zmysłów (projekt demonstracyjny)","date":"2026-08-21","zoning":{"on":true,"dayZ1":40,"nightZ2":30}};
function loadDemo(){ state=JSON.parse(JSON.stringify(DEMO_PROJECT)); state.activeFloor=0; state.date=new Date().toISOString().slice(0,10); sel=null; undoStack.length=0; document.getElementById('projName').value=state.name||''; refreshAll(); fitView(); }

let sel = null;               // {kind:'room'|'node'|'seg', floor, id}
let tool = 'select';
const undoStack = [];
function snapshot(){ undoStack.push(JSON.stringify(stripBg(state))); if(undoStack.length>40) undoStack.shift(); }
function stripBg(s){ return s; } // tła zostają w undo (dataURL) — akceptowalne dla domowych projektów
function undo(){ if(!undoStack.length) return; const bgs=state.floors.map(f=>f.bg); state = JSON.parse(undoStack.pop()); state.floors.forEach((f,i)=>{ if(!f.bg && bgs[i]) f.bg=bgs[i]; }); sel=null; refreshAll(); }

/* ============================ NARZĘDZIA ============================ */
function uid(){ return 'id'+Math.random().toString(36).slice(2,9); }
const fmt = (x,d=0)=> (x==null||isNaN(x))?'—':x.toLocaleString('pl-PL',{minimumFractionDigits:d,maximumFractionDigits:d});
const F = ()=> state.floors[state.activeFloor];
function esc(s){ return String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

function polyArea(pts){ let a=0; for(let i=0;i<pts.length;i++){const p=pts[i],q=pts[(i+1)%pts.length]; a+=p.x*q.y-q.x*p.y;} return Math.abs(a)/2; }
function polyCentroid(pts){ let x=0,y=0; pts.forEach(p=>{x+=p.x;y+=p.y}); return {x:x/pts.length,y:y/pts.length}; }
function pointInPoly(pt,pts){ let inside=false; for(let i=0,j=pts.length-1;i<pts.length;j=i++){ const xi=pts[i].x,yi=pts[i].y,xj=pts[j].x,yj=pts[j].y; if(((yi>pt.y)!=(yj>pt.y)) && (pt.x < (xj-xi)*(pt.y-yi)/(yj-yi)+xi)) inside=!inside; } return inside; }
function dist(a,b){ return Math.hypot(a.x-b.x,a.y-b.y); }
function polylineLen(pts){ let L=0; for(let i=1;i<pts.length;i++) L+=dist(pts[i-1],pts[i]); return L; }
function distToSegment(p,a,b){ const l2=dist(a,b)**2; if(!l2) return dist(p,a); let t=((p.x-a.x)*(b.x-a.x)+(p.y-a.y)*(b.y-a.y))/l2; t=Math.max(0,Math.min(1,t)); return dist(p,{x:a.x+t*(b.x-a.x),y:a.y+t*(b.y-a.y)}); }

// spadek ciśnienia liniowy — kanał okrągły stalowy (wzór Altszula)
function spiroDpm(q_m3h, d_mm){
  const d=d_mm/1000, A=Math.PI*d*d/4, v=q_m3h/3600/A;
  if(v<=0) return {v:0,dpm:0};
  const Re=v*d/1.5e-5, lam=0.11*Math.pow(SPIRO_ROUGHNESS/d+68/Re,0.25);
  return {v, dpm: lam/d*1.2*v*v/2};
}
function autoDiameter(q){ // najmniejsza średnica spiro przy v ≤ vMax.branch
  for(const d of SPIRO_D){ if(spiroDpm(q,d).v<=NORMS.vMax.branch) return d; }
  return SPIRO_D[SPIRO_D.length-1];
}
/* ============================ CANVAS / EDYTOR ============================ */
const cv=document.getElementById('cv'), ctx=cv.getContext('2d');
const view={x:0,y:0,z:1};
let mouse={x:0,y:0,wx:0,wy:0,down:false,panStart:null};
let draft=null;   // trwające rysowanie: {type:'room'|'seg'|'calib', pts:[], ...}
let spaceDown=false;

const NODE_DEFS={
  ahu:     {label:'Centrala',   color:'#2F3033', r:16, sym:'HRU'},
  man_sup: {label:'Rozdz. nawiew', color:'var(--sup)', c:'#2D62BE', r:12, sym:'RN'},
  man_exh: {label:'Rozdz. wywiew', color:'var(--exh)', c:'#D12E4F', r:12, sym:'RW'},
  term_sup:{label:'Anemostat naw.', c:'#2D62BE', r:9,  sym:'N'},
  term_exh:{label:'Anemostat wyw.', c:'#D12E4F', r:9,  sym:'W'},
  intake:  {label:'Czerpnia',   c:'#248964', r:11, sym:'CZ'},
  exhout:  {label:'Wyrzutnia',  c:'#A57327', r:11, sym:'WY'},
  riser:   {label:'Pion',       c:'#4A4B50',    r:10, sym:'P'},
  person:  {label:'Mieszkaniec', c:'#7B5CC1', r:9, sym:'👤'}
};

function resize(){ cv.width=cv.clientWidth*devicePixelRatio; cv.height=cv.clientHeight*devicePixelRatio; draw(); }
window.addEventListener('resize',resize);

function w2s(p){ return {x:(p.x*view.z+view.x)*devicePixelRatio, y:(p.y*view.z+view.y)*devicePixelRatio}; }
function s2w(x,y){ return {x:(x-view.x)/view.z, y:(y-view.y)/view.z}; }

function setHint(t){ const h=document.getElementById('hint'); if(t){h.textContent=t;h.style.opacity=1;} else h.style.opacity=0; }

const TOOL_HINTS={
  select:'Klikaj obiekty aby edytować. Przeciągnij węzeł aby przesunąć. Delete usuwa.',
  pan:'Przeciągaj, aby przesuwać widok. Kółko myszy — zoom.',
  calib:'Kliknij dwa punkty o znanej odległości na podkładzie (np. długość ściany z wymiarem).',
  roi:'Kliknij dwa przeciwległe narożniki obszaru analizy — obejmij sam budynek, bez łańcuchów wymiarowych i tabeli rysunkowej.',
  room:'Klikaj kolejne narożniki pomieszczenia. Podwójny klik lub Enter — zamknij obrys. Esc — anuluj.',
  wand:'Klikaj WNĘTRZE pomieszczenia — program sam obrysuje je po ścianach. Kolejne kliknięcie w to samo pomieszczenie odświeża obrys.',
  ahu:'Kliknij miejsce montażu centrali wentylacyjnej.',
  man_sup:'Kliknij miejsce skrzynki rozdzielczej NAWIEWU (np. nad sufitem korytarza).',
  man_exh:'Kliknij miejsce skrzynki rozdzielczej WYWIEWU.',
  term_sup:'Kliknij w pomieszczeniu miejsce anemostatu NAWIEWNEGO (puszka + zawór).',
  term_exh:'Kliknij w pomieszczeniu miejsce anemostatu WYWIEWNEGO.',
  intake:'Kliknij miejsce czerpni (ściana zewn. — pamiętaj o §152 WT).',
  exhout:'Kliknij miejsce wyrzutni.',
  riser:'Kliknij miejsce pionu. Piony o tym samym numerze na różnych kondygnacjach są łączone automatycznie.',
  duct:'Kliknij węzeł początkowy, punkty pośrednie trasy, zakończ na węźle docelowym. Trasa tylko w pionie/poziomie (przyciąganie ortogonalne). Esc — anuluj.',
  flx:'Kliknij rozdzielacz, punkty pośrednie, zakończ na anemostacie. Trasa tylko w pionie/poziomie. Esc — anuluj.',
  person:'Kliknij w pomieszczeniu, aby dodać mieszkańca. Mieszkańców można przeciągać między pomieszczeniami — nawiew i CO₂ przeliczają się automatycznie.'
};

function setTool(t){
  tool=t; draft=null;
  document.querySelectorAll('#toolbar .tbtn[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===t));
  cv.style.cursor = t==='pan'?'grab':(t==='select'?'default':'crosshair');
  setHint(TOOL_HINTS[t]||''); draw();
}
document.querySelectorAll('#toolbar .tbtn[data-tool]').forEach(b=>b.addEventListener('click',()=>setTool(b.dataset.tool)));

/* wstawienie węzła w punkcie — wspólna ścieżka dla kliknięcia narzędziem
   i dla upuszczenia karty z szyny narzędzi (drag & drop, js/dnd.js) */
function placeNodeAt(type,w,opt){
  opt=opt||{};
  const f=F();
  snapshot();
  const n={id:uid(),type:type,x:w.x,y:w.y};
  if(type==='riser'){ n.num = 1+Math.max(0,...state.floors.flatMap(fl=>fl.nodes.filter(x=>x.type==='riser').map(x=>x.num||0))); n.extraLen=3; }
  if(type==='term_sup'||type==='term_exh'){ const r=roomAt(w); n.roomId=r?r.id:null; if(!r) toast('Uwaga: anemostat poza obrysem pomieszczenia — nie zostanie policzony w bilansie.'); }
  if(type==='person'){ const r=roomAt(w); n.roomId=r?r.id:null; if(!r) toast('Mieszkaniec poza pomieszczeniem — nie wpływa na bilans.'); }
  f.nodes.push(n); sel={kind:'node',id:n.id};
  if(opt.armSelect) setTool('select');
  recalc(); refreshAll();
  return n;
}

/* ---------- hit-testing ---------- */
function nodeAt(w,tol=12){ const f=F(); tol/=view.z; for(const n of [...f.nodes].reverse()){ if(dist(w,n)<=Math.max(tol,(NODE_DEFS[n.type].r+4)/view.z)) return n; } return null; }
function roomAt(w){ const f=F(); for(const r of [...f.rooms].reverse()){ if(pointInPoly(w,r.pts)) return r; } return null; }
function segAt(w,tol=7){ const f=F(); tol/=view.z;
  for(const s of [...f.segs].reverse()){ const pts=(window.__routes&&window.__routes[s.id])||segPoints(s); for(let i=1;i<pts.length;i++){ if(distToSegment(w,pts[i-1],pts[i])<=tol) return s; } } return null; }
function segPoints(s){ const f=F(); const a=f.nodes.find(n=>n.id===s.a), b=f.nodes.find(n=>n.id===s.b); return orthoPath([a,...(s.pts||[]),b].filter(Boolean)); }
/* trasy przewodów tylko w pionie i poziomie (rzut): każdy skośny odcinek zamieniany na kolano poziom→pion */
function orthoPath(pts){
  if(pts.length<2) return pts;
  const out=[pts[0]];
  for(let i=1;i<pts.length;i++){ const p=out[out.length-1], q=pts[i];
    if(Math.abs(q.x-p.x)>0.01&&Math.abs(q.y-p.y)>0.01) out.push({x:q.x,y:p.y,_elbow:true});
    out.push(q); }
  return out;
}
/* ---------- rozsunięcie równoległych tras (nawiew / wywiew nie mogą się pokrywać) ----------
   Dla kondygnacji: każdy prosty odcinek trasy trafia do klastra odcinków współliniowych (ta sama oś, ta sama
   współrzędna ±tol, nakładające się zakresy). W klastrze odcinki otrzymują „pasy": nawiew po jednej stronie,
   wywiew po drugiej (kolejność: nawiew, czerpnia, mieszane, wyrzutnia, wywiew), rozstaw wg średnicy.
   Zwraca mapę segId -> punkty [px] do rysowania i hit-testu. Obliczenia długości używają trasy nominalnej. */
const SIDE_RANK={sup:0,fresh:1,null:2,mix:2,undefined:2,out:3,exh:4};
function buildRoutes(f){
  const C=window.CALC||{}, ppm=f.pxPerM||40, tol=0.35*ppm;
  const base={}, legs=[];
  f.segs.forEach(s=>{
    const a=f.nodes.find(n=>n.id===s.a), b=f.nodes.find(n=>n.id===s.b); if(!a||!b) return;
    const pts=orthoPath([a,...(s.pts||[]),b]); base[s.id]=pts;
    const res=(C.segs||{})[s.id]||{};
    const w = s.kind==='flx' ? 0.10 : Math.max(0.16,(res.d||125)/1000+0.06); // pas: FLX ~10 cm (wiązka), spiro = średnica + luz
    // odcinki proste (łączenie współliniowych)
    const L=[];
    for(let i=1;i<pts.length;i++){ const p=pts[i-1],q=pts[i]; if(Math.abs(p.x-q.x)<0.01&&Math.abs(p.y-q.y)<0.01) continue;
      const axis=Math.abs(p.y-q.y)<0.01?'h':'v';
      const last=L[L.length-1];
      if(last&&last.axis===axis){ last.q=q; } else L.push({axis,p,q});
    }
    L.forEach((l,i)=>{ l.seg=s; l.side=res.side; l.w=w*ppm; l.c= l.axis==='h'?l.p.y:l.p.x; l.lo=Math.min(l.axis==='h'?l.p.x:l.p.y, l.axis==='h'?l.q.x:l.q.y); l.hi=Math.max(l.axis==='h'?l.p.x:l.p.y, l.axis==='h'?l.q.x:l.q.y); l.off=0; legs.push(l); });
    s._legs=L;
  });
  // klastry (union-find)
  const par=legs.map((_,i)=>i); const find=i=>par[i]===i?i:(par[i]=find(par[i]));
  for(let i=0;i<legs.length;i++) for(let j=i+1;j<legs.length;j++){ const A=legs[i],B=legs[j];
    if(A.axis!==B.axis||Math.abs(A.c-B.c)>tol) continue;
    if(A.hi<B.lo-tol||B.hi<A.lo-tol) continue;               // brak nakładania zakresów
    if(A.seg===B.seg) continue;
    par[find(i)]=find(j); }
  const groups={}; legs.forEach((l,i)=>{ const r=find(i); (groups[r]=groups[r]||[]).push(l); });
  Object.values(groups).forEach(g=>{
    if(g.length<2) return;
    g.sort((a,b)=>(SIDE_RANK[a.side]??2)-(SIDE_RANK[b.side]??2) || (a.seg.id<b.seg.id?-1:1));
    const cRef=g.reduce((s,l)=>s+l.c,0)/g.length;
    // rozstaw: suma szerokości + luz 0,08 m, wyśrodkowana na wspólnej osi
    const gap=0.03*ppm; let total=g.reduce((s,l)=>s+l.w,0)+gap*(g.length-1); let pos=-total/2;
    g.forEach(l=>{ l.off=(cRef+pos+l.w/2)-l.c; pos+=l.w+gap; });
  });
  // odtworzenie polilinii: stub od węzła do przesuniętego odcinka, narożniki = przecięcia przesuniętych odcinków
  const out={};
  f.segs.forEach(s=>{
    const L=s._legs; if(!L||!L.length){ out[s.id]=base[s.id]||[]; return; }
    const cc=l=>l.c+l.off;
    const a=L[0].p, b=L[L.length-1].q;
    const pts=[a];
    const first=L[0]; const A2= first.axis==='h'?{x:a.x,y:cc(first)}:{x:cc(first),y:a.y}; if(dist(a,A2)>0.5) pts.push(A2);
    for(let i=1;i<L.length;i++){ const u=L[i-1],v=L[i]; if(u.axis===v.axis){ pts.push(v.axis==='h'?{x:v.p.x,y:cc(v)}:{x:cc(v),y:v.p.y}); continue; }
      pts.push(u.axis==='h'?{x:cc(v),y:cc(u)}:{x:cc(u),y:cc(v)}); }
    const last=L[L.length-1]; const B2= last.axis==='h'?{x:b.x,y:cc(last)}:{x:cc(last),y:b.y}; if(dist(b,B2)>0.5) pts.push(B2);
    pts.push(b);
    out[s.id]=pts; delete s._legs;
  });
  return out;
}
/* przyciąganie ortogonalne przy rysowaniu: punkt wyrównany do poprzedniego w osi dominującej */
/* punkt etykiety: FLX — środek ostatniego odcinka (przy anemostacie), kanał — środek najdłuższego odcinka */
function labelPoint(pts,kind){
  if(pts.length<2) return pts[0];
  let i=pts.length-1;
  if(kind!=='flx'){ let best=0; for(let k=1;k<pts.length;k++){ const L=dist(pts[k-1],pts[k]); if(L>best){best=L;i=k;} } }
  const a=pts[i-1], b=pts[i]; return {x:(a.x+b.x)/2,y:(a.y+b.y)/2};
}
function orthoSnap(prev,w){ if(!prev) return w; return Math.abs(w.x-prev.x)>=Math.abs(w.y-prev.y)? {x:w.x,y:prev.y} : {x:prev.x,y:w.y}; }

/* ---------- zdarzenia myszy ---------- */
cv.addEventListener('contextmenu',e=>e.preventDefault());
cv.addEventListener('wheel',e=>{ if(window.__mode3D) return; e.preventDefault();
  const k=e.deltaY<0?1.15:1/1.15, w=s2w(e.offsetX,e.offsetY);
  view.z=Math.min(12,Math.max(.04,view.z*k));
  view.x=e.offsetX-w.x*view.z; view.y=e.offsetY-w.y*view.z; draw();
},{passive:false});

cv.addEventListener('mousedown',e=>{
  if(window.__mode3D) return;
  const w=s2w(e.offsetX,e.offsetY); mouse.down=true;
  if(e.button===1||e.button===2||tool==='pan'||spaceDown){ mouse.panStart={mx:e.offsetX,my:e.offsetY,vx:view.x,vy:view.y}; cv.style.cursor='grabbing'; return; }
  if(tool==='select'){
    const n=nodeAt(w); if(n){ sel={kind:'node',id:n.id}; mouse.dragNode=n; snapshot(); refreshSide(); draw(); return; }
    const s=segAt(w); if(s){ sel={kind:'seg',id:s.id}; refreshSide(); draw(); return; }
    const r=roomAt(w); if(r){ sel={kind:'room',id:r.id}; refreshSide(); draw(); return; }
    sel=null; refreshSide(); draw();
  }
});
cv.addEventListener('mousemove',e=>{
  if(window.__mode3D) return;
  const w=s2w(e.offsetX,e.offsetY); mouse.wx=w.x; mouse.wy=w.y;
  const f=F();
  document.getElementById('stCoords').textContent = f.pxPerM? `${(w.x/f.pxPerM).toFixed(2)} m, ${(w.y/f.pxPerM).toFixed(2)} m` : `${w.x|0}, ${w.y|0} px`;
  if(mouse.panStart){ view.x=mouse.panStart.vx+(e.offsetX-mouse.panStart.mx); view.y=mouse.panStart.vy+(e.offsetY-mouse.panStart.my); draw(); return; }
  if(mouse.dragNode){ mouse.dragNode.x=w.x; mouse.dragNode.y=w.y; if(mouse.dragNode.type==='person'||mouse.dragNode.type==='term_sup'||mouse.dragNode.type==='term_exh'){ const r=roomAt(w); mouse.dragNode.roomId=r?r.id:null; } recalc(); draw(); return; }
  if(draft) draw();
});
window.addEventListener('mouseup',()=>{ mouse.down=false; mouse.panStart=null; if(mouse.dragNode){ mouse.dragNode=null; refreshSide(); } if(tool==='pan') cv.style.cursor='grab'; });

cv.addEventListener('click',e=>{
  if(window.__mode3D) return;
  if(e.detail>1) return; // dblclick osobno
  if(tool==='pan'||spaceDown||mouse.panStart) return;
  const w=s2w(e.offsetX,e.offsetY); const f=F();
  if(tool==='calib'){
    if(!draft) draft={type:'calib',pts:[w]};
    else { draft.pts.push(w); finishCalib(); }
    draw(); return;
  }
  if(tool==='room'){
    if(!draft) draft={type:'room',pts:[]};
    draft.pts.push(w); draw(); return;
  }
  if(tool==='roi'){
    if(!draft) draft={type:'roi',pts:[w]};
    else { const a=draft.pts[0]; draft=null; if(window.setROI) setROI(a,w); setTool('select'); }
    draw(); return;
  }
  if(tool==='wand'){ if(window.wandAt) wandAt(w); return; }
  if(NODE_DEFS[tool]){ placeNodeAt(tool,w,{armSelect:tool!=='person'}); return; }
  if(tool==='duct'||tool==='flx'){
    const n=nodeAt(w);
    if(!draft){
      if(!n){ toast('Zacznij od kliknięcia węzła (centrala / rozdzielacz / czerpnia...).'); return; }
      draft={type:'seg',kind:tool,a:n.id,pts:[]}; draw(); return;
    }
    if(n && n.id!==draft.a){
      snapshot();
      f.segs.push({id:uid(),kind:draft.kind,a:draft.a,b:n.id,pts:draft.pts,extraLen:0});
      draft=null; recalc(); refreshAll(); return;
    }
    { const a0=f.nodes.find(x=>x.id===draft.a); const last=draft.pts.length?draft.pts[draft.pts.length-1]:a0; draft.pts.push(orthoSnap(last,w)); }
    draw();
  }
});
cv.addEventListener('dblclick',e=>{ if(window.__mode3D) return; if(tool==='room'&&draft&&draft.pts.length>=3) finishRoom(); });

window.addEventListener('keydown',e=>{
  if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT'||e.target.tagName==='TEXTAREA') return;
  if(e.code==='Space'){ spaceDown=true; cv.style.cursor='grab'; }
  if(e.key==='Escape'){ draft=null; draw(); }
  if(e.key==='Enter'&&tool==='room'&&draft&&draft.pts.length>=3) finishRoom();
  if((e.key==='Delete'||e.key==='Backspace')&&sel){ deleteSel(); }
  if(e.ctrlKey&&e.key.toLowerCase()==='z'){ undo(); }
});
window.addEventListener('keyup',e=>{ if(e.code==='Space'){ spaceDown=false; cv.style.cursor=tool==='pan'?'grab':'default'; } });

function finishRoom(){
  snapshot(); const f=F();
  const r={id:uid(),pts:draft.pts,type:'sypialnia',name:'',osoby:null,hOverride:null,flowOverride:null};
  f.rooms.push(r); draft=null; sel={kind:'room',id:r.id};
  setTool('select'); recalc(); refreshAll();
}
function finishCalib(){
  const [a,b]=draft.pts, px=dist(a,b); draft=null;
  const val=prompt('Rzeczywista odległość między wskazanymi punktami [m]:','5.0');
  const m=parseFloat((val||'').replace(',','.'));
  if(m>0&&px>0){ snapshot(); F().pxPerM=px/m; recalc(); refreshAll(); toast(`Skala ustawiona: ${(px/m).toFixed(1)} px/m`); }
  draw();
}
function deleteSel(){
  if(!sel) return; snapshot(); const f=F();
  if(sel.kind==='room'){ f.rooms=f.rooms.filter(r=>r.id!==sel.id); f.nodes.forEach(n=>{if(n.roomId===sel.id)n.roomId=null;}); }
  if(sel.kind==='node'){ f.nodes=f.nodes.filter(n=>n.id!==sel.id); f.segs=f.segs.filter(s=>s.a!==sel.id&&s.b!==sel.id); }
  if(sel.kind==='seg'){ f.segs=f.segs.filter(s=>s.id!==sel.id); }
  sel=null; recalc(); refreshAll();
}
document.getElementById('btnDelete').addEventListener('click',deleteSel);
document.getElementById('btnUndo').addEventListener('click',undo);
document.getElementById('zin').addEventListener('click',()=>{ if(window.__mode3D){ const W=cv.clientWidth/2,H=cv.clientHeight/2; v3.scale*=1.25; v3.ox=W-(W-v3.ox)*1.25; v3.oy=H-(H-v3.oy)*1.25; draw(); return; } view.z*=1.25;draw();});
document.getElementById('zout').addEventListener('click',()=>{ if(window.__mode3D){ const W=cv.clientWidth/2,H=cv.clientHeight/2; v3.scale/=1.25; v3.ox=W-(W-v3.ox)/1.25; v3.oy=H-(H-v3.oy)/1.25; draw(); return; } view.z/=1.25;draw();});
document.getElementById('zfit').addEventListener('click',fitView);

function fitView(){
  if(window.__mode3D&&window.fit3D){ fit3D(); return; }
  const f=F(); let xs=[],ys=[];
  if(f.bg){ xs.push(0,f.bgW); ys.push(0,f.bgH); }
  f.rooms.forEach(r=>r.pts.forEach(p=>{xs.push(p.x);ys.push(p.y);}));
  f.nodes.forEach(n=>{xs.push(n.x);ys.push(n.y);});
  if(!xs.length){ view.x=40;view.y=40;view.z=1;draw();return; }
  const minx=Math.min(...xs),maxx=Math.max(...xs),miny=Math.min(...ys),maxy=Math.max(...ys);
  const W=cv.clientWidth,H=cv.clientHeight;
  view.z=Math.min(W/(maxx-minx+80),H/(maxy-miny+80),4);
  view.x=(W-(minx+maxx)*view.z)/2; view.y=(H-(miny+maxy)*view.z)/2; draw();
}

let toastT=null;
function toast(t){ setHint(t); clearTimeout(toastT); toastT=setTimeout(()=>setHint(TOOL_HINTS[tool]||''),4000); }

/* ---------- rysowanie ---------- */
const bgCache={}, maskImgCache={};
function draw(){
  const f=F(); if(!f) return;
  if(window.__mode3D&&window.draw3D){ draw3D(); return; }
  ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,cv.width,cv.height);
  ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
  ctx.save(); ctx.translate(view.x,view.y); ctx.scale(view.z,view.z);
  // podkład
  if(f.bg){
    let img=bgCache[f.id];
    if(!img||img.src!==f.bg){ img=new Image(); img.src=f.bg; bgCache[f.id]=img; img.onload=()=>{f.bgW=img.naturalWidth;f.bgH=img.naturalHeight;draw();}; }
    if(img.complete&&img.naturalWidth){ ctx.globalAlpha=f.bgAlpha??0.65; ctx.drawImage(img,0,0); ctx.globalAlpha=1; }
  }
  // podgląd maski ścian / regionów
  if(f.maskPrev){
    let mi=maskImgCache[f.id];
    if(!mi||mi.src!==f.maskPrev){ mi=new Image(); mi.src=f.maskPrev; maskImgCache[f.id]=mi; mi.onload=()=>draw(); }
    if(mi.complete&&mi.naturalWidth){ ctx.globalAlpha=0.75;
      ctx.drawImage(mi,0,0,mi.naturalWidth/(f.maskPrevK||1),mi.naturalHeight/(f.maskPrevK||1)); ctx.globalAlpha=1; }
  }
  const lw=k=>k/view.z;
  // pomieszczenia
  const C=window.CALC||{};
  f.rooms.forEach(r=>{
    const t=ROOM_TYPES[r.type]||{};
    const col = t.role==='exh'?'rgba(209,46,79,':'both'===t.role?'rgba(129,84,182,':t.role==='sup'?'rgba(45,98,190,':t.role==='excluded'?'rgba(142,144,150,':'rgba(142,144,150,';
    ctx.beginPath(); r.pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)); ctx.closePath();
    const LIVEr=window.CTRL&&CTRL.connected&&CTRL.roomCO2&&CTRL.roomCO2[r.id]!=null, co2=LIVEr?CTRL.roomCO2[r.id]:null;
    ctx.fillStyle=col+(sel&&sel.kind==='room'&&sel.id===r.id?'0.28)':'0.13)'); ctx.fill();
    if(LIVEr){ ctx.fillStyle=co2Color(co2, Math.min(0.55,Math.max(0,(co2-500)/1400))); ctx.fill(); }
    ctx.strokeStyle=col+'0.85)'; ctx.lineWidth=lw(sel&&sel.kind==='room'&&sel.id===r.id?3:1.6); ctx.stroke();
    const c=polyCentroid(r.pts), info=(C.rooms||{})[r.id];
    ctx.fillStyle='#1C1C1E'; ctx.textAlign='center';
    ctx.font=`600 ${lw(13)}px Outfit, Segoe UI`;
    ctx.fillText(roomName(r), c.x, c.y-lw(14));
    if(zoningOn()){ const z=roomZone(r); if(z){ const tw=ctx.measureText(roomName(r)).width; ctx.font=`700 ${lw(9.5)}px Outfit, Segoe UI`; ctx.fillStyle=ZONES[z].c; ctx.fillText(ZONES[z].short, c.x+tw/2+lw(12), c.y-lw(14)); ctx.fillStyle='#1C1C1E'; } }
    ctx.font=`${lw(11)}px Outfit, Segoe UI`; ctx.fillStyle='#6B6D73';
    if(info){ ctx.fillText(`${fmt(info.area,1)} m²`+(info.occ?`  · ${info.occ} os.`:'')+(info.sup?`  ▸ N ${fmt(info.sup)} m³/h`:'')+(info.exh?`  ▸ W ${fmt(info.exh)} m³/h`:''), c.x, c.y+lw(2)); }
    if(LIVEr){ ctx.font=`700 ${lw(11)}px Outfit, Segoe UI`; ctx.fillStyle=co2Color(co2,1); ctx.fillText(`CO₂ ${fmt(co2)} ppm`, c.x, c.y+lw(15)); }
    else ctx.fillText(f.pxPerM?`${fmt(polyArea(r.pts)/f.pxPerM**2,1)} m²`:'', c.x, c.y+lw(2));
  });
  // segmenty (trasy rozsunięte — nawiew i wywiew nie pokrywają się)
  const ROUTES=buildRoutes(f); window.__routes=ROUTES;
  f.segs.forEach(s=>{
    const pts=ROUTES[s.id]||segPoints(s); if(pts.length<2) return;
    const res=(C.segs||{})[s.id]||{};
    const supSide = res.side==='sup', exhSide=res.side==='exh';
    ctx.beginPath(); pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
    const LIVE=window.CTRL&&CTRL.connected, lq=LIVE?(CTRL.live.segs[s.id]||0):0, lk=LIVE&&res.q?Math.min(1.6,lq/res.q):1;
    if(s.kind==='flx'){
      ctx.strokeStyle= supSide?'#2D62BE':exhSide?'#D12E4F':'#B4B7BD';
      ctx.lineWidth=lw(sel&&sel.kind==='seg'&&sel.id===s.id?5:3)*(LIVE?Math.max(0.5,lk):1); ctx.setLineDash([lw(7),lw(5)]);
      if(LIVE) ctx.lineDashOffset=-CTRL.dash*lk/view.z; ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset=0;
      if(LIVE&&lq<1){ ctx.strokeStyle='rgba(255,255,255,.7)'; ctx.lineWidth=lw(3); ctx.stroke(); }
    } else {
      ctx.strokeStyle= res.side==='fresh'?'#248964':res.side==='out'?'#A57327':supSide?'#2D62BE':exhSide?'#D12E4F':'#8E9096';
      ctx.lineWidth=lw(sel&&sel.kind==='seg'&&sel.id===s.id?7:5); ctx.stroke();
      ctx.strokeStyle='rgba(255,255,255,.55)'; ctx.lineWidth=lw(1.4);
      if(LIVE){ ctx.setLineDash([lw(6),lw(10)]); ctx.lineDashOffset=-CTRL.dash*lk/view.z; }
      ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset=0;
    }
    if(res.q){
      const m2=labelPoint(pts,s.kind);
      ctx.font=`600 ${lw(10.5)}px Outfit, Segoe UI`; ctx.textAlign='center';
      const label= LIVE ? `${fmt(lq)} m³/h ▶` : (s.kind==='flx' ? `${fmt(res.q)} m³/h · ${res.tubes}×FLX${state.flxDia}` : `${fmt(res.q)} m³/h · Ø${res.d}`);
      const tw=ctx.measureText(label).width;
      ctx.fillStyle='rgba(255,255,255,.85)'; ctx.fillRect(m2.x-tw/2-lw(3),m2.y-lw(16),tw+lw(6),lw(13));
      ctx.fillStyle='#1C1C1E'; ctx.fillText(label,m2.x,m2.y-lw(6));
    }
  });
  // szkic segmentu w trakcie
  if(draft&&draft.type==='seg'){
    const a=f.nodes.find(n=>n.id===draft.a);
    const last=draft.pts.length?draft.pts[draft.pts.length-1]:a, mp=orthoSnap(last,{x:mouse.wx,y:mouse.wy});
    const dp=orthoPath([a,...draft.pts,mp]);
    ctx.beginPath(); dp.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
    ctx.strokeStyle='#1C1C1E'; ctx.lineWidth=lw(2); ctx.setLineDash([lw(6),lw(4)]); ctx.stroke(); ctx.setLineDash([]);
  }
  if(draft&&draft.type==='room'){
    ctx.beginPath(); draft.pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)); ctx.lineTo(mouse.wx,mouse.wy);
    ctx.strokeStyle='#22815E'; ctx.lineWidth=lw(2); ctx.setLineDash([lw(6),lw(4)]); ctx.stroke(); ctx.setLineDash([]);
  }
  if(f.roi){
    ctx.strokeStyle='#C03048'; ctx.lineWidth=lw(1.6); ctx.setLineDash([lw(10),lw(6)]);
    ctx.strokeRect(f.roi.x0,f.roi.y0,f.roi.x1-f.roi.x0,f.roi.y1-f.roi.y0); ctx.setLineDash([]);
    ctx.font=`${lw(11)}px Outfit, Segoe UI`; ctx.fillStyle='#C03048'; ctx.textAlign='left';
    ctx.fillText('obszar analizy',f.roi.x0+lw(4),f.roi.y0-lw(5));
  }
  if(draft&&draft.type==='roi'){
    const a=draft.pts[0];
    ctx.strokeStyle='#C03048'; ctx.lineWidth=lw(1.6); ctx.setLineDash([lw(8),lw(5)]);
    ctx.strokeRect(Math.min(a.x,mouse.wx),Math.min(a.y,mouse.wy),Math.abs(mouse.wx-a.x),Math.abs(mouse.wy-a.y));
    ctx.setLineDash([]);
  }
  if(draft&&draft.type==='calib'){
    const a=draft.pts[0]; ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(mouse.wx,mouse.wy);
    ctx.strokeStyle='#956B23'; ctx.lineWidth=lw(2); ctx.stroke();
  }
  // węzły
  f.nodes.forEach(n=>{
    const d=NODE_DEFS[n.type], r=d.r/view.z*Math.min(view.z,1.6);
    const isSel=sel&&sel.kind==='node'&&sel.id===n.id;
    ctx.beginPath();
    if(n.type==='person'){ // sylwetka: głowa + tułów
      ctx.arc(n.x,n.y-r*0.55,r*0.42,0,7); ctx.fillStyle=isSel?'#A9EBC9':d.c; ctx.fill();
      ctx.beginPath(); ctx.moveTo(n.x-r*0.75,n.y+r*0.9); ctx.quadraticCurveTo(n.x-r*0.8,n.y-r*0.15,n.x,n.y-r*0.1); ctx.quadraticCurveTo(n.x+r*0.8,n.y-r*0.15,n.x+r*0.75,n.y+r*0.9); ctx.closePath(); ctx.fill();
      ctx.strokeStyle='#fff'; ctx.lineWidth=lw(1.2); ctx.stroke();
      if(!n.roomId){ ctx.strokeStyle='#C03048'; ctx.setLineDash([lw(3),lw(2)]); ctx.beginPath(); ctx.arc(n.x,n.y,r*1.3,0,7); ctx.stroke(); ctx.setLineDash([]); }
      return; }
    if(n.type==='ahu'){ ctx.rect(n.x-r*1.4,n.y-r,r*2.8,r*2); } else ctx.arc(n.x,n.y,r,0,7);
    ctx.fillStyle=isSel?'#A9EBC9':(d.c||d.color||'#1C1C1E'); ctx.fill();
    ctx.strokeStyle='#fff'; ctx.lineWidth=lw(1.6); ctx.stroke();
    ctx.fillStyle=isSel?'#1C1C1E':'#fff'; ctx.font=`700 ${r*0.9}px Outfit, Segoe UI`; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(d.sym+(n.type==='riser'?n.num:''),n.x,n.y+r*0.05);
    ctx.textBaseline='alphabetic';
    const info=(window.CALC?.nodes||{})[n.id];
    if(info&&info.q){ const LIVE=window.CTRL&&CTRL.connected&&(n.type==='term_sup'||n.type==='term_exh'); const q=LIVE?(CTRL.live.nodes[n.id]??info.q):info.q; ctx.font=`600 ${lw(10)}px Outfit, Segoe UI`; ctx.fillStyle=LIVE?'#22815E':'#1C1C1E'; ctx.fillText(`${fmt(q)} m³/h`,n.x,n.y+r+lw(11)); }
  });
  ctx.restore();
  if(window.drawLiveBadge) drawLiveBadge();
  document.getElementById('stScale').textContent = f.pxPerM?`skala: ${f.pxPerM.toFixed(1)} px/m (1:${fmt(100/ (f.pxPerM/37.8) ,0)}~)`:'skala: NIESKALIBROWANA — użyj narzędzia Kalibracja';
  document.getElementById('stSel').textContent = sel?`zaznaczono: ${selLabel()}`:'';
}
function selLabel(){
  const f=F();
  if(sel.kind==='room'){ const r=f.rooms.find(x=>x.id===sel.id); return r?roomName(r):''; }
  if(sel.kind==='node'){ const n=f.nodes.find(x=>x.id===sel.id); return n?NODE_DEFS[n.type].label:''; }
  if(sel.kind==='seg'){ const s=f.segs.find(x=>x.id===sel.id); return s?(s.kind==='flx'?'przewód FLX':'kanał spiro'):''; }
  return '';
}
function co2Color(ppm,a){ return ppm>1200?`rgba(192,48,72,${a})`:ppm>1000?`rgba(165,115,39,${a})`:ppm>800?`rgba(149,107,35,${a})`:`rgba(34,129,94,${a})`; }
function roomName(r){ return r.name || (ROOM_TYPES[r.type]?.label.split(' — ')[0].split(' /')[0] ?? 'Pomieszczenie'); }
/* ---------- STREFY WENTYLACJI (nawiew): S1 = pokoje/sypialnie (strefa nocna), S2 = salon/jadalnia (strefa dzienna) ---------- */
const ZONES={1:{label:'S1 — pokoje (strefa nocna)',short:'S1',c:'#6946B9'},2:{label:'S2 — salon (strefa dzienna)',short:'S2',c:'#65762D'}};
const ZONE_DEFAULT={sypialnia:1,pokoj:1,pokoj_oddzielony:1,salon:2,salon_aneks:2};
function zoningOn(){ return !!(state.zoning&&state.zoning.on); }
function roomZone(r){ const t=ROOM_TYPES[r.type]||{}; if(!(t.role==='sup'||t.role==='both')) return 0; if(r.zone===0) return 0; if(r.zone===1||r.zone===2) return r.zone; return ZONE_DEFAULT[r.type]||0; }
/* ============================ OBLICZENIA ============================ */
window.CALC={};
const round5=x=>Math.round(x/5)*5;

function allNodes(){ return state.floors.flatMap((f,fi)=>f.nodes.map(n=>({...n,fi}))); }
function nodeKey(n){ return n.type==='riser' ? 'R#'+(n.num||1) : n.id; }

function recalc(){
  const C={rooms:{},segs:{},nodes:{},warn:[],terms:[]};
  const occ=allNodes().filter(n=>n.type==='person'); C.occupants=occ.length; C.occByRoom={}; occ.forEach(n=>{ if(n.roomId) C.occByRoom[n.roomId]=(C.occByRoom[n.roomId]||0)+1; });
  const fromPlan=occ.length>0; C.personsFromPlan=fromPlan;
  const persons= fromPlan? occ.length : (state.persons||1);
  // ---------- 1. bilans pomieszczeń ----------
  let exhList=[],supList=[];
  state.floors.forEach((f,fi)=>{
    f.rooms.forEach(r=>{
      const t=ROOM_TYPES[r.type]||{};
      const area=(r.areaOverride!=null&&r.areaOverride>0)? r.areaOverride
                 : (f.pxPerM? polyArea(r.pts)/f.pxPerM**2 : null);
      const h=r.hOverride||f.h, vol=area?area*h:null;
      const rec={id:r.id,fi,floor:f.name,name:roomName(r),type:r.type,area,vol,exh:0,sup:0,role:t.role,boost:t.boost};
      if(t.role==='exh'||t.role==='both'){
        rec.exhBase = r.flowOverride!=null? r.flowOverride : (t.flow?t.flow(persons):(t.wExh||0));
        exhList.push(rec);
      }
      if(t.role==='sup'||t.role==='both'){
        rec.w = fromPlan ? ((C.occByRoom[r.id]||0)>0 ? C.occByRoom[r.id] : 0.5) : (r.osoby!=null? r.osoby : (t.osoby||1));
        rec.occ = C.occByRoom[r.id]||0;
        supList.push(rec);
      }
      if(t.role==='excluded') rec.warnTxt=t.warn;
      C.rooms[r.id]=rec;
    });
  });
  const sumExhBase=exhList.reduce((s,r)=>s+r.exhBase,0);
  const minOs=NORMS.minPerPerson*persons;
  const V=Math.max(sumExhBase,minOs);
  // wywiew: skalowanie w górę do bilansu (minima normowe zachowane)
  const kEx=sumExhBase>0?V/sumExhBase:0;
  let accE=0; exhList.forEach((r,i)=>{ r.exh = i===exhList.length-1 ? V-accE : round5(r.exhBase*kEx); if(r.exh<r.exhBase) r.exh=r.exhBase; accE+=r.exh; });
  const sumExh=exhList.reduce((s,r)=>s+r.exh,0);
  // nawiew: rozdział wg wag (osób)
  const sumW=supList.reduce((s,r)=>s+r.w,0);
  let accS=0; supList.forEach((r,i)=>{ r.sup = i===supList.length-1 ? Math.max(0,sumExh-accS) : round5(sumExh*(sumW?r.w/sumW:1/supList.length)); accS+=r.sup; });
  const sumSup=supList.reduce((s,r)=>s+r.sup,0);
  C.balance={sumExhBase,minOs,V:sumExh,sumSup,persons,night:Math.round(sumExh*NORMS.nightReduction)};
  // ---------- 1b. strefy nawiewu: tryb dzień / noc (suma nawiewu stała, przepustnice strefowe przerzucają strumień) ----------
  const Z=state.zoning||{on:false}; C.zoning={on:zoningOn(),z:{1:{nom:0,day:0,night:0,rooms:0},2:{nom:0,day:0,night:0,rooms:0}}};
  supList.forEach(r=>{ const rr=state.floors[r.fi].rooms.find(x=>x.id===r.id); r.zone=rr?roomZone(rr):0; if(r.zone){ C.zoning.z[r.zone].nom+=r.sup; C.zoning.z[r.zone].rooms++; } r.supDay=r.sup; r.supNight=r.sup; });
  if(C.zoning.on){
    const z1=C.zoning.z[1], z2=C.zoning.z[2], tot=z1.nom+z2.nom;
    const scen=(cutZone,pct,key)=>{ // strefa „cutZone” zredukowana do pct % nominału, reszta trafia do drugiej strefy (wagi nominalne)
      const other=cutZone===1?2:1, zc=C.zoning.z[cutZone], zo=C.zoning.z[other];
      const cut=zo.nom>0&&zc.nom>0 ? Math.round(zc.nom*pct/100/5)*5 : zc.nom;
      const rest=tot-cut;
      supList.forEach(r=>{ if(r.zone===cutZone) r[key]=zc.nom?Math.round(r.sup*cut/zc.nom):0; else if(r.zone===other) r[key]=zo.nom?Math.round(r.sup*rest/zo.nom):0; });
      const zk=key==='supDay'?'day':'night'; zc[zk]=cut; zo[zk]=rest;
    };
    scen(1, Z.dayZ1??40, 'supDay');   // dzień: pokoje zredukowane, salon dostaje więcej
    scen(2, Z.nightZ2??30, 'supNight'); // noc: salon zredukowany, pokoje dostają więcej
  }
  // ---------- 2. anemostaty ----------
  const terms=allNodes().filter(n=>n.type==='term_sup'||n.type==='term_exh');
  terms.forEach(n=>{
    const rec=n.roomId?C.rooms[n.roomId]:null;
    const side=n.type==='term_sup'?'sup':'exh';
    let q=0;
    if(rec){
      const roomFlow=side==='sup'?rec.sup:rec.exh;
      const cnt=terms.filter(m=>m.roomId===n.roomId&&m.type===n.type).length;
      q=cnt?Math.round(roomFlow/cnt):0;
      if(side==='sup'&&C.zoning.on){ n._qMax=Math.round(Math.max(rec.sup,rec.supDay||0,rec.supNight||0)/cnt); n._qDay=Math.round((rec.supDay||0)/cnt); n._qNight=Math.round((rec.supNight||0)/cnt); }
      if(roomFlow===0&&rec.role!=='transfer') C.warn.push(`Anemostat ${side==='sup'?'nawiewny':'wywiewny'} w pomieszczeniu „${rec.name}” — pomieszczenie nie ma ${side==='sup'?'nawiewu':'wywiewu'} w bilansie.`);
    } else C.warn.push('Anemostat poza obrysem pomieszczenia — przepływ 0.');
    C.nodes[n.id]={q,side,qDay:n._qDay,qNight:n._qNight};
    C.terms.push({id:n.id,fi:n.fi,q,qMax:n._qMax??q,side,roomId:n.roomId});
  });
  // ---------- 3. graf sieci ----------
  const adj={}; // key -> [{key2, seg, fi}]
  const key2node={};
  allNodes().forEach(n=>{ key2node[nodeKey(n)]=n; });
  state.floors.forEach((f,fi)=>{
    f.segs.forEach(s=>{
      const a=f.nodes.find(n=>n.id===s.a), b=f.nodes.find(n=>n.id===s.b); if(!a||!b) return;
      const ka=nodeKey(a),kb=nodeKey(b);
      (adj[ka]=adj[ka]||[]).push({to:kb,seg:s,fi}); (adj[kb]=adj[kb]||[]).push({to:ka,seg:s,fi});
      C.segs[s.id]={q:0,qMax:0,kind:s.kind,fi,side:null};
    });
  });
  const ahu=allNodes().find(n=>n.type==='ahu');
  C.hasAhu=!!ahu;
  function path(fromKey,toKey){
    if(fromKey===toKey) return [];
    const prev={[fromKey]:null},Q=[fromKey];
    while(Q.length){ const k=Q.shift(); for(const e of (adj[k]||[])){ if(!(e.to in prev)){ prev[e.to]={k,seg:e.seg}; if(e.to===toKey){ const out=[]; let c=e.to; while(prev[c]){ out.push(prev[c].seg); c=prev[c].k; } return out.reverse(); } Q.push(e.to);} } }
    return null;
  }
  const termPaths={};
  if(ahu){
    const ak=nodeKey(ahu);
    C.terms.forEach(t=>{
      const pp=path(ak,t.id);
      if(pp===null){ C.warn.push('Anemostat niepodłączony do centrali (brak ciągłej trasy przewodów).'); t.connected=false; return; }
      t.connected=true; termPaths[t.id]=pp;
      pp.forEach(s=>{ C.segs[s.id].q+=t.q; C.segs[s.id].qMax+=t.qMax; C.segs[s.id].side=C.segs[s.id].side&&C.segs[s.id].side!==t.side?'mix':t.side; });
    });
    // czerpnia / wyrzutnia
    allNodes().filter(n=>n.type==='intake'||n.type==='exhout').forEach(n=>{
      const pp=path(ak,nodeKey(n));
      if(pp===null){ C.warn.push(`${n.type==='intake'?'Czerpnia':'Wyrzutnia'} niepodłączona do centrali.`); return; }
      n._path=pp;
      pp.forEach(s=>{ C.segs[s.id].q+=sumExh; C.segs[s.id].qMax+=sumExh; C.segs[s.id].side=n.type==='intake'?'fresh':'out'; });
      C.nodes[n.id]={q:sumExh,side:n.type==='intake'?'fresh':'out'};
      (C.ambPaths=C.ambPaths||{})[n.type]=pp;
    });
    // przepływy rozdzielaczy
    allNodes().filter(n=>n.type==='man_sup'||n.type==='man_exh').forEach(n=>{
      const q=state.floors[n.fi].segs.filter(s=>(s.a===n.id||s.b===n.id)&&s.kind==='flx').reduce((s,g)=>s+(C.segs[g.id]?.q||0),0);
      C.nodes[n.id]={q,side:n.type==='man_sup'?'sup':'exh'};
    });
    C.nodes[ahu.id]={q:sumExh,side:null};
  }
  // ---------- 4. wymiarowanie segmentów ----------
  const flx=FLX_SYS[state.flxDia];
  state.floors.forEach((f,fi)=>{
    f.segs.forEach(s=>{
      const a=f.nodes.find(n=>n.id===s.a), b=f.nodes.find(n=>n.id===s.b); if(!a||!b) return;
      const pts=orthoPath([a,...(s.pts||[]),b]);
      const r=C.segs[s.id];
      r.len = (f.pxPerM? polylineLen(pts)/f.pxPerM : 0) + (s.extraLen||0);
      // połowa długości pionu doliczana do każdego odcinka stykającego się z pionem
      [a,b].forEach(n=>{ if(n.type==='riser') r.len += (n.extraLen??3)/2; });
      // kolana z geometrii
      r.bends90=0;r.bends45=0;
      for(let i=1;i<pts.length-1;i++){
        const a1=Math.atan2(pts[i].y-pts[i-1].y,pts[i].x-pts[i-1].x), a2=Math.atan2(pts[i+1].y-pts[i].y,pts[i+1].x-pts[i].x);
        let da=Math.abs((a2-a1)*180/Math.PI); if(da>180)da=360-da;
        if(da>60) r.bends90++; else if(da>25) r.bends45++;
      }
      const qS=Math.max(r.q||0,r.qMax||0); r.qSize=qS; // wymiarowanie na maksimum ze scenariuszy stref
      if(s.kind==='flx'){
        r.tubes=Math.max(1,Math.ceil(qS/flx.qMax));
        r.qTube=qS/r.tubes;
        r.v = r.qTube/3600/(Math.PI*flx.dInner**2/4);
        r.dp = r.len*flx.dpm(r.qTube);
        r.dim = `${r.tubes}×FLX ${state.flxDia}`;
      } else {
        r.d = s.dOverride || autoDiameter(qS||1);
        const {v,dpm}=spiroDpm(qS,r.d);
        r.v=v; const pdyn=1.2*v*v/2;
        r.dp = r.len*dpm + (r.bends90*0.3+r.bends45*0.15)*pdyn;
        r.dim=`Ø${r.d}`;
      }
      r.dp=r.dp||0;
    });
  });
  // ---------- 5. spręż wymagany (ścieżka krytyczna) ----------
  function pathDp(pp){ return pp.reduce((s,g)=>s+(C.segs[g.id]?.dp||0),0); }
  let critSup={dp:0},critExh={dp:0};
  C.terms.filter(t=>t.connected).forEach(t=>{
    const dpT=pathDp(termPaths[t.id]) + LUMP.plenumValve + LUMP.manifold;
    const o={dp:dpT,term:t};
    if(t.side==='sup'&&dpT>critSup.dp) critSup=o;
    if(t.side==='exh'&&dpT>critExh.dp) critExh=o;
  });
  const dpFresh=(C.ambPaths?.intake?pathDp(C.ambPaths.intake):0)+(C.ambPaths?.intake?LUMP.intakeZeta*1.2*Math.pow((C.segs[C.ambPaths.intake[0]?.id]?.v||2.5),2)/2:0);
  const dpOut=(C.ambPaths?.exhout?pathDp(C.ambPaths.exhout):0)+(C.ambPaths?.exhout?LUMP.intakeZeta*1.2*Math.pow((C.segs[C.ambPaths.exhout[0]?.id]?.v||2.5),2)/2:0);
  C.press={
    sup: critSup.dp + dpFresh + 2*LUMP.silencer,
    exh: critExh.dp + dpOut + 2*LUMP.silencer,
    critSup, critExh, dpFresh, dpOut
  };
  C.press.max=Math.max(C.press.sup,C.press.exh);
  // ---------- 6. dobór centrali ----------
  C.units=AHU_LIST.map(u=>{
    const okV=sumExh<=0.9*u.v100, okP=C.press.max<=100;
    let st = !okV?'za mała':(C.press.max>150?'spręż zbyt wysoki':(C.press.max>100?'sprawdź charakterystykę':'OK'));
    return {...u,st,fit:okV&&C.press.max<=150};
  });
  C.unit = C.units.find(u=>u.fit) || null;
  // ---------- 7. BOM ----------
  buildBOM(C);
  // ---------- 8. zgodność ----------
  buildChecks(C);
  C.termPaths=termPaths;
  window.CALC=C;
}

/* ---------- BOM ---------- */
function buildBOM(C){
  const bom=[]; const add=(code,name,qty,unit,note)=>bom.push({code,name,qty,unit,note:note||''});
  const flx=FLX_SYS[state.flxDia];
  const ductD=C.unit?C.unit.duct:160;
  if(C.unit) add(C.unit.model,'Centrala wentylacyjna z odzyskiem ciepła 21LAB',1,'szt.',`sprawność ${C.unit.eta}%, króćce Ø${ductD}`);
  const segs=Object.entries(C.segs);
  // spiro wg średnic
  const byD={};
  state.floors.forEach(f=>f.segs.filter(s=>s.kind==='duct').forEach(s=>{
    const r=C.segs[s.id]; if(!r||!r.len) return;
    const d=r.d; byD[d]=byD[d]||{len:0,b90:0,b45:0,ins:0};
    byD[d].len+=r.len; byD[d].b90+=r.bends90; byD[d].b45+=r.bends45;
    if(s.insulated) byD[d].ins+=r.len;
  }));
  Object.entries(byD).forEach(([d,v])=>{
    add(CAT.pipe(d).split(' ')[0],CAT.pipe(d).replace(/^\S+ /,''),Math.ceil(v.len*1.05),'m');
    if(v.b90) add(`BPL-90-${d}`,'Kolano tłoczone 90° z uszczelką',v.b90,'szt.');
    if(v.b45) add(`BPL-45-${d}`,'Kolano tłoczone 45° z uszczelką',v.b45,'szt.');
    add(`ILPL-${d}`,'Nypel łączący z uszczelką',Math.ceil(v.len/3)+v.b90+v.b45+2,'szt.');
    if(v.ins) add(`ALSDL-PE-L-${d}`,'Izolacja: przewód izolowany term.-akust. (odcinki przez przestrzeń nieogrzewaną)',Math.ceil(v.ins),'m','alternatywnie otulina na spiro');
  });
  // FLX
  let flxLen=0, tubesTotal=0, plenums={sup:0,exh:0}, plenumSpec={};
  state.floors.forEach(f=>f.segs.filter(s=>s.kind==='flx').forEach(s=>{
    const r=C.segs[s.id]; if(!r) return;
    flxLen+=r.len*(r.tubes||1); tubesTotal+=r.tubes||1;
    const b=f.nodes.find(n=>n.id===s.b), a=f.nodes.find(n=>n.id===s.a);
    const term=[a,b].find(n=>n&&(n.type==='term_sup'||n.type==='term_exh'));
    if(term){ const k=`${r.tubes||1}`; plenumSpec[k]=(plenumSpec[k]||0)+1; plenums[term.type==='term_sup'?'sup':'exh']++; }
  }));
  if(flxLen) add(flx.code,'Przewód elastyczny PE-HD antybakteryjny (FLX-REKU)',Math.ceil(flxLen*1.05),'m','zapas 5%');
  Object.entries(plenumSpec).forEach(([n,cnt])=> add(`${flx.plenum}-${n}-125-F`,`Puszka rozprężna EPP, ${n}×Ø${state.flxDia}, przyłącze Ø125`,cnt,'szt.'));
  if(plenums.sup) add('KN-125','Zawór nawiewny talerzowy Ø125',plenums.sup,'szt.','regulacja strumienia na zaworze');
  if(plenums.exh) add('KW-125','Zawór wywiewny talerzowy Ø125',plenums.exh,'szt.');
  // rozdzielacze
  allNodes().filter(n=>n.type==='man_sup'||n.type==='man_exh').forEach(n=>{
    const tubes=state.floors[n.fi].segs.filter(s=>(s.a===n.id||s.b===n.id)&&s.kind==='flx').reduce((s,g)=>s+(C.segs[g.id]?.tubes||0),0);
    const mainSeg=state.floors[n.fi].segs.find(s=>(s.a===n.id||s.b===n.id)&&s.kind==='duct');
    const d1=mainSeg?C.segs[mainSeg.id]?.d:160;
    if(tubes) add(`${flx.manifold}-${tubes}-${d1}`,`Rozdzielacz EPP ${n.type==='man_sup'?'nawiewu':'wywiewu'}: ${tubes}×Ø${state.flxDia}, przyłącze Ø${d1}`,1,'szt.','konfiguracja króćców wg katalogu FLX-REKU');
  });
  if(tubesTotal){
    add(`FLX-O-${state.flxDia}`,'Uszczelka o-ring do złącz FLX (2 szt./złącze)',tubesTotal*4,'szt.');
    add('FLX-FIX-75-10-1','Mocowanie przewodów FLX (opak. 10 szt.)',Math.ceil(flxLen/1.5/10),'opak.','1 uchwyt / ~1,5 m');
  }
  // tłumiki + czerpnia/wyrzutnia
  if(C.unit){
    if(C.zoning&&C.zoning.on&&C.zoning.z[1].rooms&&C.zoning.z[2].rooms){ add('PRZ-SIL-125','Przepustnica strefowa z siłownikiem 24 V (nawiew: S1 pokoje / S2 salon)',2,'szt.','[do weryfikacji] dobór z katalogu 21LAB — alternatywnie osobny rozdzielacz nawiewu na strefę'); add('STER-STREFY','Sterownik strefowy dzień/noc (2 wyjścia, harmonogram / czujnik obecności)',1,'szt.','[do weryfikacji] kompatybilność ze sterowaniem centrali'); }
    add(`SIL-${ductD}-600`,'Tłumik akustyczny okrągły L=600 (nawiew + wywiew)',2,'szt.','montaż przy centrali — hałas wg PN-87/B-02151/02');
    if(state.combi) add(`CWS-COMBI-${ductD}`,'Czerpnio-wyrzutnia ścienna combi',1,'szt.','jedno przejście przez ścianę');
    else { add(`UELA-AL-${ductD}`,'Czerpnia ścienna aluminiowa',1,'szt.','§152 WT — odległości'); add(`USAV-${ductD}`,'Wyrzutnia ścienna z siatką',1,'szt.'); }
    add(`ALSDL-PE-L-${ductD}`,'Przewód izolowany paroszczelny: czerpnia/wyrzutnia ↔ centrala',Math.ceil((C.press?1:1)*4),'m','odcinki czerpni i wyrzutni ZAWSZE izolowane paroszczelnie (§153 WT)');
  }
  if(window.ctrlBOM) ctrlBOM(C,add);
  C.bom=bom;
}

/* ---------- ZGODNOŚĆ ---------- */
function buildChecks(C){
  const ch=[]; const add=(st,txt,ref)=>ch.push({st,txt,ref});
  const B=C.balance;
  if(C.zoning&&C.zoning.on&&C.zoning.z[1].rooms&&C.zoning.z[2].rooms){ const z1n=C.zoning.z[1].night; add(z1n>=B.minOs?'ok':'warn',`Strefowanie: w trybie nocnym strefa S1 (pokoje) otrzymuje ${fmt(z1n)} m³/h (min. ${fmt(B.minOs)} m³/h dla ${B.persons} osób); tryb dzienny — salon ${fmt(C.zoning.z[2].day)} m³/h. Przewody wymiarowane na maksimum ze scenariuszy.`,'PN-83/B-03430/Az3 p. 2.1.5 (regulacja strumieni); WT §149'); }
  add(B.V>=B.minOs?'ok':'err',`Strumień powietrza zewnętrznego: ${fmt(B.V)} m³/h przy ${B.persons} osobach (wymagane min. ${fmt(B.minOs)} m³/h).`,'WT §149 ust. 1; PN-83/B-03430/Az3:2000 (20 m³/h·os)');
  const exR=Object.values(C.rooms).filter(r=>r.exhBase!=null);
  add(exR.length?'ok':'warn',exR.length?`Wywiewy normowe przypisane dla ${exR.length} pomieszczeń (kuchnia 70/50/30, łazienka 50, WC 30, pom. bez okna 15).`:'Brak pomieszczeń z wywiewem normowym — dodaj kuchnię, łazienkę, WC.','PN-83/B-03430 p. 2.1.2 (norma przywołana w zał. 1 WT)');
  const kitch=Object.values(C.rooms).find(r=>r.boost);
  add(kitch?'warn':'warn',kitch?`Kuchnia: przewidzieć okresowy wywiew intensywny ≥ ${NORMS.kitchenBoost} m³/h (tryb boost centrali lub okap z własnym wyrzutem${state.kitchenHood?' — zaznaczono okap':''}). Okap NIE może być wpięty w rekuperację.`:'Brak kuchni w projekcie — uzupełnij.','PN-83/B-03430/Az3:2000');
  if(C.unit) add(C.unit.eta>=NORMS.recoveryMinEta?'ok':'err',`Odzysk ciepła: ${C.unit.model}, sprawność ${C.unit.eta}% (wymagane ≥ ${NORMS.recoveryMinEta}% dla instalacji ≥ ${NORMS.recoveryThreshold} m³/h; dobra praktyka — zawsze).`,'WT §151 ust. 1');
  else add('warn','Nie dobrano jeszcze centrali z odzyskiem ciepła.','WT §151');
  // prędkości
  const fast=[]; state.floors.forEach(f=>f.segs.forEach(s=>{ const r=C.segs[s.id]; if(!r)return;
    if(s.kind==='flx'&&r.v>NORMS.vMax.flx) fast.push(`FLX ${fmt(r.v,1)} m/s`);
    if(s.kind==='duct'&&r.v>NORMS.vMax.main) fast.push(`spiro Ø${r.d}: ${fmt(r.v,1)} m/s`); }));
  add(fast.length?'warn':'ok',fast.length?`Przekroczone zalecane prędkości (hałas!): ${fast.join(', ')}. Zwiększ średnice / liczbę przewodów.`:'Prędkości powietrza w przewodach w zakresie zalecanym (kanały ≤ 4 m/s, FLX ≤ 3 m/s).','praktyka projektowa; hałas: PN-87/B-02151/02 (pokoje 25 dB(A) w nocy)');
  // pokrycie pomieszczeń
  const noTerm=[];
  Object.values(C.rooms).forEach(r=>{
    if(r.role==='transfer'||r.role==='excluded') return;
    const has=C.terms.some(t=>t.roomId===r.id&&((r.role==='sup'&&t.side==='sup')||(r.role==='exh'&&t.side==='exh')||r.role==='both'));
    if(!has) noTerm.push(r.name);
  });
  add(noTerm.length?'err':'ok',noTerm.length?`Pomieszczenia bez anemostatu: ${noTerm.join(', ')}.`:'Każde pomieszczenie bilansowane ma element nawiewny/wywiewny.','PN-83/B-03430 p. 2.1.3 (nawiew do pokojów, wywiew z pom. „brudnych”)');
  const excl=Object.values(C.rooms).filter(r=>r.role==='excluded');
  excl.forEach(r=>{
    const conn=C.terms.some(t=>t.roomId===r.id);
    add(conn?'err':'warn',`${r.name}: ${conn?'PODŁĄCZONO do rekuperacji — usuń! ':''}${ROOM_TYPES[r.type].warn}`,'WT §108 (garaż); przepisy dot. kotłowni');
  });
  add(C.ambPaths?.intake&&C.ambPaths?.exhout?'ok':'err',C.ambPaths?.intake&&C.ambPaths?.exhout?'Czerpnia i wyrzutnia zaprojektowane. Zweryfikuj na budowie: czerpnia ≥ 2 m nad terenem, ≥ 8 m od parkingów/miejsc odpadów; rozdział czerpni od wyrzutni wg §152.':'Brak czerpni lub wyrzutni podłączonej do centrali.','WT §152');
  add('warn','Przewody przez przestrzenie nieogrzewane (poddasze, garaż) — izolacja cieplna; czerpnia/wyrzutnia — izolacja z barierą paroszczelną. Otwory rewizyjne do czyszczenia przewodów.','WT §153 ust. 5–6');
  add('warn','Zapewnić przepływ powietrza: podcięcia drzwi pokojów ~80 cm² (0,008 m²), drzwi łazienki/WC — otwory ≥ 220 cm² (0,022 m²).','PN-83/B-03430 p. 2.1.4');
  add('warn','Budynek z kominkiem/paleniskiem na paliwo stałe: zapewnić NIEZALEŻNY dopływ powietrza do spalania; wentylacja mechaniczna nie może powodować podciśnienia zakłócającego odprowadzenie spalin (dopuszczalne kominki z zamkniętą komorą spalania).','WT §148 ust. 4, §150 ust. 9');
  add('ok',`Redukcja nocna: dopuszczalne obniżenie strumieni do 60% (${fmt(C.balance.night)} m³/h) poza okresem użytkowania, z zachowaniem ochrony przed wilgocią.`,'PN-83/B-03430/Az3:2000');
  if(C.hasAhu&&C.press.max>0) add(C.press.max<=150?'ok':'warn',`Obliczony wymagany spręż dyspozycyjny: ${fmt(C.press.max)} Pa (nawiew ${fmt(C.press.sup)} / wywiew ${fmt(C.press.exh)}).`,'obliczenia własne — Darcy-Weisbach/Altszul + opory miejscowe');
  C.checks=ch;
}

/* ============================ PANELE UI ============================ */
function refreshAll(){ recalc(); renderFloorbar(); refreshSide(); draw(); if(window.updateDropzone) updateDropzone(); }
function refreshSide(){ renderPane(currentPane); renderProps(); }
let currentPane='proj';
document.querySelectorAll('#tabs button').forEach(b=>b.addEventListener('click',()=>{
  currentPane=b.dataset.pane;
  document.querySelectorAll('#tabs button').forEach(x=>x.classList.toggle('active',x===b));
  document.querySelectorAll('.pane').forEach(p=>p.classList.toggle('active',p.id==='pane-'+currentPane));
  renderPane(currentPane);
  if(window.setMode3D) setMode3D(currentPane==='v3d');
}));

function bindNum(el,obj,key,cb){ el.addEventListener('change',()=>{ snapshot(); const v=parseFloat(el.value.replace? el.value.replace(',','.'):el.value); obj[key]=isNaN(v)?null:v; (cb||refreshAll)(); }); }

function renderFloorbar(){
  const fb=document.getElementById('floorbar'); fb.innerHTML='';
  state.floors.forEach((f,i)=>{
    const b=document.createElement('button'); b.textContent=f.name; b.className=i===state.activeFloor?'active':'';
    b.onclick=()=>{ state.activeFloor=i; sel=null; refreshAll(); fitView(); };
    fb.appendChild(b);
  });
  const add=document.createElement('button'); add.textContent='+ kondygnacja';
  add.onclick=()=>{ snapshot(); state.floors.push(newFloor(state.floors.length===1?'Piętro':'Kondygnacja '+(state.floors.length+1))); state.activeFloor=state.floors.length-1; refreshAll(); };
  fb.appendChild(add);
  const b3=document.createElement('button'); b3.textContent=window.__mode3D?'2D':'3D'; b3.className='b3d'+(window.__mode3D?' active':''); b3.title=window.__mode3D?'Wróć do edycji rzutu':'Widok 3D instalacji (aksonometria)';
  b3.onclick=()=>{ if(!window.setMode3D) return; if(window.__mode3D){ v3SwitchTab('proj'); setMode3D(false); } else { v3SwitchTab('v3d'); setMode3D(true); } };
  fb.appendChild(b3);
}

function renderPane(p){
  const el=document.getElementById('pane-'+p); if(!el) return;
  if(p==='proj') return renderProj(el);
  if(p==='bilans') return renderBilans(el);
  if(p==='siec') return renderSiec(el);
  if(p==='dobor') return renderDobor(el);
  if(p==='bom') return renderBOMPane(el);
  if(p==='zgod') return renderZgod(el);
  if(p==='v3d'&&window.render3DPane) return render3DPane(el);
  if(p==='ster'&&window.renderSter) return renderSter(el);
}

function renderProj(el){
  const f=F();
  el.innerHTML=`
  <h3>Dane projektu</h3>
  ${(window.CALC||{}).personsFromPlan?`<div class="field"><label>Liczba mieszkańców (z rzutu)</label><span><b>${CALC.occupants}</b> <button class="btn" id="pOccClear" style="padding:3px 8px;font-size:11px">usuń wszystkich</button></span></div>
  <p class="note">Mieszkańcy rozmieszczeni na rzucie (narzędzie „Mieszkaniec”) decydują o liczbie osób w bilansie i o rozdziale nawiewu między pokoje (pokój bez mieszkańca: waga 0,5). Przeciągnij postać do innego pomieszczenia, aby zmienić rozdział; w zakładce Sterowanie zobaczysz wpływ na CO₂.</p>`
  :`<div class="field"><label>Liczba mieszkańców</label><input type="number" id="pPersons" min="1" max="12" value="${state.persons}"></div>
  <div class="field"><label>Rozmieść mieszkańców na rzucie</label><button class="btn" id="pOccAuto">Rozmieść (${state.persons})</button></div>`}
  <div class="field"><label>System rozprowadzenia FLX</label><select id="pFlx"><option value="75" ${state.flxDia==75?'selected':''}>FLX Ø75 (do 30 m³/h/przewód)</option><option value="90" ${state.flxDia==90?'selected':''}>FLX Ø90 (do 45 m³/h/przewód)</option></select></div>
  <div class="field"><label>Czerpnio-wyrzutnia combi (CWS)</label><input type="checkbox" id="pCombi" ${state.combi?'checked':''}></div>
  <div class="field"><label>Okap kuchenny z własnym wyrzutem</label><input type="checkbox" id="pHood" ${state.kitchenHood?'checked':''}></div>
  <h4>Strefy wentylacji (nawiew)</h4>
  <div class="field"><label>Strefowanie: S1 pokoje / S2 salon</label><input type="checkbox" id="pZon" ${zoningOn()?'checked':''}></div>
  ${zoningOn()?`<div class="field"><label>Dzień: pokoje (S1) do [% nominału]</label><input type="number" id="pZday" min="0" max="100" step="5" value="${state.zoning.dayZ1??40}"></div>
  <div class="field"><label>Noc: salon (S2) do [% nominału]</label><input type="number" id="pZnight" min="0" max="100" step="5" value="${state.zoning.nightZ2??30}"></div>
  <p class="note">Suma nawiewu jest stała — przepustnice strefowe przerzucają strumień między strefami (dzień: więcej do salonu, noc: więcej do pokoi). Przewody wymiarowane na maksimum ze scenariuszy. Strefę pomieszczenia zmienisz w jego właściwościach (domyślnie: sypialnia/pokój → S1, salon → S2).</p>`:''}
  <div class="field"><label>Projektant</label><input type="text" id="pAuthor" value="${esc(state.author)}"></div>
  <h4>Kondygnacja: ${esc(f.name)}</h4>
  <div class="field"><label>Nazwa kondygnacji</label><input type="text" id="pFName" value="${esc(f.name)}"></div>
  <div class="field"><label>Wysokość pomieszczeń [m]</label><input type="number" id="pFH" step="0.05" value="${f.h}"></div>
  <div class="field"><label>Podkład (rzut)</label><button class="btn" id="pBgBtn">${f.bg?'Zamień…':'Wgraj obraz / PDF…'}</button></div>
  ${f.bg?`<div class="field"><label>Przezroczystość podkładu</label><input type="range" id="pBgA" min="0.1" max="1" step="0.05" value="${f.bgAlpha??0.65}"></div>`:''}
  <div class="field"><label>Skala</label><span style="font-size:12px">${f.pxPerM?f.pxPerM.toFixed(1)+' px/m':'<b style="color:var(--err)">nieskalibrowana</b>'} — <a href="#" id="pCalib">kalibruj</a></span></div>
  ${state.floors.length>1?`<button class="btn danger" id="pDelFloor">Usuń tę kondygnację</button>`:''}
  <p class="note">Przebieg pracy: 1) wgraj podkład, 2) skalibruj skalę na znanym wymiarze, 3) obrysuj pomieszczenia i nadaj im typy, 4) rozmieść centralę, rozdzielacze, anemostaty, czerpnię i wyrzutnię, 5) połącz przewodami, 6) sprawdź zakładki Bilans → Sieć → Centrala → Zestawienie → Zgodność, 7) generuj raport.</p>
  <p class="note">Piony między kondygnacjami: postaw węzeł „Pion” o tym samym numerze na obu kondygnacjach — program połączy je automatycznie (długość pionu ustawisz we właściwościach węzła).</p>
  <details class="src"><summary>Podstawy prawne i normowe</summary>
  Rozporządzenie MI w sprawie warunków technicznych… (t.j. Dz.U. 2022 poz. 1225, z późn. zm.) §147–155;
  PN-83/B-03430 + Az3:2000; PN-EN 12599 (odbiór); PN-87/B-02151/02 (hałas);
  „Warunki Techniczne Wykonania i Odbioru Instalacji Wentylacyjnych” COBRTI INSTAL, zeszyt 5 (2002).
  Dane produktowe: katalogi 21LAB (alnor.com.pl), w tym FLX-REKU i centrale HRU. Wartości oporów zaworów/puszek przyjęto ryczałtowo — zweryfikuj z kartami doboru 21LAB.</details>`;
  const pp=el.querySelector('#pPersons'); if(pp) bindNum(pp,state,'persons');
  const oa=el.querySelector('#pOccAuto'); if(oa) oa.addEventListener('click',()=>{ snapshot(); autoOccupants(); refreshAll(); });
  const oc=el.querySelector('#pOccClear'); if(oc) oc.addEventListener('click',()=>{ snapshot(); state.floors.forEach(f=>{ f.nodes=f.nodes.filter(n=>n.type!=='person'); }); refreshAll(); });
  el.querySelector('#pFlx').addEventListener('change',e=>{snapshot();state.flxDia=+e.target.value;refreshAll();});
  el.querySelector('#pCombi').addEventListener('change',e=>{state.combi=e.target.checked;refreshAll();});
  el.querySelector('#pHood').addEventListener('change',e=>{state.kitchenHood=e.target.checked;refreshAll();});
  el.querySelector('#pZon').addEventListener('change',e=>{snapshot(); state.zoning=state.zoning||{dayZ1:40,nightZ2:30}; state.zoning.on=e.target.checked; refreshAll();});
  const zd=el.querySelector('#pZday'); if(zd) zd.addEventListener('change',e=>{snapshot(); state.zoning.dayZ1=Math.max(0,Math.min(100,+e.target.value||0)); refreshAll();});
  const zn=el.querySelector('#pZnight'); if(zn) zn.addEventListener('change',e=>{snapshot(); state.zoning.nightZ2=Math.max(0,Math.min(100,+e.target.value||0)); refreshAll();});
  el.querySelector('#pAuthor').addEventListener('change',e=>{state.author=e.target.value;});
  el.querySelector('#pFName').addEventListener('change',e=>{snapshot();f.name=e.target.value;refreshAll();});
  bindNum(el.querySelector('#pFH'),f,'h');
  el.querySelector('#pBgBtn').addEventListener('click',()=>document.getElementById('fileBg').click());
  el.querySelector('#pCalib').addEventListener('click',e=>{e.preventDefault();setTool('calib');});
  const a=el.querySelector('#pBgA'); if(a) a.addEventListener('input',e=>{f.bgAlpha=+e.target.value;draw();});
  const df=el.querySelector('#pDelFloor'); if(df) df.addEventListener('click',()=>{ if(confirm('Usunąć kondygnację wraz z zawartością?')){snapshot();state.floors.splice(state.activeFloor,1);state.activeFloor=0;refreshAll();} });
}

function renderBilans(el){
  const C=window.CALC,B=C.balance||{};
  const rows=Object.values(C.rooms||{}).map(r=>`<tr data-room="${r.id}">
    <td>${esc(r.floor)}</td><td>${esc(r.name)}<br><span style="color:var(--muted);font-size:10.5px">${esc(ROOM_TYPES[r.type]?.label||'')}</span></td>
    <td class="num">${fmt(r.area,1)}</td>
    <td class="num">${r.sup?`<span class="pill sup">${fmt(r.sup)}</span>`:''}${r.sup&&r.zone&&(C.zoning||{}).on?`<br><span style="font-size:9.5px;color:${ZONES[r.zone].c}">${ZONES[r.zone].short} · D ${fmt(r.supDay)} / N ${fmt(r.supNight)}</span>`:''}</td>
    <td class="num">${r.exh?`<span class="pill exh">${fmt(r.exh)}</span>`:''}${r.exhBase&&r.exh>r.exhBase?`<br><span style="font-size:9.5px;color:var(--muted)">min. ${r.exhBase}</span>`:''}</td>
  </tr>`).join('');
  const Zc=C.zoning||{on:false};
  const zoneTbl= Zc.on ? `<h4>Strefy nawiewu — scenariusze</h4>
  <table class="dt"><tr><th>Strefa</th><th class="num">Pom.</th><th class="num">Nominal</th><th class="num">Dzień</th><th class="num">Noc</th></tr>
  ${[1,2].map(k=>`<tr><td><span class="pill" style="background:${ZONES[k].c}22;color:${ZONES[k].c}">${ZONES[k].short}</span> ${esc(ZONES[k].label.split(' — ')[1])}</td><td class="num">${Zc.z[k].rooms}</td><td class="num">${fmt(Zc.z[k].nom)}</td><td class="num">${fmt(Zc.z[k].day)}</td><td class="num">${fmt(Zc.z[k].night)}</td></tr>`).join('')}
  <tr class="sum"><td colspan="2">RAZEM nawiew strefowany</td><td class="num">${fmt(Zc.z[1].nom+Zc.z[2].nom)}</td><td class="num">${fmt(Zc.z[1].day+Zc.z[2].day)}</td><td class="num">${fmt(Zc.z[1].night+Zc.z[2].night)}</td></tr></table>
  <p class="note">Dzień: pokoje (S1) zredukowane do ${state.zoning.dayZ1??40}% nominału, nadwyżka do salonu. Noc: salon (S2) do ${state.zoning.nightZ2??30}%, nadwyżka do pokoi. Ustawienia w zakładce Projekt.</p>` : '';
  el.innerHTML=`<h3>Bilans powietrza</h3>
  <div class="kpi"><b>${fmt(B.V)} m³/h</b><span>strumień projektowy</span></div>
  <div class="kpi"><b>${fmt(B.minOs)} m³/h</b><span>min. dla ${B.persons} osób${C.personsFromPlan?' (z rzutu)':''} (§149 WT)</span></div>
  <div class="kpi"><b>${fmt(B.sumExhBase)} m³/h</b><span>suma minimów normowych</span></div>
  <div class="kpi"><b>${fmt(B.night)} m³/h</b><span>tryb nocny (60%)</span></div>
  <table class="dt"><tr><th>Kond.</th><th>Pomieszczenie</th><th class="num">m²</th><th class="num">Nawiew</th><th class="num">Wywiew</th></tr>${rows}
  <tr class="sum"><td colspan="3">RAZEM</td><td class="num">${fmt(B.sumSup)}</td><td class="num">${fmt(B.V)}</td></tr></table>
  ${zoneTbl}
  <p class="note">Wywiewy wg PN-83/B-03430 (minima); przy bilansie > sumy minimów wywiewy zwiększane proporcjonalnie. Nawiew rozdzielony na pokoje wg liczby osób (edytuj we właściwościach pomieszczenia). Kliknij wiersz aby zaznaczyć pomieszczenie.</p>
  ${(C.warn||[]).map(w=>`<div class="chk warn"><span class="st">⚠</span><div>${esc(w)}</div></div>`).join('')}`;
  el.querySelectorAll('tr[data-room]').forEach(tr=>tr.addEventListener('click',()=>{
    const id=tr.dataset.room;
    state.floors.forEach((f,i)=>{ if(f.rooms.some(r=>r.id===id)){ state.activeFloor=i; } });
    sel={kind:'room',id}; renderFloorbar(); renderProps(); draw();
  }));
}

function renderSiec(el){
  const C=window.CALC;
  let rows='';
  state.floors.forEach(f=>f.segs.forEach(s=>{
    const r=C.segs[s.id]; if(!r) return;
    const vBad=(s.kind==='flx'&&r.v>NORMS.vMax.flx)||(s.kind==='duct'&&r.v>NORMS.vMax.main);
    rows+=`<tr data-seg="${s.id}"><td>${esc(f.name)}</td><td>${s.kind==='flx'?'FLX':'spiro'} <span class="pill ${r.side==='sup'?'sup':r.side==='exh'?'exh':'ok'}">${r.side==='fresh'?'czerpny':r.side==='out'?'wyrzut':r.side==='sup'?'nawiew':r.side==='exh'?'wywiew':'?'}</span></td>
    <td class="num">${fmt(r.len,1)}</td><td class="num">${fmt(r.q)}${(C.zoning||{}).on&&r.qSize>r.q?`<br><span style="font-size:9.5px;color:var(--muted)">maks ${fmt(r.qSize)}</span>`:''}</td><td>${r.dim||''}</td>
    <td class="num" style="${vBad?'color:var(--err);font-weight:700':''}">${fmt(r.v,1)}</td><td class="num">${fmt(r.dp,1)}</td></tr>`;
  }));
  const P=C.press||{};
  el.innerHTML=`<h3>Sieć przewodów</h3>
  ${C.hasAhu?'':'<div class="chk err"><span class="st">✗</span><div>Brak centrali na rysunku — przepływy w sieci nie są liczone.</div></div>'}
  <div class="kpi"><b>${fmt(P.sup)} Pa</b><span>spręż wymagany — nawiew</span></div>
  <div class="kpi"><b>${fmt(P.exh)} Pa</b><span>spręż wymagany — wywiew</span></div>
  <table class="dt"><tr><th>Kond.</th><th>Odcinek</th><th class="num">L [m]</th><th class="num">V̇ [m³/h]</th><th>Wymiar</th><th class="num">v [m/s]</th><th class="num">Δp [Pa]</th></tr>${rows||'<tr><td colspan="7">Brak przewodów — narysuj kanały i przewody FLX.</td></tr>'}</table>
  <p class="note">Δp: straty liniowe (spiro — wzór Altszula, k=0,15 mm; FLX — charakterystyki katalogowe) + kolana z geometrii trasy. Ryczałty w sprężu: puszka+zawór 20 Pa, rozdzielacz 10 Pa, tłumiki 2×15 Pa, czerpnia/wyrzutnia ζ=2,5. Odcinki pionowe: dodaj „długość dodatkową” we właściwościach odcinka lub użyj węzłów Pion.</p>
  <p class="note">Kliknij wiersz aby zaznaczyć odcinek. Średnicę spiro można nadpisać we właściwościach.</p>`;
  el.querySelectorAll('tr[data-seg]').forEach(tr=>tr.addEventListener('click',()=>{
    const id=tr.dataset.seg;
    state.floors.forEach((f,i)=>{ if(f.segs.some(s=>s.id===id)) state.activeFloor=i; });
    sel={kind:'seg',id}; renderFloorbar(); renderProps(); draw();
  }));
}

function renderDobor(el){
  const C=window.CALC,B=C.balance||{},P=C.press||{};
  const rows=(C.units||[]).map(u=>`<tr style="${C.unit&&u.model===C.unit.model?'background:#E8F9F0':''}">
    <td>${u.model}${C.unit&&u.model===C.unit.model?' <span class="pill ok">dobrana</span>':''}</td>
    <td class="num">${u.v100}</td><td class="num">${u.eta}%</td><td class="num">Ø${u.duct}</td>
    <td><span class="pill ${u.st==='OK'?'ok':u.st==='za mała'?'err':'warn'}">${u.st}</span></td></tr>`).join('');
  el.innerHTML=`<h3>Dobór centrali (rekuperatora)</h3>
  <div class="kpi"><b>${fmt(B.V)} m³/h</b><span>strumień projektowy</span></div>
  <div class="kpi"><b>${fmt(P.max)} Pa</b><span>wymagany spręż zewn.</span></div>
  <table class="dt"><tr><th>Model 21LAB</th><th class="num">V̇ @100 Pa</th><th class="num">Odzysk</th><th class="num">Króćce</th><th>Ocena</th></tr>${rows}</table>
  <p class="note">Kryterium: strumień projektowy ≤ 90% wydajności przy 100 Pa oraz wymagany spręż ≤ 100 Pa (100–150 Pa — sprawdź punkt pracy na charakterystyce z karty 21LAB). Sprawność odzysku wg EN 13141-7 — wszystkie modele spełniają §151 WT (≥ 50%).</p>
  ${C.unit?`<div class="chk ok"><span class="st">✓</span><div><b>${C.unit.model}</b> — ${C.unit.note}. Zapas wydajności: ${fmt(100*(1-B.V/C.unit.v100))}%. ${C.unit.noise!=='—'?'Hałas: '+C.unit.noise+'. ':''}${C.unit.power!=='—'?'Pobór mocy: '+C.unit.power+'.':''}</div></div>`:'<div class="chk err"><span class="st">✗</span><div>Żadna centrala z typoszeregu nie spełnia kryteriów — zmniejsz opory (większe średnice, krótsze trasy) lub podziel instalację.</div></div>'}
  <p class="note">Kuchnia — wywiew intensywny 120 m³/h: realizowany trybem „boost” centrali (chwilowo cała wydajność do kuchni) lub okapem z niezależnym wyrzutem. Maks. moc właściwa wentylatorów (SFP) wg §154 ust. 10 WT.</p>`;
}

function renderBOMPane(el){
  const C=window.CALC;
  const rows=(C.bom||[]).map(b=>`<tr><td>${esc(b.code)}</td><td>${esc(b.name)}${b.note?`<br><span style="color:var(--muted);font-size:10px">${esc(b.note)}</span>`:''}</td><td class="num">${fmt(b.qty)}</td><td>${b.unit}</td></tr>`).join('');
  el.innerHTML=`<h3>Zestawienie materiałów (21LAB)</h3>
  <table class="dt"><tr><th>Kod</th><th>Nazwa</th><th class="num">Ilość</th><th>j.m.</th></tr>${rows||'<tr><td colspan="4">Zestawienie powstanie po narysowaniu instalacji.</td></tr>'}</table>
  <button class="btn" id="bomCsv">Kopiuj CSV</button>
  <p class="note">Kody wg konwencji katalogowej 21LAB (sufiks L = uszczelka EPDM, klasa szczelności D wg PN-EN 12237). Konfiguracje rozdzielaczy i puszek EPP potwierdź w katalogu FLX-REKU. Zestawienie nie obejmuje automatyki, sterowników ściennych i nagrzewnic wstępnych (opcje centrali).</p>`;
  el.querySelector('#bomCsv')?.addEventListener('click',()=>{
    const csv='Kod;Nazwa;Ilość;j.m.;Uwagi\n'+(C.bom||[]).map(b=>[b.code,b.name,b.qty,b.unit,b.note].join(';')).join('\n');
    navigator.clipboard.writeText(csv).then(()=>toast('Skopiowano CSV do schowka.'));
  });
}

function renderZgod(el){
  const C=window.CALC;
  el.innerHTML=`<h3>Zgodność z przepisami</h3>
  ${(C.checks||[]).map(c=>`<div class="chk ${c.st}"><span class="st">${c.st==='ok'?'✓':c.st==='err'?'✗':'⚠'}</span><div>${c.txt}<span class="ref">${esc(c.ref)}</span></div></div>`).join('')}
  <h4>Warunki wykonania i odbioru (WTWiO COBRTI INSTAL z. 5 / PN-EN 12599)</h4>
  <div class="chk warn"><span class="st">☐</span><div>Szczelność przewodów: klasa min. A (zalecana B); system FLX-REKU i spiro „L”: klasa D. Próba szczelności z protokołem.<span class="ref">PN-EN 12237, PN-EN 1507; WTWiO z. 5</span></div></div>
  <div class="chk warn"><span class="st">☐</span><div>Regulacja instalacji: pomiar strumieni na każdym zaworze; odchyłki ≤ ±20% (pomieszczenie) i ≤ ±15% (instalacja).<span class="ref">PN-EN 12599</span></div></div>
  <div class="chk warn"><span class="st">☐</span><div>Pomiar hałasu: pokoje ≤ 35/25 dB(A) dzień/noc, kuchnia i pom. sanitarne ≤ 40 dB(A).<span class="ref">PN-87/B-02151/02 (PN-B-02151-2:2018)</span></div></div>
  <div class="chk warn"><span class="st">☐</span><div>72-godzinny ruch próbny; dokumentacja powykonawcza, protokoły pomiarów, DTR central, deklaracje właściwości użytkowych wyrobów.<span class="ref">WTWiO COBRTI INSTAL z. 5</span></div></div>
  <div class="chk warn"><span class="st">☐</span><div>Otwory rewizyjne umożliwiające czyszczenie przewodów i urządzeń; dostęp serwisowy do filtrów centrali.<span class="ref">WT §153 ust. 6</span></div></div>`;
}

/* ---------- właściwości zaznaczenia ---------- */
function renderProps(){
  const box=document.getElementById('props');
  if(!sel){ box.style.display='none'; box.innerHTML=''; return; }
  const f=F(); box.style.display='block';
  if(sel.kind==='room'){
    const r=f.rooms.find(x=>x.id===sel.id); if(!r){box.style.display='none';return;}
    const t=ROOM_TYPES[r.type]||{};
    box.innerHTML=`<h3>Pomieszczenie</h3>
    <div class="field"><label>Nazwa</label><input type="text" id="prName" value="${esc(r.name)}" placeholder="${esc(roomName(r))}"></div>
    <div class="field"><label>Typ</label><select id="prType">${Object.entries(ROOM_TYPES).map(([k,v])=>`<option value="${k}" ${k===r.type?'selected':''}>${v.label}</option>`).join('')}</select></div>
    ${(t.role==='sup'||t.role==='both')?((window.CALC||{}).personsFromPlan?`<div class="field"><label>Mieszkańcy w pomieszczeniu (z rzutu)</label><b>${(CALC.occByRoom||{})[r.id]||0}</b></div>`:`<div class="field"><label>Liczba osób (waga nawiewu)</label><input type="number" id="prOs" min="0" step="1" value="${r.osoby??t.osoby??1}"></div>`):''}
    ${(t.role==='exh'||t.role==='both')?`<div class="field"><label>Wywiew — nadpisz [m³/h]</label><input type="number" id="prFlow" placeholder="auto" value="${r.flowOverride??''}"></div>`:''}
    <div class="field"><label>Powierzchnia [m²] (z rzutu)</label><input type="number" id="prA" step="0.01" placeholder="${fmt((window.CALC.rooms[r.id]||{}).area,2)}" value="${r.areaOverride??''}"></div>
    <div class="field"><label>Wysokość [m] (nadpisz)</label><input type="number" id="prH" step="0.05" placeholder="${f.h}" value="${r.hOverride??''}"></div>
    ${(t.role==='sup'||t.role==='both')&&zoningOn()?`<div class="field"><label>Strefa nawiewu</label><select id="prZone"><option value="auto" ${r.zone==null?'selected':''}>auto (${ZONES[ZONE_DEFAULT[r.type]||1].short})</option><option value="1" ${r.zone===1?'selected':''}>${ZONES[1].label}</option><option value="2" ${r.zone===2?'selected':''}>${ZONES[2].label}</option><option value="0" ${r.zone===0?'selected':''}>bez strefy (stały strumień)</option></select></div>`:''}
    ${t.warn?`<p class="note" style="color:var(--err)">${t.warn}</p>`:''}`;
    const pz=box.querySelector('#prZone'); if(pz) pz.addEventListener('change',e=>{snapshot(); r.zone=e.target.value==='auto'?null:+e.target.value; refreshAll();});
    box.querySelector('#prName').addEventListener('change',e=>{snapshot();r.name=e.target.value;refreshAll();});
    box.querySelector('#prType').addEventListener('change',e=>{snapshot();r.type=e.target.value;refreshAll();});
    const os=box.querySelector('#prOs'); if(os) os.addEventListener('change',e=>{snapshot();r.osoby=e.target.value===''?null:+e.target.value;refreshAll();});
    const fl=box.querySelector('#prFlow'); if(fl) fl.addEventListener('change',e=>{snapshot();r.flowOverride=e.target.value===''?null:+e.target.value;refreshAll();});
    const pa=box.querySelector('#prA'); if(pa) pa.addEventListener('change',e=>{snapshot();r.areaOverride=e.target.value===''?null:+e.target.value;refreshAll();});
    const hh=box.querySelector('#prH'); if(hh) hh.addEventListener('change',e=>{snapshot();r.hOverride=e.target.value===''?null:+e.target.value;refreshAll();});
  }
  if(sel.kind==='node'){
    const n=f.nodes.find(x=>x.id===sel.id); if(!n){box.style.display='none';return;}
    const d=NODE_DEFS[n.type];
    box.innerHTML=`<h3>${d.label}</h3>
    ${n.type==='riser'?`<div class="field"><label>Numer pionu</label><input type="number" id="pnNum" min="1" value="${n.num||1}"></div>
    <div class="field"><label>Długość pionu [m]</label><input type="number" id="pnLen" step="0.1" value="${n.extraLen??3}"></div>
    <p class="note">Piony o tym samym numerze na różnych kondygnacjach są traktowane jako jeden punkt sieci.</p>`:''}
    ${(n.type==='term_sup'||n.type==='term_exh')?`<p class="note">Przepływ: <b>${fmt((window.CALC.nodes[n.id]||{}).q)} m³/h</b>. Puszka rozprężna EPP + zawór ${n.type==='term_sup'?'KN':'KW'}-125.</p>`:''}
    ${(n.type==='intake')?'<p class="note">§152 WT: dolna krawędź ≥ 2 m nad terenem; ≥ 8 m od parkingów >20 stanowisk i miejsc odpadów; zachowaj rozdział od wyrzutni.</p>':''}
    <p class="note">Przeciągnij węzeł narzędziem „Wybierz”, aby zmienić położenie.</p>`;
    const nn=box.querySelector('#pnNum'); if(nn) nn.addEventListener('change',e=>{snapshot();n.num=+e.target.value;refreshAll();});
    const nl=box.querySelector('#pnLen'); if(nl) nl.addEventListener('change',e=>{snapshot();n.extraLen=+e.target.value;refreshAll();});
  }
  if(sel.kind==='seg'){
    const s=f.segs.find(x=>x.id===sel.id); if(!s){box.style.display='none';return;}
    const r=window.CALC.segs[s.id]||{};
    box.innerHTML=`<h3>${s.kind==='flx'?'Przewód FLX':'Kanał spiro'} — ${fmt(r.len,1)} m, ${fmt(r.q)} m³/h</h3>
    <div class="field"><label>Długość dodatkowa [m] (piony, załamania 3D)</label><input type="number" id="psExtra" step="0.1" value="${s.extraLen||0}"></div>
    ${s.kind==='duct'?`<div class="field"><label>Średnica</label><select id="psD"><option value="">auto (Ø${r.d||'—'})</option>${SPIRO_D.map(d=>`<option value="${d}" ${s.dOverride===d?'selected':''}>Ø${d}</option>`).join('')}</select></div>
    <div class="field"><label>Przez przestrzeń nieogrzewaną (izolacja)</label><input type="checkbox" id="psIns" ${s.insulated?'checked':''}></div>`:''}
    <p class="note">v = ${fmt(r.v,2)} m/s, Δp = ${fmt(r.dp,1)} Pa${s.kind==='flx'?`, przewody równoległe: ${r.tubes||1}`:''}, kolana: ${r.bends90||0}×90° ${r.bends45||0}×45°</p>`;
    box.querySelector('#psExtra').addEventListener('change',e=>{snapshot();s.extraLen=+e.target.value||0;refreshAll();});
    const pd=box.querySelector('#psD'); if(pd) pd.addEventListener('change',e=>{snapshot();s.dOverride=e.target.value?+e.target.value:null;refreshAll();});
    const pi=box.querySelector('#psIns'); if(pi) pi.addEventListener('change',e=>{snapshot();s.insulated=e.target.checked;refreshAll();});
  }
}
/* ============================ AUTOMATYKA v3 ============================
   Rozpoznawanie pomieszczeń z rzutu architektonicznego.

   Założenia wynikające z analizy realnych rzutów (PB 1:100):
   - ściany bywają rysowane DWIEMA cienkimi liniami z kreskowaniem → nie wolno
     filtrować „po grubości kreski”, bo ściana znika i pomieszczenie wycieka
   - otwory okienne/drzwiowe są ZAMKNIĘTE cienkimi liniami (ościeżnice, skrzydła)
     → surowa maska tuszu jest najlepszą przegrodą
   - łańcuchy wymiarowe, osie, tabela rysunkowa leżą POZA bryłą → obcinamy do
     obwiedni budynku wyznaczonej jako największa spójna „bryła” rysunku
   - osie kreskowo-punktowe przechodzą przez pomieszczenia, ale mają przerwy →
     nie stosujemy domknięcia morfologicznego domyślnie (przerwy zachowują spójność)
   - wszystkie progi w METRACH (wymagana skala), nie w pikselach
   - opisy to często numery „1/5” + tabela „Zestawienie pomieszczeń” → OCR czyta
     tabelę i mapuje numer → nazwa + powierzchnia
   ==================================================================== */

const OCR_TYPES=[
  ['ANEKS','salon_aneks'],['KUCHN','kuchnia_el'],
  ['AZIENK','lazienka'],['LAZIENK','lazienka'],['KAPIEL','lazienka'],['UPIEL','lazienka'],
  ['TOALET','wc'],['WC','wc'],
  ['SYPIALN','sypialnia'],['YPIALN','sypialnia'],
  ['SALON','salon'],['DZIENN','salon'],['JADALN','salon'],['WYPOCZ','salon'],
  ['GABINET','pokoj'],['BIURO','pokoj'],['POKOJ','pokoj'],['POK.','pokoj'],['POK ','pokoj'],['ANTRESOL','pokoj'],
  ['GARDER','garderoba'],['SPIZ','garderoba'],['SCHOWEK','garderoba'],['SZAFA','garderoba'],
  ['PRALN','pralnia'],['SUSZARN','pralnia'],
  ['KOTLOWN','kotlownia'],['KOTL','kotlownia'],['TECHNICZN','kotlownia'],['POM. TECH','kotlownia'],['TECHN','kotlownia'],
  ['GARAZ','garaz'],
  ['WIATROLAP','komunikacja'],['WIATRO','komunikacja'],['PRZEDPOK','komunikacja'],
  ['KORYTARZ','komunikacja'],['KOMUNIK','komunikacja'],['HOL','komunikacja'],
  ['SIEN','komunikacja'],['SCHODY','komunikacja'],['KLATKA','komunikacja'],['HALL','komunikacja'],
  ['TARAS','komunikacja'],['GANEK','komunikacja']
];
function deaccent(s){ return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/ł/g,'l').replace(/Ł/g,'L').toUpperCase(); }
function typeFromLabel(txt){
  const t=deaccent(txt);
  for(const [k,v] of OCR_TYPES){ if(t.includes(k)) return v; }
  return null;
}
function typeFromArea(m2){
  if(m2==null) return 'pokoj';
  if(m2<2.2) return 'garderoba';
  if(m2<3.2) return 'wc';
  if(m2<6.5) return 'lazienka';
  if(m2>22)  return 'salon';
  return 'pokoj';
}
function areaFromText(txt){
  const t=deaccent(txt).replace(/\s+/g,' ');
  let m=t.match(/(\d{1,3}[.,]\d{1,2})\s*M\s*(2|²)?/);
  if(m){ const a=parseFloat(m[1].replace(',','.')); if(a>=1&&a<=200) return a; }
  m=t.match(/(\d{1,2}[.,]\d{1,2})\s*[X×]\s*(\d{1,2}[.,]\d{1,2})/);
  if(m){ const a=parseFloat(m[1].replace(',','.')), b=parseFloat(m[2].replace(',','.'));
    if(a>=1&&a<=18&&b>=1&&b<=18) return a*b; }
  return null;
}
/* tabela „Zestawienie pomieszczeń”: wiersze typu  1/5  Salon  38,65  39,45 */
function parseRoomSchedule(lines){
  const map={};
  for(const L of lines){
    const t=L.text.replace(/\s+/g,' ').trim();
    const m=t.match(/^(\d{1,2}\s*[\/.]\s*\d{1,2})\s+([A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż .+-]{3,30}?)\s+(\d{1,3}[.,]\d{1,2})/);
    if(m){
      const key=m[1].replace(/\s/g,'').replace('.','/');
      map[key]={name:m[2].trim(), area:parseFloat(m[3].replace(',','.'))};
    }
  }
  return map;
}
const RE_ROOMNO=/^(\d{1,2})\s*[\/]\s*(\d{1,2})$/;

/* ================= morfologia oparta na transformacie odległości =================
   dilate/erode/close/open w czasie O(N) niezależnie od promienia (chamfer 3-4) */
function chamferDist(mask,W,H,want){          // odległość do najbliższego piksela mask===want
  const INF=1e9, d=new Float32Array(W*H);
  for(let i=0;i<W*H;i++) d[i]= (mask[i]?1:0)===want ? 0 : INF;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){ const i=y*W+x; let v=d[i];
    if(y>0){ if(d[i-W]+3<v)v=d[i-W]+3; if(x>0&&d[i-W-1]+4<v)v=d[i-W-1]+4; if(x<W-1&&d[i-W+1]+4<v)v=d[i-W+1]+4; }
    if(x>0&&d[i-1]+3<v)v=d[i-1]+3; d[i]=v; }
  for(let y=H-1;y>=0;y--)for(let x=W-1;x>=0;x--){ const i=y*W+x; let v=d[i];
    if(y<H-1){ if(d[i+W]+3<v)v=d[i+W]+3; if(x<W-1&&d[i+W+1]+4<v)v=d[i+W+1]+4; if(x>0&&d[i+W-1]+4<v)v=d[i+W-1]+4; }
    if(x<W-1&&d[i+1]+3<v)v=d[i+1]+3; d[i]=v; }
  for(let i=0;i<W*H;i++) d[i]/=3;
  return d;
}
function mDilate(m,W,H,r){ if(r<=0) return m; const d=chamferDist(m,W,H,1), o=new Uint8Array(W*H);
  for(let i=0;i<W*H;i++) o[i]= d[i]<=r ?1:0; return o; }
function mErode(m,W,H,r){ if(r<=0) return m; const d=chamferDist(m,W,H,0), o=new Uint8Array(W*H);
  for(let i=0;i<W*H;i++) o[i]= d[i]>r ?1:0; return o; }
function mClose(m,W,H,r){ return r>0? mErode(mDilate(m,W,H,r),W,H,r) : m; }

/* ================= dialog parametrów ================= */
function autoDetectDialog(){
  const f=F();
  if(!f.bg){ alert('Najpierw wgraj rzut — przeciągnij plik na obszar roboczy.'); return; }
  if(!f.pxPerM){
    if(confirm('Rozpoznawanie wymaga znanej skali rzutu (wszystkie progi liczone są w metrach).\n\nPrzejść teraz do kalibracji? Kliknij dwa punkty o znanej odległości (np. całkowitą szerokość budynku z łańcucha wymiarowego).')) setTool('calib');
    return;
  }
  let dlg=document.getElementById('dlgDetect');
  if(dlg) dlg.remove();
  dlg=document.createElement('dialog'); dlg.id='dlgDetect';
  dlg.innerHTML=`<h3>Rozpoznawanie pomieszczeń</h3>
  <div class="field"><label>Czułość (próg jasności kreski)</label><input type="range" id="ddT" min="80" max="235" value="${f.detT||190}" style="width:130px"><span id="ddTv" style="font-size:11.5px;width:26px;display:inline-block">${f.detT||190}</span></div>
  <div class="field"><label>Maks. grubość ściany [m]</label><input type="number" id="ddWM" min="0.1" max="0.7" step="0.05" value="0.3" style="width:70px"></div>
  <div class="field"><label>Domknij otwory bez skrzydeł [m]</label><input type="number" id="ddG" min="0" max="1.5" step="0.05" value="0" style="width:70px"></div>
  <div class="field"><label>Min. powierzchnia pomieszczenia [m²]</label><input type="number" id="ddA" min="0.5" step="0.5" value="1.5" style="width:70px"></div>
  <div class="field"><label>Min. szerokość w świetle [m]</label><input type="number" id="ddI" min="0.3" step="0.1" value="0.6" style="width:70px"></div>
  <div class="field"><label>Tylko obszary ograniczone ścianami</label><input type="checkbox" id="ddWB"></div>
  <div class="field"><label>Prostuj obrysy do figur prostokątnych</label><input type="checkbox" id="ddR" checked></div>
  <div class="field"><label>Czytaj opisy i zestawienie pomieszczeń (OCR)</label><input type="checkbox" id="ddO" checked></div>
  <div class="field"><label>Usuń istniejące obrysy</label><input type="checkbox" id="ddC" checked></div>
  <p class="note"><b>Kolejność pracy:</b> 1) kalibracja skali, 2) narzędzie <b>„Obszar analizy”</b> — dwoma kliknięciami obejmij sam budynek (bez łańcuchów wymiarowych, osi i tabeli rysunkowej), 3) „Rozpoznaj”. Bez wskazanego obszaru program próbuje wyznaczyć go sam, ale na rysunkach z gęstą wymiarówką bywa to zawodne.</p>
  <p class="note">Przegrodą są <b>wszystkie kreski rysunku</b> — ościeżnice i skrzydła drzwi zamykają otwory, więc ściany kreskowane (dwie cienkie linie) też działają poprawnie. Łańcuchy wymiarowe, osie i tabela rysunkowa są odrzucane przez automatyczne obcięcie do obwiedni budynku. „Domknij otwory” użyj tylko wtedy, gdy na rzucie są otwory bez skrzydeł (przejścia bez drzwi) i pomieszczenia się zlewają.</p>
  <p class="note">Gdy rzut jest nietypowy — użyj narzędzia <b>„Klik: pomieszczenie”</b> i klikaj wnętrza pomieszczeń pojedynczo. Podgląd „Maska ścian” pokazuje, co program widzi jako przegrodę.</p>
  <div style="text-align:right;margin-top:10px">
    <button class="btn" id="ddPrev">Podgląd maski</button>
    <button class="btn" id="ddCancel">Anuluj</button>
    <button class="btn acc" id="ddRun">Rozpoznaj</button></div>`;
  document.body.appendChild(dlg);
  const rd=()=>({ thresh:+dlg.querySelector('#ddT').value, gapM:+dlg.querySelector('#ddG').value,
    minArea:+dlg.querySelector('#ddA').value, minInr:+dlg.querySelector('#ddI').value,
    rect:dlg.querySelector('#ddR').checked, ocr:dlg.querySelector('#ddO').checked, clear:dlg.querySelector('#ddC').checked,
    wallBounded:dlg.querySelector('#ddWB').checked, wallM:+dlg.querySelector('#ddWM').value });
  dlg.querySelector('#ddT').addEventListener('input',e=>{ dlg.querySelector('#ddTv').textContent=e.target.value; });
  dlg.querySelector('#ddCancel').addEventListener('click',()=>dlg.close());
  dlg.querySelector('#ddPrev').addEventListener('click',async()=>{ const o=rd(); F().detT=o.thresh; await showMaskPreview(o); });
  dlg.querySelector('#ddRun').addEventListener('click',async()=>{ const o=rd(); F().detT=o.thresh; dlg.close(); await detectRooms(o); });
  dlg.showModal();
}

/* ================= budowa maski i regionów (z cache) ================= */
const maskCache={};
function loadBgImage(f){
  return new Promise((res,rej)=>{ const im=new Image(); im.onload=()=>res(im); im.onerror=()=>rej(new Error('nie można odczytać podkładu')); im.src=f.bg; });
}
async function buildMask(opt){
  const f=F();
  const key=f.id+'|'+(f.bg?f.bg.length:0)+'|'+opt.thresh+'|'+opt.gapM+'|'+(opt.wallM||0.30)+'|'+f.pxPerM;
  if(maskCache.key===key) return maskCache.val;
  const im=await loadBgImage(f);
  f.bgW=im.naturalWidth; f.bgH=im.naturalHeight;
  const MAXPIX=4.2e6;
  const k=Math.min(1,Math.sqrt(MAXPIX/(im.naturalWidth*im.naturalHeight)));
  const W=Math.max(2,Math.round(im.naturalWidth*k)), H=Math.max(2,Math.round(im.naturalHeight*k));
  const oc=document.createElement('canvas'); oc.width=W; oc.height=H;
  const octx=oc.getContext('2d',{willReadFrequently:true});
  octx.fillStyle='#fff'; octx.fillRect(0,0,W,H); octx.drawImage(im,0,0,W,H);
  const px=octx.getImageData(0,0,W,H).data, N=W*H;
  const ppm=f.pxPerM*k;                       // px na metr w obrazie roboczym
  // 1) tusz
  let ink=new Uint8Array(N);
  for(let i=0;i<N;i++){ const g=px[i*4]*0.3+px[i*4+1]*0.59+px[i*4+2]*0.11;
    if((g<opt.thresh&&px[i*4+3]>60)||px[i*4+3]<40) ink[i]=1; }
  // 2) opcjonalne domknięcie otworów bez skrzydeł
  if(opt.gapM>0) ink=mClose(ink,W,H,Math.max(1,opt.gapM*ppm/2));
  // 4) ŚCIANY: domknięcie 0,15 m scala ściany rysowane dwiema liniami (także kreskowane),
  //    otwarcie 0,06 m usuwa cienkie kreski (wymiarówki, tabela rysunkowa, meble, osie, teksty).
  // domknięcie o połowę maks. grubości ściany scala ściany rysowane dwiema liniami
  // (także kreskowane / z wypełnieniem), otwarcie usuwa cienkie kreski rysunku
  const rClose=Math.max(1,0.5*(opt.wallM||0.30)*ppm), rOpen=Math.max(1,0.03*ppm);
  const thick=mDilate(mErode(mClose(ink,W,H,rClose),W,H,rOpen),W,H,rOpen);
  const thickNear=mDilate(thick,W,H,Math.max(2,0.12*ppm));
  // 4b) PRZEGRODA = ściany + tylko te kreski, które ich DOTYKAJĄ:
  //     ościeżnice, skrzydła i łuki drzwi, linie okien (zamykają otwory),
  //     natomiast wolnostojące meble, schody, opisy i osie NIE dzielą pomieszczeń.
  const band=mDilate(thick,W,H,Math.max(1,0.05*ppm));
  const part=new Uint8Array(N), seenI=new Uint8Array(N);
  for(let s0=0;s0<N;s0++){
    if(!ink[s0]||seenI[s0]) continue;
    const st=[s0]; seenI[s0]=1; const cc=[s0]; let hit=!!band[s0];
    while(st.length){ const i=st.pop(), x=i%W, y=(i/W)|0;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        const nx=x+dx, ny=y+dy; if(nx<0||ny<0||nx>=W||ny>=H) continue;
        const j=ny*W+nx; if(ink[j]&&!seenI[j]){ seenI[j]=1; if(band[j])hit=true; cc.push(j); st.push(j); } } }
    if(hit) for(const j of cc) part[j]=1;
  }
  // 4c) obszar zewnętrzny (poza rysunkiem)
  const outside=new Uint8Array(N); const Q=[];
  const push=i=>{ if(!part[i]&&!outside[i]){ outside[i]=1; Q.push(i); } };
  for(let x=0;x<W;x++){ push(x); push((H-1)*W+x); }
  for(let y=0;y<H;y++){ push(y*W); push(y*W+W-1); }
  while(Q.length){ const i=Q.pop(), x=i%W, y=(i/W)|0;
    if(x>0)push(i-1); if(x<W-1)push(i+1); if(y>0)push(i-W); if(y<H-1)push(i+W); }
  const dFree=chamferDist(part,W,H,1);   // odległość do najbliższej kreski (promień wpisany)
  const val={W,H,k,ppm,ink:part,inkRaw:ink,outside,thick,thickNear,dFree,canvas:oc};
  maskCache.key=key; maskCache.val=val;
  return val;
}
/* etykietowanie wszystkich zamkniętych regionów rysunku */
function labelRegions(M){
  const {W,H,ink,outside,dFree}=M, N=W*H;
  const lab=new Int32Array(N);
  for(let i=0;i<N;i++) lab[i]= ink[i]?-2 : (outside[i]?-1:0);
  const comps=[]; let id=0;
  for(let s=0;s<N;s++){
    if(lab[s]!==0) continue;
    id++; const st=[s]; lab[s]=id; let cnt=0,minx=W,maxx=0,miny=H,maxy=0,inr=0;
    while(st.length){ const i=st.pop(); cnt++; const x=i%W,y=(i/W)|0;
      if(dFree&&dFree[i]>inr) inr=dFree[i];
      if(x<minx)minx=x; if(x>maxx)maxx=x; if(y<miny)miny=y; if(y>maxy)maxy=y;
      if(x>0&&lab[i-1]===0){lab[i-1]=id;st.push(i-1);} if(x<W-1&&lab[i+1]===0){lab[i+1]=id;st.push(i+1);}
      if(y>0&&lab[i-W]===0){lab[i-W]=id;st.push(i-W);} if(y<H-1&&lab[i+W]===0){lab[i+W]=id;st.push(i+W);} }
    comps.push({id,cnt,minx,maxx,miny,maxy,inr});
  }
  return {lab,comps};
}
/* OBSZAR ANALIZY: pomieszczenia budynku tworzą jedną gęstą grupę (sąsiadują przez
   ściany 0,12–0,25 m). Komórki łańcuchów wymiarowych, tabela rysunkowa i legenda
   leżą dalej niż 0,35 m od najbliższego pomieszczenia → trafiają do innych grup.  */
function clusterEnv(cand,ppm,W,H){
  if(!cand.length) return {x0:0,y0:0,x1:W-1,y1:H-1};
  const tol=0.35*ppm, p=cand.map((_,i)=>i);
  const find=i=>{ while(p[i]!==i){ p[i]=p[p[i]]; i=p[i]; } return i; };
  const uni=(a,b)=>{ a=find(a); b=find(b); if(a!==b) p[b]=a; };
  const near=(a,b)=> (a.minx-tol<=b.maxx && b.minx-tol<=a.maxx && a.miny-tol<=b.maxy && b.miny-tol<=a.maxy);
  for(let i=0;i<cand.length;i++)for(let j=i+1;j<cand.length;j++) if(near(cand[i],cand[j])) uni(i,j);
  const g={};
  cand.forEach((c,i)=>{ const r=find(i); (g[r]=g[r]||{cnt:0,x0:W,y0:H,x1:0,y1:0,n:0});
    const q=g[r]; q.cnt+=c.cnt; q.n++;
    q.x0=Math.min(q.x0,c.minx); q.y0=Math.min(q.y0,c.miny);
    q.x1=Math.max(q.x1,c.maxx); q.y1=Math.max(q.y1,c.maxy); });
  let best=null; Object.values(g).forEach(q=>{ if(!best||q.cnt>best.cnt) best=q; });
  const mg=0.45*ppm;
  return {x0:Math.max(0,best.x0-mg),y0:Math.max(0,best.y0-mg),
          x1:Math.min(W-1,best.x1+mg),y1:Math.min(H-1,best.y1+mg),n:best.n};
}
/* region → wielokąt: wypełnienie dziur (meble, schody, zabudowa) i dekompozycja
   na prostokąt lub dwa połączone prostokąty (kształt L) — pomieszczenia w domach
   jednorodzinnych są figurami prostokątnymi, więc obrys jest z definicji regularny */
function fillRegionMask(lab,W,H,c,bigIds){
  const x0=Math.max(0,c.minx-1), x1=Math.min(W-1,c.maxx+1);
  const y0=Math.max(0,c.miny-1), y1=Math.min(H-1,c.maxy+1);
  const w=x1-x0+1, h=y1-y0+1, m=new Uint8Array(w*h);
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++) if(lab[y*W+x]===c.id) m[(y-y0)*w+(x-x0)]=1;
  const vis=new Uint8Array(w*h), Q=[];
  const pu=i=>{ if(!m[i]&&!vis[i]){ vis[i]=1; Q.push(i); } };
  for(let x=0;x<w;x++){ pu(x); pu((h-1)*w+x); }
  for(let y=0;y<h;y++){ pu(y*w); pu(y*w+w-1); }
  while(Q.length){ const i=Q.pop(), x=i%w, y=(i/w)|0;
    if(x>0)pu(i-1); if(x<w-1)pu(i+1); if(y>0)pu(i-w); if(y<h-1)pu(i+w); }
  let filled=0;
  for(let i=0;i<w*h;i++) if(!m[i]&&!vis[i]){ m[i]=1; filled++; }
  // piksele należące do INNYCH pomieszczeń — obrys nie może ich zagarniać
  const oth=new Uint8Array(w*h);
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){ const j=(y-y0)*w+(x-x0);
    if(m[j]) continue;                       // wnętrze pomieszczenia (także zabudowa) — nie sąsiad
    const L=lab[y*W+x];
    if(L>0&&L!==c.id&&(!bigIds||bigIds.has(L))) oth[j]=1; }
  return {m,w,h,x0,y0,filled,oth};
}
function maskBBox(m,w,h,pred){
  let x0=w,x1=-1,y0=h,y1=-1,a=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){ if(!m[y*w+x]) continue; if(pred&&!pred(x,y)) continue;
    a++; if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; }
  if(x1<0) return null;
  return {x0,x1,y0,y1,a,rect:(x1-x0+1)*(y1-y0+1)};
}
/* Pokrycie regionu jednym lub dwoma prostokątami.
   Meble przylegające do ścian, symbole drzwi i zabudowa tworzą WCIĘCIA w konturze,
   ale pomieszczenie pozostaje prostokątem — dlatego bierzemy prostokąt opisany,
   a na dwa prostokąty (kształt L / T) dzielimy tylko przy wyraźnym uskoku. */
function largestRect(m,w,h){
  const hgt=new Int32Array(w); let best=null;
  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++) hgt[x]= m[y*w+x]? hgt[x]+1 : 0;
    const st=[];
    for(let x=0;x<=w;x++){
      const cur= x<w? hgt[x] : 0;
      while(st.length && hgt[st[st.length-1]]>=cur){
        const t=st.pop(), hh=hgt[t], left= st.length? st[st.length-1]+1 : 0, area=hh*(x-left);
        if(hh>0 && (!best||area>best.area)) best={area,x0:left,x1:x-1,y0:y-hh+1,y1:y,rect:area,a:area};
      }
      st.push(x);
    }
  }
  return best;
}
function grab(G,rs){                       // ile obcych pikseli zagarnia zestaw prostokątów
  let bad=0,tot=0;
  for(const r of rs) for(let y=r.y0;y<=r.y1;y++)for(let x=r.x0;x<=r.x1;x++){ tot++; if(G.oth[y*G.w+x]) bad++; }
  return tot? bad/tot : 1;
}
function regionRects(G,ppm){
  const {m,w,h}=G;
  const bb=maskBBox(m,w,h,null);
  if(!bb) return null;
  const bw=bb.x1-bb.x0+1, bh=bb.y1-bb.y0+1;
  if(grab(G,[bb])>0.05){                       // prostokąt opisany zagarniałby sąsiada
    const li=largestRect(m,w,h);
    return li? [li] : [bb];
  }
  // brakująca część prostokąta opisanego
  const cm=new Uint8Array(w*h);
  for(let y=bb.y0;y<=bb.y1;y++)for(let x=bb.x0;x<=bb.x1;x++) if(!m[y*w+x]) cm[y*w+x]=1;
  const cut=largestRect(cm,w,h);
  const MIN=1.15*ppm;                          // uskok musi mieć min. ~1,15 m w obu kierunkach
  if(cut){
    const cw=cut.x1-cut.x0+1, ch=cut.y1-cut.y0+1;
    const corner=(cut.x0<=bb.x0+2||cut.x1>=bb.x1-2)&&(cut.y0<=bb.y0+2||cut.y1>=bb.y1-2);
    if(cw>=MIN&&ch>=MIN&&cw*ch>=0.18*bw*bh&&corner)
      return [{...bb,cut:{x0:cut.x0,x1:cut.x1,y0:cut.y0,y1:cut.y1}}];
  }
  return [bb];                                 // zwykły prostokąt (wcięcia od zabudowy pomijamy)
}
function cleanPoly(pts){
  const o=[];
  for(const p of pts){ const q=o[o.length-1]; if(!q||Math.abs(q.x-p.x)>0.5||Math.abs(q.y-p.y)>0.5) o.push(p); }
  if(o.length>1){ const a=o[0],b=o[o.length-1]; if(Math.abs(a.x-b.x)<0.5&&Math.abs(a.y-b.y)<0.5) o.pop(); }
  const r=[];
  for(let i=0;i<o.length;i++){ const p0=o[(i+o.length-1)%o.length], p1=o[i], p2=o[(i+1)%o.length];
    const cr=(p1.x-p0.x)*(p2.y-p1.y)-(p1.y-p0.y)*(p2.x-p1.x);
    if(Math.abs(cr)>0.5) r.push(p1); }
  return r.length>=4? r : o;
}
function rectsToPoly(rs){
  const R=r=>({x0:r.x0,y0:r.y0,x1:r.x1+1,y1:r.y1+1});
  const a=R(rs[0]);
  if(rs[0].cut){
    const c=R(rs[0].cut);
    const left  = Math.abs(c.x0-a.x0)<3;       // do której krawędzi przylega wycięcie
    const top   = Math.abs(c.y0-a.y0)<3;
    const P=[];
    if(top&&left)      P.push({x:c.x1,y:a.y0},{x:a.x1,y:a.y0},{x:a.x1,y:a.y1},{x:a.x0,y:a.y1},{x:a.x0,y:c.y1},{x:c.x1,y:c.y1});
    else if(top&&!left)P.push({x:a.x0,y:a.y0},{x:c.x0,y:a.y0},{x:c.x0,y:c.y1},{x:a.x1,y:c.y1},{x:a.x1,y:a.y1},{x:a.x0,y:a.y1});
    else if(!top&&left)P.push({x:a.x0,y:a.y0},{x:a.x1,y:a.y0},{x:a.x1,y:a.y1},{x:c.x1,y:a.y1},{x:c.x1,y:c.y0},{x:a.x0,y:c.y0});
    else               P.push({x:a.x0,y:a.y0},{x:a.x1,y:a.y0},{x:a.x1,y:c.y0},{x:c.x0,y:c.y0},{x:c.x0,y:a.y1},{x:a.x0,y:a.y1});
    return cleanPoly(P);
  }
  return [{x:a.x0,y:a.y0},{x:a.x1,y:a.y0},{x:a.x1,y:a.y1},{x:a.x0,y:a.y1}];
}
/* Rozszerzenie prostokąta pomieszczenia do ścian.
   Meble, zabudowa i urządzenia przylegające do ścian ucinają region, ale są
   rysowane CIENKĄ kreską — dlatego przy rozszerzaniu przeskakujemy przeszkody
   cieńsze niż 0,10 m, a zatrzymujemy się na ścianie, na obszarze zewnętrznym
   i na pomieszczeniu już obrysowanym. */
function growRectToWalls(bb,M,lab,claimed,env,isRoom,selfId){
  const {W,H,ink,ppm}=M;
  const jump=Math.max(2,Math.round(0.10*ppm)), maxGrow=Math.round(1.6*ppm);
  const freeStrip=(x0,x1,y0,y1)=>{
    let n=0,inkN=0;
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
      if(x<env.x0||x>env.x1||y<env.y0||y>env.y1) return false;
      const i=y*W+x, L=lab[i];
      if(L===-1||claimed[i]) return false;                 // zewnątrz / już obrysowane
      if(L>0&&L!==selfId&&isRoom[L]) return false;          // inne pomieszczenie
      n++; if(ink[i]) inkN++;
    }
    return n>0 && inkN/n<0.5;
  };
  const sides=[
    {get:()=>[bb.x0-1,bb.x0-1,bb.y0,bb.y1], mv:d=>bb.x0-=d, lim:()=>bb.x0},
    {get:()=>[bb.x1+1,bb.x1+1,bb.y0,bb.y1], mv:d=>bb.x1+=d, lim:()=>bb.x1},
    {get:()=>[bb.x0,bb.x1,bb.y0-1,bb.y0-1], mv:d=>bb.y0-=d, lim:()=>bb.y0},
    {get:()=>[bb.x0,bb.x1,bb.y1+1,bb.y1+1], mv:d=>bb.y1+=d, lim:()=>bb.y1}
  ];
  sides.forEach((sd,si)=>{
    let moved=0;
    while(moved<maxGrow){
      const [a,b,c,d]=sd.get();
      if(freeStrip(a,b,c,d)){ sd.mv(1); moved++; continue; }
      let hop=0;
      for(let k=2;k<=jump;k++){
        const dx=(si<2?k:0), dy=(si<2?0:k);
        const [a2,b2,c2,d2]= si===0? [bb.x0-k,bb.x0-k,bb.y0,bb.y1]
                            : si===1? [bb.x1+k,bb.x1+k,bb.y0,bb.y1]
                            : si===2? [bb.x0,bb.x1,bb.y0-k,bb.y0-k]
                            :         [bb.x0,bb.x1,bb.y1+k,bb.y1+k];
        if(freeStrip(a2,b2,c2,d2)){ hop=k; break; }
      }
      if(!hop) break;
      sd.mv(hop); moved+=hop;
    }
  });
  return bb;
}
function regionInradius(G){          // maks. promień wpisany [px] — połowa szerokości w świetle
  const d=chamferDist(G.m,G.w,G.h,0);
  let mx=0; for(let i=0;i<G.w*G.h;i++) if(G.m[i]&&d[i]>mx) mx=d[i];
  return mx;
}
function regionToPoly(lab,M,c,opt,bigIds){
  const G=fillRegionMask(lab,M.W,M.H,c,bigIds);
  if(opt.minInr>0 && regionInradius(G) < 0.5*opt.minInr*M.ppm) return null;
  const rs=regionRects(G,M.ppm);
  if(!rs) return null;
  const pts=rectsToPoly(opt.rect===false?[{...rs[0],cut:null}]:rs);
  if(!pts||pts.length<4) return null;
  return pts.map(p=>({x:(p.x+G.x0)/M.k, y:(p.y+G.y0)/M.k}));
}

/* ================= podgląd maski ================= */
async function showMaskPreview(opt){
  setHint('Buduję maskę…'); await new Promise(r=>setTimeout(r,20));
  try{
    const M=await buildMask(opt); const f=F();
    const {lab,comps}=labelRegions(M);
    const cnd=comps.filter(c=>c.cnt>=(opt.minArea||1.5)*M.ppm*M.ppm && c.cnt<0.75*M.W*M.H);
    M.env = f.roi ? {x0:f.roi.x0*M.k,y0:f.roi.y0*M.k,x1:f.roi.x1*M.k,y1:f.roi.y1*M.k}
                  : clusterEnv(cnd,M.ppm,M.W,M.H);
    const c=document.createElement('canvas'); c.width=M.W; c.height=M.H;
    const g=c.getContext('2d'); const img=g.createImageData(M.W,M.H);
    for(let i=0;i<M.W*M.H;i++){
      const L=lab[i]; let r=0,gg=0,b=0,a=0;
      if(L===-2){ r=18;gg=49;b=78;a=255; }            // przegroda
      else if(L>0){ const h=(L*57)%360; const s=0.55,v=0.95;
        const fq=(n)=>{ const kk=(n+h/60)%6; return Math.round(255*(v-v*s*Math.max(0,Math.min(kk,4-kk,1)))); };
        r=fq(5);gg=fq(3);b=fq(1);a=150; }             // regiony
      img.data[i*4]=r; img.data[i*4+1]=gg; img.data[i*4+2]=b; img.data[i*4+3]=a;
    }
    g.putImageData(img,0,0);
    // ramka obwiedni
    g.strokeStyle='#C03048'; g.lineWidth=3; g.setLineDash([12,8]);
    g.strokeRect(M.env.x0,M.env.y0,M.env.x1-M.env.x0,M.env.y1-M.env.y0);
    f.maskPrev=c.toDataURL('image/png'); f.maskPrevK=M.k;
    delete maskPrevCache[f.id];
    setHint(''); draw();
    toast(`Podgląd: ${cnd.length} regionów wielkości pomieszczenia, obszar analizy = czerwona ramka. Granatowe = przegrody. Wyłącz przyciskiem „Maska ścian”.`);
  }catch(e){ setHint(''); alert('Błąd podglądu: '+e.message); }
}
const maskPrevCache={};

/* ================= detekcja ================= */
async function detectRooms(opt){
  const f=F();
  setHint('Analizuję rzut…'); await new Promise(r=>setTimeout(r,20));
  try{
    const M=await buildMask(opt);
    const {lab,comps}=labelRegions(M);
    const ppm=M.ppm;
    const minPx=opt.minArea*ppm*ppm;
    const minInrPx=0.5*(opt.minInr||0.6)*ppm;
    const isRoom=[]; comps.forEach(c=>{ isRoom[c.id]= c.cnt>=minPx && c.inr>=minInrPx; });
    let cand=comps.filter(c=>isRoom[c.id] && c.cnt<0.75*M.W*M.H);
    const env = f.roi
      ? {x0:f.roi.x0*M.k,y0:f.roi.y0*M.k,x1:f.roi.x1*M.k,y1:f.roi.y1*M.k}
      : clusterEnv(cand,ppm,M.W,M.H);
    M.env=env;
    cand=cand.filter(c=>{ const cx=(c.minx+c.maxx)/2, cy=(c.miny+c.maxy)/2;
      return cx>=env.x0&&cx<=env.x1&&cy>=env.y0&&cy<=env.y1; });
    if(!cand.length){ setHint(''); alert('Nie wykryto pomieszczeń w obszarze analizy. Użyj narzędzia „Obszar analizy”, aby wskazać sam budynek, albo „Klik: pomieszczenie”.'); return; }
    if(!cand.length){
      setHint('');
      alert('Nie wykryto pomieszczeń.\n\nSprawdź kolejno:\n1) „Podgląd maski” — czy ściany są ciągłe (granatowe) i czy czerwona ramka otacza budynek,\n2) czułość — przy jasnym skanie zwiększ, przy ciemnym tle zmniejsz,\n3) jeśli pomieszczenia zlewają się przez przejścia bez drzwi — ustaw „Domknij otwory” na 0,9 m,\n4) w ostateczności użyj narzędzia „Klik: pomieszczenie”.');
      return;
    }
    // filtr „ograniczone ścianami”: odrzuca komórki tabeli rysunkowej, pola łańcuchów
    // wymiarowych i wnętrza mebli — ich brzeg tworzą cienkie kreski, nie ściany
    if(opt.wallBounded===true){
      const {W,H,thickNear}=M, byId={}; cand.forEach(c=>{byId[c.id]={bnd:0,thk:0};});
      for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){
        const i=y*W+x, L=lab[i]; if(L<=0) continue; const st=byId[L]; if(!st) continue;
        if(lab[i-1]===-2||lab[i+1]===-2||lab[i-W]===-2||lab[i+W]===-2){ st.bnd++; if(thickNear[i]) st.thk++; }
      }
      const kept=cand.filter(c=>{ const st=byId[c.id]; return st&&st.bnd>0&&st.thk/st.bnd>=0.30; });
      if(kept.length) cand=kept;
    }
    // wektoryzacja — od największego regionu, żeby obrys dużego pomieszczenia mógł
    // wchłonąć drobne fragmenty (paski przy zabudowie, wycinki przy skrzydłach drzwi)
    let polys=[];
    cand.sort((a,b)=>b.cnt-a.cnt);
    const prot=new Set(), claimed=new Uint8Array(M.W*M.H);
    for(const c of cand){
      const G=fillRegionMask(lab,M.W,M.H,c,prot);
      prot.add(c.id);
      const rs=regionRects(G,ppm);
      if(!rs) continue;
      let pts;
      if(rs.length===1 && !rs[0].cut){
        // prosty prostokąt → rozszerzamy do ścian (odzyskujemy powierzchnię pod zabudową)
        const bb={x0:rs[0].x0+G.x0, x1:rs[0].x1+G.x0, y0:rs[0].y0+G.y0, y1:rs[0].y1+G.y0};
        growRectToWalls(bb,M,lab,claimed,env,isRoom,c.id);
        pts=[{x:bb.x0,y:bb.y0},{x:bb.x1+1,y:bb.y0},{x:bb.x1+1,y:bb.y1+1},{x:bb.x0,y:bb.y1+1}];
        for(let y=bb.y0;y<=bb.y1;y++)for(let x=bb.x0;x<=bb.x1;x++) claimed[y*M.W+x]=1;
        pts=pts.map(p=>({x:p.x/M.k,y:p.y/M.k}));
      } else {
        pts=rectsToPoly(rs).map(p=>({x:(p.x+G.x0)/M.k,y:(p.y+G.y0)/M.k}));
        for(let y=rs[0].y0;y<=rs[0].y1;y++)for(let x=rs[0].x0;x<=rs[0].x1;x++) claimed[(y+G.y0)*M.W+(x+G.x0)]=1;
      }
      if(!pts||pts.length<4) continue;
      polys.push({pts,area:polyArea(pts),cnt:c.cnt});
    }
    // filtry geometryczne: zawieranie (meble, schody, wnętrza ścian) + szerokość w świetle
    polys.sort((a,b)=>b.area-a.area);
    polys=polys.filter((P,idx)=>{
      const cen=polyCentroid(P.pts);
      for(let j=0;j<idx;j++){ if(pointInPoly(cen,polys[j].pts)) return false; }
      return true;
    });
    // OCR: opisy + zestawienie pomieszczeń
    let lines=[], sched={};
    if(opt.ocr){ setHint('Czytam opisy i zestawienie pomieszczeń (OCR)…');
      lines=await tryOcr(M.canvas).catch(()=>[]);
      sched=parseRoomSchedule(lines);
    }
    snapshot();
    if(opt.clear){ f.rooms=[]; f.nodes.forEach(n=>{ if(n.roomId) n.roomId=null; }); }
    let made=0, typed=0, byNo=0;
    for(const P of polys){
      const cen=polyCentroid(P.pts);
      if(f.rooms.some(r=>pointInPoly(cen,r.pts))) continue;
      const inL=lines.filter(L=>pointInPoly({x:L.cx/M.k,y:L.cy/M.k},P.pts));
      let type=null,name='',areaHint=null;
      // a) numer pomieszczenia + tabela
      for(const L of inL){ const t=L.text.replace(/\s+/g,''); const m=t.match(RE_ROOMNO);
        if(m){ const key=m[1]+'/'+m[2]; const e=sched[key];
          if(e){ type=typeFromLabel(e.name); name=`${key} ${e.name}`; areaHint=e.area; byNo++; break; } } }
      // b) nazwa wprost na rzucie
      if(!type) for(const L of inL){ const t2=typeFromLabel(L.text);
        if(t2){ type=t2; name=L.text.replace(/\d+[.,]\d+\s*[mM].*$/,'').replace(/[^0-9A-Za-ząćęłńóśźżĄĆĘŁŃÓŚŹŻ.\/ -]/g,'').trim(); break; } }
      if(!areaHint) for(const L of inL){ const a=areaFromText(L.text); if(a){ areaHint=a; break; } }
      const areaM2=polyArea(P.pts)/f.pxPerM**2;
      if(type) typed++; else type=typeFromArea(areaHint||areaM2);
      f.rooms.push({id:uid(),pts:P.pts,type,
        name:name?(name.length>2?name:''):'',
        areaOverride: areaHint||null,          // powierzchnia z zestawienia/opisu na rzucie
        osoby:null,hOverride:null,flowOverride:null,auto:true});
      made++;
    }
    refreshAll(); setHint('');
    toast(`Rozpoznano ${made} pomieszczeń`+(byNo?`, w tym ${byNo} nazwanych z zestawienia (numery „1/x”)`:'')
      +(typed&&!byNo?`, ${typed} z opisów`:'')+(!typed&&opt.ocr?' — OCR nie odczytał opisów, typy przypisane z powierzchni':'')
      +'. Sprawdź typy w zakładce Bilans, potem „Rozmieść anemostaty”.');
  }catch(err){ setHint(''); alert('Błąd analizy rzutu: '+err.message); }
}

/* ================= „Klik: pomieszczenie” (magic wand) ================= */
async function wandAt(world){
  const f=F();
  if(!f.bg){ toast('Brak podkładu.'); return; }
  if(!f.pxPerM){ toast('Najpierw skalibruj skalę rzutu.'); return; }
  const opt={thresh:f.detT||190, gapM:f.detGap||0, rect:f.detRect!==false, minArea:0.4, minInr:0.3};
  try{
    const M=await buildMask(opt);
    const sx=Math.round(world.x*M.k), sy=Math.round(world.y*M.k);
    if(sx<0||sy<0||sx>=M.W||sy>=M.H){ toast('Klik poza rzutem.'); return; }
    if(M.ink[sy*M.W+sx]){ toast('Kliknięto na kreskę rysunku — kliknij wnętrze pomieszczenia.'); return; }
    // flood tylko z klikniętego punktu (bez ograniczenia obwiednią)
    const {W,H,ink}=M, N=W*H;
    const lab=new Int32Array(N);
    for(let i=0;i<N;i++) lab[i]= ink[i]?-2:0;
    const id=1, st=[sy*W+sx]; lab[st[0]]=id;
    let cnt=0,minx=W,maxx=0,miny=H,maxy=0, touched=false;
    while(st.length){ const i=st.pop(); cnt++; const x=i%W,y=(i/W)|0;
      if(x===0||y===0||x===W-1||y===H-1) touched=true;
      if(x<minx)minx=x; if(x>maxx)maxx=x; if(y<miny)miny=y; if(y>maxy)maxy=y;
      if(x>0&&lab[i-1]===0){lab[i-1]=id;st.push(i-1);} if(x<W-1&&lab[i+1]===0){lab[i+1]=id;st.push(i+1);}
      if(y>0&&lab[i-W]===0){lab[i-W]=id;st.push(i-W);} if(y<H-1&&lab[i+W]===0){lab[i+W]=id;st.push(i+W);} }
    if(touched){ toast('Obszar nie jest zamknięty — wypływa poza rysunek. Sprawdź „Podgląd maski”, zwiększ czułość albo domknij otwory.'); return; }
    const pts=regionToPoly(lab,M,{id,cnt,minx,maxx,miny,maxy},opt);
    if(!pts){ toast('Nie udało się obrysować obszaru.'); return; }
    const cen=polyCentroid(pts);
    const ex=f.rooms.find(r=>pointInPoly(cen,r.pts));
    snapshot();
    if(ex){ ex.pts=pts; sel={kind:'room',id:ex.id}; toast('Zaktualizowano obrys istniejącego pomieszczenia.'); }
    else {
      const areaM2=polyArea(pts)/f.pxPerM**2;
      const r={id:uid(),pts,type:typeFromArea(areaM2),name:'',osoby:null,hOverride:null,flowOverride:null,auto:true};
      f.rooms.push(r); sel={kind:'room',id:r.id};
      toast(`Dodano pomieszczenie ${fmt(areaM2,1)} m² — ustaw typ we właściwościach (panel niżej) i klikaj kolejne pomieszczenia.`);
    }
    refreshAll();
  }catch(e){ toast('Błąd: '+e.message); }
}

/* ================= geometria pomocnicza ================= */
function traceContour(lab,W,H,c){
  const id=c.id;
  const at=(x,y)=> x>=0&&y>=0&&x<W&&y<H&&lab[y*W+x]===id;
  let sx=-1,sy=-1;
  outer: for(let y=c.miny;y<=c.maxy;y++)for(let x=c.minx;x<=c.maxx;x++){ if(at(x,y)){sx=x;sy=y;break outer;} }
  if(sx<0) return null;
  const dirs=[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
  let px=sx,py=sy,dir=6;
  const out=[{x:sx,y:sy}];
  const maxSteps=(c.maxx-c.minx+c.maxy-c.miny+4)*8+4000;
  for(let step=0;step<maxSteps;step++){
    let found=false;
    for(let i=0;i<8;i++){ const nd=(dir+6+i)%8;
      const nx=px+dirs[nd][0], ny=py+dirs[nd][1];
      if(at(nx,ny)){ px=nx;py=ny;dir=nd; out.push({x:nx,y:ny}); found=true; break; } }
    if(!found) break;
    if(px===sx&&py===sy) break;
  }
  return out;
}
function rdp(pts,eps){
  if(pts.length<3) return pts;
  let dmax=0,idx=0;
  for(let i=1;i<pts.length-1;i++){ const dd=distToSegment(pts[i],pts[0],pts[pts.length-1]); if(dd>dmax){dmax=dd;idx=i;} }
  if(dmax>eps){ const a=rdp(pts.slice(0,idx+1),eps), b=rdp(pts.slice(idx),eps); return a.slice(0,-1).concat(b); }
  return [pts[0],pts[pts.length-1]];
}
function rectifyPoly(pts,thJog){
  const n=pts.length; if(n<4) return null;
  const edges=[];
  for(let i=0;i<n;i++){ const p=pts[i],q=pts[(i+1)%n]; const dx=q.x-p.x,dy=q.y-p.y;
    const hv=Math.abs(dx)>=Math.abs(dy)?'H':'V';
    edges.push({hv,len:Math.hypot(dx,dy)||1e-6,coord:hv==='H'?(p.y+q.y)/2:(p.x+q.x)/2}); }
  let runs=[];
  for(const e of edges){
    if(runs.length&&runs[runs.length-1].hv===e.hv){ const r=runs[runs.length-1];
      r.coord=(r.coord*r.len+e.coord*e.len)/(r.len+e.len); r.len+=e.len; }
    else runs.push({hv:e.hv,len:e.len,coord:e.coord});
  }
  while(runs.length>1&&runs[0].hv===runs[runs.length-1].hv){
    const a=runs.pop(); runs[0].coord=(runs[0].coord*runs[0].len+a.coord*a.len)/(runs[0].len+a.len); runs[0].len+=a.len;
  }
  if(thJog>0){
    for(let guard=0; guard<80 && runs.length>4; guard++){
      let mi=-1,ml=Infinity;
      runs.forEach((r,i)=>{ if(r.len<ml){ml=r.len;mi=i;} });
      if(ml>=thJog) break;
      const m=runs.length, ip=(mi+m-1)%m, inx=(mi+1)%m;
      const P=runs[ip], Nx=runs[inx];
      P.coord=(P.coord*P.len+Nx.coord*Nx.len)/(P.len+Nx.len); P.len+=Nx.len;
      runs=runs.filter((_,i)=>i!==mi&&i!==inx);
      while(runs.length>1&&runs[0].hv===runs[runs.length-1].hv){
        const a=runs.pop(); runs[0].coord=(runs[0].coord*runs[0].len+a.coord*a.len)/(runs[0].len+a.len); runs[0].len+=a.len;
      }
    }
  }
  if(runs.length<4||runs.length%2) return null;
  const out=[];
  for(let i=0;i<runs.length;i++){ const a=runs[i], b=runs[(i+1)%runs.length];
    out.push(a.hv==='H'?{x:b.coord,y:a.coord}:{x:a.coord,y:b.coord}); }
  const a0=polyArea(pts), a1=polyArea(out);
  if(!a1||a1/a0<0.96||a1/a0>1.35) return null;
  return out;
}
function polyInradius(pts){
  const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);
  const minx=Math.min(...xs),maxx=Math.max(...xs),miny=Math.min(...ys),maxy=Math.max(...ys);
  const step=Math.max(maxx-minx,maxy-miny)/26+1e-6;
  let best=0;
  for(let y=miny+step/2;y<maxy;y+=step)for(let x=minx+step/2;x<maxx;x+=step){
    const p={x,y}; if(!pointInPoly(p,pts)) continue;
    let dE=Infinity;
    for(let i=0;i<pts.length;i++){ const dd=distToSegment(p,pts[i],pts[(i+1)%pts.length]); if(dd<dE)dE=dd; }
    if(dE>best)best=dE;
  }
  return best;
}
function offsetPoly(pts,dOut){
  if(!dOut) return pts;
  const n=pts.length;
  let sa=0; for(let i=0;i<n;i++){ const p=pts[i],q=pts[(i+1)%n]; sa+=p.x*q.y-q.x*p.y; }
  const sgn=sa>0?1:-1, out=[];
  for(let i=0;i<n;i++){
    const p0=pts[(i+n-1)%n],p1=pts[i],p2=pts[(i+1)%n];
    const e1={x:p1.x-p0.x,y:p1.y-p0.y}, e2={x:p2.x-p1.x,y:p2.y-p1.y};
    const l1=Math.hypot(e1.x,e1.y)||1, l2=Math.hypot(e2.x,e2.y)||1;
    const n1={x:sgn*e1.y/l1,y:-sgn*e1.x/l1}, n2={x:sgn*e2.y/l2,y:-sgn*e2.x/l2};
    const bx=n1.x+n2.x, by=n1.y+n2.y, bl=Math.hypot(bx,by);
    if(bl<1e-6){ out.push({x:p1.x+n1.x*dOut,y:p1.y+n1.y*dOut}); continue; }
    const cosHalf=Math.sqrt(Math.max((1+(n1.x*n2.x+n1.y*n2.y))/2,0.02));
    const dd=Math.min(dOut/cosHalf,dOut*3);
    out.push({x:p1.x+bx/bl*dd,y:p1.y+by/bl*dd});
  }
  return out;
}

/* ================= OCR ================= */
async function tryOcr(canvas){
  if(!window.Tesseract){
    await new Promise((res,rej)=>{ const s=document.createElement('script');
      s.src='https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.1.0/tesseract.min.js';
      s.onload=res; s.onerror=()=>rej(new Error('brak internetu')); document.head.appendChild(s);
      setTimeout(()=>rej(new Error('timeout')),20000); });
  }
  const s2=Math.min(2.2,3400/canvas.width);
  const oc2=document.createElement('canvas'); oc2.width=Math.round(canvas.width*s2); oc2.height=Math.round(canvas.height*s2);
  const c2=oc2.getContext('2d'); c2.imageSmoothingEnabled=true;
  c2.fillStyle='#fff'; c2.fillRect(0,0,oc2.width,oc2.height);
  c2.drawImage(canvas,0,0,oc2.width,oc2.height);
  const worker=await Tesseract.createWorker('pol',1).catch(()=>Tesseract.createWorker('eng',1));
  try{
    const {data}=await worker.recognize(oc2);
    const lines=[];
    (data.lines||[]).forEach(L=>{ const t=(L.text||'').trim();
      if(t.length>=2&&L.confidence>25) lines.push({text:t,cx:(L.bbox.x0+L.bbox.x1)/2/s2,cy:(L.bbox.y0+L.bbox.y1)/2/s2}); });
    (data.words||[]).forEach(w=>{ const t=(w.text||'').trim();
      if(t.length>=2&&w.confidence>30) lines.push({text:t,cx:(w.bbox.x0+w.bbox.x1)/2/s2,cy:(w.bbox.y0+w.bbox.y1)/2/s2}); });
    return lines;
  } finally { worker.terminate(); }
}

/* ================= anemostaty ================= */
const VALVE_MAX=60;
function autoTerminals(){
  recalc();
  const C=window.CALC; let made=0, skipped=0;
  snapshot();
  state.floors.forEach((f,fi)=>{
    f.rooms.forEach(r=>{
      const rec=C.rooms[r.id]; if(!rec) return;
      const t=ROOM_TYPES[r.type]||{};
      if(t.role==='transfer'||t.role==='excluded'){ if(t.role==='excluded') skipped++; return; }
      [['sup',rec.sup||0,'term_sup'],['exh',rec.exh||rec.exhBase||0,'term_exh']].forEach(([side,flow,ntype])=>{
        if(flow<=0) return;
        if(side==='sup'&&!(t.role==='sup'||t.role==='both')) return;
        if(side==='exh'&&!(t.role==='exh'||t.role==='both')) return;
        const existing=f.nodes.filter(n=>n.roomId===r.id&&n.type===ntype);
        const need=Math.max(1,Math.ceil(flow/VALVE_MAX))-existing.length;
        if(need<=0) return;
        const avoid=f.nodes.filter(n=>n.roomId===r.id).map(n=>({x:n.x,y:n.y}));
        placeInRoom(r.pts,need,avoid).forEach(p=>{ f.nodes.push({id:uid(),type:ntype,x:p.x,y:p.y,roomId:r.id,auto:true}); made++; });
      });
    });
  });
  refreshAll();
  toast(`Rozmieszczono ${made} anemostatów (≤ ${VALVE_MAX} m³/h na zawór).`+(skipped?' Pominięto garaż/kotłownię (wentylacja niezależna).':'')+' Przesuń zawory w docelowe miejsca i połącz przewodami FLX.');
}
function placeInRoom(pts,n,avoid){
  const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);
  const minx=Math.min(...xs),maxx=Math.max(...xs),miny=Math.min(...ys),maxy=Math.max(...ys);
  const step=Math.max((maxx-minx),(maxy-miny))/36+1e-6;
  const cand=[];
  for(let y=miny+step/2;y<maxy;y+=step)for(let x=minx+step/2;x<maxx;x+=step){
    const p={x,y}; if(!pointInPoly(p,pts)) continue;
    let dEdge=Infinity;
    for(let i=0;i<pts.length;i++){ const dd=distToSegment(p,pts[i],pts[(i+1)%pts.length]); if(dd<dEdge)dEdge=dd; }
    cand.push({x,y,dEdge});
  }
  if(!cand.length) return [polyCentroid(pts)];
  const chosen=[];
  for(let i=0;i<n;i++){
    let best=null,bs=-1;
    for(const c of cand){
      let dOther=Infinity;
      [...chosen,...(avoid||[])].forEach(q=>{ const dd=dist(c,q); if(dd<dOther)dOther=dd; });
      const score=Math.min(c.dEdge, dOther*0.55);
      if(score>bs){bs=score;best=c;}
    }
    chosen.push({x:best.x,y:best.y});
  }
  return chosen;
}

function setROI(a,b){
  const f=F();
  f.roi={x0:Math.min(a.x,b.x),y0:Math.min(a.y,b.y),x1:Math.max(a.x,b.x),y1:Math.max(a.y,b.y)};
  maskCache.key=null; refreshAll();
  toast('Obszar analizy ustawiony — teraz „Rozpoznaj pomieszczenia”. Ponowne kliknięcie dwóch punktów zmienia obszar.');
}
document.getElementById('btnRoiClear').addEventListener('click',()=>{ F().roi=null; maskCache.key=null; refreshAll(); toast('Obszar analizy wyczyszczony — program wyznaczy go automatycznie.'); });
document.getElementById('btnAutoRooms').addEventListener('click',autoDetectDialog);
document.getElementById('btnAutoTerms').addEventListener('click',()=>{
  if(!F().rooms.length){ alert('Brak pomieszczeń — użyj „Rozpoznaj pomieszczenia”, narzędzia „Klik: pomieszczenie” lub obrysuj ręcznie.'); return; }
  autoTerminals();
});
document.getElementById('btnMask').addEventListener('click',async()=>{
  const f=F();
  if(f.maskPrev){ f.maskPrev=null; draw(); toast('Podgląd maski wyłączony.'); return; }
  if(!f.bg){ alert('Brak podkładu.'); return; }
  if(!f.pxPerM){ alert('Najpierw skalibruj skalę rzutu.'); return; }
  await showMaskPreview({thresh:f.detT||190,gapM:f.detGap||0,rect:true,minArea:1.5,minInr:0.8});
});
/* ============================ RAPORT ============================ */
/* automatyczne rozmieszczenie mieszkańców: wg wag pokoi nawiewnych (sypialnia 2, pokój 1, salon 2) do liczby state.persons */
function autoOccupants(){
  const N=state.persons||1; const rooms=[];
  state.floors.forEach((f,fi)=>f.rooms.forEach(r=>{ const t=ROOM_TYPES[r.type]||{}; if(t.role==='sup'||t.role==='both'){ rooms.push({f,fi,r,w:r.osoby!=null?r.osoby:(t.osoby||1),n:0}); } }));
  if(!rooms.length){ toast('Brak pokoi nawiewnych — najpierw obrysuj pomieszczenia.'); return; }
  let left=N; rooms.sort((a,b)=>b.w-a.w);
  while(left>0){ let placed=false; for(const rm of rooms){ if(left<=0) break; if(rm.n<rm.w){ rm.n++; left--; placed=true; } } if(!placed){ rooms[0].n++; left--; } }
  rooms.forEach(rm=>{ if(!rm.n) return; const pts=placeInRoom(rm.r.pts,rm.n,rm.f.nodes.filter(n=>n.type!=='person'));
    pts.forEach(p=>rm.f.nodes.push({id:uid(),type:'person',x:p.x,y:p.y,roomId:rm.r.id})); });
}
function buildReport(){
  const C=window.CALC,B=C.balance||{},P=C.press||{};
  const today=new Date().toLocaleDateString('pl-PL');
  const roomRows=Object.values(C.rooms||{}).map(r=>`<tr><td>${esc(r.floor)}</td><td>${esc(r.name)}</td><td>${esc(ROOM_TYPES[r.type]?.label||'')}</td><td class="num">${fmt(r.area,1)}</td><td class="num">${fmt(r.vol,1)}</td><td class="num">${r.sup?fmt(r.sup):''}</td><td class="num">${r.exh?fmt(r.exh):''}</td><td>${r.exhBase!=null?esc(ROOM_TYPES[r.type]?.ref||''):''}</td></tr>`).join('');
  let segRows=''; state.floors.forEach(f=>f.segs.forEach(s=>{ const r=C.segs[s.id]; if(!r) return;
    segRows+=`<tr><td>${esc(f.name)}</td><td>${s.kind==='flx'?'przewód FLX':'kanał spiro'} (${r.side==='fresh'?'czerpny':r.side==='out'?'wyrzutowy':r.side==='sup'?'nawiew':r.side==='exh'?'wywiew':'—'})</td><td class="num">${fmt(r.len,1)}</td><td class="num">${fmt(r.q)}</td><td>${r.dim||''}</td><td class="num">${fmt(r.v,2)}</td><td class="num">${fmt(r.dp,1)}</td></tr>`; }));
  const bomRows=(C.bom||[]).map(b=>`<tr><td>${esc(b.code)}</td><td>${esc(b.name)}</td><td class="num">${fmt(b.qty)}</td><td>${b.unit}</td><td>${esc(b.note)}</td></tr>`).join('');
  const checkRows=(C.checks||[]).map(c=>`<li>[${c.st==='ok'?'✓':c.st==='err'?'✗':'!'}] ${c.txt} <i>(${esc(c.ref)})</i></li>`).join('');
  document.getElementById('reportWrap').innerHTML=`
  <h1>Projekt instalacji wentylacji mechanicznej z odzyskiem ciepła</h1>
  <div class="meta">${esc(state.name||'—')} · opracował(a): ${esc(state.author||'—')} · data: ${today} · narzędzie: HVAC+ (asortyment 21LAB)</div>
  <h2>1. Podstawa opracowania</h2>
  <ul>
    <li>Rozporządzenie Ministra Infrastruktury z 12.04.2002 r. w sprawie warunków technicznych, jakim powinny odpowiadać budynki i ich usytuowanie (t.j. Dz.U. 2022 poz. 1225, z późn. zm.) — w szczególności §147–155.</li>
    <li>PN-83/B-03430 wraz ze zmianą Az3:2000 „Wentylacja w budynkach mieszkalnych zamieszkania zbiorowego i użyteczności publicznej — Wymagania”.</li>
    <li>„Warunki Techniczne Wykonania i Odbioru Instalacji Wentylacyjnych”, COBRTI INSTAL, zeszyt 5, 2002.</li>
    <li>PN-EN 12599 (odbiór i pomiary), PN-87/B-02151/02 / PN-B-02151-2:2018 (hałas), PN-EN 12237 (szczelność przewodów okrągłych).</li>
    <li>Katalogi techniczne 21LAB Systemy Wentylacji (system FLX-REKU, centrale HRU).</li>
  </ul>
  <h2>2. Bilans powietrza wentylacyjnego</h2>
  <p>Liczba mieszkańców: <b>${B.persons}</b>${C.personsFromPlan?' (rozmieszczeni na rzutach — rozdział nawiewu wg faktycznego obłożenia pokoi)':''}. Minimalny strumień powietrza zewnętrznego: <b>${fmt(B.minOs)} m³/h</b> (20 m³/h·os — §149 WT). Suma wywiewów normowych: <b>${fmt(B.sumExhBase)} m³/h</b>. <b>Strumień projektowy: ${fmt(B.V)} m³/h</b> (instalacja zrównoważona, nawiew = wywiew). Tryb obniżony (nocny): do ${fmt(B.night)} m³/h (60% — Az3:2000). Okresowy wywiew intensywny z kuchni: ≥ 120 m³/h.</p>
  <table><tr><th>Kond.</th><th>Pomieszczenie</th><th>Typ</th><th class="num">Pow. [m²]</th><th class="num">Kub. [m³]</th><th class="num">Nawiew [m³/h]</th><th class="num">Wywiew [m³/h]</th><th>Podstawa</th></tr>${roomRows}
  <tr><th colspan="5">RAZEM</th><th class="num">${fmt(B.sumSup)}</th><th class="num">${fmt(B.V)}</th><th></th></tr></table>
  ${C.zoning&&C.zoning.on?`<h3>Strefy wentylacji (nawiew)</h3><p>Instalacja nawiewna podzielona na dwie strefy sterowane przepustnicami strefowymi: <b>S1 — pokoje/sypialnie (strefa nocna)</b> i <b>S2 — salon/jadalnia (strefa dzienna)</b>. Suma nawiewu pozostaje stała; w trybie dziennym strefa S1 jest redukowana do ${state.zoning.dayZ1??40}% nominału, w trybie nocnym strefa S2 do ${state.zoning.nightZ2??30}%. Przewody i rozdzielacze zwymiarowano na maksimum ze scenariuszy.</p>
  <table><tr><th>Strefa</th><th class="num">Pomieszczeń</th><th class="num">Nominal [m³/h]</th><th class="num">Dzień [m³/h]</th><th class="num">Noc [m³/h]</th></tr>${[1,2].map(k=>`<tr><td>${ZONES[k].label}</td><td class="num">${C.zoning.z[k].rooms}</td><td class="num">${fmt(C.zoning.z[k].nom)}</td><td class="num">${fmt(C.zoning.z[k].day)}</td><td class="num">${fmt(C.zoning.z[k].night)}</td></tr>`).join('')}</table>`:''}
  <h2>3. Sieć przewodów — wymiarowanie i straty ciśnienia</h2>
  <table><tr><th>Kond.</th><th>Odcinek</th><th class="num">L [m]</th><th class="num">V̇ [m³/h]</th><th>Wymiar</th><th class="num">v [m/s]</th><th class="num">Δp [Pa]</th></tr>${segRows}</table>
  <p>Wymagany spręż dyspozycyjny centrali: <b>nawiew ${fmt(P.sup)} Pa</b>, <b>wywiew ${fmt(P.exh)} Pa</b> (w tym ryczałty: puszka rozprężna + zawór 20 Pa, rozdzielacz 10 Pa, tłumiki 2×15 Pa, czerpnia/wyrzutnia ζ=2,5). Straty liniowe: kanały stalowe — wzór Altszula (k = 0,15 mm), przewody FLX — charakterystyki katalogowe.</p>
  ${window.render3DImage&&state.floors.some(f=>f.segs.length||f.nodes.length)?`<p><i>Układ przestrzenny instalacji — patrz rysunki Rys. 1 i Rys. 2 (aksonometrie) na końcu opracowania.</i></p>`:''}
  <h2>4. Dobór centrali wentylacyjnej</h2>
  ${C.unit?`<p>Dobrano: <b>21LAB ${C.unit.model}</b> — wydajność ${C.unit.v100} m³/h przy 100 Pa, sprawność odzysku ciepła ${C.unit.eta}% (EN 13141-7) ≥ 50% wymaganych przez §151 WT, króćce Ø${C.unit.duct}. ${C.unit.note}. Punkt pracy (${fmt(B.V)} m³/h / ${fmt(P.max)} Pa) zweryfikować na charakterystyce z karty doboru 21LAB.</p>`:'<p><b>Nie dobrano centrali</b> — patrz uwagi w narzędziu.</p>'}
  <h2>5. Zestawienie materiałów (asortyment 21LAB)</h2>
  <table><tr><th>Kod</th><th>Nazwa</th><th class="num">Ilość</th><th>j.m.</th><th>Uwagi</th></tr>${bomRows}</table>
  <h2 class="pagebreak">6. Zgodność z wymaganiami</h2>
  <ul>${checkRows}</ul>
  <h2>7. Wytyczne wykonania i odbioru (WTWiO COBRTI INSTAL z. 5, PN-EN 12599)</h2>
  <ul>
    <li>Przewody łączyć szczelnie; system FLX-REKU oraz kształtki spiro z uszczelką (sufiks L) — klasa szczelności D. Próba szczelności z protokołem.</li>
    <li>Przewody prowadzone przez przestrzenie nieogrzewane izolować termicznie; odcinki czerpni i wyrzutni — izolacja z barierą paroszczelną (§153 WT).</li>
    <li>Zapewnić otwory rewizyjne oraz dostęp do filtrów i wymiennika centrali (§153 ust. 6 WT).</li>
    <li>Regulacja: nastawy zaworów; pomiar strumieni — odchyłki ≤ ±20% dla pomieszczenia, ≤ ±15% dla instalacji (PN-EN 12599); protokół regulacji.</li>
    <li>Pomiar poziomu dźwięku: pokoje ≤ 35 dB(A) dzień / 25 dB(A) noc; kuchnia i pomieszczenia sanitarne ≤ 40 dB(A) (PN-87/B-02151/02).</li>
    <li>72-godzinny ruch próbny; przekazanie dokumentacji powykonawczej, DTR, deklaracji właściwości użytkowych, protokołów prób i pomiarów.</li>
    <li>Otwory wyrównawcze: podcięcia drzwi pokoi ~0,008 m², drzwi łazienki/WC ≥ 0,022 m² (PN-83/B-03430 p. 2.1.4).</li>
  </ul>
  <div class="sig"><div>opracował(a)</div><div>sprawdził(a)</div></div>
  <p class="meta">Dokument wygenerowany w HVAC+ — narzędzie wspomagające. Wyniki podlegają weryfikacji przez projektanta z uprawnieniami; karty doboru urządzeń 21LAB są nadrzędne wobec wartości przybliżonych.</p>`;
  // ---- arkusze rysunkowe: aksonometrie 3D (A4 poziom) ----
  if(window.render3DImage&&state.floors.some(f=>f.segs.length||f.nodes.length)){
    const leg=`<div class="leg"><span><i style="background:#2D62BE"></i>nawiew</span><span><i style="background:#D12E4F"></i>wywiew</span><span><i style="background:#248964"></i>czerpnia</span><span><i style="background:#A57327"></i>wyrzutnia</span><span><i style="background:#4A4B50"></i>pion</span><span><i style="background:#2F3033"></i>centrala</span>${zoningOn()?`<span><b style="color:${ZONES[1].c}">S1</b> pokoje · <b style="color:${ZONES[2].c}">S2</b> salon</span>`:''}</div>`;
    const tb=(nr,tytul,opis)=>`<div class="tblock"><div><b>${esc(state.name||'Projekt wentylacji')}</b>${esc(opis)}</div><div><b>Rys. ${nr}</b>${esc(tytul)}</div><div><b>${today}</b>opracował(a): ${esc(state.author||'—')}</div><div><b>HVAC+ · 21LAB</b>rysunek poglądowy, bez skali</div></div>`;
    const sheet=(nr,tytul,opis,img)=>`<div class="sheet"><h2>Rys. ${nr}. ${esc(tytul)}</h2><img src="${img}">${leg}${tb(nr,tytul,opis)}</div>`;
    const img1=render3DImage(1600,1800,{theta:-35*Math.PI/180,elev:34*Math.PI/180,explode:1.2});
    const img2=render3DImage(1600,1800,{theta:145*Math.PI/180,elev:30*Math.PI/180,explode:1.2});
    let sheets=sheet(1,'Aksonometria instalacji wentylacji — widok od frontu','kondygnacje rozsunięte 1,2 m, przewody pod stropem; nawiew i wywiew na osobnych poziomach',img1)
              + sheet(2,'Aksonometria instalacji wentylacji — widok od tyłu','ten sam model obrócony o 180°',img2);
    if(state.floors.length>1){ const img3=render3DImage(1600,1800,{theta:0,elev:89*Math.PI/180,explode:0}); sheets+=sheet(3,'Rzut z góry — wszystkie kondygnacje','widok ortogonalny z góry (rzuty nałożone, wyrównanie po pionach)',img3); }
    document.getElementById('reportWrap').insertAdjacentHTML('beforeend',sheets);
  }
  window.print();
}

/* ============================ ZAPIS / ODCZYT / PODKŁAD ============================ */
document.getElementById('btnReport').addEventListener('click',()=>{ recalc(); buildReport(); });
document.getElementById('btnSave').addEventListener('click',()=>{
  state.name=document.getElementById('projName').value;
  const blob=new Blob([JSON.stringify(state)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download=(state.name||'projekt-hvac').replace(/[^\w\dąćęłńóśźż -]/gi,'')+'.hvacplus.json'; a.click();
});
document.getElementById('btnLoad').addEventListener('click',()=>document.getElementById('fileProj').click());
document.getElementById('fileProj').addEventListener('change',e=>{
  const file=e.target.files[0]; if(!file) return;
  const rd=new FileReader();
  rd.onload=()=>{ try{ state=JSON.parse(rd.result); state.activeFloor=0; sel=null; if(!state.zoning) state.zoning={on:false,dayZ1:40,nightZ2:30};
    document.getElementById('projName').value=state.name||''; refreshAll(); fitView(); }catch(err){ alert('Nieprawidłowy plik projektu.'); } };
  rd.readAsText(file); e.target.value='';
});
document.getElementById('btnNew').addEventListener('click',()=>{
  if(confirm('Rozpocząć nowy projekt? Niezapisane zmiany zostaną utracone.')){ state=freshState(); sel=null; document.getElementById('projName').value=''; refreshAll(); fitView(); }
});
document.getElementById('projName').addEventListener('change',e=>{ state.name=e.target.value; });
document.getElementById('btnDemo').addEventListener('click',()=>{ if(confirm('Wczytać projekt demonstracyjny? Niezapisane zmiany zostaną utracone.')) loadDemo(); });

document.getElementById('fileBg').addEventListener('change',e=>{
  const file=e.target.files[0]; if(!file) return; e.target.value='';
  handleBgFile(file);
});
async function handleBgFile(file){
  const f=F();
  if(!/^image\/|pdf$/i.test(file.type)&&!/\.(pdf|png|jpe?g|gif|webp|bmp)$/i.test(file.name)){
    alert('Obsługiwane formaty podkładu: PDF, PNG, JPG.'); return;
  }
  if(file.type==='application/pdf'||/\.pdf$/i.test(file.name)){
    if(window.__noPdf||!window.pdfjsLib){ alert('Obsługa PDF wymaga połączenia z internetem (biblioteka pdf.js). Wyeksportuj rzut jako PNG/JPG i wgraj obraz.'); return; }
    try{
      pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      const buf=await file.arrayBuffer();
      const pdf=await pdfjsLib.getDocument({data:buf}).promise;
      let pageNo=1;
      if(pdf.numPages>1){ pageNo=Math.min(pdf.numPages,Math.max(1,parseInt(prompt(`PDF ma ${pdf.numPages} stron. Którą wczytać?`,'1'))||1)); }
      const page=await pdf.getPage(pageNo);
      const vp=page.getViewport({scale:2});
      const c=document.createElement('canvas'); c.width=vp.width; c.height=vp.height;
      await page.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;
      snapshot(); f.bg=c.toDataURL('image/png'); f.bgW=c.width; f.bgH=c.height; f.pxPerM=0;
      delete bgCache[f.id]; refreshAll(); fitView(); toast('Podkład wczytany — teraz „Rozpoznaj pomieszczenia” (Automatyzacja) albo Kalibracja skali.');
    }catch(err){ alert('Nie udało się odczytać PDF: '+err.message); }
    return;
  }
  const rd=new FileReader();
  rd.onload=()=>{ snapshot(); f.bg=rd.result; f.pxPerM=0; delete bgCache[f.id]; refreshAll();
    const img=new Image(); img.onload=()=>{ f.bgW=img.naturalWidth; f.bgH=img.naturalHeight; fitView(); }; img.src=rd.result;
    toast('Podkład wczytany — teraz „Rozpoznaj pomieszczenia” (Automatyzacja) albo Kalibracja skali.'); };
  rd.readAsDataURL(file);
}

/* ---------- strefa wgrywania (drag & drop) ---------- */
function updateDropzone(){
  const f=F();
  const show=!f.bg&&!f.rooms.length&&!f.nodes.length;
  document.getElementById('dropzone').classList.toggle('show',show);
}
document.getElementById('dzInner').addEventListener('click',()=>document.getElementById('fileBg').click());
const cwrap=document.getElementById('canvaswrap');
['dragenter','dragover'].forEach(ev=>cwrap.addEventListener(ev,e=>{
  e.preventDefault(); e.stopPropagation(); cwrap.classList.add('dragover');
  if(!F().bg) document.getElementById('dropzone').classList.add('show');
}));
cwrap.addEventListener('dragleave',e=>{ if(e.target===cwrap){ cwrap.classList.remove('dragover'); updateDropzone(); } });
cwrap.addEventListener('drop',e=>{
  e.preventDefault(); e.stopPropagation(); cwrap.classList.remove('dragover');
  const file=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0];
  if(file) handleBgFile(file); else updateDropzone();
});

/* ============================ START ============================ */
resize(); setTool('select'); loadDemo();
setHint('Witaj w HVAC+. Wczytano projekt demonstracyjny (parter + poddasze) — obejrzyj go w zakładce „3D”. Własny projekt: „Nowy” → wgraj podkład, skalibruj skalę, obrysuj pomieszczenia.');
