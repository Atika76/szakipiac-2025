// feltoltes.js – Modern, előnézetes, magyar hibakezeléssel

// Supabase inicializálás (KÖTELEZŐ!)
import { supabase } from './supabase.js'; // Ha nincs import, hagyd el ezt a sort!

document.addEventListener("DOMContentLoaded", async function () {
  const form = document.getElementById("hirdetesForm");
  const cim = document.getElementById("cim");
  const kategoria = document.getElementById("kategoria");
  const leiras = document.getElementById("leiras");
  const ar = document.getElementById("ar");
  const kep = document.getElementById("kep");
  const kepElonezet = document.getElementById("kepElonezet");
  const uzenet = document.getElementById("uzenet");

  let kepFile = null;

  // Kép előnézet
  kep.addEventListener("change", function () {
    kepElonezet.innerHTML = "";
    if (kep.files && kep.files[0]) {
      const file = kep.files[0];
      if (!file.type.startsWith('image/')) {
        uzenet.innerHTML = `<div class="hiba">Csak képfájl tölthető fel!</div>`;
        kep.value = "";
        return;
      }
      if (file.size > 2 * 1024 * 1024) { // 2 MB limit
        uzenet.innerHTML = `<div class="hiba">A kép mérete maximum 2 MB lehet!</div>`;
        kep.value = "";
        return;
      }
      kepFile = file;
      const reader = new FileReader();
      reader.onload = function (e) {
        kepElonezet.innerHTML = `<img src="${e.target.result}" alt="Előnézet" style="max-width:180px;max-height:130px;border-radius:10px;margin-top:7px;border:1px solid #ddd;">`;
      };
      reader.readAsDataURL(file);
    } else {
      kepFile = null;
    }
  });

  // Hirdetés beküldése
  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    uzenet.innerHTML = "";

    // Alap validáció
    if (!cim.value.trim() || !kategoria.value) {
      uzenet.innerHTML = `<div class="hiba">A cím és kategória megadása kötelező!</div>`;
      return;
    }

    let kep_url = "";
    if (kepFile) {
      // Kép feltöltése Supabase storage-ba
      const fileName = `hirdetesek/${Date.now()}_${kepFile.name.replace(/\s/g,'_')}`;
      let { data, error } = await supabase.storage.from('kepek').upload(fileName, kepFile);
      if (error) {
        uzenet.innerHTML = `<div class="hiba">Hiba a kép feltöltésekor: ${error.message}</div>`;
        return;
      }
      // Lekérjük az elérési utat
      const { data: urlData } = supabase.storage.from('kepek').getPublicUrl(fileName);
      kep_url = urlData.publicUrl;
    }

    // Hirdetés mentése
    const { data, error } = await supabase.from('hirdetesek').insert([{
      cim: cim.value.trim(),
      kategoria: kategoria.value,
      leiras: leiras.value.trim(),
      ar: ar.value ? parseInt(ar.value) : null,
      kep_url,
      status: "függőben",
      created_at: new Date().toISOString()
    }]);
    if (error) {
      uzenet.innerHTML = `<div class="hiba">Hiba történt a mentés során: ${error.message}</div>`;
      return;
    }
    form.reset();
    kepElonezet.innerHTML = "";
    uzenet.innerHTML = `<div style="color: #047857; background:#dcfce7; padding: 8px 13px; border-radius:8px; margin:1rem 0;">Hirdetésed sikeresen elküldve, jóváhagyás után megjelenik az oldalon!</div>`;
  });
});
