// Munkafigyelő lezárás és admin kezelés patch
(function () {
  if (window.__spMfCloseBtn) return;
  window.__spMfCloseBtn = true;

  function toast(message, type) {
    const el = document.getElementById('toast-notification');
    if (!el) return console.log(message);
    const bg = type === 'error' ? 'bg-red-600' : (type === 'info' ? 'bg-blue-600' : 'bg-green-600');
    el.textContent = message;
    el.className = 'fixed top-5 right-5 text-white py-3 px-6 rounded-lg shadow-xl transform transition-transform duration-300 z-[110] ' + bg;
    el.classList.remove('translate-x-[120%]');
    setTimeout(function () { el.classList.add('translate-x-[120%]'); }, 4200);
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  async function rights() {
    const c = window.supaClient;
    if (!c) return new Map();
    const r = await c.from('munkafigyelo_nyilvanos').select('id,torolheto');
    if (r.error) return new Map();
    return new Map((r.data || []).map(function (x) { return [String(x.id), !!x.torolheto]; }));
  }

  async function closeOne(id, btn) {
    const c = window.supaClient;
    if (!c) return toast('Supabase kapcsolat nem elérhető.', 'error');
    if (!confirm('Biztos lezárod ezt a munkát?')) return;
    btn.disabled = true;
    btn.textContent = 'Lezárás...';
    const r = await c.rpc('munkafigyelo_lezaras', { p_hirdetes_id: id });
    if (r.error) {
      btn.disabled = false;
      btn.textContent = 'Lezárás';
      return toast('Nem sikerült lezárni: ' + r.error.message, 'error');
    }
    const card = btn.closest('article[data-lead-id]');
    if (card) card.remove();
    toast('Munka lezárva.');
  }

  async function applyCloseButtons() {
    const cards = Array.from(document.querySelectorAll('article[data-lead-id]'));
    if (!cards.length) return;
    const map = await rights();
    cards.forEach(function (card) {
      const id = String(card.dataset.leadId || '');
      if (!id || !map.get(id) || card.querySelector('[data-mf-close-btn]')) return;
      const row = card.querySelector('[data-save-lead]')?.parentElement || card;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.mfCloseBtn = 'true';
      btn.className = 'rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-black text-rose-700 hover:bg-rose-100';
      btn.textContent = 'Lezárás';
      btn.addEventListener('click', function () { closeOne(id, btn); });
      row.appendChild(btn);
    });
  }

  async function adminAction(fn, id, confirmText) {
    const c = window.supaClient;
    if (!c) return toast('Supabase kapcsolat nem elérhető.', 'error');
    if (!confirm(confirmText)) return;
    const r = await c.rpc(fn, { p_hirdetes_id: id });
    if (r.error) return toast('Műveleti hiba: ' + r.error.message, 'error');
    toast('Művelet kész.');
    renderAdminPanel(true);
  }

  async function renderAdminPanel(force) {
    const adminPage = document.getElementById('admin-page');
    if (!adminPage || adminPage.style.display === 'none') return;
    const c = window.supaClient;
    if (!c) return;

    const oldManualBox = Array.from(adminPage.querySelectorAll('h2')).find(function (h) {
      return (h.textContent || '').includes('Külső munka / közbeszerzés hozzáadása');
    })?.closest('.bg-white');
    if (oldManualBox) oldManualBox.style.display = 'none';

    let panel = document.getElementById('mf-admin-manager');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'mf-admin-manager';
      panel.className = 'bg-white p-6 rounded-lg shadow-sm border border-gray-100 mb-6';
      const anchor = oldManualBox || adminPage.querySelector('.bg-white');
      if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(panel, anchor.nextSibling);
      else adminPage.prepend(panel);
    } else if (!force && panel.dataset.loaded === 'true') {
      return;
    }

    panel.innerHTML = '<h2 class="text-2xl font-bold mb-2">Munkafigyelő hirdetések kezelése</h2><p class="text-sm text-gray-600 mb-4">Itt látod az aktív és lezárt megrendelői munkákat, közbeszerzéseket és külső rekordokat.</p><div class="text-sm text-gray-500">Betöltés...</div>';

    const r = await c.rpc('munkafigyelo_admin_lista');
    if (r.error) {
      panel.innerHTML += '<div class="mt-3 rounded border border-red-200 bg-red-50 p-3 text-red-700 text-sm">Nem sikerült betölteni: ' + esc(r.error.message) + '</div>';
      return;
    }

    const rows = r.data || [];
    panel.dataset.loaded = 'true';
    const tableRows = rows.map(function (x) {
      const statusClass = x.allapot === 'aktiv' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-slate-700 bg-slate-50 border-slate-200';
      const restoreBtn = x.allapot === 'aktiv' ? '' : '<button data-mf-admin-restore="' + esc(x.id) + '" class="rounded border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700 hover:bg-emerald-100">Visszaállítás</button>';
      return '<tr class="border-b align-top">'
        + '<td class="py-2 pr-3 font-bold">' + esc(x.cim) + '<div class="text-xs font-normal text-gray-500">' + esc(x.id) + '</div></td>'
        + '<td class="py-2 pr-3">' + esc(x.szakma || '-') + '<br><span class="text-xs text-gray-500">' + esc(x.telepules || '-') + '</span></td>'
        + '<td class="py-2 pr-3">' + esc(x.forras_tipus || '-') + '</td>'
        + '<td class="py-2 pr-3"><span class="inline-flex rounded-full border px-2 py-1 text-xs font-black ' + statusClass + '">' + esc(x.allapot || '-') + '</span></td>'
        + '<td class="py-2 pr-3 whitespace-nowrap flex flex-col gap-2">'
        + (x.allapot === 'aktiv' ? '<button data-mf-admin-close="' + esc(x.id) + '" class="rounded border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-bold text-amber-700 hover:bg-amber-100">Lezárás</button>' : restoreBtn)
        + '<button data-mf-admin-remove="' + esc(x.id) + '" class="rounded border border-red-200 bg-red-50 px-3 py-1 text-sm font-bold text-red-700 hover:bg-red-100">Végleges törlés</button>'
        + '</td></tr>';
    }).join('');

    panel.innerHTML = '<h2 class="text-2xl font-bold mb-2">Munkafigyelő hirdetések kezelése</h2>'
      + '<p class="text-sm text-gray-600 mb-4">A régi külső rekord felvevő dobozt elrejtettem, mert megtévesztő volt. Itt tudod lezárni, visszaállítani vagy végleg törölni a Munkafigyelő rekordokat.</p>'
      + '<div class="overflow-x-auto"><table class="min-w-full text-sm"><thead><tr class="text-left border-b bg-gray-50"><th class="py-2 pr-3">Cím</th><th class="py-2 pr-3">Szakma / település</th><th class="py-2 pr-3">Forrás</th><th class="py-2 pr-3">Állapot</th><th class="py-2 pr-3">Művelet</th></tr></thead><tbody>'
      + (tableRows || '<tr><td colspan="5" class="py-6 text-center text-gray-500">Nincs Munkafigyelő rekord.</td></tr>')
      + '</tbody></table></div>';

    panel.querySelectorAll('[data-mf-admin-close]').forEach(function (b) {
      b.addEventListener('click', function () { adminAction('munkafigyelo_lezaras', b.dataset.mfAdminClose, 'Biztos lezárod ezt a munkát?'); });
    });
    panel.querySelectorAll('[data-mf-admin-restore]').forEach(function (b) {
      b.addEventListener('click', function () { adminAction('munkafigyelo_visszaallitas', b.dataset.mfAdminRestore, 'Biztos visszaállítod ezt a munkát aktívra?'); });
    });
    panel.querySelectorAll('[data-mf-admin-remove]').forEach(function (b) {
      b.addEventListener('click', function () { adminAction('munkafigyelo_vegleges_torles', b.dataset.mfAdminRemove, 'Biztos végleg törlöd ezt a rekordot? Ezt nem lehet visszavonni.'); });
    });
  }

  let t = null;
  function later() {
    if (t) clearTimeout(t);
    t = setTimeout(function () {
      applyCloseButtons();
      renderAdminPanel(false);
    }, 250);
  }

  new MutationObserver(later).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('hashchange', later);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', later);
  else later();
})();
