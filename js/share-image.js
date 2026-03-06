(function(){
  function showShareToast(message, type){
    try {
      if (typeof showToast === 'function') { showToast(message, type || 'info'); return; }
    } catch(e) {}
    alert(message);
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    let line = '';
    let lines = [];
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const testWidth = ctx.measureText(testLine).width;
      if (testWidth > maxWidth && line) {
        lines.push(line.trim());
        line = words[n] + ' ';
        if (maxLines && lines.length >= maxLines - 1) break;
      } else {
        line = testLine;
      }
    }
    if (line && (!maxLines || lines.length < maxLines)) lines.push(line.trim());
    if (maxLines && lines.length > maxLines) lines = lines.slice(0, maxLines);
    lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
    return y + (lines.length-1)*lineHeight;
  }

  function drawRoundedRect(ctx, x, y, w, h, r, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.arcTo(x+w, y, x+w, y+h, r);
    ctx.arcTo(x+w, y+h, x, y+h, r);
    ctx.arcTo(x, y+h, x, y, r);
    ctx.arcTo(x, y, x+w, y, r);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
  }

  async function loadImage(src){
    return new Promise((resolve,reject)=>{
      const img=new Image();
      img.crossOrigin='anonymous';
      img.onload=()=>resolve(img);
      img.onerror=reject;
      img.src=src;
    });
  }

  async function makeShareImage(meta){
    const canvas=document.createElement('canvas');
    canvas.width=1200;
    canvas.height=630;
    const ctx=canvas.getContext('2d');

    const grad=ctx.createLinearGradient(0,0,1200,630);
    grad.addColorStop(0,'#facc15');
    grad.addColorStop(1,'#fde68a');
    ctx.fillStyle=grad;
    ctx.fillRect(0,0,1200,630);

    for(let i=0;i<18;i++){
      ctx.fillStyle='rgba(255,255,255,0.10)';
      ctx.fillRect((i*71)%1200, (i*53)%630, 34, 10);
      ctx.fillRect((i*97)%1200, (i*41)%630, 10, 34);
    }

    drawRoundedRect(ctx, 70, 65, 520, 90, 24, '#166534');
    ctx.fillStyle='#ffffff';
    ctx.font='bold 56px Arial';
    ctx.fillText('SZAKIPIAC-2025.hu', 105, 124);

    ctx.fillStyle='#111827';
    ctx.font='bold 58px Arial';
    const titleY = wrapText(ctx, meta.title || 'SzakiPiac hirdetés', 95, 245, 590, 70, 3);

    drawRoundedRect(ctx, 95, titleY + 45, 430, 62, 30, '#ffffff', '#d1d5db');
    ctx.fillStyle='#111827';
    ctx.font='bold 30px Arial';
    ctx.fillText((meta.city || 'Országos') + (meta.category ? ' • ' + meta.category : ''), 125, titleY + 86);

    ctx.fillStyle='#334155';
    ctx.font='30px Arial';
    wrapText(ctx, meta.desc || 'Találj megbízható szakembert vagy kérj ajánlatot a SzakiPiacon.', 95, titleY + 165, 600, 40, 4);

    drawRoundedRect(ctx, 95, 525, 420, 64, 30, '#fff7ed', '#fb923c');
    ctx.fillStyle='#9a3412';
    ctx.font='bold 34px Arial';
    ctx.fillText('szakipiac-2025.hu', 132, 568);

    drawRoundedRect(ctx, 720, 150, 400, 315, 28, 'rgba(255,255,255,0.55)', '#f59e0b');
    try {
      const logo=await loadImage('logo.png');
      ctx.drawImage(logo, 745, 175, 92, 92);
    } catch(e) {}
    ctx.fillStyle='#166534';
    ctx.font='bold 34px Arial';
    ctx.fillText('Találj megbízható', 860, 215);
    ctx.fillStyle='#111827';
    ctx.fillText('szakembert', 860, 255);

    ctx.fillStyle='#1f2937';
    ctx.font='28px Arial';
    ctx.fillText('• ajánlatkérés', 752, 330);
    ctx.fillText('• profil + üzenet', 752, 372);
    ctx.fillText('• gyors kapcsolatfelvétel', 752, 414);
    ctx.fillText('• Piacra kész hirdetés', 752, 456);

    return canvas;
  }

  async function handleShareButton(button){
    const meta = {
      title: button.dataset.shareTitle || 'SzakiPiac hirdetés',
      city: button.dataset.shareCity || 'Országos',
      category: button.dataset.shareCategory || '',
      desc: button.dataset.shareDesc || ''
    };
    const original = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '⏳ Készül...';
    try {
      const canvas = await makeShareImage(meta);
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      const safeName = (meta.title || 'szakipiac-hirdetes').toLowerCase().replace(/[^a-z0-9áéíóöőúüű-]+/gi,'-').replace(/-+/g,'-').slice(0,50);
      link.href = dataUrl;
      link.download = `${safeName || 'szakipiac-hirdetes'}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      const preview = window.open(dataUrl, '_blank');
      if (!preview) { /* ignore popup block */ }
      showShareToast('A megosztó kép elkészült és letöltődött.', 'success');
    } catch (err) {
      console.error(err);
      showShareToast('A hirdetés képe most nem készíthető el.', 'error');
    } finally {
      button.disabled = false;
      button.innerHTML = original;
    }
  }

  document.addEventListener('click', function(e){
    const button = e.target.closest('.share-image-btn');
    if (!button) return;
    e.preventDefault();
    handleShareButton(button);
  });
})();
