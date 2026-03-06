(function () {
  function slugify(text) {
    return String(text || 'hirdetes')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'hirdetes';
  }

  function roundRect(ctx, x, y, width, height, radius) {
    const r = typeof radius === 'number'
      ? { tl: radius, tr: radius, br: radius, bl: radius }
      : radius;

    ctx.beginPath();
    ctx.moveTo(x + r.tl, y);
    ctx.lineTo(x + width - r.tr, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r.tr);
    ctx.lineTo(x + width, y + height - r.br);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r.br, y + height);
    ctx.lineTo(x + r.bl, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r.bl);
    ctx.lineTo(x, y + r.tl);
    ctx.quadraticCurveTo(x, y, x + r.tl, y);
    ctx.closePath();
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    let line = '';
    let lines = 0;

    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + ' ';
      if (ctx.measureText(testLine).width > maxWidth && line) {
        ctx.fillText(line.trim(), x, y);
        line = words[i] + ' ';
        y += lineHeight;
        lines++;

        if (lines >= maxLines - 1) {
          let rest = (line + words.slice(i + 1).join(' ')).trim();
          while (rest && ctx.measureText(rest + '…').width > maxWidth) {
            rest = rest.slice(0, -1);
          }
          ctx.fillText((rest || '').trim() + '…', x, y);
          return;
        }
      } else {
        line = testLine;
      }
    }

    if (line.trim()) ctx.fillText(line.trim(), x, y);
  }

  function extractAdDataFromCard(btn) {
    const card = btn.closest('.bg-white, .border, .hirdetes, .card') || document;
    const title = card.querySelector('h3, h2, .title')?.innerText?.trim() || 'SzakiPiac hirdetés';
    const category = card.querySelector('p.text-xs, .category')?.innerText?.trim() || '';
    const price = Array.from(card.querySelectorAll('div, span, p'))
      .map(el => (el.innerText || '').trim())
      .find(t => /\bft\b/i.test(t)) || '';
    const desc = card.querySelector('p.text-gray-600, p')?.innerText?.trim() || 'Találj megbízható szakembert a SzakiPiacon.';

    return { cim: title, kategoria: category, ar: price, leiras: desc };
  }

  function buildCanvas(ad) {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 630;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 1200, 630);
    grad.addColorStop(0, '#facc15');
    grad.addColorStop(1, '#fde68a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1200, 630);

    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    roundRect(ctx, 70, 70, 1060, 490, 28);
    ctx.fill();

    ctx.fillStyle = '#166534';
    roundRect(ctx, 95, 95, 530, 82, 22);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px Arial';
    ctx.fillText('SZAKIPIAC-2025.HU', 125, 148);

    ctx.fillStyle = '#111827';
    ctx.font = 'bold 52px Arial';
    wrapText(ctx, ad.cim || 'Új hirdetés a SzakiPiacon', 110, 250, 620, 60, 3);

    ctx.fillStyle = '#065f46';
    ctx.font = 'bold 28px Arial';
    const meta = [ad.kategoria || '', ad.varos || '', ad.ar || ''].filter(Boolean).join(' • ');
    wrapText(ctx, meta || 'Megbízható szakember • Ajánlatkérés', 110, 385, 620, 36, 2);

    ctx.fillStyle = '#374151';
    ctx.font = '26px Arial';
    wrapText(ctx, String(ad.leiras || '').replace(/\s+/g, ' ').trim(), 110, 445, 620, 34, 3);

    ctx.fillStyle = '#ecfdf5';
    roundRect(ctx, 770, 110, 280, 360, 30);
    ctx.fill();

    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(910, 220, 78, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 64px Arial';
    ctx.fillText('✔', 885, 243);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 30px Arial';
    ctx.fillText('Ajánlatkérés', 815, 330);
    ctx.fillText('egy kattintással', 790, 370);

    ctx.fillStyle = '#ffffff';
    roundRect(ctx, 110, 500, 370, 58, 28);
    ctx.fill();

    ctx.fillStyle = '#111827';
    ctx.font = 'bold 28px Arial';
    ctx.fillText('szakipiac-2025.hu', 145, 538);

    return canvas;
  }

  function downloadCanvas(canvas, title) {
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `szakipiac-${slugify(title)}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    return dataUrl;
  }

  if (typeof window.generateShareImageById !== 'function') {
    window.generateShareImageById = function (adId) {
      const btn = document.querySelector(`.share-image-btn[data-ad-id="${CSS.escape(String(adId))}"]`);
      const ad = btn ? extractAdDataFromCard(btn) : { cim: 'SzakiPiac hirdetés' };
      const canvas = buildCanvas(ad);
      downloadCanvas(canvas, ad.cim);
      return false;
    };
  }

  document.addEventListener('click', function (e) {
    const btn = e.target.closest('.share-image-btn');
    if (!btn) return;

    e.preventDefault();

    const adId = btn.getAttribute('data-ad-id');
    if (adId && typeof window.generateShareImageById === 'function') {
      window.generateShareImageById(adId);
      return false;
    }

    const ad = extractAdDataFromCard(btn);
    const canvas = buildCanvas(ad);
    downloadCanvas(canvas, ad.cim);
    return false;
  }, true);
})();
