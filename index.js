// index.js (Javítva a képek megjelenítésével)
const hirdetesekLista = document.getElementById('hirdetesek-lista');
const searchInput = document.getElementById('search');
const categorySelect = document.getElementById('category-select');
const ADMIN_EMAIL = "atika.76@windowslive.com";

async function megjelenitHirdetesek() {
    hirdetesekLista.innerHTML = "<p>Hirdetések betöltése...</p>";
    const loggedInUser = localStorage.getItem("loggedInUser");
    try {
        let query = supaClient.from('hirdetesek').select('*').gte('lejárati_datum', new Date().toISOString()).order('created_at', { ascending: false });
        // ... (a többi szűrési logika)
        const { data: hirdetesek, error } = await query;
        if (error) throw error;
        if (!hirdetesek || hirdetesek.length === 0) {
            hirdetesekLista.innerHTML = "<p>Nincs hirdetés.</p>";
            return;
        }
        hirdetesekLista.innerHTML = "";
        hirdetesek.forEach(h => {
            const deleteButton = loggedInUser === ADMIN_EMAIL ? `<button class="delete-btn" onclick="deleteAd(${h.id})">Törlés</button>` : '';
            
            // EZ A RÉSZ JAVÍTJA A KÉPMEGJELENÍTÉST
            let kepekHTML = '';
            if (h.kep_url_tomb && h.kep_url_tomb.length > 0) {
                kepekHTML += '<div class="hirdetes-kepek">';
                h.kep_url_tomb.forEach(url => {
                    kepekHTML += `<img src="${url}" alt="Hirdetés kép" class="hirdetes-kep">`;
                });
                kepekHTML += '</div>';
            }
            // ... (a többi HTML generálás)
            const box = document.createElement("div");
            box.className = "hirdetes-kartya";
            box.innerHTML = `${deleteButton}<h3>${h.cim}</h3>${kepekHTML}<p><b>Kategória:</b> ${h.kategoria}</p><p>${h.leiras}</p>`;
            hirdetesekLista.appendChild(box);
        });
    } catch (error) {
        hirdetesekLista.innerHTML = `<p style='color:red;'>Hiba: ${error.message}</p>`;
    }
}
// ... (a többi funkció: deleteAd, eseménykezelők)
