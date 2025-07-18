// auth.js - Végleges, javított verzió

const form = document.getElementById("auth-form");
const title = document.getElementById("auth-title");
const btn = document.getElementById("auth-btn");
const switchLink = document.getElementById("switch-link");
const forgotPwLink = document.getElementById("forgot-pw-link");
const message = document.getElementById("auth-message");
const emailInput = document.getElementById("email-input");
const passwordInput = document.getElementById("password-input");
const pwLabel = document.getElementById("pwlabel"); // Ez a sor is hiányzott
let mode = "login"; // Ez a sor is hiányzott

function setMode(newMode) {
  mode = newMode;
  message.textContent = "";
  if (mode === "login") {
    title.textContent = "Bejelentkezés";
    btn.textContent = "Bejelentkezés";
    switchLink.textContent = "Nincs fiókod? Regisztrálj!";
    forgotPwLink.style.display = "inline";
    passwordInput.style.display = "block";
    pwLabel.style.display = "block";
  } else { // register
    title.textContent = "Regisztráció";
    btn.textContent = "Regisztráció";
    switchLink.textContent = "Van már fiókod? Bejelentkezés!";
    forgotPwLink.style.display = "none";
    passwordInput.style.display = "block";
    pwLabel.style.display = "block";
  }
}

switchLink.addEventListener("click", (e) => { 
  e.preventDefault(); 
  setMode(mode === 'login' ? 'register' : 'login'); 
});

forgotPwLink.addEventListener('click', (e) => {
  e.preventDefault();
  alert("Ez a funkció még nincs implementálva.");
}); 

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  message.textContent = "";
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (mode === "login") {
    const { error } = await supaClient.auth.signInWithPassword({ email, password });
    if (error) {
      message.textContent = "Hiba: Hibás email vagy jelszó.";
      message.style.color = "red";
    } else {
      localStorage.setItem("loggedInUser", email);
      window.location.href = "index.html";
    }
  } else if (mode === "register") {
    if (password.length < 6) {
        message.textContent = "A jelszónak legalább 6 karakter hosszúnak kell lennie.";
        message.style.color = "red";
        return;
    }
    const { error } = await supaClient.auth.signUp({ email, password });
    if (error) {
      message.textContent = "Hiba: " + error.message;
      message.style.color = "red";
    } else {
      message.style.color = "green";
      message.textContent = "Sikeres regisztráció! Kérlek, erősítsd meg az email címedet a postafiókodban a bejelentkezés előtt.";
    }
  }
});

// Alaphelyzet beállítása az oldal betöltésekor
setMode("login");
