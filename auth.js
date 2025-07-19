const form = document.getElementById("auth-form");
const title = document.getElementById("auth-title");
const btn = document.getElementById("auth-btn");
const switchLink = document.getElementById("switch-link");
const message = document.getElementById("auth-message");
const emailInput = document.getElementById("email-input");
const passwordInput = document.getElementById("password-input");
let mode = "login";

function setMode(newMode) {
  mode = newMode;
  message.textContent = "";
  title.textContent = mode === 'login' ? 'Bejelentkezés' : 'Regisztráció';
  btn.textContent = mode === 'login' ? 'Bejelentkezés' : 'Regisztráció';
  switchLink.textContent = mode === 'login' ? 'Nincs fiókod? Regisztrálj!' : 'Van már fiókod? Bejelentkezés!';
}

switchLink.addEventListener("click", (e) => { e.preventDefault(); setMode(mode === 'login' ? 'register' : 'login'); });

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  message.textContent = "";

  if (mode === "login") {
    const { data, error } = await supaClient.auth.signInWithPassword({ email, password });
    if (error) {
      message.textContent = "Hiba: Hibás email vagy jelszó.";
      message.style.color = "red";
    } else {
      localStorage.setItem("loggedInUser", data.user.email);
      window.location.href = "index.html";
    }
  } else { // Register
    const { error } = await supaClient.auth.signUp({ email, password });
    if (error) {
      message.textContent = "Hiba: " + error.message;
      message.style.color = "red";
    } else {
      message.textContent = "Sikeres regisztráció! Kérlek, erősítsd meg az email címedet a postafiókodban.";
      message.style.color = "green";
    }
  }
});
setMode("login");
