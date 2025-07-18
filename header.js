document.addEventListener('DOMContentLoaded', () => {
    const adminEmail = "atika.76@windowslive.com";
    const loggedInUserEmail = localStorage.getItem("loggedInUser");
    const nav = document.querySelector('.green-header nav');
    if (!nav) return;

    const loginLink = nav.querySelector('a[href="auth.html"]');
    
    if (loggedInUserEmail && loginLink) {
        loginLink.style.display = 'none';

        const userDisplay = document.createElement('div');
        userDisplay.style.display = 'flex';
        userDisplay.style.alignItems = 'center';
        userDisplay.style.gap = '15px';
        
        let adminLink = loggedInUserEmail === adminEmail ? `<a href="admin.html" style="color: #fff700; text-decoration: underline; font-weight: bold;">Admin</a>` : '';

        userDisplay.innerHTML = `<span style="color: white; font-weight: bold;">${loggedInUserEmail}</span> ${adminLink} <button id="logoutBtn" class="header-logout-btn">Kijelentkezés</button>`;
        nav.appendChild(userDisplay);

        document.getElementById('logoutBtn').addEventListener('click', async () => {
            await supaClient.auth.signOut();
            localStorage.removeItem('loggedInUser');
            window.location.href = 'index.html';
        });
    }
});
