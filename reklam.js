document.addEventListener('DOMContentLoaded', async () => {
    const reklamDoboz = document.querySelector('.reklam-doboz');
    if (!reklamDoboz) return;

    try {
        const { data: reklamok, error } = await supaClient
            .from('reklamok')
            .select('image_url, target_url')
            .eq('is_active', true)
            .gte('expires_at', new Date().toISOString());
        
        if (error) throw error;
        if (!reklamok || reklamok.length === 0) {
            reklamDoboz.innerHTML = '<b>Szabad reklámhely!</b><br>Itt hirdethet!<br><a href="reklam.html">Reklám feltöltése</a>';
            return;
        }

        let currentIndex = 0;
        const showAd = () => {
            if (reklamok.length === 0) return;
            const ad = reklamok[currentIndex];
            reklamDoboz.innerHTML = `<a href="${ad.target_url}" target="_blank"><img src="${ad.image_url}" alt="Reklám" style="width:100%; border-radius:10px;"></a>`;
            currentIndex = (currentIndex + 1) % reklamok.length;
        };

        showAd(); // Azonnal mutatunk egyet
        setInterval(showAd, 10000); // 10 másodpercenként cseréljük

    } catch (error) {
        console.error("Hiba a reklámok betöltésekor:", error);
    }
});
