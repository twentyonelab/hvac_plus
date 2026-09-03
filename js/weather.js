/* =====================================================================
   HVAC+ planer — dane pogodowe z Open-Meteo (bez klucza, bez rejestracji)

   Moduł oddaje jeden odczyt zgodny z kontraktem WeatherReading. Zasady,
   których pilnuje (każda z nich wynika z konkretnego błędu):
     · brak pomiaru to null, nigdy zero,
     · pamięć podręczna 10 minut,
     · po błędzie nie ponawia od razu — odczekuje 60 s,
     · jedno zapytanie obsługuje wielu odbiorców (obietnica w locie),
     · przy błędzie oddaje ostatni znany odczyt (ma własny ts, więc widać wiek),
     · limit czasu na zapytanie (AbortSignal.timeout),
     · wyłącznik ruchu na zewnątrz (allowExternal).

   Aplikacja jest statyczna (GitHub Pages), więc nie ma serwera, na którym
   mógłby stanąć własny punkt GET /api/weather. Odpowiednikiem punktu API
   jest tutaj HvacWeather.read() — ta sama semantyka: oddaje WeatherReading
   albo null, gdzie null znaczy „nie ma pogody z żadnego źródła”.
   ===================================================================== */
(function(){
  'use strict';

  const API      = 'https://api.open-meteo.com/v1/forecast';
  const GEO      = 'https://geocoding-api.open-meteo.com/v1/search';
  const FIELDS   = 'temperature_2m,relative_humidity_2m,wind_speed_10m,cloud_cover,weather_code,shortwave_radiation';
  const TTL      = 10*60*1000;   // pamięć podręczna
  const COOLDOWN = 60*1000;      // przerwa po błędzie
  const TIMEOUT  = 8000;         // limit czasu zapytania
  const LS_KEY   = 'hvacplus.weather.last';

  /* kody pogody WMO — tylko te występujące w Polsce */
  const WMO = {
    0:'bezchmurnie', 1:'przejaśnienia', 2:'częściowe zachmurzenie', 3:'zachmurzenie',
    45:'mgła', 48:'mgła osadzająca szron',
    51:'mżawka', 53:'mżawka', 55:'silna mżawka', 56:'mżawka marznąca', 57:'silna mżawka marznąca',
    61:'słaby deszcz', 63:'deszcz', 65:'silny deszcz',
    66:'deszcz marznący', 67:'silny deszcz marznący',
    71:'słaby śnieg', 73:'śnieg', 75:'silny śnieg', 77:'śnieg ziarnisty',
    80:'przelotny deszcz', 81:'przelotny deszcz', 82:'ulewa',
    85:'przelotny śnieg', 86:'silny przelotny śnieg',
    95:'burza', 96:'burza z gradem', 99:'burza z gradem'
  };
  const wmoText = code => (typeof code==='number' && WMO[code]) ? WMO[code] : 'warunki nietypowe';

  /* brak pomiaru to null — zero jest poprawną temperaturą i poprawnym zachmurzeniem */
  const num = v => (typeof v==='number' && Number.isFinite(v)) ? v : null;

  const stored = readStored();
  const state = {
    allowExternal: true,
    reading: stored,         // ostatni znany odczyt
    fetchedAt: (stored&&stored.__fetchedAt)||0,
    errorAt: 0,
    inFlight: null,
    lastError: null,
    geo: new Map()
  };

  function readStored(){
    try{
      const raw=localStorage.getItem(LS_KEY); if(!raw) return null;
      const o=JSON.parse(raw);
      return (o && o.source==='open-meteo' && typeof o.ts==='string') ? o : null;
    }catch(e){ return null; }
  }
  function store(reading){
    try{ localStorage.setItem(LS_KEY, JSON.stringify({...reading, __fetchedAt:Date.now()})); }catch(e){}
  }

  async function getJSON(url){
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT), cache:'no-store' });
    if(!res.ok) throw new Error('HTTP '+res.status);
    return res.json();
  }

  /* geokodowanie adresu → współrzędne (dokładność 4 miejsc w zupełności wystarcza) */
  async function geocode(place){
    const key=String(place||'').trim().toLowerCase();
    if(!key) return null;
    if(state.geo.has(key)) return state.geo.get(key);
    const url=`${GEO}?name=${encodeURIComponent(place)}&count=1&language=pl&format=json`;
    const j=await getJSON(url);
    const r=(j&&j.results&&j.results[0])||null;
    const out = r ? {
      lat:+r.latitude.toFixed(4), lon:+r.longitude.toFixed(4),
      place:[r.name, r.admin1, r.country].filter(Boolean).join(', ')
    } : null;
    state.geo.set(key,out);
    return out;
  }

  function toReading(j, place){
    const c=(j&&j.current)||{};
    return {
      source:'open-meteo',
      ts: typeof c.time==='string' ? c.time : new Date().toISOString(),
      place: place||'—',
      tempC:        num(c.temperature_2m),
      humidity:     num(c.relative_humidity_2m),
      windKmh:      num(c.wind_speed_10m),
      radiationWm2: num(c.shortwave_radiation),
      cloudCover:   num(c.cloud_cover),
      text:         wmoText(num(c.weather_code))
    };
  }

  async function fetchReading(opts){
    let lat=num(opts.lat), lon=num(opts.lon), place=opts.place||'';
    if(lat==null||lon==null){
      const g=await geocode(place);
      if(!g) throw new Error('nie znaleziono miejsca: '+(place||'(brak)'));
      lat=g.lat; lon=g.lon; place=g.place;
    }
    const url=`${API}?latitude=${lat}&longitude=${lon}&current=${FIELDS}&timezone=Europe%2FWarsaw`;
    const j=await getJSON(url);
    return toReading(j, place || `${lat}, ${lon}`);
  }

  /**
   * Odpowiednik punktu GET /api/weather.
   * @param {{place?:string, lat?:number, lon?:number, force?:boolean}} opts
   * @returns {Promise<Object|null>} WeatherReading albo null
   */
  async function read(opts){
    opts=opts||{};
    const now=Date.now();

    if(!state.allowExternal) return state.reading;                       // wyłącznik ruchu
    if(!opts.force && state.reading && now-state.fetchedAt < TTL) return state.reading;   // pamięć podręczna
    if(!opts.force && now-state.errorAt < COOLDOWN) return state.reading;                 // przerwa po błędzie
    if(state.inFlight) return state.inFlight;                            // jedno zapytanie na wielu odbiorców

    state.inFlight = fetchReading(opts)
      .then(r=>{
        state.reading=r; state.fetchedAt=Date.now(); state.errorAt=0; state.lastError=null;
        store(r);
        return r;
      })
      .catch(err=>{
        state.errorAt=Date.now(); state.lastError=String(err&&err.message||err);
        return state.reading;      // przy błędzie oddaj ostatni znany odczyt, nie pustkę
      })
      .finally(()=>{ state.inFlight=null; });

    return state.inFlight;
  }

  /* wiek odczytu liczymy od chwili POBRANIA (ts ze źródła jest czasem lokalnym
     strefy Europe/Warsaw bez oznaczenia, więc w innej strefie mylił by wynik) */
  const ageMinutes = ()=> state.fetchedAt ? Math.round((Date.now()-state.fetchedAt)/60000) : null;

  window.HvacWeather = {
    read,
    wmoText,
    get last(){ return state.reading; },
    get lastError(){ return state.lastError; },
    get stale(){ return !state.reading || Date.now()-state.fetchedAt > TTL; },
    ageMinutes,
    get allowExternal(){ return state.allowExternal; },
    set allowExternal(v){ state.allowExternal=!!v; }
  };
})();
