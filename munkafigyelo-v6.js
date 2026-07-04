const MUNKAFIGYELO_BUILD = "LEADGYUJTO-ONLY-20260704-1";
const VAPID_PUBLIC_KEY = "BI9GtCoUOzjMo4ILFJ84E2Ud1nWzt58dd8g3efiESKRXb71BRD2okYXt0lqCR4-VE5-Y2R89aQ2_eKQdLs9b_Qk";

const SZAKMAK = [
  "Ács", "Asztalos", "Bádogos", "Burkoló", "Épületgépész", "Festő-mázoló",
  "Gipszkartonos", "Kertépítő", "Klímaszerelő", "Kőműves", "Lakatos",
  "Napelem-szerelő", "Szigetelő", "Takarító", "Tetőfedő", "Térkövező",
  "Víz- és gázszerelő", "Villanyszerelő", "Generálkivitelező", "Egyéb szakember"
];

const MEGYEK = [
  "Budapest", "Bács-Kiskun", "Baranya", "Békés", "Borsod-Abaúj-Zemplén",
  "Csongrád-Csanád", "Fejér", "Győr-Moson-Sopron", "Hajdú-Bihar", "Heves",
  "Jász-Nagykun-Szolnok", "Komárom-Esztergom", "Nógrád", "Pest", "Somogy",
  "Szabolcs-Szatmár-Bereg", "Tolna", "Vas", "Veszprém", "Zala", "Országos"
];

