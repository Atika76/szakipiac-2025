// Supabase inicializálás (supabase.js szükséges!)
import { supabase } from './supabase.js'; // Ha nincs import, csak hagyd ki ezt a sort!

document.addEventListener("DOMContentLoaded", () => {
  const listaElem = document.getElementById("hirdetesek-lista");
  const kereso = document.getElementById("kereso");
  const keresGomb = document.getElementById("keresesGomb");
  const kategoriak = document.getElementById("kategoriak");

  let hirdetesek = [];

  // Hirdetések betöltése az induláskor
  async function betoltHirdetesek() {
    listaElem.innerHTML = "<p>Betöltés...</p>";
    let { data, error } = await supabase.from("hirdetesek").select("*").eq("status", "jóváhagyott").order("created_at", { ascending: false });
    if (error) {
      listaElem.innerHTML = `<p class="hiba">Hiba történt a hirdetések betöltésekor!</p>`;
      return;
    }
    hirdetesek = data || [];
    renderHirdetesek(hirdetesek);
  }

  // Keresés és szűrés logika
  function keresHirdetesek() {
    const keresSzoveg = kereso.value.trim().toLowerCase();
    const kategoria = kategoriak.value;
    let szurt = hirdetesek.filter(h => {
      const szoveg = `${h.cim} ${h.leiras || ""} ${h.kategoria || ""}`.toLowerCase();
      const kategoriaOK = !kategoria || h.kategoria === kategoria;
      return szoveg.includes(keresSzoveg) && kategoriaOK;
    });
    renderHirdetesek(szurt);
  }

  // Hirdetések megjelenítése modern kártyákkal
  function renderHirdetesek(lista) {
    if (!lista.length) {
      listaElem.innerHTML = "<p>Nincs találat a megadott feltételekre.</p>";
      return;
    }
    listaElem.innerHTML = lista.map(h => `
      <article class="hirdetes-kartya">
        <h3>${h.cim}</h3>
        <p class="leiras">${h.leiras || ''}</p>
        <p class="info">
          <span class="kategoria">${h.kategoria || '-'}</span> |
          <span class="datum">${new Date(h.created_at).toLocaleDateString('hu-HU')}</span>
        </p>
        <p class="ar">${h.ar ? `${h.ar} Ft` : ''}</p>
        ${h.kep_url ? `<img src="${h.kep_url}" alt="Hirdetés képe" class="hirdetes-kep">` : ''}
      </article>
    `).join("");
  }

  // Események bekötése
  keresGomb.addEventListener("click", keresHirdetesek);
  kategoriak.addEventListener("change", keresHirdetesek);
  kereso.addEventListener("input", () => { if (!kereso.value) keresHirdetesek(); });

  // Enterrel is működjön a keresés
  kereso.addEventListener("keydown", (e) => {
    if (e.key === "Enter") keresHirdetesek();
  });

  // Alap betöltés
  betoltHirdetesek();
});
