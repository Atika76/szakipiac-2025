# szakipiac-weboldal
 Lakásfelújítás és szakik piactere


## KivitelezésPRO

Új oldal: `kivitelezes-pro.html` – teljes kivitelezési asszisztens szakágakkal, ütemezéssel, ellenőrzőlistával, alvállalkozó-kezeléssel, költségbecsléssel, JSON export/import funkcióval és PDF készítéssel.

Opcionális Supabase tábla: `supabase/kivitelezes_pro_schema.sql`.

## SzakiPiac 360

Az első 360 ütem új eszközközpontot, ingyenes és 360 jogosultsági alapot, napi Gemini-keretet, szolgáltatási igénykezelést, hirdetéskép-takarítást és pontos hirdetésre mutató Facebook-megosztást tartalmaz.

Adatbázis-beállítás: `supabase/szakipiac_360.sql`.

A jelenlegi böngészős PayPal-fizetés továbbra is működik. Az opcionális szerveroldali ellenőrzéshez később a `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` és `PAYPAL_ENV` Supabase secret adható meg; ezek hiányában a rendszer automatikusan a korábbi működő fizetési módot használja.
