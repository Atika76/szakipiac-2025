<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="UTF-8" />
  <title>Admin felület – SzakiPiac</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header class="green-header">
    <img src="logo.png" class="logo" alt="SzakiPiac logó">
    <nav>
      <a href="index.html">Főoldal</a>
      <a href="rolunk.html">Rólunk</a>
      <a href="kapcsolat.html">Kapcsolat</a>
      <a href="feltoltes.html">Hirdetés feltöltés</a>
      <a href="auth.html">Bejelentkezés</a>
    </nav>
  </header>
  <div class="container">
    <div class="content-box">
      <div id="admin-panel">
        <h1>Admin felület</h1>
        <p>Itt láthatod az összes hirdetést, beleértve a lejártakat is.</p>
        <div id="admin-hirdetesek-lista"></div>
      </div>
      <div id="access-denied" style="display: none;">
        <h1>Hozzáférés megtagadva!</h1>
      </div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="supabase.js"></script>
  <script src="header.js"></script>
  <script>
    const adminEmail = "atika.76@windowslive.com";
    const loggedInUserEmail = localStorage.getItem("loggedInUser");
    const hirdetesekLista = document.getElementById('admin-hirdetesek-lista');

    async function loadAdminAds() {
        try {
            const { data, error } = await supaClient.from('hirdetesek').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            if (!data || data.length === 0) {
                hirdetesekLista.innerHTML = "<p>Nincsenek hirdetések az adatbázisban.</p>";
                return;
            }
            hirdetesekLista.innerHTML = "";
            data.forEach(h => {
                const box = document.createElement("div");
                box.className = "hirdetes-kartya";
                const isExpired = new Date(h.lejárati_datum) < new Date();
                box.style.borderLeft = isExpired ? '5px solid #e74c3c' : '5px solid #2ecc71';
                box.innerHTML = `
                    <button class="delete-btn" onclick="deleteAd(${h.id})">Törlés</button>
                    <h3>${h.cim}</h3>
                    <p><b>Feladó:</b> ${h.email}</p>
                    <p><b>Lejárat:</b> ${new Date(h.lejárati_datum).toLocaleDateString()} ${isExpired ? '(Lejárt)' : ''}</p>
                `;
                hirdetesekLista.appendChild(box);
            });
        } catch (error) {
            hirdetesekLista.innerHTML = `<p style="color:red;">Hiba: ${error.message}</p>`;
        }
    }

    async function deleteAd(id) {
        if (!confirm('Biztosan törölni szeretnéd ezt a hirdetést?')) return;
        const { error } = await supaClient.from('hirdetesek').delete().eq('id', id);
        if (error) alert('Hiba a törlés során: ' + error.message);
        else loadAdminAds();
    }

    if (loggedInUserEmail === adminEmail) {
        document.getElementById('admin-panel').style.display = 'block';
        loadAdminAds();
    } else {
        document.getElementById('access-denied').style.display = 'block';
    }
  </script>
</body>
</html>
