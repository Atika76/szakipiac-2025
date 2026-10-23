# SzakiPiac PRO+ – forrásolt adattár és később frissíthető árlista

2026. október 23. Helyi munkaváltozat; nincs feltöltve az éles weboldalra.

## Mi készült el?

A meglévő alkalmazás kapott adatbővítést. Az eredeti 188 munkatétel, 22 szakág, 70 alapanyagrekord, 30 eredeti normahely és a korábbi forrásolt munkaváltozatok megmaradtak. A korábbi forrásolt adatok teljes tartalmának megőrzését JSON-alapú SHA-256 ellenőrzés is teszteli.

| Adat | Előtte | Most |
|---|---:|---:|
| Alap munkatételek | 188 | 188 |
| Külön forrásolt munkaváltozatok | 9 | 33 |
| Összes helyi munkatétel/változat | 197 | 221 |
| Anyag-/termékrekordok | 70 | 95 |
| Kitöltött, dokumentált normák | 6 | 15 |

Újonnan: 9 falazási változat és 15 anyagrecept, 25 termék-/anyagrekord. A falazási normák gyártói **számított** időnormák. A 6 korábbi szárazépítési norma 2013-as ÉVOSZ-forrásból származik. Egyiket sem állítjuk új helyszíni mérésnek vagy valamennyi munkakörülményre érvényes általános normának.

## Mit lehet kiválasztani?

- Porotherm 10, 25 és 30 N+F neo: hagyományos habarcsos, Rapid vékonyrétegű és Dryfix technológia külön-külön. Gyártói anyagigény és számított normaidő, m²-re. Rapidnál az első sor külön munkafolyamat; az általános falmező normájába nem rejtettünk további munkaórát.
- Cemix MP 501 I gépi és Premium kézi vakolat: külön 10 és 20 mm réteg.
- Renti javítóhabarcs: külön megnevezett 3 mm réteg.
- Nivobond és Nivo SP 0–20 aljzatkiegyenlítő: külön 3 és 5 mm réteg.
- Flex M burkolatragasztó: külön 3 és 6 mm **ragasztóréteg**, nem fogazatméret.
- StyroKleber Extra: EPS és ásványgyapot; a táblaragasztás és a hálóágyazás külön. Az EPS 4–5 kg/m² tartományából 5 kg/m² felső anyagbecslést használunk, ezt a megnevezés is jelzi.

A rétegreceptek nem teljes vakolási/burkolási/hőszigetelő rendszerek: alapozás, profilok, lapok, háló, dübel, csomópont stb. a megnevezés szerinti munkahatárokon túl külön tétel. A közölt gyártói anyagigény becslés, a tényleges alapfelület befolyásolja.

## Források és árak

Az egyedi számadatok saját összeállításban szerepelnek. Nem másoltunk TERC-adatbázist, teljes gyártói táblázatot, védjegyes kiírásokat vagy kiadványokat a programba. A forrásjegyzék URL-t, ellenőrzési napot és letöltési SHA-256-ot tartalmaz. A forrás nyilvánossága nem jelent korlátlan újraközlési jogot: további nagy adatátvételhez vagy rendszeres beszállítói feedhez külön felhasználási feltételek ellenőrzendők.

