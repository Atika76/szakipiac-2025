// Munkafigyelő lezárás gomb patch
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

  async function apply() {
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

  let t = null;
  function later() {
    if (t) clearTimeout(t);
    t = setTimeout(apply, 250);
  }

  new MutationObserver(later).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('hashchange', later);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', later);
  else later();
})();
