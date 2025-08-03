const hirdetesekLista = document.getElementById('hirdetesek-lista');
const searchInput = document.getElementById('search');
const categorySelect = document.getElementById('category-select');
const ADMIN_EMAIL = "atika.76@windowslive.com";

// === ÚJ RÉSZ A KÉPNAGYÍTÁSHOZ ===
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxClose = document.querySelector('.lightbox-close');

function openLightbox(imageUrl) {
    if (lightbox && lightboxImg) {
        lightboxImg.src = imageUrl;
        lightbox.classList.add('active');
    }
}

function closeLightbox() {
    if (lightbox) {
        lightbox.classList.remove('active');
    }
}

if (lightbox) {
    lightboxClose.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) {
            closeLightbox();
        }
    });
}
// Globálissá tesszük, hogy a HTML-ből elérhető legyen
window.openLightbox = openLightbox;
// === ÚJ RÉSZ VÉGE ===

async function megjelenitHirdetesek() {
    hirdetesekLista.innerHTML = "<p>Hirdetések betöltése...</p>";
    const loggedInUserEmail = localStorage.getItem("loggedInUser");
    
    try {
        let query = supaClient.from('hirdetesek').select('*').gte('lejárati_datum', new Date().toISOString()).order('created_at', { ascending: false });
        
        const searchTerm = searchInput.value.trim();
        if (searchTerm) {
            query = query.or(`cim.ilike.%${searchTerm}%,leiras.ilike.%${searchTerm}%`);
        }

        const category = categorySelect.value;
        if (category) {
            query = query.eq('kategoria', category);
        }

        const { data: hirdetesek, error } = await query;
        if (error) throw error;

        if (!hirdetesek || hirdetesek.length === 0) {
            hirdetesekLista.innerHTML = "<p>Jelenleg nincs a keresésnek megfelelő hirdetés.</p>";
            return;
        }

        hirdetesekLista.innerHTML = "";
        hirdetesek.forEach(h => {
            let deleteButton = '';
            if (loggedInUserEmail === ADMIN_EMAIL || loggedInUserEmail === h.email) {
                deleteButton = `<button class="delete-btn" onclick="deleteAd(${h.id})">Törlés</button>`;
            }
            
            let kepekHTML = '';
            if (h.kep_url_tomb && h.kep_url_tomb.length > 0) {
                kepekHTML += '<div class="hirdetes-kepek">';
                h.kep_url_tomb.forEach(url => {
                    // JAVÍTVA: A kép mostantól kattinthatóvá válik
                    kepekHTML += `<img src="${url}" alt="Hirdetés kép" class="hirdetes-kep" style="cursor: zoom-in;" onclick="openLightbox('${url}')">`;
                });
                kepekHTML += '</div>';
            }
            
            let contactHTML = `<a href="mailto:${h.email}" class="contact-btn">Kapcsolat (Email)</a>`;
            if (h.telefonszam) {
                contactHTML += `<a href="tel:${h.telefonszam}" class="contact-btn phone-btn">Kapcsolat (Telefon)</a>`;
            }

            const box = document.createElement("div");
            box.className = "hirdetes-kartya";
            box.innerHTML = `
                ${deleteButton}
                <h3>${h.cim}</h3>
                ${kepekHTML}
                <p><b>Kategória:</b> ${h.kategoria}</p>
                <p><b>Ár:</b> ${h.ar ? h.ar + ' Ft' : 'Megegyezés szerint'}</p>
                <p>${h.leiras}</p>
                <div class="contact-buttons">${contactHTML}</div>
            `;
            hirdetesekLista.appendChild(box);
        });
    } catch (error) {
        hirdetesekLista.innerHTML = `<p style='color:red;'>Hiba a hirdetések betöltésekor: ${error.message}</p>`;
    }
}

async function deleteAd(id) {
    if (!confirm('Biztosan törölni szeretnéd ezt a hirdetést?')) return;
    const { error } = await supaClient.from('hirdetesek').delete().eq('id', id);
    if (error) {
        alert('Hiba a törlés során: ' + error.message);
    } else {
        megjelenitHirdetesek();
    }
}

if(searchInput) searchInput.addEventListener('input', megjelenitHirdetesek);
if(categorySelect) categorySelect.addEventListener('change', megjelenitHirdetesek);
document.addEventListener('DOMContentLoaded', megjelenitHirdetesek);
