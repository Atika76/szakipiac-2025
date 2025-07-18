// PayPal fizetés teszt! (csak vizuális példa, tényleges fizetést tegyél bele a véglegesben!)
document.getElementById('fizetesBtn').onclick = function () {
    const kep = document.getElementById('kep').files[0];
    const url = document.getElementById('url').value.trim();

    if (!kep || !url) {
        document.getElementById('uzenet').textContent = "Kép és link megadása kötelező!";
        return;
    }
    // MÉRET ellenőrzés (1 MB)
    if (kep.size > 1048576) {
        document.getElementById('uzenet').textContent = "A kép túl nagy (max 1 MB)!";
        return;
    }

    // Nincs valódi PayPal API – ezt a részt illesztd össze fizetési rendszerrel!
    // Itt most csak "fizetés sikeres" szimuláció van:
    setTimeout(function() {
        localStorage.setItem("aktivreklam", JSON.stringify({
            url: url,
            img: URL.createObjectURL(kep)
        }));
        document.getElementById('uzenet').innerHTML = "<span class='success'>Reklám feltöltve, fizetés sikeres! Megjelenik a főoldalon.</span>";
    }, 1500);
};
