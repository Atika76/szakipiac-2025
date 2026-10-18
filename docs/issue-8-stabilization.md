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

Új migráció: `supabase/migrations/202610180001_quote_workflow_stabilization.sql`.

Előfeltétel: a meglévő `ajanlatok`, `ajanlat_megosztasok`, `kivitelezes_projektek` sémák és a pgcrypto kiterjesztés. A migráció újrafuttatható, nem töröl üzleti rekordot, nem írja át a történeti elfogadásokat. Új mezők: ajánlat szülőverzió, megosztási snapshot, kivitelezési ajánlatkapcsolat és revízió.

A jelenlegi éles RLS-leltár alapján hiányzó UPDATE policy külön hozzáadásra kerül. Nem cseréljük le a meglévő SELECT/INSERT/DELETE policy-kat. A tartalomzár és a tulajdonosi védelem adatbázis-trigger, a KivitelezésPRO mentése explicit jogosultságot ellenőrző RPC.

## Telepítés védelme és sorrendje

Az első fejlesztési push commitja `d27ae5c`: már kizárta az automatikus éles telepítést. Sem az első push, sem a tesztek nem indítottak production deploy-t.

A Pages és backend workflow-k most csak manuálisan, mainről, `DEPLOY_PRODUCTION` bemenettel futhatnak. Ezt senki nem indította el. A tulajdonosi engedélyt a bemenet nem helyettesíti. A backend workflow a korábbi alapdefiníciók után újra alkalmazza a stabilizáló migrációt, így későbbi jóváhagyott futás sem telepít vissza régi, kevésbé védett ajánlatfüggvényeket.

Élesítés csak a két PR ellenőrzése, az ÉpítésNapló tényleges séma/RLS előellenőrzése és staging próba után:

1. Tulajdonos által jóváhagyott mentés/karbantartási időablak, aktuális main és séma ismételt leltára.
2. Mindkét új migráció telepítése, még a frontend változtatása előtt.
3. ÉpítésNapló v2 fogadó- és claim-függvények telepítése.
4. SzakiPiac v2 átadó telepítése.
5. Frontendek publikálása és jóváhagyott ellenőrzés.

Verzióeltéréskor az import hibával megáll; nincs elfogadás nélküli visszaesési út. A manuális régi workflow-k más meglévő backend-funkciókat is telepítenek, ezért indításuk előtt a teljes lépéssort át kell nézni; a fenti célzott sorrendhez jóváhagyott, célzott telepítés ajánlott.

## Visszaállítás

Hiba esetén először az új importindítás leállítása. Az ajánlatvédő adatbázis-szabályokat, verziókapcsolatokat és importnyilvántartást meg kell tartani; nincs automatikus DROP, adattörlés vagy a korábbi elfogadás nélküli út visszakapcsolása. A frontend visszaállítható egy ellenőrzött kompatibilis változatra, az indítás tiltásával. Backendvisszaállítás előtt külön kompatibilitási felülvizsgálat szükséges.

## Hatókör

A hirdetéskezelés, profil, Munkafigyelő, csomagok, fizetések, energiaeszközök, fejléc és általános CSS üzleti kódja nem változott. Az ÉpítésNapló napi projektoldala, fotói, videói és riportjai sem változnak.

Páros változtatás: https://github.com/Atika76/Epites-Naplo/tree/codex/issue-8-stabilization

Részletes eredmények és blokkoló élesítési feltételek: [tesztjelentés](issue-8-test-report.md).
