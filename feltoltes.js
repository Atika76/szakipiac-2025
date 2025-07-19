const adminEmail = "atika.76@windowslive.com";
const csomagValaszto = document.getElementById("csomagValaszto");
const paypalContainer = document.getElementById("paypal-container");
const feltoltesForm = document.getElementById('feltoltesForm');
const uzenetDiv = document.getElementById('uzenet');
const kepekInput = document.getElementById('kepek');
let fizetesSikeres = false;

// Bejelentkezett e-mail lekérése (localStorage alapján)
function getLoggedInEmail() { 
    return localStorage.getItem("loggedInUser") || null; 
}

// PayPal gombok logikája
function handlePackageChange() {
    const email = getLoggedInEmail();
    const isAdmin = (email === adminEmail);
    const csomag = csomagValaszto.value;

    if (csomag === 'Alap' || isAdmin) {
        fizetesSikeres = true;
        paypalContainer.style.display = "none";
        paypalContainer.innerHTML = "";
        return;
    }

    fizetesSikeres = false;
    paypalContainer.style.display = "block";
    paypalContainer.innerHTML = "";
    paypal.Buttons({
        createOrder: (data, actions) => actions.order.create({ purchase_units: [{ amount: { value: csomag === "Prémium" ? "1990" : "2990", currency_code: "HUF" } }] }),
        onApprove: (data, actions) => actions.order.capture().then(details => {
            uzenetDiv.textContent = "Fizetés sikeres! Folytathatod a feltöltést.";
            uzenetDiv.style.color = "green";
            paypalContainer.style.display = "none";
            fizetesSikeres = true;
        }),
        onError: function (err) {
            uzenetDiv.textContent = "Hiba történt a fizetés során. Próbáld újra.";
            uzenetDiv.style.color = "red";
        }
    }).render('#paypal-container');
}

// FŐ submit eseménykezelő
feltoltesForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = getLoggedInEmail();
    if (!email) {
        uzenetDiv.textContent = "A hirdetés feladásához be kell jelentkezned!";
        uzenetDiv.style.color = "red";
        return;
    }
    if (!fizetesSikeres) {
        uzenetDiv.textContent = "A fizetős csomagoknál először fizess!";
        uzenetDiv.style.color = "red";
        return;
    }
    uzenetDiv.textContent = "Feltöltés folyamatban...";

    const csomag = csomagValaszto.value;
    const napok = csomag === 'Alap' ? 7 : (csomag === 'Prémium' ? 14 : 30);
    const lejarat = new Date();
    lejarat.setDate(lejarat.getDate() + napok);

    // KEPEK FELTÖLTÉSE STORAGE-BA
    let kepekUrlTomb = [];
    if (kepekInput.files.length > 0) {
        for (let i = 0; i < kepekInput.files.length; i++) {
            const file = kepekInput.files[i];
            // Egyedi fájlnév (időbélyeg + email + eredeti név)
            const filename = `${Date.now()}_${email}_${file.name}`;
            let { data, error } = await supabase.storage.from('hirdeteskepek').upload(filename, file);
            if (error) {
                uzenetDiv.textContent = "Hiba a képfeltöltés során: " + error.message;
                uzenetDiv.style.color = "red";
                return;
            }
            // Teljes elérési út
            kepekUrlTomb.push(filename);
        }
    }

    // HIRDETÉS FELVITELE ADATBÁZISBA
    const { error } = await supabase.from('hirdetesek').insert([{
        cim: document.getElementById('cim').value,
        leiras: document.getElementById('leiras').value,
        kategoria: document.getElementById('kategoria').value,
        ar: document.getElementById('ar').value || null,
        csomag: csomag,
        email: email,
        lejárati_datum: lejarat.toISOString(),
        telefonszam: document.getElementById('telefonszam')?.value || null,
        kepek: kepekUrlTomb.join(';')
    }]);

    if (error) {
        uzenetDiv.textContent = "Hiba a feltöltés során: " + error.message;
        uzenetDiv.style.color = "red";
    } else {
        window.location.href = 'sikeres.html';
    }
});

// PayPal logika inicializálása oldal betöltéskor is
csomagValaszto.addEventListener("change", handlePackageChange);
document.addEventListener('DOMContentLoaded', handlePackageChange);
