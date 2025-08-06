const feltoltesForm = document.getElementById('feltoltesForm');
const uzenetDiv = document.getElementById('uzenet');
const kepekInput = document.getElementById('kepek');
const previewsContainer = document.getElementById('image-previews');
const csomagValaszto = document.getElementById("csomagValaszto");
const paypalContainer = document.getElementById("paypal-container");
const adminEmail = "atika.76@windowslive.com";

let kivalasztottKepek = [];
let fizetesSikeres = false;
const packageLimits = { 'Alap': 2, 'Prémium': 3, 'Extra': 5 };

function renderPreviews() {
    previewsContainer.innerHTML = '';
    kivalasztottKepek.forEach((file, index) => {
        const container = document.createElement('div');
        container.className = 'preview-container';
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.className = 'preview-image';
        const removeBtn = document.createElement('button');
        removeBtn.textContent = 'X';
        removeBtn.className = 'remove-btn';
        removeBtn.type = 'button';
        removeBtn.onclick = () => {
            kivalasztottKepek.splice(index, 1);
            renderPreviews();
        };
        container.appendChild(img);
        container.appendChild(removeBtn);
        previewsContainer.appendChild(container);
    });
}

function handlePackageChange() {
    const email = localStorage.getItem("loggedInUser");
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
            uzenetDiv.textContent = "Sikeres fizetés!";
            uzenetDiv.style.color = "green";
            paypalContainer.style.display = "none";
            fizetesSikeres = true;
        })
    }).render('#paypal-container');
}

kepekInput.addEventListener('change', (e) => {
    const limit = packageLimits[csomagValaszto.value];
    if (kivalasztottKepek.length >= limit) {
        alert(`Már elérted a maximum (${limit} db) feltölthető képet.`);
        e.target.value = '';
        return;
    }
    if (e.target.files.length > 0) {
        kivalasztottKepek.push(e.target.files[0]);
        renderPreviews();
    }
    e.target.value = '';
});

csomagValaszto.addEventListener('change', () => {
    kivalasztottKepek = [];
    renderPreviews();
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
    if (!fizetesSikeres) {
        uzenetDiv.textContent = "A fizetős csomagoknál a feltöltés előtt fizetned kell!";
        return;
    }
    uzenetDiv.textContent = "Feltöltés folyamatban...";
    document.querySelector('button[type="submit"]').disabled = true;
    try {
        const imageUrls = [];
        for (const file of kivalasztottKepek) {
            const filePath = `${user.id}/${Date.now()}-${file.name}`;
            const { data, error } = await supaClient.storage.from('hirdetes-kepek').upload(filePath, file);
            if (error) throw new Error('Képfeltöltési hiba: ' + error.message);
            const { data: { publicUrl } } = supaClient.storage.from('hirdetes-kepek').getPublicUrl(filePath);
            imageUrls.push(publicUrl);
        }
        const csomag = csomagValaszto.value;
        const napok = packageLimits[csomag] || 7;
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
