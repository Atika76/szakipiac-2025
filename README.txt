SZAKIPIAC 2025 – HASZNÁLATI ÚTMUTATÓ

1. Fájlok:

- index.html ............. Főoldal, keresés, hirdetések listázása
- feltoltes.html ......... Hirdetés feltöltése, képek, csomagválasztás, fizetés
- admin.html ............. Admin jóváhagyás/törlés, csak admin emaillel
- auth.html .............. Regisztráció és bejelentkezés (Supabase Auth)
- kapcsolat.html .......... Kapcsolati adatok, űrlap
- rolunk.html ............. Bemutatkozó oldal
- header.js ............... Fejléc, menü, logó, reklámsáv minden oldalra
- supabase.js ............. Itt kell beírni a saját Supabase URL-t és kulcsot!
- style.css ............... Közös stílus, minden oldalra
- logo.png ................ Saját logó (cserélhető)
- reklam1.png ............. Saját reklámkép (cserélhető)

2. SUPABASE BEÁLLÍTÁS

A supabase.js fájlban a következő két sort kell kitölteni a saját projekted adataival:
const SUPABASE_URL = "https://...supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1...";

Ezt a Supabase > Settings > API menüben találod meg.

3. FONTOS!  
Minden fő .html oldalad <head> részébe be van téve:
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js"></script>
<script src="header.js"></script>
<script src="supabase.js"></script>
<link rel="stylesheet" href="style.css">

4. HOGYAN INDÍTSD EL?

- GitHub Pages-en, Netlify-on vagy bármilyen statikus tárhelyen, csak másold fel az összes fájlt egy mappába.
- Ha offline nézed, a Supabase-alapú funkciók csak akkor mennek, ha internet van, és jól beírtad a supabase.js-ben a saját adatokat.
- Ha bármilyen funkció (regisztráció, belépés, feltöltés, admin) nem működik, ellenőrizd:  
  – helyesek-e a Supabase adatok a supabase.js-ben  
  – minden oldalon betöltődik-e a supabase-js CDN  
  – a Supabase-ben engedélyezve van-e a táblák, Auth, Storage

5. Ha elakadsz:
- Küldd el a hibaüzenetet (lehetőleg angolul, konzolból), vagy kérj segítséget a fejlesztői közösségtől.
- Bármikor visszatérhetsz ehhez a README.txt-hez – minden lényeg benne van!

Jó használatot kíván:  
SzakiPiac fejlesztői asszisztens (ChatGPT)
