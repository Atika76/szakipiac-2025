const SUPABASE_URL = "https://bxtpnotswnwrbycvfypz.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4dHBub3Rzd253cmJ5Y3ZmeXB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI5MTQ0NDcsImV4cCI6MjA2ODQ5MDQ0N30.CXEfo_8qmIYhkEZFdTsbl9ZB-PRTP6UK8EbIxxpSGZc";
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Localstorage segéd
function setLoggedInUser(email) {
  localStorage.setItem("loggedInUser", email);
}
function clearLoggedInUser() {
  localStorage.removeItem("loggedInUser");
}
function getLoggedInUser() {
  return localStorage.getItem("loggedInUser");
}

// REGISZTRÁCIÓ
const regForm = document.getElementById('regForm');
if (regForm) {
  regForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const uzenet = document.getElementById('regUzenet');
    uzenet.textContent = "Regisztráció folyamatban...";

    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      uzenet.textContent = "Hiba: " + error.message;
    } else {
      uzenet.textContent = "Sikeres regisztráció! Jelentkezz be.";
      regForm.reset();
    }
  });
}

// BEJELENTKEZÉS
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const uzenet = document.getElementById('loginUzenet');
    uzenet.textContent = "Bejelentkezés folyamatban...";

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      uzenet.textContent = "Hiba: " + error.message;
    } else {
      setLoggedInUser(email);
      uzenet.textContent = "Sikeres bejelentkezés! Átirányítás...";
      setTimeout(() => {
        window.location.href = "index.html";
      }, 1000);
    }
  });
}

// KIJELENTKEZÉS (ha van logoutBtn gomb)
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    clearLoggedInUser();
    window.location.href = "auth.html";
  });
}
