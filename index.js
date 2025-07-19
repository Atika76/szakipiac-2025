const hirdetesekLista = document.getElementById('hirdetesek-lista');
const searchInput = document.getElementById('search');
const categorySelect = document.getElementById('category-select');
const ADMIN_EMAIL = "atika.76@windowslive.com";

async function megjelenitHirdetesek() {
    hirdetesekLista.innerHTML = "<p>Hirdetések betöltése...</p>";
    const loggedInUser = localStorage.getItem("loggedInUser");
    try {
        let query = supabase.from('hirdetesek').select('*').gte('lejárati_datum', new Date().toISOString()).order('id', { ascending: false });
        const searchTerm = searchInput.value.trim();
        if (searchTerm) query = query.ilike('cim', `%${searchTerm}%`);
        const category = categorySelect.value;
        if (category) query = query.eq('kategoria', category);
        const { data: hirdetesek, error } = await query;
        if (error) throw error;
        if (!hirdetesek || hirdetesek.length === 0) {
            hirdetesekLista.innerHTML = "<p>Jelenleg nincs a keresésnek megfelelő hirdetés.</p>";
            return;
        }
        hirdetesekLista.innerHTML = "";
        hirdetesek.forEach(h => {
            const deleteButton = loggedInUser === ADMIN_EMAIL ? `<button class="delete-btn" onclick="deleteAd(${h.id})">Törlés</button>` : '';
            let kepekHTML = '';
            if (h.kepek) {
                try {
                    const kepekArr = JSON.parse(h.kepek);
                    if (Array.isArray(kepekArr)) {
                        kepekHTML += '<div class="hirdetes-kepek">';
                        kepekArr.forEach(url => { kepekHTML += `<img src="${url}" alt="Hirdetés kép" class="hirdetes-kep">`; });
                        kepekHTML += '</div>';
                    }
                } catch {}
            }
            let contactHTML = `<a href="mailto:${h.email}" class="contact-btn">Kapcsolat (Email)</a>`;
            if (h.telefonszam) {
                contactHTML += `<a href="tel:${h.telefonszam}" class="contact-btn phone-btn">Kapcsolat (Telefon)</a>`;
            }
            const box = document.createElement("div");
            box.className = "hirdetes-kartya";
            box.innerHTML = `${deleteButton}<h3>${h.cim}</h3>${kepekHTML}<p><b>Kategória:</b> ${h.kategoria}</p><p><b>Ár:</b> ${h.ar ? h.ar + ' Ft' : 'Megegyezés szerint'}</p><p>${h.leiras}</p><div class="contact-buttons">${contactHTML}</div>`;
            hirdetesekLista.appendChild(box);
        });
    } catch (error) {
        hirdetesekLista.innerHTML = `<p style='color:red;'>Hiba történt a hirdetések betöltésekor: ${error.message}</p>`;
    }
}
async function deleteAd(id) {
    if (!confirm('Biztosan törölni szeretnéd ezt a hirdetést?')) return;
    const { error } = await supabase.from('hirdetesek').delete().eq('id', id);
    if (error) alert('Hiba a törlés során: ' + error.message);
    else megjelenitHirdetesek();
}
searchInput.addEventListener('input', megjelenitHirdetesek);
categorySelect.addEventListener('change', megjelenitHirdetesek);
document.addEventListener('DOMContentLoaded', megjelenitHirdetesek);