const BEAGYAZOTT_KOZBESZERZESEK = [{"id":"fallback-ted-456926-2026","cim":"Magyarország – Közúti híd építése – K-híd felújítása (ép. ber. kivitelezés)","leiras":"Kiíró: Budapest Közút Zártkörűen Működő Részvénytársaság\n\nBecsült érték/keret: Közbeszerzés","szakma":"Generálkivitelező","megye":"Országos","telepules":"Budapest","iranyitoszam":null,"surgosseg":"normal","koltseg_min":null,"koltseg_max":null,"kezdes_datum":null,"forras_tipus":"kozbeszerzes","forras_url":"https://ted.europa.eu/hu/notice/456926-2026/html","lejar_at":"2099-12-31T23:59:59Z","created_at":"2026-07-03T00:00:00.000Z","updated_at":"2026-07-04T10:00:24.493Z","kapcsolat_elerheto":false},{"id":"fallback-ted-458201-2026","cim":"Magyarország – Épületszerelési munka – Csodapók Óvoda - Napsugár Bölcsőde felújítása","leiras":"Kiíró: Kőbányai Vagyonkezelő Zártkörűen Működő Részvénytársaság\n\nBecsült érték/keret: Közbeszerzés","szakma":"Generálkivitelező","megye":"Országos","telepules":"Budapest","iranyitoszam":null,"surgosseg":"normal","koltseg_min":null,"koltseg_max":null,"kezdes_datum":null,"forras_tipus":"kozbeszerzes","forras_url":"https://ted.europa.eu/hu/notice/458201-2026/html","lejar_at":"2099-12-31T23:59:59Z","created_at":"2026-07-03T00:00:00.000Z","updated_at":"2026-07-04T10:00:24.493Z","kapcsolat_elerheto":false},{"id":"fallback-ted-459274-2026","cim":"Magyarország – Pályaépítés – Aljcsere folyópályában és kitérőben","leiras":"Kiíró: MÁV Pályaműködtetési Zártkörűen Működő Részvénytársaság\n\nBecsült érték/keret: 4 473 237 000 HUF","szakma":"Generálkivitelező","megye":"Országos","telepules":"Budapest","iranyitoszam":null,"surgosseg":"normal","koltseg_min":null,"koltseg_max":null,"kezdes_datum":null,"forras_tipus":"kozbeszerzes","forras_url":"https://ted.europa.eu/hu/notice/459274-2026/html","lejar_at":"2099-12-31T23:59:59Z","created_at":"2026-07-03T00:00:00.000Z","updated_at":"2026-07-04T10:00:24.494Z","kapcsolat_elerheto":false},{"id":"fallback-ted-459725-2026","cim":"Magyarország – Iskolaépületek kivitelezése – Bővítés a Nógrádmegyeri Mikszáth K. Ált. Iskolában","leiras":"Kiíró: Balassagyarmati Tankerületi Központ\n\nBecsült érték/keret: Közbeszerzés","szakma":"Generálkivitelező","megye":"Országos","telepules":"Balassagyarmat","iranyitoszam":null,"surgosseg":"normal","koltseg_min":null,"koltseg_max":null,"kezdes_datum":null,"forras_tipus":"kozbeszerzes","forras_url":"https://ted.europa.eu/hu/notice/459725-2026/html","lejar_at":"2099-12-31T23:59:59Z","created_at":"2026-07-03T00:00:00.000Z","updated_at":"2026-07-04T10:00:24.494Z","kapcsolat_elerheto":false},{"id":"fallback-ted-459885-2026","cim":"Magyarország – Alállomás építése – „Alállomások tervezése és kivitelezése\"","leiras":"Kiíró: MÁV Pályaműködtetési Zártkörűen Működő Részvénytársaság\n\nBecsült érték/keret: Közbeszerzés","szakma":"Generálkivitelező","megye":"Országos","telepules":"Budapest","iranyitoszam":null,"surgosseg":"normal","koltseg_min":null,"koltseg_max":null,"kezdes_datum":null,"forras_tipus":"kozbeszerzes","forras_url":"https://ted.europa.eu/hu/notice/459885-2026/html","lejar_at":"2099-12-31T23:59:59Z","created_at":"2026-07-03T00:00:00.000Z","updated_at":"2026-07-04T10:00:24.494Z","kapcsolat_elerheto":false},{"id":"fallback-ted-460594-2026","cim":"Magyarország – Építési munkák – M1 Hegyeshalom határátkelő akadálymentesítése I.","leiras":"Kiíró: Építési és Közlekedési Minisztérium\n\nBecsült érték/keret: Közbeszerzés","szakma":"Generálkivitelező","megye":"Országos","telepules":"Budapest","iranyitoszam":null,"surgosseg":"normal","koltseg_min":null,"koltseg_max":null,"kezdes_datum":null,"forras_tipus":"kozbeszerzes","forras_url":"https://ted.europa.eu/hu/notice/460594-2026/html","lejar_at":"2099-12-31T23:59:59Z","created_at":"2026-07-03T00:00:00.000Z","updated_at":"2026-07-04T10:00:24.494Z","kapcsolat_elerheto":false},{"id":"fallback-ted-453831-2026","cim":"Magyarország – Közút építése – Kenyérgyári út - Textilgyári út korszerűsítése","leiras":"Kiíró: Szeged Megyei Jogú Város Önkormányzata\n\nBecsült érték/keret: Közbeszerzés","szakma":"Generálkivitelező","megye":"Országos","telepules":"Szeged","iranyitoszam":null,"surgosseg":"normal","koltseg_min":null,"koltseg_max":null,"kezdes_datum":null,"forras_tipus":"kozbeszerzes","forras_url":"https://ted.europa.eu/hu/notice/453831-2026/html","lejar_at":"2099-12-31T23:59:59Z","created_at":"2026-07-02T00:00:00.000Z","updated_at":"2026-07-04T10:00:24.493Z","kapcsolat_elerheto":false},{"id":"fallback-ted-455319-2026","cim":"Magyarország – Építési munkák – Bánki Donát Műszaki Tech. és Koll. belső felújítás","leiras":"Kiíró: Nyíregyházi Szakképzési Centrum\n\nBecsült érték/keret: Közbeszerzés","szakma":"Generálkivitelező","megye":"Országos","telepules":"Nyíregyháza","iranyitoszam":null,"surgosseg":"normal","koltseg_min":null,"koltseg_max":null,"kezdes_datum":null,"forras_tipus":"kozbeszerzes","forras_url":"https://ted.europa.eu/hu/notice/455319-2026/html","lejar_at":"2099-12-31T23:59:59Z","created_at":"2026-07-02T00:00:00.000Z","updated_at":"2026-07-04T10:00:24.493Z","kapcsolat_elerheto":false},{"id":"fallback-ted-455988-2026","cim":"Magyarország – Villamosperon építési munkái – 50-es villamosvonal peronfelújítás, II-es ütem","leiras":"Kiíró: BKK Budapesti Közlekedési Központ Zártkörűen Működő Részvénytársaság\n\nBecsült érték/keret: Közbeszerzés","szakma":"Generálkivitelező","megye":"Országos","telepules":"Budapest","iranyitoszam":null,"surgosseg":"normal","koltseg_min":null,"koltseg_max":null,"kezdes_datum":null,"forras_tipus":"kozbeszerzes","forras_url":"https://ted.europa.eu/hu/notice/455988-2026/html","lejar_at":"2099-12-31T23:59:59Z","created_at":"2026-07-02T00:00:00.000Z","updated_at":"2026-07-04T10:00:24.493Z","kapcsolat_elerheto":false},{"id":"fallback-ted-449947-2026","cim":"Magyarország – Építési munkák – Infrastruktúra fejlesztés Széchenyi Műszaki Tech.","leiras":"Kiíró: Székesfehérvári Szakképzési Centrum\n\nBecsült érték/keret: Közbeszerzés","szakma":"Generálkivitelező","megye":"Országos","telepules":"Székesfehérvár","iranyitoszam":null,"surgosseg":"normal","koltseg_min":null,"koltseg_max":null,"kezdes_datum":null,"forras_tipus":"kozbeszerzes","forras_url":"https://ted.europa.eu/hu/notice/449947-2026/html","lejar_at":"2099-12-31T23:59:59Z","created_at":"2026-07-01T00:00:00.000Z","updated_at":"2026-07-04T10:00:24.492Z","kapcsolat_elerheto":false},{"id":"fallback-ted-450441-2026","cim":"Magyarország – Felsővezeték építése – Szombathely-Kőszeg vasútvonal villamosítása","leiras":"Kiíró: Győr-Sopron-Ebenfurti Vasút Zártkörűen Működő Részvénytársaság\n\nBecsült érték/keret: Közbeszerzés","szakma":"Generálkivitelező","megye":"Országos","telepules":"Sopron","iranyitoszam":null,"surgosseg":"normal","koltseg_min":null,"koltseg_max":null,"kezdes_datum":null,"forras_tipus":"kozbeszerzes","forras_url":"https://ted.europa.eu/hu/notice/450441-2026/html","lejar_at":"2099-12-31T23:59:59Z","created_at":"2026-07-01T00:00:00.000Z","updated_at":"2026-07-04T10:00:24.492Z","kapcsolat_elerheto":false},{"id":"fallback-ted-452089-2026","cim":"Magyarország – Építési munkák – Gyömrő, Fekete István Ált. Iskola újjáépítése","leiras":"Kiíró: Építési és Közlekedési Minisztérium\n\nBecsült érték/keret: Közbeszerzés","szakma":"Generálkivitelező","megye":"Országos","telepules":"Budapest","iranyitoszam":null,"surgosseg":"normal","koltseg_min":null,"koltseg_max":null,"kezdes_datum":null,"forras_tipus":"kozbeszerzes","forras_url":"https://ted.europa.eu/hu/notice/452089-2026/html","lejar_at":"2099-12-31T23:59:59Z","created_at":"2026-07-01T00:00:00.000Z","updated_at":"2026-07-04T10:00:24.492Z","kapcsolat_elerheto":false},{"id":"fallback-ted-452435-2026","cim":"Magyarország – Hirdetési és marketingszolgáltatások – Komplex kommunikációs feladatok DKFP részére (243)","leiras":"Kiíró: Digitális Kormányzati Fejlesztés és Projektmenedzsment Korlátolt Felelősségű Társaság\n\nBecsült érték/keret: Közbeszerzés","szakma":"Generálkivitelező","megye":"Országos","telepules":"Budapest","iranyitoszam":null,"surgosseg":"normal","koltseg_min":null,"koltseg_max":null,"kezdes_datum":null,"forras_tipus":"kozbeszerzes","forras_url":"https://ted.europa.eu/hu/notice/452435-2026/html","lejar_at":"2099-12-31T23:59:59Z","created_at":"2026-07-01T00:00:00.000Z","updated_at":"2026-07-04T10:00:24.492Z","kapcsolat_elerheto":false},{"id":"fallback-ted-452724-2026","cim":"Magyarország – Vasútépítés – Pályavasúti karbantartási,felújítási tevékenységek","leiras":"Kiíró: MÁV Pályaműködtetési Zártkörűen Működő Részvénytársaság\n\nBecsült érték/keret: Közbeszerzés","szakma":"Generálkivitelező","megye":"Országos","telepules":"Budapest","iranyitoszam":null,"surgosseg":"normal","koltseg_min":null,"koltseg_max":null,"kezdes_datum":null,"forras_tipus":"kozbeszerzes","forras_url":"https://ted.europa.eu/hu/notice/452724-2026/html","lejar_at":"2099-12-31T23:59:59Z","created_at":"2026-07-01T00:00:00.000Z","updated_at":"2026-07-04T10:00:24.492Z","kapcsolat_elerheto":false},{"id":"fallback-ted-445875-2026","cim":"Magyarország – Vízelvezető rendszer építése – RESILIMET projekt: csapadékvíz-kezelés fejlesztése","leiras":"Kiíró: Budapest Airport Budapest Liszt Ferenc Nemzetközi Repülőtér Üzemeltető Zártkörűen Működő Részvénytársaság\n\nBecsült érték/keret: Közbeszerzés","szakma":"Generálkivitelező","megye":"Országos","telepules":"Budapest","iranyitoszam":null,"surgosseg":"normal","koltseg_min":null,"koltseg_max":null,"kezdes_datum":null,"forras_tipus":"kozbeszerzes","forras_url":"https://ted.europa.eu/hu/notice/445875-2026/html","lejar_at":"2099-12-31T23:59:59Z","created_at":"2026-06-30T00:00:00.000Z","updated_at":"2026-07-04T10:00:24.491Z","kapcsolat_elerheto":false},{"id":"fallback-ted-445938-2026","cim":"Magyarország – Pályaépítés – Aljcsere folyópályában és kitérőben","leiras":"Kiíró: MÁV Pályaműködtetési Zártkörűen Működő Részvénytársaság\n\nBecsült érték/keret: 4 473 237 000 HUF","szakma":"Generálkivitelező","megye":"Országos","telepules":"Budapest","iranyitoszam":null,"surgosseg":"normal","koltseg_min":null,"koltseg_max":null,"kezdes_datum":null,"forras_tipus":"kozbeszerzes","forras_url":"https://ted.europa.eu/hu/notice/445938-2026/html","lejar_at":"2099-12-31T23:59:59Z","created_at":"2026-06-30T00:00:00.000Z","updated_at":"2026-07-04T10:00:24.491Z","kapcsolat_elerheto":false},{"id":"fallback-ted-446225-2026","cim":"Magyarország – Építési munkák – KM-Burkolatfennt. és kapcs. forgalomt. munkák 2025","leiras":"Kiíró: Újpesti Városgondnokság Szolgáltató Kft.\n\nBecsült érték/keret: 1 500 000 000 HUF","szakma":"Burkoló","megye":"Országos","telepules":"Budapest","iranyitoszam":null,"surgosseg":"normal","koltseg_min":null,"koltseg_max":null,"kezdes_datum":null,"forras_tipus":"kozbeszerzes","forras_url":"https://ted.europa.eu/hu/notice/446225-2026/html","lejar_at":"2099-12-31T23:59:59Z","created_at":"2026-06-30T00:00:00.000Z","updated_at":"2026-07-04T10:00:24.491Z","kapcsolat_elerheto":false},{"id":"fallback-ted-446472-2026","cim":"Magyarország – Közút építése – Tölgyes utca felújítása","leiras":"Kiíró: Nyíregyháza Megyei Jogú Város Önkormányzata\n\nBecsült érték/keret: Közbeszerzés","szakma":"Generálkivitelező","megye":"Országos","telepules":"Nyíregyháza","iranyitoszam":null,"surgosseg":"normal","koltseg_min":null,"koltseg_max":null,"kezdes_datum":null,"forras_tipus":"kozbeszerzes","forras_url":"https://ted.europa.eu/hu/notice/446472-2026/html","lejar_at":"2099-12-31T23:59:59Z","created_at":"2026-06-30T00:00:00.000Z","updated_at":"2026-07-04T10:00:24.491Z","kapcsolat_elerheto":false},{"id":"fallback-ted-446596-2026","cim":"Magyarország – Építési munkák – Szeged,Széchenyi tér 11. műemlék épület felújítás","leiras":"Kiíró: Szeged Megyei Jogú Város Önkormányzata\n\nBecsült érték/keret: Közbeszerzés","szakma":"Generálkivitelező","megye":"Országos","telepules":"Szeged","iranyitoszam":null,"surgosseg":"normal","koltseg_min":null,"koltseg_max":null,"kezdes_datum":null,"forras_tipus":"kozbeszerzes","forras_url":"https://ted.europa.eu/hu/notice/446596-2026/html","lejar_at":"2099-12-31T23:59:59Z","created_at":"2026-06-30T00:00:00.000Z","updated_at":"2026-07-04T10:00:24.492Z","kapcsolat_elerheto":false},{"id":"fallback-ted-448349-2026","cim":"Magyarország – Építési munkák – Perkupa 22 KV-os kapcsolóállomás rekonstrukció___","leiras":"Kiíró: MVM Émász Áramhálózati Kft.\n\nBecsült érték/keret: Közbeszerzés","szakma":"Generálkivitelező","megye":"Országos","telepules":"Miskolc","iranyitoszam":null,"surgosseg":"normal","koltseg_min":null,"koltseg_max":null,"kezdes_datum":null,"forras_tipus":"kozbeszerzes","forras_url":"https://ted.europa.eu/hu/notice/448349-2026/html","lejar_at":"2099-12-31T23:59:59Z","created_at":"2026-06-30T00:00:00.000Z","updated_at":"2026-07-04T10:00:24.492Z","kapcsolat_elerheto":false},{"id":"fallback-ted-442044-2026","cim":"Magyarország – Építési munkák – Péczeli József Ált Iskola és AMI infrastr. fejl.","leiras":"Kiíró: Kazincbarcikai Tankerületi Központ\n\nBecsült érték/keret: Közbeszerzés","szakma":"Generálkivitelező","megye":"Országos","telepules":"Kazincbarcika","iranyitoszam":null,"surgosseg":"normal","koltseg_min":null,"koltseg_max":null,"kezdes_datum":null,"forras_tipus":"kozbeszerzes","forras_url":"https://ted.europa.eu/hu/notice/442044-2026/html","lejar_at":"2099-12-31T23:59:59Z","created_at":"2026-06-29T00:00:00.000Z","updated_at":"2026-07-04T10:00:24.486Z","kapcsolat_elerheto":false},{"id":"fallback-ted-443658-2026","cim":"Magyarország – Műemlékek megőrzésével kapcsolatos szolgáltatások – Rajka, középkori falfestmény restaurálása","leiras":"Kiíró: Rajkai Római Katolikus Plébánia\n\nBecsült érték/keret: 25 550 000 HUF","szakma":"Generálkivitelező","megye":"Országos","telepules":"Rajka","iranyitoszam":null,"surgosseg":"normal","koltseg_min":null,"koltseg_max":null,"kezdes_datum":null,"forras_tipus":"kozbeszerzes","forras_url":"https://ted.europa.eu/hu/notice/443658-2026/html","lejar_at":"2099-12-31T23:59:59Z","created_at":"2026-06-29T00:00:00.000Z","updated_at":"2026-07-04T10:00:24.490Z","kapcsolat_elerheto":false},{"id":"fallback-ted-445724-2026","cim":"Magyarország – Légbefúvó rendszer – Szennyvíztelepi forgódugattyús fúvók cseréje- Pápa","leiras":"Kiíró: Pápai Víz- és Csatornamű Zrt.\n\nBecsült érték/keret: Közbeszerzés","szakma":"Generálkivitelező","megye":"Országos","telepules":"Pápa","iranyitoszam":null,"surgosseg":"normal","koltseg_min":null,"koltseg_max":null,"kezdes_datum":null,"forras_tipus":"kozbeszerzes","forras_url":"https://ted.europa.eu/hu/notice/445724-2026/html","lejar_at":"2099-12-31T23:59:59Z","created_at":"2026-06-29T00:00:00.000Z","updated_at":"2026-07-04T10:00:24.490Z","kapcsolat_elerheto":false},{"id":"fallback-ted-439163-2026","cim":"Magyarország – Tűzoltó, mentő- és biztonsági felszerelések – Tűzszimulációs eszközök beszerzése","leiras":"Kiíró: Belügyminisztérium Országos Katasztrófavédelmi Főigazgatóság\n\nBecsült érték/keret: Közbeszerzés","szakma":"Generálkivitelező","megye":"Országos","telepules":"Budapest","iranyitoszam":null,"surgosseg":"normal","koltseg_min":null,"koltseg_max":null,"kezdes_datum":null,"forras_tipus":"kozbeszerzes","forras_url":"https://ted.europa.eu/hu/notice/439163-2026/html","lejar_at":"2099-12-31T23:59:59Z","created_at":"2026-06-26T00:00:00.000Z","updated_at":"2026-07-04T10:00:24.485Z","kapcsolat_elerheto":false},{"id":"fallback-ted-439500-2026","cim":"Magyarország – Építési munkák – Aszfaltozás,burkolati jel festése MÁV PM hálózatán","leiras":"Kiíró: MÁV Pályaműködtetési Zártkörűen Működő Részvénytársaság\n\nBecsült érték/keret: Közbeszerzés","szakma":"Burkoló","megye":"Országos","telepules":"Budapest","iranyitoszam":null,"surgosseg":"normal","koltseg_min":null,"koltseg_max":null,"kezdes_datum":null,"forras_tipus":"kozbeszerzes","forras_url":"https://ted.europa.eu/hu/notice/439500-2026/html","lejar_at":"2099-12-31T23:59:59Z","created_at":"2026-06-26T00:00:00.000Z","updated_at":"2026-07-04T10:00:24.485Z","kapcsolat_elerheto":false},{"id":"fallback-ted-439746-2026","cim":"Magyarország – Vízi létesítmények építése – Szeged Algyői főcsatorna fejlesztés IV. ütem","leiras":"Kiíró: Országos Vízügyi Főigazgatóság\n\nBecsült érték/keret: Közbeszerzés","szakma":"Generálkivitelező","megye":"Országos","telepules":"Budapest","iranyitoszam":null,"surgosseg":"normal","koltseg_min":null,"koltseg_max":null,"kezdes_datum":null,"forras_tipus":"kozbeszerzes","forras_url":"https://ted.europa.eu/hu/notice/439746-2026/html","lejar_at":"2099-12-31T23:59:59Z","created_at":"2026-06-26T00:00:00.000Z","updated_at":"2026-07-04T10:00:24.486Z","kapcsolat_elerheto":false},{"id":"fallback-ted-439942-2026","cim":"Magyarország – Útburkolat építése – R100 - Földi oldali infrastruktúra fejlesztés","leiras":"Kiíró: Budapest Airport Budapest Liszt Ferenc Nemzetközi Repülőtér Üzemeltető Zártkörűen Működő Részvénytársaság\n\nBecsült érték/keret: Közbeszerzés","szakma":"Burkoló","megye":"Országos","telepules":"Budapest","iranyitoszam":null,"surgosseg":"normal","koltseg_min":null,"koltseg_max":null,"kezdes_datum":null,"forras_tipus":"kozbeszerzes","forras_url":"https://ted.europa.eu/hu/notice/439942-2026/html","lejar_at":"2099-12-31T23:59:59Z","created_at":"2026-06-26T00:00:00.000Z","updated_at":"2026-07-04T10:00:24.486Z","kapcsolat_elerheto":false},{"id":"fallback-ted-440482-2026","cim":"Magyarország – Villamos hálózati szerelés – Földeléstelepítés KÖF szabadlégvezetékes hálózaton","leiras":"Kiíró: MVM Démász Áramhálózati Kft.\n\nBecsült érték/keret: Közbeszerzés","szakma":"Generálkivitelező","megye":"Országos","telepules":"Szeged","iranyitoszam":null,"surgosseg":"normal","koltseg_min":null,"koltseg_max":null,"kezdes_datum":null,"forras_tipus":"kozbeszerzes","forras_url":"https://ted.europa.eu/hu/notice/440482-2026/html","lejar_at":"2099-12-31T23:59:59Z","created_at":"2026-06-26T00:00:00.000Z","updated_at":"2026-07-04T10:00:24.486Z","kapcsolat_elerheto":false},{"id":"fallback-ted-431761-2026","cim":"Magyarország – Képalkotó berendezés orvosi, fogászati és állatorvosi használatra – DEK-1585 Röntgen és mammográf készülé","leiras":"Kiíró: Debreceni Egyetem\n\nBecsült érték/keret: Közbeszerzés","szakma":"Generálkivitelező","megye":"Országos","telepules":"Debrecen","iranyitoszam":null,"surgosseg":"normal","koltseg_min":null,"koltseg_max":null,"kezdes_datum":null,"forras_tipus":"kozbeszerzes","forras_url":"https://ted.europa.eu/hu/notice/431761-2026/html","lejar_at":"2099-12-31T23:59:59Z","created_at":"2026-06-25T00:00:00.000Z","updated_at":"2026-07-04T10:00:24.483Z","kapcsolat_elerheto":false},{"id":"fallback-ted-432263-2026","cim":"Magyarország – Építési munkák – Nyírbátor Várost elkerülő utak kivitelezése","leiras":"Kiíró: Építési és Közlekedési Minisztérium\n\nBecsült érték/keret: Közbeszerzés","szakma":"Generálkivitelező","megye":"Országos","telepules":"Budapest","iranyitoszam":null,"surgosseg":"normal","koltseg_min":null,"koltseg_max":null,"kezdes_datum":null,"forras_tipus":"kozbeszerzes","forras_url":"https://ted.europa.eu/hu/notice/432263-2026/html","lejar_at":"2099-12-31T23:59:59Z","created_at":"2026-06-25T00:00:00.000Z","updated_at":"2026-07-04T10:00:24.483Z","kapcsolat_elerheto":false},{"id":"fallback-ted-432969-2026","cim":"Magyarország – Építési munkák – Keretmegállapodás kivitelezési munkák 3.","leiras":"Kiíró: Semmelweis Egyetem\n\nBecsült érték/keret: Közbeszerzés","szakma":"Generálkivitelező","megye":"Országos","telepules":"Budapest","iranyitoszam":null,"surgosseg":"normal","koltseg_min":null,"koltseg_max":null,"kezdes_datum":null,"forras_tipus":"kozbeszerzes","forras_url":"https://ted.europa.eu/hu/notice/432969-2026/html","lejar_at":"2099-12-31T23:59:59Z","created_at":"2026-06-25T00:00:00.000Z","updated_at":"2026-07-04T10:00:24.483Z","kapcsolat_elerheto":false},{"id":"fallback-ted-433493-2026","cim":"Magyarország – Iskolaépületek kivitelezése – Meglévő tanműhely energetikai korszerűsítése","leiras":"Kiíró: Szolnoki Szakképzési Centrum\n\nBecsült érték/keret: Közbeszerzés","szakma":"Generálkivitelező","megye":"Országos","telepules":"Szolnok","iranyitoszam":null,"surgosseg":"normal","koltseg_min":null,"koltseg_max":null,"kezdes_datum":null,"forras_tipus":"kozbeszerzes","forras_url":"https://ted.europa.eu/hu/notice/433493-2026/html","lejar_at":"2099-12-31T23:59:59Z","created_at":"2026-06-25T00:00:00.000Z","updated_at":"2026-07-04T10:00:24.484Z","kapcsolat_elerheto":false},{"id":"fallback-ted-433612-2026","cim":"Magyarország – Teljes vagy részleges magas- és mélyépítési munka – ÉMO14 szennyvíztiszt. és csat. hál. fejl. feladata","leiras":"Kiíró: Közlekedési és Beruházási Minisztérium\n\nBecsült érték/keret: Közbeszerzés","szakma":"Generálkivitelező","megye":"Országos","telepules":"Budapest","iranyitoszam":null,"surgosseg":"normal","koltseg_min":null,"koltseg_max":null,"kezdes_datum":null,"forras_tipus":"kozbeszerzes","forras_url":"https://ted.europa.eu/hu/notice/433612-2026/html","lejar_at":"2099-12-31T23:59:59Z","created_at":"2026-06-25T00:00:00.000Z","updated_at":"2026-07-04T10:00:24.484Z","kapcsolat_elerheto":false},{"id":"fallback-ted-435383-2026","cim":"Magyarország – Kutatási és kísérleti létesítmények kiviteletése – HSM Gyógyszerkutatási Centrum kialakítása I. ütem","leiras":"Kiíró: Semmelweis Egyetem\n\nBecsült érték/keret: Közbeszerzés","szakma":"Generálkivitelező","megye":"Országos","telepules":"Budapest","iranyitoszam":null,"surgosseg":"normal","koltseg_min":null,"koltseg_max":null,"kezdes_datum":null,"forras_tipus":"kozbeszerzes","forras_url":"https://ted.europa.eu/hu/notice/435383-2026/html","lejar_at":"2099-12-31T23:59:59Z","created_at":"2026-06-25T00:00:00.000Z","updated_at":"2026-07-04T10:00:24.484Z","kapcsolat_elerheto":false},{"id":"fallback-ted-435906-2026","cim":"Magyarország – Építési munkák – DEK-1388 DE Főépület homlokzat felújítás","leiras":"Kiíró: Debreceni Egyetem\n\nBecsült érték/keret: Közbeszerzés","szakma":"Generálkivitelező","megye":"Országos","telepules":"Debrecen","iranyitoszam":null,"surgosseg":"normal","koltseg_min":null,"koltseg_max":null,"kezdes_datum":null,"forras_tipus":"kozbeszerzes","forras_url":"https://ted.europa.eu/hu/notice/435906-2026/html","lejar_at":"2099-12-31T23:59:59Z","created_at":"2026-06-25T00:00:00.000Z","updated_at":"2026-07-04T10:00:24.484Z","kapcsolat_elerheto":false},{"id":"fallback-ted-436050-2026","cim":"Magyarország – Útburkolat építése – 471. sz. főút (1+000-2+850 km) fejlesztése","leiras":"Kiíró: Építési és Közlekedési Minisztérium\n\nBecsült érték/keret: Közbeszerzés","szakma":"Burkoló","megye":"Országos","telepules":"Budapest","iranyitoszam":null,"surgosseg":"normal","koltseg_min":null,"koltseg_max":null,"kezdes_datum":null,"forras_tipus":"kozbeszerzes","forras_url":"https://ted.europa.eu/hu/notice/436050-2026/html","lejar_at":"2099-12-31T23:59:59Z","created_at":"2026-06-25T00:00:00.000Z","updated_at":"2026-07-04T10:00:24.484Z","kapcsolat_elerheto":false},{"id":"fallback-ted-436577-2026","cim":"Magyarország – Gázvezetékek építése – Gázelosztó vezeték rekonstrukciós munkák","leiras":"Kiíró: MVM Főgáz Földgázhálózati Kft.\n\nBecsült érték/keret: Közbeszerzés","szakma":"Generálkivitelező","megye":"Országos","telepules":"Budapest","iranyitoszam":null,"surgosseg":"normal","koltseg_min":null,"koltseg_max":null,"kezdes_datum":null,"forras_tipus":"kozbeszerzes","forras_url":"https://ted.europa.eu/hu/notice/436577-2026/html","lejar_at":"2099-12-31T23:59:59Z","created_at":"2026-06-25T00:00:00.000Z","updated_at":"2026-07-04T10:00:24.484Z","kapcsolat_elerheto":false},{"id":"fallback-ted-437486-2026","cim":"Magyarország – Centrifuga – Centrifuga és kihordórendszerének cseréje","leiras":"Kiíró: Fővárosi Vízművek Zártkörűen Működő Részvénytársaság\n\nBecsült érték/keret: Közbeszerzés","szakma":"Generálkivitelező","megye":"Országos","telepules":"Budapest","iranyitoszam":null,"surgosseg":"normal","koltseg_min":null,"koltseg_max":null,"kezdes_datum":null,"forras_tipus":"kozbeszerzes","forras_url":"https://ted.europa.eu/hu/notice/437486-2026/html","lejar_at":"2099-12-31T23:59:59Z","created_at":"2026-06-25T00:00:00.000Z","updated_at":"2026-07-04T10:00:24.485Z","kapcsolat_elerheto":false},{"id":"fallback-ted-438132-2026","cim":"Magyarország – Erősáramú vezeték építése – Hálózatfejlesztés-Hálózati csatlakozás megvalósítá","leiras":"Kiíró: MVM Démász Áramhálózati Kft.\n\nBecsült érték/keret: Közbeszerzés","szakma":"Generálkivitelező","megye":"Országos","telepules":"Szeged","iranyitoszam":null,"surgosseg":"normal","koltseg_min":null,"koltseg_max":null,"kezdes_datum":null,"forras_tipus":"kozbeszerzes","forras_url":"https://ted.europa.eu/hu/notice/438132-2026/html","lejar_at":"2099-12-31T23:59:59Z","created_at":"2026-06-25T00:00:00.000Z","updated_at":"2026-07-04T10:00:24.485Z","kapcsolat_elerheto":false},{"id":"fallback-ted-438566-2026","cim":"Magyarország – Építési munkák – Szolgáltatóház kialakítása","leiras":"Kiíró: Karcag Városi Önkormányzat\n\nBecsült érték/keret: Közbeszerzés","szakma":"Generálkivitelező","megye":"Országos","telepules":"Karcag","iranyitoszam":null,"surgosseg":"normal","koltseg_min":null,"koltseg_max":null,"kezdes_datum":null,"forras_tipus":"kozbeszerzes","forras_url":"https://ted.europa.eu/hu/notice/438566-2026/html","lejar_at":"2099-12-31T23:59:59Z","created_at":"2026-06-25T00:00:00.000Z","updated_at":"2026-07-04T10:00:24.485Z","kapcsolat_elerheto":false},{"id":"fallback-ted-430547-2026","cim":"Magyarország – Kardio-angiográfiás készülékek – DEK-1621 DSA készülék besz. bérleti konstrukcióban","leiras":"Kiíró: Debreceni Egyetem\n\nBecsült érték/keret: Közbeszerzés","szakma":"Generálkivitelező","megye":"Országos","telepules":"Debrecen","iranyitoszam":null,"surgosseg":"normal","koltseg_min":null,"koltseg_max":null,"kezdes_datum":null,"forras_tipus":"kozbeszerzes","forras_url":"https://ted.europa.eu/hu/notice/430547-2026/html","lejar_at":"2099-12-31T23:59:59Z","created_at":"2026-06-24T00:00:00.000Z","updated_at":"2026-07-04T10:00:24.482Z","kapcsolat_elerheto":false},{"id":"fallback-ted-430881-2026","cim":"Magyarország – Villamosperon építési munkái – 56-56A villamosvonal peronok akadálymentesítése","leiras":"Kiíró: BKK Budapesti Közlekedési Központ Zártkörűen Működő Részvénytársaság\n\nBecsült érték/keret: Közbeszerzés","szakma":"Generálkivitelező","megye":"Országos","telepules":"Budapest","iranyitoszam":null,"surgosseg":"normal","koltseg_min":null,"koltseg_max":null,"kezdes_datum":null,"forras_tipus":"kozbeszerzes","forras_url":"https://ted.europa.eu/hu/notice/430881-2026/html","lejar_at":"2099-12-31T23:59:59Z","created_at":"2026-06-24T00:00:00.000Z","updated_at":"2026-07-04T10:00:24.482Z","kapcsolat_elerheto":false},{"id":"fallback-ted-431298-2026","cim":"Magyarország – Alállomás építése – DUVI 132/11 kV-os alállomás, kábelvonal létesítése","leiras":"Kiíró: ELMŰ Hálózati Kft.\n\nBecsült érték/keret: Közbeszerzés","szakma":"Generálkivitelező","megye":"Országos","telepules":"Budapest","iranyitoszam":null,"surgosseg":"normal","koltseg_min":null,"koltseg_max":null,"kezdes_datum":null,"forras_tipus":"kozbeszerzes","forras_url":"https://ted.europa.eu/hu/notice/431298-2026/html","lejar_at":"2099-12-31T23:59:59Z","created_at":"2026-06-24T00:00:00.000Z","updated_at":"2026-07-04T10:00:24.482Z","kapcsolat_elerheto":false},{"id":"fallback-ted-431706-2026","cim":"Magyarország – Villamos hálózati szerelés – Üzemzavarelhárítási és megelőzési munkák Émász","leiras":"Kiíró: MVM Émász Áramhálózati Kft.\n\nBecsült érték/keret: Közbeszerzés","szakma":"Generálkivitelező","megye":"Országos","telepules":"Miskolc","iranyitoszam":null,"surgosseg":"normal","koltseg_min":null,"koltseg_max":null,"kezdes_datum":null,"forras_tipus":"kozbeszerzes","forras_url":"https://ted.europa.eu/hu/notice/431706-2026/html","lejar_at":"2099-12-31T23:59:59Z","created_at":"2026-06-24T00:00:00.000Z","updated_at":"2026-07-04T10:00:24.483Z","kapcsolat_elerheto":false},{"id":"fallback-ted-425515-2026","cim":"Magyarország – Építési munkák – SZTE Szentesi MC geoterm.hőell.kialakítása II.ütem","leiras":"Kiíró: Szegedi Tudományegyetem\n\nBecsült érték/keret: Közbeszerzés","szakma":"Generálkivitelező","megye":"Országos","telepules":"Szeged","iranyitoszam":null,"surgosseg":"normal","koltseg_min":null,"koltseg_max":null,"kezdes_datum":null,"forras_tipus":"kozbeszerzes","forras_url":"https://ted.europa.eu/hu/notice/425515-2026/html","lejar_at":"2099-12-31T23:59:59Z","created_at":"2026-06-22T00:00:00.000Z","updated_at":"2026-07-04T10:00:24.481Z","kapcsolat_elerheto":false},{"id":"fallback-ted-426976-2026","cim":"Magyarország – Alállomás építése – Pécel 132/22 kV alállomás létesítése","leiras":"Kiíró: ELMŰ Hálózati Kft.\n\nBecsült érték/keret: Közbeszerzés","szakma":"Generálkivitelező","megye":"Országos","telepules":"Budapest","iranyitoszam":null,"surgosseg":"normal","koltseg_min":null,"koltseg_max":null,"kezdes_datum":null,"forras_tipus":"kozbeszerzes","forras_url":"https://ted.europa.eu/hu/notice/426976-2026/html","lejar_at":"2099-12-31T23:59:59Z","created_at":"2026-06-22T00:00:00.000Z","updated_at":"2026-07-04T10:00:24.481Z","kapcsolat_elerheto":false},{"id":"fallback-ted-427312-2026","cim":"Magyarország – Víz- és szennyvízvezetékek építése – Veszprém, Cholnoky J. u vízvezeték rekonstrukció","leiras":"Kiíró: Kiskunsági Víziközmű-Szolgáltató Korlátolt Felelősségű Társaság\n\nBecsült érték/keret: Közbeszerzés","szakma":"Generálkivitelező","megye":"Országos","telepules":"Kiskunhalas","iranyitoszam":null,"surgosseg":"normal","koltseg_min":null,"koltseg_max":null,"kezdes_datum":null,"forras_tipus":"kozbeszerzes","forras_url":"https://ted.europa.eu/hu/notice/427312-2026/html","lejar_at":"2099-12-31T23:59:59Z","created_at":"2026-06-22T00:00:00.000Z","updated_at":"2026-07-04T10:00:24.481Z","kapcsolat_elerheto":false},{"id":"fallback-ted-427503-2026","cim":"Magyarország – Közvilágítás-karbantartási szolgáltatások – Közvilágítás korszerűsítés Sátoraljaújhelyen","leiras":"Kiíró: Sátoraljaújhely Város Önkormányzata\n\nBecsült érték/keret: Közbeszerzés","szakma":"Generálkivitelező","megye":"Országos","telepules":"Sátoraljaújhely","iranyitoszam":null,"surgosseg":"normal","koltseg_min":null,"koltseg_max":null,"kezdes_datum":null,"forras_tipus":"kozbeszerzes","forras_url":"https://ted.europa.eu/hu/notice/427503-2026/html","lejar_at":"2099-12-31T23:59:59Z","created_at":"2026-06-22T00:00:00.000Z","updated_at":"2026-07-04T10:00:24.482Z","kapcsolat_elerheto":false},{"id":"fallback-ted-427674-2026","cim":"Magyarország – Magasépítési munka – Infrastrukturális fejlesztés Tarnamérai Ált. Isk.","leiras":"Kiíró: Egri Tankerületi Központ\n\nBecsült érték/keret: Közbeszerzés","szakma":"Generálkivitelező","megye":"Országos","telepules":"Eger","iranyitoszam":null,"surgosseg":"normal","koltseg_min":null,"koltseg_max":null,"kezdes_datum":null,"forras_tipus":"kozbeszerzes","forras_url":"https://ted.europa.eu/hu/notice/427674-2026/html","lejar_at":"2099-12-31T23:59:59Z","created_at":"2026-06-22T00:00:00.000Z","updated_at":"2026-07-04T10:00:24.482Z","kapcsolat_elerheto":false}];
const SAVED_KEY = "szakipiac_munkafigyelo_saved_v2";

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;"
  }[ch] || ch));
}

