(function(){
  const API="https://bxtpnotswnwrbycvfypz.supabase.co/rest/v1/epitoipari_arak?select=*&aktiv=eq.true";
  const KEY="sb_publishable_Mb8TFdTfXZqemImigup9Ig_RpJhUrx8";
  const page=location.pathname.split("/").pop()||"";
  const fmt=n=>new Intl.NumberFormat("hu-HU",{maximumFractionDigits:0}).format(Math.round(n||0))+" Ft";
  const configs={
    "mennyibe-kerul-a-felujitas.html":[
      ["Festés, előkészítéssel",[["festo-elokeszites",1],["festo-glett",1],["festo-festes",1]],"/m²"],
      ["Padlóburkolás",[["burkolo-padlo",1]],"/m²"],
      ["Fürdőszoba mintaprojekt",[["jarulekos-bontas",16],["viz-kiallas",6],["villany-kiallas",5],["aljzat-kiegyenlites",6],["burkolo-fal",22],["burkolo-padlo",6]],""],
      ["Homlokzati szigetelés, 15 cm EPS",[["homlokzat-eps",1]],"/m²"],
      ["Tetőszerkezet és fedés",[["acs-tetoszerkezet",1],["acs-folia-lec",1],["acs-cserep",1]],"/m²"]],
    "60-nm-lakas-felujitas-koltseg-2026.html":[
      ["Festés, előkészítéssel (120 m²)",[["festo-elokeszites",120],["festo-glett",120],["festo-festes",120]],""],
      ["Padlóburkolás (35 m²)",[["burkolo-padlo",35]],""],
      ["Vízszerelési kiállások (8 db)",[["viz-kiallas",8]],""],
      ["Villamos kiállások (20 db)",[["villany-kiallas",20]],""],
      ["Bontás és javító vakolás",[["jarulekos-bontas",24],["vakolas-javito",20]],""]],
    "mennyibe-kerul-a-furdoszoba-felujitas.html":[
      ["Bontás (16 munkaóra)",[["jarulekos-bontas",16]],""],
      ["Víz-/csatorna-kiállások (6 db)",[["viz-kiallas",6]],""],
      ["Villamos kiállások (5 db)",[["villany-kiallas",5]],""],
      ["Falburkolás (22 m²)",[["burkolo-fal",22]],""],
      ["Padlóburkolás (6 m²)",[["burkolo-padlo",6]],""],
      ["Aljzatkiegyenlítés (6 m²)",[["aljzat-kiegyenlites",6]],""]],
    "mennyibe-kerul-a-szigeteles.html":[
      ["Komplett homlokzati hőszigetelés, 15 cm EPS",[["homlokzat-eps",1]],"/m²"],
      ["Gép- és eszközhasználat",[["jarulekos-gep",1]],"/nap"],
      ["Építési hulladék kezelése",[["jarulekos-hulladek",1]],"/m³"]],
    "panel-lakas-felujitas-ara-2026.html":[
      ["Festés, előkészítéssel",[["festo-elokeszites",1],["festo-glett",1],["festo-festes",1]],"/m²"],
      ["Padlóburkolás",[["burkolo-padlo",1]],"/m²"],
      ["Villamos kiállás",[["villany-kiallas",1]],"/db"],
      ["Vízvezeték-kiállás",[["viz-kiallas",1]],"/db"],
      ["Laminált padló alátéttel",[["laminalt-padlo",1]],"/m²"]],
    "szobafestes-ar-negyzetmeter-2026.html":[
      ["Festés 2 rétegben, fehér",[["festo-festes",1]],"/m²"],
      ["Felület-előkészítés és alapozás",[["festo-elokeszites",1]],"/m²"],
      ["Glettelés és csiszolás 2 rétegben",[["festo-glett",1]],"/m²"],
      ["Teljes festési rétegrend",[["festo-elokeszites",1],["festo-glett",1],["festo-festes",1]],"/m²"]]
  };
  const list=configs[page]; if(!list) return;
  function range(rows,parts){
    return parts.reduce((a,[id,q])=>{const r=rows.find(x=>x.id===id);if(!r)return a;return [a[0]+q*(Number(r.anyag_min||0)+Number(r.munka_min||0)),a[1]+q*(Number(r.anyag_max||0)+Number(r.munka_max||0))];},[0,0]);
  }
  fetch(API,{headers:{apikey:KEY}}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(rows=>{
    const h=[...document.querySelectorAll("h2")].find(x=>x.textContent.includes("Átlagos árak"));
    const ul=h?.parentElement?.querySelector("ul"); if(!ul)return;
    ul.innerHTML=list.map(([label,parts,suffix])=>{const [min,max]=range(rows,parts);return `<li><span class="font-semibold">${label}:</span> ${fmt(min)} – ${fmt(max)}${suffix}</li>`;}).join("");
    const dates=rows.map(x=>x.frissitve).filter(Boolean).sort();
    const note=document.createElement("p");note.className="mt-3 text-xs font-semibold text-emerald-700";note.textContent=`SzakiPiac referencia-adatbázis • nettó becslés • árak frissítve: ${dates[dates.length-1]||"nincs dátum"}`;ul.after(note);
  }).catch(()=>{});
})();
