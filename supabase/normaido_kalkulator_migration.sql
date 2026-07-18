-- Futtasd egyszer a Supabase SQL Editorban a meglévő árkatalógus bővítéséhez.
alter table public.epitoipari_arak add column if not exists norma_ora_min numeric not null default 0;
alter table public.epitoipari_arak add column if not exists norma_ora_atlag numeric not null default 0;
alter table public.epitoipari_arak add column if not exists norma_ora_max numeric not null default 0;
alter table public.epitoipari_arak add column if not exists munkatartalom text;

update public.epitoipari_arak
set norma_ora_atlag = round((munka_atlag / 7830.0)::numeric, 3),
    norma_ora_min = round((munka_min / 7830.0)::numeric, 3),
    norma_ora_max = round((munka_max / 7830.0)::numeric, 3),
    munkatartalom = coalesce(munkatartalom, megnevezes || ' – normál, előkészített munkakörülmények között'),
    frissitve = current_date,
    updated_at = now()
where norma_ora_atlag = 0 and munka_atlag > 0 and egyseg <> 'alkalom';
