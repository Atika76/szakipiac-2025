// feltoltes.js (Javított feltöltési logika)
feltoltesForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { data: { user } } = await supaClient.auth.getUser();
    if (!user) {
        uzenetDiv.textContent = "A feltöltéshez be kell jelentkezned!";
        return;
    }
    uzenetDiv.textContent = "Feltöltés folyamatban...";
    try {
        const imageFiles = document.getElementById('kepek').files;
        const imageUrls = []; // Ebbe gyűjtjük az összes kép URL-jét

        // Végigmegyünk az összes kiválasztott fájlon
        for (const file of imageFiles) {
            const filePath = `${user.id}/${Date.now()}-${file.name}`;
            const { error: uploadError } = await supaClient.storage.from('hirdetes-kepek').upload(filePath, file);
            if (uploadError) throw uploadError;
            
            const { data: { publicUrl } } = supaClient.storage.from('hirdetes-kepek').getPublicUrl(filePath);
            imageUrls.push(publicUrl);
        }

        // ... (a hirdetés többi adatának összegyűjtése)

        const { error: insertError } = await supaClient.from('hirdetesek').insert([{
            // ... (cim, leiras, stb.)
            kep_url_tomb: imageUrls // Itt már az összes kép URL-jét mentjük
        }]);
        
        if (insertError) throw insertError;
        window.location.href = 'sikeres.html';
    } catch (error) {
        uzenetDiv.textContent = "Hiba történt: " + error.message;
    }
});
