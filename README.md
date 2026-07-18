# szakipiac-weboldal
 Lakásfelújítás és szakik piactere


## KivitelezésPRO

Új oldal: `kivitelezes-pro.html` – teljes kivitelezési asszisztens szakágakkal, ütemezéssel, ellenőrzőlistával, alvállalkozó-kezeléssel, költségbecsléssel, JSON export/import funkcióval és PDF készítéssel.

Opcionális Supabase tábla: `supabase/kivitelezes_pro_schema.sql`.

## SzakiPiac 360

Az eszközközpont három hozzáférést kezel: örök ingyenes csomag, 360 Alap (1 990 Ft / 30 nap) és 360 PRO (4 990 Ft / 30 nap). A csomagokhoz külön Gemini- és mentési keret tartozik; a profitkalkulátor, a dokumentumkészítő és a KivitelezésPRO a PRO része.

Adatbázis-beállítás: `supabase/szakipiac_360.sql`.

A Prémium és Extra hirdetés meglévő fizetése változatlan marad. A PayPal JavaScript SDK az alkalmas vásárlóknál PayPal- és bankkártyás lehetőséget is megjelenít. A 360 csomag automatikus és biztonságos aktiválásához a `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` és `PAYPAL_ENV` Supabase secret szükséges; a böngésző soha nem kapja meg a titkos kulcsot.
