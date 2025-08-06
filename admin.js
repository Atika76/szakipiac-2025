// admin.js – Magyar kereső/szűrő, gyors jóváhagyás, törlés

// Supabase inicializálás (supabase.js szükséges!)
import { supabase } from './supabase.js'; // Ha nincs import, csak hagyd el ezt a sort!

document.addEventListener("DOMContentLoaded", async function () {
  const listaElem = document.getElementById("admin-hirdetesek-lista");
  const kereso = document.getElementById("admin-kereso");
  const kategoria = document.getElementById("admin-kategoria");
  const statusz = document.getElementById("admin-statusz");
  const keresGomb = document.getElementById("adminKeresGomb");
  const uzenet = document.getElementById("admin-uzenet");

  let hirdetesek = [];

  // Hirdetések betöltése (összes!)
  async function betoltAdminHirdetesek() {
    listaElem.innerHTML = "<p>Betöltés...</p>";
    let { data, error } = await supabase.from("hirdetesek").select("*").order("created_at", { ascending: false });
    if (error) {
      listaElem.innerHTML = `<p class="hiba">Hiba történt a hirdetések betöltésekor!</p>`;
      return;
    }
    hirdetesek = data || [];
    adminRenderHirdetesek(hirdetesek);
  }

  // Keresés/szűrés logika
  function adminKeres() {
    const keresSzoveg = kereso.value.trim().toLowerCase();
    const kat = kategoria.value;
    const stat = statusz.value;
    let szurt = hirdetesek.filter(h => {
      const szoveg = `${h.cim} ${h.leiras || ""} ${h.kategoria || ""} ${h.status || ""} ${h.email || ""}`.toLowerCase();
      const katOK = !kat || h.kategoria === kat;
      const statOK = !stat || h.status === stat;
      return szoveg.includes(keresSzoveg) && katOK && statOK;
    });
    adminRenderHirdetesek(szurt);
  }

  // Hirdetések listázása, admin gombokkal
  function adminRenderHirdetesek(lista) {
    if (!lista.length) {
      listaElem.innerHTML = "<p>Nincs találat.</p>";
      return;
    }
    listaElem.innerHTML = lista.map(h => `
      <article class="hirdetes-kartya">
        <h3>${h.cim}</h3>
        <p class="leiras">${h.leiras || ''}</p>
        <p class="info">
          <span class="kategoria">${h.kategoria || '-'}</span> |
          <span class="datum">${new Date(h.created_at).toLocaleDateString('hu-HU')}</span> |
          <span class="statusz" style="color:${h.status==='jóváhagyott' ? '#059669' : h.status==='függőben' ? '#eab308' : '#b91c1c'};">
            ${h.status}
          </span>
        </p>
        <p class="ar">${h.ar ? `${h.ar} Ft` : ''}</p>
        ${h.kep_url ? `<img src="${h.kep_url}" alt="Hirdetés képe" class="hirdetes-kep">` : ''}
        <div style="display:flex;gap:7px;margin-top:10px;">
          ${h.status !== 'jóváhagyott' ? `<button class="btn-jovahagy" data-id="${h.id}">Jóváhagy</button>` : ''}
          <button class="btn-torles" data-id="${h.id}">Törlés</button>
        </div>
      </article>
    `).join("");
  }

  // Gombok eseményei
  listaElem.addEventListener("click", async function (e) {
    if (e.target.classList.contains("btn-jovahagy")) {
      const id = e.target.getAttribute("data-id");
      await adminAllapotValt(id, "jóváhagyott");
    }
    if (e.target.classList.contains("btn-torles")) {
      const id = e.target.getAttribute("data-id");
      await adminTorles(id);
    }
  });

  async function adminAllapotValt(id, ujStatusz) {
    uzenet.innerHTML = "";
    let { error } = await supabase.from("hirdetesek").update({ status: ujStatusz }).eq("id", id);
    if (error) {
      uzenet.innerHTML = `<div class="hiba">Hiba: ${error.message}</div>`;
    } else {
      uzenet.innerHTML = `<div style="color:#047857; background:#dcfce7; padding:7px 12px; border-radius:8px;margin:0.5rem 0;">Sikeresen jóváhagyva!</div>`;
      await betoltAdminHirdetesek();
    }
  }

  async function adminTorles(id) {
    if (!confirm("Biztosan törlöd ezt a hirdetést?")) return;
    uzenet.innerHTML = "";
    let { error } = await supabase.from("hirdetesek").delete().eq("id", id);
    if (error) {
      uzenet.innerHTML = `<div class="hiba">Hiba: ${error.message}</div>`;
    } else {
      uzenet.innerHTML = `<div style="color:#b91c1c; background:#fee2e2; padding:7px 12px; border-radius:8px;margin:0.5rem 0;">Törölve.</div>`;
      await betoltAdminHirdetesek();
    }
  }

  // Események
  keresGomb.addEventListener("click", adminKeres);
  kategoria.addEventListener("change", adminKeres);
  statusz.addEventListener("change", adminKeres);
  kereso.addEventListener("input", () => { if (!kereso.value) adminKeres(); });
  kereso.addEventListener("keydown", (e) => { if (e.key === "Enter") adminKeres(); });

  // Alap betöltés
  await betoltAdminHirdetesek();
});