- [Porotherm nettó árjegyzék, 2026.04.01-től](https://www.wienerberger.hu/content/dam/wienerberger/hungary/marketing/documents-magazines/brochures/Porotherm_arjegyzek_297x210_2026_aprilis_1_tol_web.pdf): 6–7. PDF-oldal; az árban foglalt kötőanyag háromszögjelzését és lábjegyzetét képen is ellenőriztem.
- [Porotherm 10 neo adatlap](https://www.wienerberger.hu/content/dam/wienerberger/hungary/marketing/documents-magazines/technical/technical-product-info-sheet/wall/2025-adatlapok/PTH%2010%20N%2BF%20neo%2020250121%20term%C3%A9kadatlap.pdf), [25 neo](https://www.wienerberger.hu/content/dam/wienerberger/hungary/marketing/documents-magazines/technical/technical-product-info-sheet/wall/2025-adatlapok/PTH%2025%20N%2BF%20neo%2020250121%20term%C3%A9kadatlap.pdf), [30 neo](https://www.wienerberger.hu/content/dam/wienerberger/hungary/marketing/documents-magazines/technical/technical-product-info-sheet/wall/2025-adatlapok/PTH%2030%20N%2BF%20neo%2020250121%20term%C3%A9kadatlap.pdf): érvényesek 2025.01.21-től, ellenőrizve 2026.10.23-án. Az oszlopokat és egységeket képen is ellenőriztem.
- [Cemix nettó árjegyzék, 2026.10.01-től](https://www.cemix.hu/Pricelists,%20catalogues,%20SampleBooks,%20leaflets/Cemix_Arjegyzek_2026_okt.pdf): új árak a 4., 5., 11., 12. PDF-oldalról, képi ellenőrzéssel. A borító és a belső lapok eltérő dátumszövegét a belső lapok érvényességi lábjegyzete alapján kezeltük. A teljes forrásszöveg az anyagrekordban van.
- A Cemix-termékoldalak pontos linkje, a fajlagos és a választott vastagság minden receptben szerepel; a forrásleltár is tartalmazza.

Gyártói nettó listaárak, nem kötelező érvényű, helyszínre szállított kereskedői ajánlatok. Szállítás, raklap, kedvezmény, csomópont és szükséges járulékos munka ellenőrzendő.

**Csomagárvédelem:** a Rapid falazóelem listaára tartalmazza a norma szerinti kötőanyagot. A kötőanyagot ezért mennyiségileg kimutatjuk, de nem adjuk hozzá másodszor a listaárhoz. A 0 Ft itt külön felszámított költség, nem ingyenes önálló termékár. A tényleges csomagellátás, kiszerelési többlet vagy eltérő beszerzési ár még megerősítendő: ezek a kötőanyagrekordok szándékosan feltételes referenciák, ezért az ilyen sor nem válik automatikusan teljesnek jelölt ajánlattá. A flakonszám egészre felfelé kerekül.

## Hogyan frissíthető 2027-ben vagy 2028-ban?

1. Részletes mód → „Anyagárak és fajlagosok kötegelt betöltése”.
2. „Aktuális árlista CSV – későbbi frissítéshez”. A fájl a már ismert nettó árakat adja, forrással és dátummal. A hiányzó árakat nem tölti ki 0-val. A 0 költségű csomagösszetevőket a fenti feltétellel kell értelmezni.
3. Csak a változó árakat, árforrást és ellenőrzési/érvényességi dátumot módosítsd. Az azonosítót, nevet és mértékegységet ne változtasd. Termék-, kiszerelés- vagy technológiacsere új, külön anyag-/munkaváltozatot igényel.
4. Ugyanott olvasd vissza a CSV-t. A program ellenőrzi az adatokat; a megváltozott ár nem örökölheti észrevétlenül ugyanazt a régi forrást és dátumot.
5. Mentsd a projektet JSON-ban vagy a meglévő felhőmentéssel. Új munkasor az új árból készül, a korábbi sorok az eredeti árukkal maradnak meg. A változatlan CSV-sorok ellenőrzött eredetjelölése is megmarad.

Az árlista a **projekt saját katalógusát** frissíti. Másik projekthez a meglévő katalógus-JSON export/import használható. Ez nem központi, minden felhasználóra azonnal kiterjedő adatbázis-frissítés. 2027/2028 valódi árait most nem állítjuk elő; az automatizált teszt jövőbeli árai kizárólag mesterséges tesztadatok.

Az anyagrecept fajlagosai az árlista frissítésekor változatlanok. Nem számítjuk fel kétszer a tartalékot vagy az óradíjban már szereplő rezsit.

## Milyen hiány maradt?

- 221 munkatételből/változatból 206-hoz nincs pontosan hozzárendelhető, igazolt normaidő. A listát a `hianyzo-normak.csv` adja.
- 95 anyag-/termékrekordból 53 ára hiányzik; `hianyzo-anyagarak.csv`. A hagyományos falazás pontosan megfelelő habarcsának ára is megadandó.
- 28 pozitív nettó ár forrásellenőrzött gyártói listaár, 8 korábbi pozitív ár feltételes beszállítói referencia, 6 rekord csomagban foglalt külön költségreferencia.
- 62 katalógusrekordnak nincs egyetlen univerzális fajlagosa. Ebben 7 új, több rétegben újrahasznált termék is van: ezek fajlagosát a külön, vastagsághoz kötött munkarecept tartalmazza. Ezért ez a szám nem jelenti azt, hogy a 15 új rétegrecept anyagigénye hiányzik.
- Vasalás, tartófa, csomópont és egyedi mennyiség továbbra is tervből/felmérésből adandó meg. A gyártói kötési vagy bedolgozhatósági időt nem tekintjük munkanormának. A vállalkozói munkadíjlistából nem számoltunk vissza hitelesnek állított normát.

Ez egy ténylegesen beépített első adatfeltöltési csomag, nem teljes, minden szakágra hiánytalan kulcsrakész adatbázis.

## Ellenőrzések

- **210/210 Node-teszt** sikeres. A teljes korábbi 193 teszt is futott; 17 új teszt ellenőrzi az adatbővítést, eredeti katalógusok megőrzését, éves árfrissítést és a mentett ár-/normapillanatképeket.
- Hat böngészős tesztprogram sikeres: `sourced-catalog-browser.cjs`, `quickquote-browser.cjs`, `norm-binding-browser.cjs`, `catalog-fixes-browser.cjs`, `building-import-browser.cjs`, `resources-export-browser.cjs`; 1440 és 390 px szélességen.
- A valódi kalkulátor HTML/JS felülete futott helyi HTTP-n. A bejelentkezés és a felhőmentés szintetikus SDK-válaszokat kapott; az éles Supabase-hívások tiltva voltak. **Ez nem új hosted vagy éles adatbázisteszt.**
- Számítás, csomagár, rendelési kerekítés, tartalék egyszeri alkalmazása, normabázis, hiányzó adatok, árlistaexport/import, hibás import változatlan állapota, korábbi normál ajánlat, JSON-/CSV-/PDF-export és mentés–visszatöltés ellenőrizve.
- A tartós renderhibás katalógus- és teljes ajánlatimport negatív kontrolljai is futottak. A régi hibát reprodukáló kontrollok szándékosan hibás régi kódot használnak; sikerük azt jelenti, hogy a teszt felismerte a régi hibát és igazolta a javított kód állapotvédelmét.
- A korábbi böngészős teszt egyik URL-ellenőrzése nem vette figyelembe a PDF-tördeléshez már korábban beillesztett láthatatlan töréspontokat. Csak a tesztet igazítottam ehhez; az URL eredeti bájtjai JSON/CSV-ben változatlanok. A régi katalógushibák negatív kontrolljához hiányzó fixture az eredeti ellenőrzött forrásból, egyező SHA-256-tal visszakerült a tesztek mellé.
- A négy szakágas, valódi 2026-os adatokkal készített példát külön exportáltuk, a mesterséges 2027-es tesztártól elválasztva. Desktop és mobil PDF 6–6 oldal, mind a 12 oldal renderelve és áttekintve; a megvizsgált mintában nincs levágott adat. A PDF továbbra is képalapú, szövege nem kereshető, a hosszú forráshivatkozások terjedelmessé teszik. A PDF-motort ebben a feladatban nem írtam át.
- Új SQL-migráció, RLS- vagy Edge Function-módosítás nincs; a korábbi izolált SQL-teszteket nem futtattam újra. A SzakiPiac főoldala, keresője, hirdetési/profil-/üzenetkódja és az Építési Napló forrása nem változott.

## Megváltozott programfájlok

- `epulet-forrasolt-adatok.js`: az adatbővítés és források.
- `epulet-adatfeltoltes.js`: aktuális árlista exportja, változatlan árak eredetének megőrzése, elavult árforrás átvitelének védelme.
- `epulet-koltsegvetes.js`: új árlista-letöltő gomb és a használati szövegek.
- `service-worker.js`: helyi kiadás gyorsítótár-verziója; egy későbbi kiadáskor az új fájlok betöltéséhez.
- Tesztek, két teszt-fixture és a jelen dokumentáció/adatleltár.

A változtatás alapja: `196847470203eacb8f3f08c7633f918ff3931596`. Külön helyi ág: `feat/proplus-sourced-catalog-20261023`. **Nincs push, merge vagy deploy, nincs éles adatbázis-módosítás.** PR #9 és Napló PR #1 változatlan.

## Független ellenőrzéshez

A ZIP-ben a teljes forrás a `forras` mappában, a bizonyítékok az `ellenorzes`, az ügyféladatot nem tartalmazó szemléltető minta a `mintak` mappában található. Node 24 alatt, a forrásmappában: `node --test tests/*.test.cjs`. A böngészős tesztekhez Playwright és Chrome, valamint a forrásmappát a 127.0.0.1:5588 címen kiszolgáló helyi HTTP-szerver kell; az SDK-válaszokat a tesztek maguk helyettesítik.

Ezt másolhatod a ChatGPT-nek a ZIP mellé:

> Ellenőrizd a mellékelt SzakiPiac PRO+ forrásolt adattár-bővítést. A 188 alap munkatétel megmaradt, 24 külön munkaváltozat és 25 anyagrekord került hozzá; 9 új gyártói számított normával. Futtasd újra a 210 Node-tesztet. Vesd össze a normákat, rétegvastagságokat, mértékegységeket és nettó árakat a csomagban hivatkozott elsődleges forrásokkal. Külön ellenőrizd a Rapid kötőanyag csomagárát, a kerekítést, a hiányos ajánlat jelölését, a CSV árfrissítés atomikusságát és a korábbi ár-/normapillanatképek megőrzését. A 2027/2028-as ártesztek mesterségesek; a szemléltető 2026-os minta külön van. A böngészőtesztek helyi, mock-SDK-s tesztek, nem hosted bizonyítékok. Ne tekintsd teljes házra hiánytalan vagy élesített adatbázisnak.
