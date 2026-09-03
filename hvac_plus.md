# HVAC+ planer™

Aplikacja webowa 21 zmysłów do projektowania wentylacji mechanicznej z odzyskiem ciepła w domach jednorodzinnych (asortyment 21LAB). Działa w przeglądarce, bez backendu i bez kroku budowania.

**Wersja online (GitHub Pages):** https://twentyonelab.github.io/hvac_plus/

## Co robi

1. Podkład: wgranie rzutu (PDF / PNG / JPG), zmiana rozmiaru podkładu („Popraw"), kalibracja skali.
2. Pomieszczenia: prostokąt z dwóch narożników albo nieregularny obrys punkt po punkcie, rozpoznawanie automatyczne z rysunku (maska ścian + OCR), edycja obrysu po zaznaczeniu (uchwyty wierzchołków, wymiary liczbowe, przeciągnięcie wnętrza przesuwa całe pomieszczenie bez zmiany kształtu), mieszkańcy na rzucie.
3. Urządzenia i sieć: centrala, rozdzielacze, anemostaty, czerpnia, wyrzutnia, piony, kanały spiro i przewody FLX. Urządzenia wstawia się **przeciągnięciem karty** z szyny narzędzi na rzut albo kliknięciem karty i kliknięciem na rzucie.
4. Obliczenia: bilans powietrza (PN-83/B-03430, WT §147–155), strefy dzień/noc, wymiarowanie przewodów, spręż, dobór centrali HRU, zestawienie materiałów, lista kontrolna zgodności.
5. Widok 3D (aksonometria), symulator sterowania (Modbus / GATE) z pogodą z Open-Meteo jako warunkami zewnętrznymi, raport do wydruku z arkuszami rysunkowymi.
6. Symulacja doby: przewijanie po wykresie (kursor zawsze stoi na danych), tempo od ×60 do ×2400, ikona dnia/nocy, pogoda z Open-Meteo jako poziom temperatury zewnętrznej (bez odczytu — przykładowy przebieg doby, wyraźnie opisany), profil obłożenia, przykładowe CO₂ w pomieszczeniach, moc grzania powietrza, temperatura nawiewu i oszczędność z odzysku; rysunek jest szary i ciemnieje na noc, a mieszkańcy pojawiają się i znikają zgodnie z obłożeniem.
7. Przyciąganie (snap) przy rysowaniu, edycji i przesuwaniu pomieszczeń: narożniki i linie już wstawionych obrysów, ze znacznikiem pod kursorem.
8. Styl wyświetlania („oczko”): wyróżnienie jednej warstwy — tylko kanały, tylko urządzenia, tylko pomieszczenia, tylko CO₂ — reszta rysunku szara i przy 20% krycia. Działa identycznie w 2D i 3D. „Tylko CO₂” bez danych CO₂ zostawia cały rysunek szary; dane dają symulacja doby albo podłączone sterowanie.

## Struktura

```
index.html            szkielet aplikacji (pasek górny, szyna narzędzi, scena, panel prawy)
css/app.css           tokeny i komponenty 21 Apps Design System + skórki paneli silnika
js/engine-core.js     dane normowe, stan, canvas 2D, obliczenia, panele, automatyka, raport
js/engine-3d.js       aksonometria instalacji
js/engine-ctrl.js     wirtualne sterowanie centralą (cyfrowy bliźniak)
js/ui.js              nakładka UI: zwijane grupy narzędzi, pigułki kondygnacji, KPI, tytuł sceny
js/dnd.js             przeciąganie kart urządzeń na rzut (Pointer Events, podgląd na canvasie)
js/weather.js         dane pogodowe z Open-Meteo (kontrakt WeatherReading, cache, backoff)
js/sim.js             symulacja doby: pogoda, pora dnia, obłożenie, energia i odzysk
assets/fonts          Outfit (variable, latin + latin-ext)
assets/icons          ikony Lucide z systemu 21 Apps
assets/logo-21zmyslow.svg, assets/sygnet-21zmyslow.svg   logo firmowe
.github/workflows/pages.yml   publikacja na GitHub Pages przy każdym pushu
```

## Design

Warstwa wizualna przeniesiona z **21 Apps Smart Home Dashboard**: Outfit, białe karty na jasnoszarym tle, kontrolki-pigułki, akcent mint (stan wybrany), lavender (tryb 3D), lime i rose (statusy). Układ: pasek górny z logo i akcjami, lewa szyna zwijanych grup narzędzi, scena z tytułem kondygnacji i przełącznikiem pięter (jak w referencji), prawy panel z KPI, zakładkami i właściwościami zaznaczenia.

## Kolory

Instalacja ma jedną paletę wspólną dla rzutu 2D, widoku 3D i wydruku: nawiew `#2D62BE`, wywiew `#D12E4F`, czerpnia `#248964`, wyrzutnia `#A57327`, strefy S1 `#6946B9` / S2 `#65762D`, mieszkaniec `#7B5CC1`, centrala i piony w szarościach ink. Zachowana jest konwencja rysunku technicznego (nawiew chłodny, wywiew ciepły), ale odcienie mają hue i nasycenie z systemu 21 Apps (mint, lavender, lime, rose), więc rysunek i interfejs są z jednego świata. Wszystkie mają kontrast ≥ 3,5:1 na tle roboczym i ≥ 4:1 dla białego opisu na symbolu. Zaznaczenie to mint-300 z systemu.

Instalacja w widoku 3D ma dokładnie tę samą paletę co rzut 2D: tinty podłóg pochodzą z jednej funkcji `roomFillTint(role)`, kolory przewodów z tych samych stałych, mieszkańcy z tej samej ciemnej szarości.

Legenda oznaczeń jest przyciskiem w prawym dolnym rogu obszaru roboczego — działa w 2D i 3D, po otwarciu aplikacji jest zwinięta. Obok niej, po lewej, siedzi pasek stanu (współrzędne, skala, zaznaczenie).

## Układ obszaru roboczego

Sterowanie rysunkiem siedzi na samym rysunku, podzielone według pytania „co robię" kontra „jak patrzę":

- **Lewa góra — praca z rysunkiem:** przełącznik 2D / 3D, widok i kamera (izometria, z góry, z przodu, z boku, dopasuj, eksport PNG), warstwy (rzutu albo modelu), narzędzia wskazywania (wybierz / edytuj, przesuń), edycja (cofnij, przywróć, usuń).
- **Prawa góra — jak patrzę:** zoom i dopasowanie, a pod lupą ustawienia widoku 3D (obrót, nachylenie, rozsunięcie kondygnacji).
- **Lewy dolny róg:** przycisk „Symulacja” i pod nim kafelek pogody — zawsze widoczne, przy otwartej symulacji przesuwają się nad jej arkusz.
- **Prawy dolny róg:** pasek stanu i legenda w jednym wierszu; na środku podpowiedź, która sama gaśnie po kilku sekundach.

Lewa szyna zostaje tym, czym powinna być — katalogiem tego, co wstawiamy w projekt: podkład, pomieszczenia, automatyzacja, urządzenia (karty do przeciągania), przewody. Panel prawy to wyłącznie dane projektu i obliczenia; zakładka „3D" zniknęła, bo ustawienia widoku należą do widoku.

## Pogoda (Open-Meteo)

Moduł `js/weather.js` pobiera bieżące warunki z Open-Meteo (bez klucza i rejestracji) i oddaje jeden odczyt zgodny z kontraktem `WeatherReading`. Pilnuje: brak pomiaru to `null` (nigdy zero), pamięć podręczna 10 minut, przerwa 60 s po błędzie, jedna obietnica w locie na wielu odbiorców, przy błędzie zwrot ostatniego znanego odczytu, limit czasu przez `AbortSignal.timeout`, wyłącznik `allowExternal`. Współrzędne pochodzą z geokodowania nazwy miejsca (Open-Meteo Geocoding), zaokrąglone do czterech miejsc.

**Odstępstwo od specyfikacji:** aplikacja jest statyczna (GitHub Pages), więc nie ma serwera, na którym mógłby stanąć punkt `GET /api/weather`. Odpowiednikiem jest `HvacWeather.read()` z tą samą semantyką — zwraca `WeatherReading` albo `null`, gdzie `null` znaczy „nie ma pogody z żadnego źródła". Postawienie prawdziwego punktu API wymagałoby backendu (np. funkcji brzegowej) — do zrobienia, gdy aplikacja dostanie serwer.

## Decyzje architektoniczne

- **Silnik obliczeniowy bez zmian funkcjonalnych.** Skórka i układ są nowe, logika i format pliku projektu (`*.hvacplus.json`) pozostają zgodne z poprzednią wersją HVAC+ ALNOR.
- **Vanilla JS, brak bundlera.** Jeden `index.html` + trzy skrypty silnika + `ui.js`. Łatwe hostowanie na Pages, zero zależności poza pdf.js z CDN (tylko do podkładów PDF).
- **Drag & drop bez frameworka.** Pointer Events plus podgląd rysowany wprost na canvasie (podświetlone pomieszczenie, pierścień celu, symbol elementu). React nic tu nie wnosi — stan przeciągania to jeden obiekt, a rysunek i tak jest imperatywny (canvas), więc warstwa wirtualnego DOM byłaby kosztem bez korzyści.
- **Jedna ścieżka wstawiania elementu.** `placeNodeAt(type, punkt)` w silniku obsługuje i kliknięcie narzędziem, i upuszczenie karty. Reguły (numer pionu, przypisanie do pomieszczenia, ostrzeżenia) nie mogą się rozjechać między trybami.
- **Cofnij / przywróć na jednym stosie.** `snapshot()` czyści stos „przywróć", `undo()` i `redo()` przerzucają stany między stosami. Każda zmiana na planie przechodzi przez `snapshot()`, więc historia obejmuje też przeciągnięte karty i automatykę.
- **Obrót 3D wokół środka bryły.** `v3Orbit()` zmienia kąty i koryguje przesunięcie tak, by środek modelu został w tym samym punkcie ekranu — bryła nie ucieka poza kadr przy obracaniu.
- **Zmiana rozmiaru podkładu wypala się w obrazie.** Suwak daje podgląd (`bgPrevK` tylko przy rysowaniu), a „Zastosuj" przerysowuje podkład do nowego rozmiaru i zapisuje jako obraz. Dzięki temu rozpoznawanie pomieszczeń, maska ścian i widok 3D pracują na realnych pikselach i nie wymagają własnej transformacji. Skala rysunku (px/m) nie zmienia się — obrysy i instalacja zostają na miejscu, żeby dało się dopasować podkład do nich.
- **Nakładki na rysunku nie przechwytują kliknięć.** Kontenery mają `pointer-events:none`, tylko same kontrolki je łapią; `fitView()` zostawia marginesy pod nakładki, żeby rysunek nie chował się pod przyciskami.
- **Pełny ekran panelu to dokument, nie okno.** W `#side.fs` panel przechodzi w `display:block` z własnym przewijaniem, a cała treść dostaje jedną wyśrodkowaną miarę (`--fs-measure: 1280px`): nagłówek i zakładki są przyklejone u góry, tabele mają pełną szerokość kolumny, a lista układa się w dwie kolumny (`column-width: 560px`). Wysokość `auto` jest tu warunkiem poprawności — przy sztywnej wysokości układ wielokolumnowy uciekał w bok i część zestawienia przestawała być dostępna.
- **Panel projektu przypięty do prawej krawędzi.** `#side` jest `position:fixed`, a `#main` ma margines równy jego szerokości. Dzięki temu pełny ekran to animacja jednej wartości (`width: 392px → 100vw`), a nie przeliczanie układu — panel płynnie wyjeżdża w lewo i przykrywa rysunek. W pełnym ekranie treść panelu układa się w kolumny (`column-width: 360px`).
- **Model symulacji jest jawny i prosty.** Moc grzania powietrza to `V·ρ·cp·ΔT` przed odzyskiem i `·(1−η)` po nim, temperatura nawiewu `t_zewn + η(t_wewn − t_zewn)`, poniżej −3 °C sprawność spada o 18% (odszranianie), wentylatory liczone ryczałtem 0,35 W na m³/h. Profil doby: noc 60% nominału, dom pusty 45%, gotowanie 120%. CO₂ z bilansu ustalonego: 430 ppm tła plus `20 l/h` na osobę podzielone przez bieżący strumień pomieszczenia. Pogoda bez odczytu z Open-Meteo jest przykładowa (temperatura, zachmurzenie, wiatr, nasłonecznienie z pory dnia) i tak podpisana w kafelku. To ma pokazywać zależności, nie zastępować obliczeń projektowych — i tak jest opisane w interfejsie.
- **Opisy CO₂ tylko tam, gdzie CO₂ jest tematem.** Barwa i podpis stężenia pojawiają się przy podłączonym sterowaniu albo w stylu wyświetlania „tylko CO₂”. W tym stylu symulacja zdejmuje szarość rysunku, bo barwy stężenia są wtedy całą treścią obrazu.
- **Wyróżnianie warstw jako stan rysowania, nie druga scena.** `focusStart(ctx, grupa)` / `focusEnd(ctx)` owijają pętle rysujące (pomieszczenia, przewody, urządzenia) w 2D i 3D; przygaszenie to `globalAlpha 0.2` plus `filter: grayscale(1)`. Jedna definicja `FOCUS_KEEP` rządzi obydwoma widokami, więc nie mogą się rozjechać.
- **Opisy na rzucie nie nachodzą na siebie.** Każda klatka rysunku ma rejestr zajętych prostokątów (`lblRects`): najpierw miejsce rezerwują symbole urządzeń, potem opisy pomieszczeń, na końcu opisy przewodów i anemostatów — te odsuwają się o wysokość wiersza albo znikają, gdy nie ma miejsca. Opis pomieszczenia dodatkowo dopasowuje się do jego szerokości: jedna linia → kilka linii → sama nazwa → sam numer, z łagodnym pomniejszeniem. Opis pomieszczenia nigdy nie znika.
- **Kafelek pogody jest zawsze na rysunku.** Bez odczytu zaprasza do podania lokalizacji (klik otwiera zakładkę „Sterowanie"), z odczytem pokazuje temperaturę i warunki; przy otwartej symulacji przesuwa się nad panel osi czasu.
- **Kolory rysunku to warstwa semantyczna, nie dekoracja.** Zmiana palety = zmiana wartości w jednym miejscu (zmienne CSS + stałe silnika), a nie przy każdym `fillStyle`.
- **UI podmienia globalne funkcje renderujące** (`renderFloorbar`, `refreshAll`, `setTool`) zamiast edytować silnik. Aktualizacja silnika = podmiana plików `engine-*.js`.

## Publikacja (GitHub Pages)

Workflow `.github/workflows/pages.yml` buduje i publikuje stronę przy każdym pushu na `main` lub `claude/**`.
Jednorazowo trzeba włączyć Pages w repozytorium: **Settings → Pages → Build and deployment → Source: „GitHub Actions”**, a potem uruchomić ponownie ostatni workflow (Actions → Re-run) albo wypchnąć dowolny commit.

## Rozwój lokalny

```
python3 -m http.server 8080
# → http://localhost:8080
```

## Uruchomienie

Otwórz `index.html` przez serwer HTTP (fonty i pdf.js) lub użyj wersji online.
