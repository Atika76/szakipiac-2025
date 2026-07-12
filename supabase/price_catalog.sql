-- SzakiPiac szerkeszthető építőipari referenciaár-katalógus.
create table if not exists public.epitoipari_arak (
  id text primary key,
  szakag text not null,
  megnevezes text not null,
  tipus text not null default 'anyag',
  egyseg text not null,
  anyag_min numeric not null default 0,
  anyag_atlag numeric not null default 0,
  anyag_max numeric not null default 0,
  munka_min numeric not null default 0,
  munka_atlag numeric not null default 0,
  munka_max numeric not null default 0,
  norma_ora_min numeric not null default 0,
  norma_ora_atlag numeric not null default 0,
  norma_ora_max numeric not null default 0,
  munkatartalom text,
  alap_mennyiseg numeric not null default 1,
  forras text,
  frissitve date not null default current_date,
  aktiv boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Meglévő telepítés biztonságos bővítése. A forrás belső adminadat, a látogatói
-- kalkulátorban nem jelenik meg és nem viszi el a felhasználót más weboldalra.
alter table public.epitoipari_arak add column if not exists norma_ora_min numeric not null default 0;
alter table public.epitoipari_arak add column if not exists norma_ora_atlag numeric not null default 0;
alter table public.epitoipari_arak add column if not exists norma_ora_max numeric not null default 0;
alter table public.epitoipari_arak add column if not exists munkatartalom text;

alter table public.epitoipari_arak enable row level security;
grant select on public.epitoipari_arak to anon, authenticated;
grant insert, update, delete on public.epitoipari_arak to authenticated;

drop policy if exists "epitoipari_arak_public_read" on public.epitoipari_arak;
create policy "epitoipari_arak_public_read" on public.epitoipari_arak
for select to anon, authenticated using (aktiv = true or lower(coalesce(auth.jwt() ->> 'email','')) = 'atika.76@windowslive.com');

drop policy if exists "epitoipari_arak_admin_all" on public.epitoipari_arak;
create policy "epitoipari_arak_admin_all" on public.epitoipari_arak
for all to authenticated
using (lower(coalesce(auth.jwt() ->> 'email','')) = 'atika.76@windowslive.com')
with check (lower(coalesce(auth.jwt() ->> 'email','')) = 'atika.76@windowslive.com');

insert into public.epitoipari_arak
(id,szakag,megnevezes,tipus,egyseg,anyag_min,anyag_atlag,anyag_max,munka_min,munka_atlag,munka_max,alap_mennyiseg,forras,frissitve)
values
('szerkezet-gepi-asas','szerkezet','Gépi alapárok ásás','munka','m³',0,0,0,2800,3500,4800,1,'SzakiPiac 2026 referencia','2026-07-12'),
('szerkezet-savalap','szerkezet','Sávalap betonozás (C16/20)','anyag','m³',30000,35000,43000,12500,15500,21000,1,'SzakiPiac 2026 referencia','2026-07-12'),
('szerkezet-fofal','szerkezet','Főfalazás (30-as tégla)','anyag','m²',10500,12500,15500,7000,8500,11500,1,'SzakiPiac 2026 referencia','2026-07-12'),
('szerkezet-valaszfal','szerkezet','Válaszfalazás (10-es tégla)','anyag','m²',5700,6800,8500,4500,5500,7500,1,'SzakiPiac 2026 referencia','2026-07-12'),
('festo-elokeszites','festo','Felület-előkészítés és alapozás','anyag','m²',350,450,650,650,850,1200,1,'https://ujrafestes.hu/arak/festes-arak-2026.html','2026-07-12'),
('festo-glett','festo','Glettelés és csiszolás 2 rétegben','anyag','m²',850,1100,1450,2200,2850,3500,1,'https://horizontmagazin.hu/szobafestes-arlista-ennyit-kernek-a-festok-iden/','2026-07-12'),
('festo-festes','festo','Festés 2 rétegben, fehér','anyag','m²',650,850,1200,1300,1600,2200,1,'https://ujrafestes.hu/arak/festes-arak-2026.html','2026-07-12'),
('acs-tetoszerkezet','acs','Tetőszerkezet építés faanyaggal','anyag','m²',13000,15500,20500,14500,17500,23000,1,'SzakiPiac 2026 referencia','2026-07-12'),
('acs-folia-lec','acs','Tetőlécezés és fóliázás','anyag','m²',3200,3950,5200,2800,3450,4800,1,'SzakiPiac 2026 referencia','2026-07-12'),
('acs-cserep','acs','Cserépfedés alapcserepekkel','anyag','m²',7200,8800,12500,4700,5800,8200,1,'SzakiPiac 2026 referencia','2026-07-12'),
('acs-eresz','acs','Ereszcsatorna rendszer szerelése','anyag','fm',4700,5800,7800,3900,4800,6500,1,'SzakiPiac 2026 referencia','2026-07-12'),
('villany-kiallas','villany','Villamos alapszerelés kiállásonként','anyag','db',4500,5500,7500,11500,14500,19000,1,'SzakiPiac 2026 referencia','2026-07-12'),
('viz-kiallas','viz','Vízvezeték-kiállás készítése','anyag','db',16000,19500,26000,19000,23500,31000,1,'SzakiPiac 2026 referencia','2026-07-12'),
('homlokzat-eps','homlokzat','Komplett homlokzati hőszigetelés, 15 cm EPS','anyag','m²',9000,12500,17000,10000,15000,23000,1,'https://hoszigetelorendszer.com/homlokzati-hoszigeteles-negyzetmeter-arak-munkadijjal-2026','2026-07-12'),
('vakolas-gepi','vakolas','Gépi vakolás oldalfalon','anyag','m²',3000,3800,5000,4200,5200,7000,1,'SzakiPiac 2026 referencia','2026-07-12'),
('vakolas-javito','vakolas','Kézi javító vakolás','anyag','m²',2500,3100,4200,5400,6800,9000,1,'SzakiPiac 2026 referencia','2026-07-12'),
('aljzat-kiegyenlites','aljzat','Aljzatkiegyenlítés önterülővel','anyag','m²',2600,3200,4300,2000,2500,3400,1,'SzakiPiac 2026 referencia','2026-07-12'),
('aljzat-estrich','aljzat','Estrich betonozás','anyag','m²',3700,4500,6000,3400,4200,5700,1,'SzakiPiac 2026 referencia','2026-07-12'),
('burkolo-padlo','burkolo','Padlóburkolás hidegburkolattal','anyag','m²',5000,6200,8500,7800,9800,13500,1,'https://www.profiburkolasbp.hu/arak/','2026-07-12'),
('burkolo-fal','burkolo','Oldalfal burkolása, csempézés','anyag','m²',5500,6800,9500,9000,11500,15500,1,'https://www.profiburkolasbp.hu/arak/','2026-07-12'),
('burkolo-labazat','burkolo','Lábazat rakása','anyag','fm',1400,1800,2500,2000,2500,3500,1,'https://www.profiburkolasbp.hu/arak/','2026-07-12'),
('karton-fal','karton','Gipszkarton válaszfal, dupla lap','anyag','m²',7800,9500,12500,6700,8200,11000,1,'SzakiPiac 2026 referencia','2026-07-12'),
('karton-mennyezet','karton','Gipszkarton álmennyezet','anyag','m²',6700,8200,10800,7600,9500,12500,1,'SzakiPiac 2026 referencia','2026-07-12'),
('laminalt-padlo','laminalt','Laminált padló fektetése alátéttel','anyag','m²',3800,4800,7500,2800,3500,4800,1,'SzakiPiac 2026 referencia','2026-07-12'),
('laminalt-szegely','laminalt','Szegélyléc rakása','anyag','fm',900,1200,1800,1400,1800,2600,1,'SzakiPiac 2026 referencia','2026-07-12'),
('jarulekos-bontas','jarulekos','Bontási munkák','munka','óra',0,0,0,5000,7500,11000,1,'SzakiPiac 2026 referencia','2026-07-12'),
('jarulekos-szallitas','jarulekos','Anyagszállítás','egyeb','alkalom',0,0,0,15000,25000,45000,1,'SzakiPiac 2026 referencia','2026-07-12'),
('jarulekos-kiszallas','jarulekos','Kiszállás','egyeb','alkalom',0,0,0,5000,9000,16000,1,'SzakiPiac 2026 referencia','2026-07-12'),
('jarulekos-hulladek','jarulekos','Építési hulladék elszállítása','egyeb','m³',0,0,0,10000,18000,30000,1,'SzakiPiac 2026 referencia','2026-07-12'),
('jarulekos-gep','jarulekos','Gép- és eszközhasználat','egyeb','nap',0,0,0,8000,15000,30000,1,'SzakiPiac 2026 referencia','2026-07-12')
on conflict (id) do nothing;

-- Kezdő normaidők: a jelenlegi ellenőrzött átlagos munkadíjakból, a 6 764 Ft/óra
-- referencia-rezsióradíjból visszaszámított, admin által tovább finomítható értékek.
update public.epitoipari_arak
set norma_ora_atlag = round((munka_atlag / 6764.0)::numeric, 3),
    norma_ora_min = round((munka_min / 6764.0)::numeric, 3),
    norma_ora_max = round((munka_max / 6764.0)::numeric, 3),
    munkatartalom = coalesce(munkatartalom, megnevezes || ' – normál, előkészített munkakörülmények között')
where norma_ora_atlag = 0 and munka_atlag > 0 and egyseg <> 'alkalom';
