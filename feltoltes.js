// ----------- Supabase kliensnek léteznie kell! -----------
// supabase.js legyen betöltve előbb! (const supabase = ...)

const adminEmail = "atika.76@windowslive.com";
const csomagValaszto = document.getElementById("csomagValaszto");
const paypalContainer = document.getElementById("paypal-container");
const feltoltesForm = document.getElementById('feltoltesForm');
const uzenetDiv = document.getElementById('uzenet');
const kepekInput = document.getElementById('kepek');
let fizetesSikeres = false;

const KEP_LIMIT = { "Alap": 2, "Prémium": 3, "Extra": 5 };
const BUCKET_NAME = "hirdetes_kepek"; // Supabase Storage bucket neve!

function getLoggedInEmail() { return localStorage.getItem("loggedInUser") || null; }

function handlePackageChange() {
    const email = getLoggedInEmail();
    const isAdmin = (email === adminEmail);
    const csomag = csomagValaszto.value;
    const maxKep = KEP_LIMIT[csomag] || 2;
    kepekInput.setAttribute("multiple", true);
    kepekInput.setAttribute("max", maxKep);
    kepekInput.onchange = function () {
        if (this.files.length > maxKep) {
            uzenetDiv.textContent = `Ehhez a csomaghoz maximum ${maxKep} képet tölthetsz fel!`;
            uzenetDiv.style.color = "red";
            this.value = "";
        }
    };

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
    uzenetDiv.style.color = "black";

    // Képfeltöltés (csak ha van kép)
    let kepUrls = [];
    if (kepekInput.files.length > 0) {
        for (let i = 0; i < kepekInput.files.length; i++) {
            const file = kepekInput.files[i];
            const filename = `${Date.now()}_${Math.floor(Math.random()*100000)}_${file.name}`;
            let { data, error } = await supabase.storage.from(BUCKET_NAME).upload(filename, file, { cacheControl: '3600', upsert: false });
            if (error) {
                uzenetDiv.textContent = "Képfeltöltési hiba: " + error.message;
                uzenetDiv.style.color = "red";
                return;
            }
            // Publikus URL
            const url = supabase.storage.from(BUCKET_NAME).getPublicUrl(filename).data.publicUrl;
            kepUrls.push(url);
        }
    }

    const csomag = csomagValaszto.value;
    const napok = csomag === 'Alap' ? 7 : (csomag === 'Prémium' ? 14 : 30);
    const lejarat = new Date();
    lejarat.setDate(lejarat.getDate() + napok);

    const { error } = await supabase.from('hirdetesek').insert([{
        cim: document.getElementById('cim').value,
        leiras: document.getElementById('leiras').value,
        kategoria: document.getElementById('kategoria').value,
        ar: document.getElementById('ar').value || null,
        csomag: csomag,
        email: email,
        lejárati_datum: lejarat.toISOString(),
        telefonszam: document.getElementById('telefonszam')?.value || null,
        kepek: kepUrls // Ezt JSON[] vagy text[] típusú mezőként add hozzá az adatbázisban!
    }]);

    if (error) {
        uzenetDiv.textContent = "Hiba a feltöltés során: " + error.message;
        uzenetDiv.style.color = "red";
    } else {
        window.location.href = 'sikeres.html';
    }
});

// Inicializálás
csomagValaszto.addEventListener("change", handlePackageChange);
document.addEventListener('DOMContentLoaded', handlePackageChange);
