// header.js

// -- Menühöz szükséges --
const NAV_EMAIL = localStorage.getItem('loggedInUser');
const ADMIN_EMAIL = "atika.76@windowslive.com";
const nav = document.querySelector("header nav");

function createNav() {
    let html = `
      <a href="index.html">Főoldal</a>
      <a href="rolunk.html">Rólunk</a>
      <a href="kapcsolat.html">Kapcsolat</a>
      <a href="feltoltes.html">Hirdetés feltöltés</a>
    `;
    if (NAV_EMAIL) {
        html += `<span style="color:#fff;font-weight:bold; margin-left:16px">${NAV_EMAIL}</span>`;
        if (NAV_EMAIL === ADMIN_EMAIL) html += `<a href="admin.html" style="color:yellow; font-weight:bold; margin-left:8px;">Admin</a>`;
        html += `<button id="logout-btn" style="margin-left:8px; background:#ff4d4d; color:#fff; border:none; border-radius:4px; padding:4px 14px; font-weight:bold; cursor:pointer;">Kijelentkezés</button>`;
    } else {
        html += `<a href="auth.html">Bejelentkezés</a>`;
    }
    nav.innerHTML = html;
}
createNav();

document.addEventListener('click', (e) => {
    if (e.target.id === "logout-btn") {
        localStorage.removeItem("loggedInUser");
        window.location.href = "index.html";
    }
});
