import { insertLead } from './ingest.js'

const now = Date.now()
const samples = [
  ['Fürdőszoba felújításhoz burkolót keresek','Egy 7 m²-es fürdőszoba teljes burkolásához keresek megbízható szakembert.','Budapest XI.','Budapest','Burkoló',96,'350–480 ezer Ft',18,true],
  ['Villanyszerelő kellene családi ház felújításához','Régi vezetékhálózat cseréje és új elosztótábla kialakítása lenne a feladat.','Érd','Pest','Villanyszerelő',91,'Ajánlatkérés',67,false],
  ['Kerítés alapozásához és falazásához keresek kőművest','Kb. 24 méter hosszú utcafronti kerítéshez keresek számlaképes szakembert.','Győr','Győr-Moson-Sopron','Kőműves',88,'600–900 ezer Ft',132,false],
  ['Beázó tető javítására keresek szakembert','A tegnapi eső után két helyen beázást tapasztaltunk.','Esztergom','Komárom-Esztergom','Tetőfedő',94,'Sürgős felmérés',186,true],
  ['Tisztasági festéshez kérek árajánlatot','Üres, 58 m²-es lakás fehér tisztasági festése lenne szükséges.','Szeged','Csongrád-Csanád','Festő',82,'180–260 ezer Ft',304,false],
  ['Udvari térkövezés kivitelezőt keres','Kb. 85 m² udvar térkövezése vízelvezetéssel együtt.','Kecskemét','Bács-Kiskun','Térkövező',79,'1,2–1,7 millió Ft',1510,false],
]

export async function seedDemo() {
  for (const [title,excerpt,city,county,trade,score,budget,minutes,urgent] of samples) {
    await insertLead({ title, excerpt, city, county, trade, score, budget, urgent, source:'Demó forrás', sourceUrl:`https://example.invalid/demo/${encodeURIComponent(title)}`, publishedAt:new Date(now-minutes*60000), tone:urgent?'Sürgős munka':'Komoly érdeklődő' }, { demo:true, notify:false })
  }
}
