const feltoltesForm = document.getElementById('feltoltesForm');
const uzenetDiv = document.getElementById('uzenet');
const kepekInput = document.getElementById('kepek');
const previewsContainer = document.getElementById('image-previews');
const csomagValaszto = document.getElementById("csomagValaszto");
const paypalContainer = document.getElementById('paypal-container');
const adminEmail = "atika.76@windowslive.com";
let fizetesSikeres = false;

// Csomagokhoz tartozó képkorlátok
const packageLimits = { 
    'Alap': 2, 
    'Prémium': 3, 
    'Extra': 5 
};

function getLoggedInEmail() { return localStorage.getItem("loggedInUser") || null; }

function handlePackageChange() {
    const email = getLoggedInEmail();
    const isAdmin = (email === adminEmail);
    const csomag = csomagValaszto.value;

    if (csomag === 'Alap' || isAdmin || !email) {
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
            uzenetDiv.textContent = "Fizetés sikeres!";
            uzenetDiv.style.color = "green";
            paypalContainer.style.display = "none";
            fizetesSikeres = true;
        })
    }).render('#paypal-container');
}

// ÚJ FUNKCIÓ: Képek ellenőrzése és előnézet generálása
function handleImageSelection() {
    previewsContainer.innerHTML = ''; // Előző előnézetek törlése
    const limit = packageLimits[csomagValaszto.value];
    const files = kepekInput.files;

    if (files.length > limit) {
        alert(`A kiválasztott "${csomagValaszto.value}" csomaghoz maximum ${limit} képet tölthetsz fel!`);
        kepekInput.value = ''; // A kiválasztott fájlok törlése
        return;
    }

    for (const file of files) {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.classList.add('preview-image');
        previewsContainer.appendChild(img);
    }
}

// Eseménykezelők
kepekInput.addEventListener('change', handleImageSelection);
csomagValaszto.addEventListener('change', () => {
    // Ha a felhasználó csomagot vált, töröljük a korábban kiválasztott képeket,
    // hogy az új limitnek megfelelően tudjon választani.
    kepekInput.value = '';
    previewsContainer.innerHTML = '';
    handlePackageChange();
});
document.addEventListener('DOMContentLoaded', handlePackageChange);

feltoltesForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { data: { user } } = await supaClient.auth.getUser();
    if (!user) {
        uzenetDiv.textContent = "A feltöltéshez be kell jelentkezned!";
        return;
    }
    if (!fizetesSikeres && user.email !== adminEmail) {
        uzenetDiv.textContent = "A fizetős csomagoknál a feltöltés előtt fizetned kell!";
        return;
    }
    uzenetDiv.textContent = "Feltöltés folyamatban, kérlek várj...";
    document.querySelector('button[type="submit"]').disabled = true;

    try {
        const imageFiles = kepekInput.files;
        const imageUrls = [];
        for (const file of imageFiles) {
            const filePath = `${user.id}/${Date.now()}-${file.name}`;
            const { data, error } = await supaClient.storage.from('hirdetes-kepek').upload(filePath, file);
            if (error) throw new Error('Képfeltöltési hiba: ' + error.message);
            const { data: { publicUrl } } = supaClient.storage.from('hirdetes-kepek').getPublicUrl(filePath);
            imageUrls.push(publicUrl);
        }

        const csomag = csomagValaszto.value;
        const napok = csomag === 'Alap' ? 7 : (csomag === 'Prémium' ? 14 : 30);
        const lejarat = new Date();
        lejarat.setDate(lejarat.getDate() + napok);

        const { error: insertError } = await supaClient.from('hirdetesek').insert([{
            cim: document.getElementById('cim').value,
            leiras: document.getElementById('leiras').value,
            kategoria: document.getElementById('kategoria').value,
            ar: parseInt(document.getElementById('ar').value) || null,
            telefonszam: document.getElementById('telefonszam').value || null,
            csomag: csomag,
            email: user.email,
            lejárati_datum: lejarat.toISOString(),
            kep_url_tomb: imageUrls
        }]);

        if (insertError) throw insertError;
        window.location.href = 'sikeres.html';
    } catch (error) {
        uzenetDiv.textContent = "Hiba történt: " + error.message;
        document.querySelector('button[type="submit"]').disabled = false;
    }
});
