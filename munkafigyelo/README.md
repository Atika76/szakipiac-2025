# SzakiLead Pro

Professzionális, mobilbarát szakmunka-hirdetési és munkafigyelő rendszer.

## Fő funkciók

- A megrendelők e-mailes megerősítéssel adhatnak fel munkát; elérhetőségük nem nyilvános.
- Védett kapcsolatközvetítő űrlap továbbítja a szakemberek üzeneteit.
- Saját kezelési jogosultsággal módosítás, lezárás, törlés és automatikus lejárat.
- Visszaélés-jelentés és adminisztrátori biztonsági lista.
- Az adminisztrátor ellenőrzi, jóváhagyja vagy elutasítja a beküldött hirdetéseket.
- Jóváhagyáskor a hirdetés megjelenik, és a megfelelő push-feliratkozók értesítést kapnak.
- Szakma, terület, frissesség és kulcsszó szerinti szűrés, több szakmás és több megyés push-beállítás.
- TED API-, engedélyezett RSS/API- és ügyfélhirdetési források.
- Mentett hirdetések, PWA-telepítés, Facebook-megosztás és admin analitika.
- Rate limit, biztonsági fejlécek, spamvédelem és adatvédelmi tájékoztató.

## Helyi indítás

```powershell
Copy-Item .env.example .env
npm install
npm run build
npm start
```

Ezután: `http://127.0.0.1:4174`

Adminoldal: `http://127.0.0.1:4174/admin.html`

Az admin az `.env` fájl `ADMIN_EMAIL` és `ADMIN_PASSWORD` értékével lép be. A munkamenet HttpOnly cookie-ban tárolódik, és e-mailes jelszó-visszaállítás támogatott.

## Ellenőrzés

```powershell
npm run check
npm run build
```

## Nyilvános HTTPS telepítés

A gyökérben található `render.yaml` Render webszolgáltatáshoz használható. Éles üzemhez állíts be tartós PostgreSQL `DATABASE_URL` kapcsolatot, SMTP-hozzáférést, valódi üzemeltetői adatokat és admin-fiókot. Helyben a rendszer automatikusan SQLite-ot használ.