function normalizeLead(row) {
  return {
    id: String(row.id || row.forras_url || row.cim || crypto.randomUUID()),
    cim: row.cim || "Névtelen munka",
    leiras: row.leiras || "",
    szakma: row.szakma || "Egyéb szakember",
    megye: row.megye || "Országos",
    telepules: row.telepules || "",
    iranyitoszam: row.iranyitoszam || "",
    surgosseg: row.surgosseg || "normal",
    koltseg_min: row.koltseg_min ?? null,
    koltseg_max: row.koltseg_max ?? null,
    kezdes_datum: row.kezdes_datum || null,
    forras_tipus: row.forras_tipus || "nyilvanos_forras",
    forras_url: row.forras_url || "",
    lejar_at: row.lejar_at || null,
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || row.created_at || null,
    kapcsolat_elerheto: Boolean(row.kapcsolat_elerheto)
  };
}

function formatDate(value) {
  if (!value) return "ismeretlen";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "ismeretlen";
  return d.toLocaleDateString("hu-HU", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function money(value) {
  if (value == null || value === "") return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("hu-HU") + " Ft";
}

function budgetText(lead) {
  if (lead.koltseg_min != null && lead.koltseg_max != null) return `${money(lead.koltseg_min)} – ${money(lead.koltseg_max)}`;
  if (lead.koltseg_min != null) return `${money(lead.koltseg_min)} felett`;
  if (lead.koltseg_max != null) return `${money(lead.koltseg_max)} alatt`;
  return lead.forras_tipus === "kozbeszerzes" ? "Közbeszerzés" : "Nincs megadva";
}

function typeLabel(type) {
  if (type === "kozbeszerzes") return "Közbeszerzés";
  if (type === "megrendelo") return "Megrendelői munka";
  return "Nyilvános forrás";
}

function typeBadge(type) {
  if (type === "kozbeszerzes") return "bg-indigo-50 text-indigo-700 border-indigo-200";
  if (type === "megrendelo") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

function urgencyLabel(value) {
  if (value === "surgos") return "Sürgős";
  if (value === "hamarosan") return "Hamarosan";
  return "Rugalmas";
}

function savedIds() {
  try { return new Set(JSON.parse(localStorage.getItem(SAVED_KEY) || "[]")); } catch { return new Set(); }
}

function saveIds(set) { localStorage.setItem(SAVED_KEY, JSON.stringify([...set])); }

function optionList(items, empty) {
  return `<option value="">${esc(empty)}</option>` + items.map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join("");
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

export function createMunkafigyelo({ client, showToast = () => {}, trackEvent = () => {}, adminEmail = "" }) {
  let root = null;
  let activeType = "all";
  let allLeads = [];
  let lastLoadError = null;
  let currentSession = null;

  async function refreshSession() {
    const { data } = await client.auth.getSession();
    currentSession = data?.session || null;
    return currentSession;
  }

  async function loadLeads() {
    lastLoadError = null;
    try {
      let res = await client
        .from("munkafigyelo_nyilvanos")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (res.error) {
        res = await client
          .from("munkafigyelo_hirdetesek")
          .select("id,cim,leiras,szakma,megye,telepules,iranyitoszam,surgosseg,koltseg_min,koltseg_max,kezdes_datum,forras_tipus,forras_url,lejar_at,created_at,updated_at,owner_id")
          .eq("allapot", "aktiv")
          .gt("lejar_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(200);
      }

      if (res.error) throw res.error;
      const rows = (res.data || []).map(row => normalizeLead({ ...row, kapcsolat_elerheto: row.kapcsolat_elerheto ?? Boolean(row.owner_id) }));
      if (rows.length) return rows.filter(x => x.forras_tipus === "megrendelo" || x.forras_url);
    } catch (err) {
      lastLoadError = err;
      console.warn("Munkafigyelő betöltési hiba:", err);
    }
    return BEAGYAZOTT_KOZBESZERZESEK.map(normalizeLead);
  }

  function filteredLeads() {
    const q = (root?.querySelector("[data-mf-search]")?.value || "").trim().toLowerCase();
    const szakma = root?.querySelector("[data-mf-szakma]")?.value || "";
    const megye = root?.querySelector("[data-mf-megye]")?.value || "";
    return allLeads.filter(lead => {
      if (activeType !== "all" && lead.forras_tipus !== activeType) return false;
      if (szakma && lead.szakma !== szakma) return false;
      if (megye && lead.megye !== megye && lead.megye !== "Országos") return false;
      if (q) {
        const hay = `${lead.cim} ${lead.leiras} ${lead.szakma} ${lead.megye} ${lead.telepules}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  function card(lead) {
    const saved = savedIds().has(lead.id);
    const hasLink = Boolean(lead.forras_url);
    const canContact = lead.forras_tipus === "megrendelo" && lead.kapcsolat_elerheto;
    return `<article class="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 hover:shadow-md transition" data-lead-id="${esc(lead.id)}">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex flex-wrap gap-2 mb-2">
            <span class="inline-flex border rounded-full px-3 py-1 text-xs font-black ${typeBadge(lead.forras_tipus)}">${typeLabel(lead.forras_tipus)}</span>
            <span class="inline-flex bg-slate-100 text-slate-700 rounded-full px-3 py-1 text-xs font-black">${esc(lead.szakma)}</span>
            <span class="inline-flex bg-orange-50 text-orange-700 rounded-full px-3 py-1 text-xs font-black">${urgencyLabel(lead.surgosseg)}</span>
          </div>
          <h3 class="text-xl font-black text-slate-900 leading-tight">${esc(lead.cim)}</h3>
          <p class="text-sm text-slate-500 mt-1">📍 ${esc([lead.iranyitoszam, lead.telepules, lead.megye].filter(Boolean).join(" "))} · Frissítve: ${formatDate(lead.created_at)}</p>
        </div>
        <button type="button" data-save-lead="${esc(lead.id)}" class="rounded-xl border border-slate-300 px-3 py-2 text-sm font-black hover:bg-slate-50">${saved ? "★ Mentve" : "☆ Mentés"}</button>
      </div>
      <p class="text-slate-700 mt-4 whitespace-pre-line line-clamp-4">${esc(lead.leiras)}</p>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 text-sm">
        <div class="rounded-xl bg-slate-50 p-3"><b>Keret:</b><br>${esc(budgetText(lead))}</div>
        <div class="rounded-xl bg-slate-50 p-3"><b>Kezdés:</b><br>${esc(lead.kezdes_datum ? formatDate(lead.kezdes_datum) : "Nincs megadva")}</div>
        <div class="rounded-xl bg-slate-50 p-3"><b>Forrás:</b><br>${esc(typeLabel(lead.forras_tipus))}</div>
      </div>
      <div class="flex flex-wrap gap-3 mt-5">
        ${hasLink ? `<a href="${esc(lead.forras_url)}" target="_blank" rel="noopener noreferrer" class="bg-emerald-700 text-white rounded-xl px-4 py-2.5 font-black hover:bg-emerald-800">Eredeti hirdetés megnyitása</a>` : ""}
        ${canContact ? `<button type="button" data-contact-lead="${esc(lead.id)}" class="bg-blue-700 text-white rounded-xl px-4 py-2.5 font-black hover:bg-blue-800">Kapcsolatfelvétel</button>` : ""}
        <button type="button" data-details-lead="${esc(lead.id)}" class="border border-slate-300 rounded-xl px-4 py-2.5 font-black hover:bg-slate-50">Részletek</button>
      </div>
    </article>`;
  }

  function renderList() {
    const list = root.querySelector("[data-mf-list]");
    const count = root.querySelector("[data-mf-count]");
    if (!list) return;
    const leads = filteredLeads();
    if (count) count.textContent = `${leads.length} találat`;
    list.innerHTML = leads.length
      ? leads.map(card).join("")
      : `<div class="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center text-slate-500 font-bold">Most nincs találat ezekkel a szűrőkkel.</div>`;
    wireListButtons();
  }

  function setType(type) {
    activeType = type;
    root.querySelectorAll("[data-mf-type]").forEach(btn => {
      const active = btn.dataset.mfType === type;
      btn.className = `px-4 py-2.5 rounded-xl text-sm font-black border transition ${active ? "bg-emerald-700 text-white border-emerald-700" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"}`;
    });
    renderList();
  }

  function wireListButtons() {
    root.querySelectorAll("[data-save-lead]").forEach(btn => btn.addEventListener("click", () => {
      const ids = savedIds();
      const id = btn.dataset.saveLead;
      if (ids.has(id)) ids.delete(id); else ids.add(id);
      saveIds(ids);
      renderList();
    }));

    root.querySelectorAll("[data-details-lead]").forEach(btn => btn.addEventListener("click", () => {
      const lead = allLeads.find(x => x.id === btn.dataset.detailsLead);
      if (!lead) return;
      alert(`${lead.cim}

${lead.leiras}

Hely: ${lead.telepules} ${lead.megye}
Forrás: ${typeLabel(lead.forras_tipus)}`);
    }));

    root.querySelectorAll("[data-contact-lead]").forEach(btn => btn.addEventListener("click", async () => {
      const id = btn.dataset.contactLead;
      const message = prompt("Írd meg röviden, miben tudsz segíteni a megrendelőnek:");
      if (!message) return;
      const { data: sessionData } = await client.auth.getSession();
      if (!sessionData?.session?.user) { showToast("Kapcsolatfelvételhez jelentkezz be.", "error"); return; }
      const res = await client.rpc("munkafigyelo_kapcsolat_kuldese", { p_hirdetes_id: id, p_uzenet: message });
      if (res.error) { showToast("Nem sikerült elküldeni: " + res.error.message, "error"); return; }
      showToast("Üzenet elküldve a megrendelőnek.");
    }));
  }

  function shellHtml() {
    return `<section class="max-w-7xl mx-auto px-4 py-8">
      <div class="rounded-3xl bg-gradient-to-br from-emerald-700 to-slate-900 text-white p-6 md:p-8 shadow-xl mb-6">
        <div class="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
          <div>
            <p class="uppercase tracking-[0.25em] text-emerald-100 text-xs font-black mb-2">SzakiPiac Munkafigyelő</p>
            <h1 class="text-3xl md:text-5xl font-black leading-tight">Friss munkák egy helyen</h1>
            <p class="text-emerald-50 mt-3 max-w-3xl">Itt nem hirdetést adsz fel. A rendszer nyilvános forrásokból, partnerlistákból és közbeszerzésekből mutat munkalehetőségeket a szakiknak.</p>
          </div>
          <div class="bg-white/10 border border-white/20 rounded-2xl p-4 min-w-[220px]"><div class="text-sm text-emerald-50">Aktív verzió</div><div class="font-black">${MUNKAFIGYELO_BUILD}</div></div>
        </div>
      </div>

      <div class="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 mb-5 text-sm font-bold">
        A megrendelői munkákat és közbeszerzéseket csak listázzuk. Válaszolni az eredeti hirdetésnél lehet, vagy belső üzenettel akkor, ha a rekordhoz van megrendelői kapcsolat.
      </div>

      ${lastLoadError ? `<div class="bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl p-4 mb-5 text-sm font-bold">Supabase betöltési hiba: ${esc(lastLoadError.message || lastLoadError)}<br>A beépített közbeszerzési tartaléklista jelenik meg.</div>` : ""}

      <div class="grid grid-cols-1 lg:grid-cols-[1fr_330px] gap-6">
        <div>
          <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm mb-4">
            <div class="flex flex-wrap gap-2 mb-4">
              <button type="button" data-mf-type="all">Összes</button>
              <button type="button" data-mf-type="megrendelo">Megrendelői munkák</button>
              <button type="button" data-mf-type="nyilvanos_forras">Nyilvános források</button>
              <button type="button" data-mf-type="kozbeszerzes">Közbeszerzések</button>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input data-mf-search placeholder="Keresés: burkoló, tető, felújítás..." class="md:col-span-2 rounded-xl border border-slate-300 p-3">
              <select data-mf-szakma class="rounded-xl border border-slate-300 p-3">${optionList(SZAKMAK, "Minden szakma")}</select>
              <select data-mf-megye class="rounded-xl border border-slate-300 p-3">${optionList(MEGYEK, "Minden megye")}</select>
            </div>
            <div class="mt-3 text-sm font-black text-slate-600" data-mf-count></div>
          </div>
          <div class="space-y-4" data-mf-list></div>
        </div>

        <aside class="space-y-4">
          <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h2 class="text-xl font-black mb-2">Értesítések</h2>
            <p class="text-sm text-slate-600 mb-4">Kapcsold be, hogy jelezzen, ha új munka vagy közbeszerzés kerül a rendszerbe.</p>
            <button type="button" data-enable-push class="w-full bg-emerald-700 text-white rounded-xl px-4 py-3 font-black hover:bg-emerald-800">Értesítés bekapcsolása</button>
            <button type="button" data-disable-push class="w-full mt-2 border border-slate-300 rounded-xl px-4 py-3 font-black hover:bg-slate-50">Értesítés kikapcsolása</button>
            <div data-push-status class="hidden mt-3 rounded-xl border p-3 text-sm font-bold"></div>
          </div>
          <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h2 class="text-xl font-black mb-2">Mentett munkák</h2>
            <p class="text-sm text-slate-600 mb-3">A csillaggal mentett találatok itt maradnak ezen az eszközön.</p>
            <button type="button" data-show-saved class="w-full border border-slate-300 rounded-xl px-4 py-3 font-black hover:bg-slate-50">Mentettek mutatása</button>
          </div>
        </aside>
      </div>
    </section>`;
  }

  async function enablePush() {
    const box = root.querySelector("[data-push-status]");
    const status = (message, type = "info") => {
      box.className = `mt-3 rounded-xl border p-3 text-sm font-bold ${type === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`;
      box.textContent = message;
    };
    try {
      const session = await refreshSession();
      if (!session?.user?.id) throw new Error("Értesítéshez jelentkezz be.");
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) throw new Error("Ez a böngésző nem támogatja a push értesítést.");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Az értesítési engedély nincs megadva.");
      const registration = await navigator.serviceWorker.register("/service-worker.js");
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
      }
      const json = subscription.toJSON();
      const res = await client.from("munkafigyelo_push_feliratkozasok").upsert({
        user_id: session.user.id,
        endpoint: json.endpoint,
        p256dh: json.keys?.p256dh,
        auth_key: json.keys?.auth,
        szakmak: [],
        megyek: [],
        surgossegek: [],
        aktiv: true,
        updated_at: new Date().toISOString()
      }, { onConflict: "endpoint" });
      if (res.error) throw res.error;
      status("Értesítés bekapcsolva. Új munka vagy közbeszerzés érkezésekor jelezhet a rendszer.");
      showToast("Munkafigyelő értesítés bekapcsolva.");
    } catch (err) {
      status(err.message || String(err), "error");
      showToast("Értesítés hiba: " + (err.message || err), "error");
    }
  }

  async function disablePush() {
    const box = root.querySelector("[data-push-status]");
    const status = msg => { box.className = "mt-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 p-3 text-sm font-bold"; box.textContent = msg; };
    try {
      const registration = await navigator.serviceWorker?.getRegistration?.();
      const subscription = await registration?.pushManager?.getSubscription?.();
      if (subscription) {
        await client.from("munkafigyelo_push_feliratkozasok").update({ aktiv: false, updated_at: new Date().toISOString() }).eq("endpoint", subscription.endpoint);
        await subscription.unsubscribe();
      }
      status("Értesítés kikapcsolva ezen az eszközön.");
    } catch (err) {
      status("Nem sikerült kikapcsolni: " + (err.message || err));
    }
  }

  async function showPage() {
    root = document.getElementById("munkafigyelo-page");
    if (!root) return;
    root.innerHTML = `<section class="max-w-7xl mx-auto px-4 py-10"><div class="bg-white rounded-2xl border border-slate-200 p-8 text-center font-black">Munkafigyelő betöltése…</div></section>`;
    await refreshSession();
    allLeads = await loadLeads();
    root.innerHTML = shellHtml();
    root.querySelectorAll("[data-mf-type]").forEach(btn => btn.addEventListener("click", () => setType(btn.dataset.mfType)));
    root.querySelector("[data-mf-search]")?.addEventListener("input", renderList);
    root.querySelector("[data-mf-szakma]")?.addEventListener("change", renderList);
    root.querySelector("[data-mf-megye]")?.addEventListener("change", renderList);
    root.querySelector("[data-show-saved]")?.addEventListener("click", () => {
      const ids = savedIds();
      activeType = "all";
      const saved = allLeads.filter(x => ids.has(x.id));
      root.querySelector("[data-mf-list]").innerHTML = saved.length ? saved.map(card).join("") : `<div class="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center text-slate-500 font-bold">Még nincs mentett munka.</div>`;
      root.querySelector("[data-mf-count]").textContent = `${saved.length} mentett találat`;
      wireListButtons();
    });
    root.querySelector("[data-enable-push]")?.addEventListener("click", enablePush);
    root.querySelector("[data-disable-push]")?.addEventListener("click", disablePush);
    setType("all");
    trackEvent("munkafigyelo_view", { count: allLeads.length });
  }

  async function renderAdmin(panel, session) {
    if (!panel) return;
    const email = (session?.user?.email || "").toLowerCase();
    if (adminEmail && email !== adminEmail.toLowerCase()) {
      panel.innerHTML = `<div class="bg-white border border-slate-200 rounded-2xl p-6 text-slate-600">A Munkafigyelő admin rész csak adminnak látszik.</div>`;
      return;
    }
    panel.innerHTML = `<div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 md:p-7">
      <h2 class="text-2xl font-black mb-2">Munkafigyelő admin</h2>
      <p class="text-sm text-slate-600 mb-5">Itt külső forrásból talált munkát vagy közbeszerzést tudsz felvinni. Ez nem lakossági hirdetésfeladás.</p>
      <form data-admin-lead-form class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input name="cim" required minlength="8" placeholder="Munka címe" class="rounded-xl border border-slate-300 p-3 md:col-span-2">
        <textarea name="leiras" required minlength="20" rows="4" placeholder="Rövid leírás / kiíró / fontos adatok" class="rounded-xl border border-slate-300 p-3 md:col-span-2"></textarea>
        <select name="szakma" required class="rounded-xl border border-slate-300 p-3">${optionList(SZAKMAK, "Szakma")}</select>
        <select name="megye" required class="rounded-xl border border-slate-300 p-3">${optionList(MEGYEK, "Megye")}</select>
        <input name="telepules" required placeholder="Település" class="rounded-xl border border-slate-300 p-3">
        <select name="forras_tipus" class="rounded-xl border border-slate-300 p-3"><option value="nyilvanos_forras">Nyilvános forrás</option><option value="kozbeszerzes">Közbeszerzés</option></select>
        <input name="forras_url" required type="url" placeholder="Eredeti hirdetés / TED link" class="rounded-xl border border-slate-300 p-3 md:col-span-2">
        <button class="bg-emerald-700 text-white rounded-xl px-5 py-3 font-black md:col-span-2">Külső munka felvétele</button>
        <div data-admin-status class="hidden md:col-span-2 rounded-xl border p-3 text-sm font-bold"></div>
      </form>
    </div>`;
    const form = panel.querySelector("[data-admin-lead-form]");
    const status = (msg, type = "info") => {
      const box = panel.querySelector("[data-admin-status]");
      box.className = `md:col-span-2 rounded-xl border p-3 text-sm font-bold ${type === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`;
      box.textContent = msg;
    };
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const fd = new FormData(form);
      const payload = {
        cim: String(fd.get("cim") || "").trim(),
        leiras: String(fd.get("leiras") || "").trim(),
        szakma: fd.get("szakma"),
        megye: fd.get("megye"),
        telepules: String(fd.get("telepules") || "").trim(),
        surgosseg: "normal",
        forras_tipus: fd.get("forras_tipus") || "nyilvanos_forras",
        forras_url: String(fd.get("forras_url") || "").trim(),
        allapot: "aktiv",
        lejar_at: new Date(Date.now() + 90 * 86400000).toISOString()
      };
      if (!payload.cim || !payload.leiras || !payload.forras_url) return status("Cím, leírás és forrás link kötelező.", "error");
      const res = await client.from("munkafigyelo_hirdetesek").insert(payload).select("id").single();
      if (res.error) return status("Mentési hiba: " + res.error.message, "error");
      status("Külső munka elmentve. Ha a push edge function telepítve van, értesítést is küldhet.");
      client.functions.invoke("munkafigyelo-push", { body: { hirdetesId: res.data.id } }).catch(() => {});
      form.reset();
    });
  }

  return { showPage, renderAdmin };
}
