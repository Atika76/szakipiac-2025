// Kliens inicializálás
const SUPABASE_URL = "https://cvcxdeunzlhcrayutuew.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2Y3hkZXVuemxoY3JheXV0dWV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxNjgyMTQsImV4cCI6MjA2Nzc0NDIxNH0.mmp-rbNPxoPJmotz5NY5XLAwdhHBkvoDKQxY6V1iSbo";
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const ADMIN_EMAIL = "atika.76@windowslive.com";
let adminLoggedIn = false;

async function login() {
  const pw = prompt("Add meg az admin jelszót:");
  if (!pw) return;
  // Admin bejelentkezés – csak saját email-cím/jelszóval!
  const { error, data } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL, password: pw
  });
  if (error) {
    alert("Hibás jelszó vagy nincs jogosultság!");
    return;
  }
  adminLoggedIn = true;
  renderAdmin();
}

async function renderAdmin() {
  if (!adminLoggedIn) return;
  // Hirdetések lekérése
  const { data, error } = await supabase
    .from("hirdetesek")
    .select("*")
    .order("created_at", { ascending: false });
  let html = "<h3>Hirdetések</h3>";
  if (error) html += "<span style='color:red'>Hiba!</span>";
  else if (!data || !data.length) html += "<i>Nincs hirdetés.</i>";
  else data.forEach(h => {
    html += `<div style="border:1px solid #aaa; padding:10px; margin:10px 0;">
      <b>${h.cim}</b> (${h.kategoria}) – ${h.ar || ""} Ft<br>
      <small>${h.leiras}</small>
    </div>`;
  });
  html += `<button onclick="logout()">Kijelentkezés</button>`;
  document.getElementById("adminContent").innerHTML = html;
}

function logout() {
  supabase.auth.signOut();
  adminLoggedIn = false;
  document.getElementById("adminContent").innerHTML = `<button onclick="login()">Admin bejelentkezés</button>`;
}

// Alapból az adminContent-be tegyél egy gombot:
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("adminContent").innerHTML = `<button onclick="login()">Admin bejelentkezés</button>`;
});
