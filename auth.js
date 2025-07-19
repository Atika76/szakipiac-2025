const SUPABASE_URL = "https://bxtpnotswnwrbycvfypz.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4dHBub3Rzd253cmJ5Y3ZmeXB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI5MTQ0NDcsImV4cCI6MjA2ODQ5MDQ0N30.CXEfo_8qmIYhkEZFdTsbl9ZB-PRTP6UK8EbIxxpSGZc";
const supaClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// BEJELENTKEZÉS
document.getElementById("loginForm").onsubmit = async (e) => {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;
  const { data, error } = await supaClient.auth.signInWithPassword({ email, password });
  if (error) {
    document.getElementById("loginUzenet").innerText = "Hiba: Hibás email vagy jelszó.";
  } else {
    document.getElementById("loginUzenet").innerText = "Sikeres bejelentkezés!";
    document.getElementById("logoutBtn").style.display = "";
    localStorage.setItem("loggedInUser", email);
    setTimeout(() => { window.location = "index.html"; }, 1000);
  }
};

// REGISZTRÁCIÓ
document.getElementById("regForm").onsubmit = async (e) => {
  e.preventDefault();
  const email = document.getElementById("regEmail").value;
  const password = document.getElementById("regPassword").value;
  const { data, error } = await supaClient.auth.signUp({ email, password });
  if (error) {
    document.getElementById("regUzenet").innerText = "Hiba: " + (error.message || "Regisztráció sikertelen!");
  } else {
    document.getElementById("regUzenet").innerText = "Sikeres regisztráció! Kérlek, erősítsd meg az emailed!";
    document.getElementById("logoutBtn").style.display = "";
    localStorage.setItem("loggedInUser", email);
  }
};

// KIJELENTKEZÉS
document.getElementById("logoutBtn").onclick = async () => {
  await supaClient.auth.signOut();
  localStorage.removeItem("loggedInUser");
  window.location.reload();
};
