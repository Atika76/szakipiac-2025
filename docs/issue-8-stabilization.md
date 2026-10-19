# Issue #8 – stabilizálási változtatások

Feladat és független ellenőrzési megjegyzés: https://github.com/Atika76/szakipiac-2025/issues/8#issuecomment-6252069288

Alap: `af89b7760555c989d6e5d1f116b4ebf759cf7ac9`. Fejlesztési ág: `codex/issue-8-stabilization`.

## Mi változik?

- A KivitelezésPRO mentési kontextusa külön azonosítót és revíziót tart. A szerver elsőre INSERT-et, utána UPDATE-et végez; az elavult revíziót elutasítja. A betöltés, helyi mentés, új projekt, JSON-import és késve visszaérkező mentés külön kezelve.
- Az eredeti ajánlatrekord az ajánlatverzió stabil azonosítója. Az elküldött/lezárt ajánlat tartalma rögzített; módosításhoz az eddigi másolatgomb új, szülőhöz kötött piszkozatot indít. Az elfogadott ajánlat közvetlen törlése is tiltott.
- Az ügyféllink új megosztáskor snapshotot kap. Megosztás, megtekintés és döntés az ajánlatot, majd a linket zárolja ugyanabban a sorrendben. A kliens nem módosíthat elfogadási tényt.
- A KivitelezésPRO kapcsolt ajánlatot választhat. Az átadó mindkét úton a tényleges, elfogadott ajánlatot olvassa; az előkészítés csak phases/subs/checks kiegészítés. A Naplóban ugyanaz az ajánlatverzió az egyszeri indítás kulcsa.
- Az alkalmazásközi átadás TLS-en, a meglévő szerveroldali importtitokkal hitelesített. A v2 üzenet tulajdonosi e-mailt és elfogadási időt tartalmaz; ezeket a szerver olvassa, nem a böngésző adja meg.

## Adatbázis és migráció

Migrációk: `supabase/migrations/202610180001_quote_workflow_stabilization.sql` és az elveszett válaszok biztonságos újrapróbálását javító `202610180002_project_save_retry.sql`. Az eredeti 001 változat változatlan.

Előfeltétel: a meglévő `ajanlatok`, `ajanlat_megosztasok`, `kivitelezes_projektek` sémák és a pgcrypto kiterjesztés. A migráció újrafuttatható, nem töröl üzleti rekordot, nem írja át a történeti elfogadásokat. Új mezők: ajánlat szülőverzió, megosztási snapshot, kivitelezési ajánlatkapcsolat és revízió.

A jelenlegi éles RLS-leltár alapján hiányzó UPDATE policy külön hozzáadásra kerül. Nem cseréljük le a meglévő SELECT/INSERT/DELETE policy-kat. A tartalomzár és a tulajdonosi védelem adatbázis-trigger, a KivitelezésPRO mentése explicit jogosultságot ellenőrző RPC.

## Telepítés védelme és sorrendje

Az első fejlesztési push commitja `d27ae5c`: már kizárta az automatikus éles telepítést. Sem az első push, sem a tesztek nem indítottak production deploy-t.

A Pages main-pushra automatikus; kézi indításkor main és explicit megerősítés szükséges. Fejlesztési ágról nem publikálhat. Ez a main automatikus megjelenését helyreállítja, mainre ebben a munkában nem került commit.

A backend workflow csak a két issue-8 migrációt és a `send-quote-to-epitesnaplo` függvényt érinti. Külön `migrate` és `functions` kézi fázis van; main és `DEPLOY_PRODUCTION` szükséges. A tulajdonosi jóváhagyást ez nem helyettesíti. Az árkatalógus, PayPal, AI és egyéb sémák/funkciók nem részei ennek a telepítésnek.

A két valódi, elkülönített Supabase-stackkel végzett integráció sikeres; az éles Napló-séma/konfiguráció 403 miatti leltára továbbra is blokkoló. Jóváhagyott sorrend:

1. Mindkét PR független ellenőrzése; hosted séma/RLS/konfiguráció összevetése, mentés és tulajdonosi jóváhagyás.
2. Mindkét repo `migrate` fázisa: csak a saját 001 és 002 migrációk, más SQL nélkül.
3. Napló `functions` fázis: kizárólag `create-szakipiac-import`, `claim-szakipiac-import`.
4. SzakiPiac `functions` fázis: kizárólag `send-quote-to-epitesnaplo`.
5. Jóváhagyott mainre összevonás/publikálás és ellenőrzés. A main frontend-commitját csak a kompatibilis backend után szabad engedni, mivel a Pages automatikusan publikál.

Ha a backend-workflow-k mainre emelése megelőzi az alkalmazáskódot, az is csak külön tulajdonosi jóváhagyással történhet. E feladatban egyik lépést sem indítottuk el. Verzióeltéréskor az import megáll; nincs elfogadást megkerülő visszaesési út.

## Második ellenőrzés javításai

A kliens a bizonytalan mentési kérést megőrzi, és mentés előtt visszaigazoltatja. A 002 migráció a saved_at nélküli teljes üzleti tartalmat hasonlítja; a tételek, összegek, ügyfél, helyszín vagy ajánlatkapcsolat eltérését nem kezeli puszta ismétlésként. A recovery a közben írt másik revíziót sem írhatja felül. Az elfogadott ajánlat új ügyféllink-gombja letiltott; új változat az eddigi másolatgombbal készül.

## Visszaállítás

Hiba esetén először az új importindítás leállítása. Az ajánlatvédő adatbázis-szabályokat, verziókapcsolatokat és importnyilvántartást meg kell tartani; nincs automatikus DROP, adattörlés vagy a korábbi elfogadás nélküli út visszakapcsolása. A frontend visszaállítható egy ellenőrzött kompatibilis változatra, az indítás tiltásával. Backendvisszaállítás előtt külön kompatibilitási felülvizsgálat szükséges.

## Hatókör

A hirdetéskezelés, profil, Munkafigyelő, csomagok, fizetések, energiaeszközök, fejléc és általános CSS üzleti kódja nem változott. Az ÉpítésNapló napi projektoldala, fotói, videói és riportjai sem változnak.

Páros változtatás: https://github.com/Atika76/Epites-Naplo/tree/codex/issue-8-stabilization

Részletes eredmények és blokkoló élesítési feltételek: [tesztjelentés](issue-8-test-report.md).
