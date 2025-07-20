const hirdetesekLista = document.getElementById('hirdetesek-lista');
const searchInput = document.getElementById('search');
const categorySelect = document.getElementById('category-select');
const ADMIN_EMAIL = "atika.76@windowslive.com";

async function megjelenitHirdetesek() {
    hirdetesekLista.innerHTML = "<p>Hirdetések betöltése...</p>";
    const loggedInUserEmail = localStorage.getItem("loggedInUser");
    
    try {
        let query = supaClient.from('hirdetesek').select('*').gte('lejárati_datum', new Date().toISOString()).order('created_at', { ascending: false });
        // ... (szűrési logika) ...
        const { data: hirdetesek, error } = await query;
        if (error) throw error;

        if (!hirdetesek || hirdetesek.length === 0) {
            hirdetesekLista.innerHTML = "<p>Jelenleg nincs a keresésnek megfelelő hirdetés.</p>";
            return;
        }

        hirdetesekLista.innerHTML = "";
        hirdetesek.forEach(h => {
            // JAVÍTVA: A törlés gomb megjelenik, ha admin vagy, VAGY ha a hirdetés a tiéd
            let deleteButton = '';
            if (loggedInUserEmail === ADMIN_EMAIL || loggedInUserEmail === h.email) {
                deleteButton = `<button class="delete-btn" onclick="deleteAd(${h.id})">Törlés</button>`;
            }
            
            // ... (a többi HTML generálás) ...
            const box = document.createElement("div");
            box.className = "hirdetes-kartya";
            box.innerHTML = `${deleteButton}<h3>${h.cim}</h3><p><b>Kategória:</b> ${h.kategoria}</p><p><b>Ár:</b> ${h.ar ? h.ar + ' Ft' : 'Megegyezés szerint'}</p><p>${h.leiras}</p>`;
            hirdetesekLista.appendChild(box);
        });
    } catch (error) {
        hirdetesekLista.innerHTML = `<p style='color:red;'>Hiba: ${error.message}</p>`;
    }
}
async function deleteAd(id) {
    if (!confirm('Biztosan törölni szeretnéd ezt a hirdetést?')) return;
    const { error } = await supaClient.from('hirdetesek').delete().eq('id', id);
    if (error) alert('Hiba a törlés során: ' + error.message);
    else megjelenitHirdetesek();
}

document.addEventListener('DOMContentLoaded', megjelenitHirdetesek);
