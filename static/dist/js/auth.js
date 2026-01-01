// auth.js - VERSION FINALE PROD + JWT REFRESH
const API_BASE_URL = "http://localhost:8000/api/auth";
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

// ==========================
// LOGIN
// ==========================
async function login(event) {
  event.preventDefault();

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const errorBox = document.getElementById("error");

  if (errorBox) errorBox.classList.add("hidden");
  console.log("🔍 Login avec:", email);

  try {
    const response = await fetch(`${API_BASE_URL}/login/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();
    console.log("📦 Données login:", data);

    if (!response.ok) throw new Error(data.detail || data.error || "Login failed");

    storeUserData(data);
    redirectUser(data.user);

    // Démarrer le rafraîchissement automatique du token
    scheduleTokenRefresh();

  } catch (error) {
    console.error("❌ Erreur login:", error);
    if (errorBox) {
      errorBox.innerText = error.message.includes("detail") ? "Identifiants incorrects" : error.message;
      errorBox.classList.remove("hidden");
    }
  }
}

// ==========================
// STOCKAGE DES DONNÉES UTILISATEUR
// ==========================
function storeUserData(data) {
  const user = data.user;
  localStorage.setItem("access_token", data.access);
  localStorage.setItem("refresh_token", data.refresh);
  localStorage.setItem("user_id", user.id);
  localStorage.setItem("user_email", user.email);
  localStorage.setItem("user_type", user.user_type);
  localStorage.setItem("first_name", user.first_name || "");
  localStorage.setItem("last_name", user.last_name || "");
  localStorage.setItem("is_superadmin", user.is_superadmin);
}

// ==========================
// REDIRECTION UTILISATEUR
// ==========================
function redirectUser(userData) {
  const userType = userData.user_type?.toLowerCase();
  const isSuperAdmin = userData.is_superadmin === true;

  console.log("📍 Redirection - userType:", userType, "isSuperAdmin:", isSuperAdmin);

  if (isSuperAdmin || userType === "superadmin") {
    window.location.href = "/static/dist/html/superadmin/dashboard.html";
    return;
  }
  if (userType === "school_admin") {
    window.location.href = "/static/dist/html/superadmin/direction_dashboard.html";
    return;
  }
  if (userType === "teacher") {
    window.location.href = "/static/dist/html/teacher/dashboard.html";
    return;
  }
  if (userType === "staff") {
    window.location.href = "/static/dist/html/staff/dashboard.html";
    return;
  }

  console.error("❌ Type utilisateur inconnu:", userType);
  alert(`Type d'utilisateur "${userType}" non reconnu. Contactez l'administrateur.`);
}

// ==========================
// REFRESH TOKEN AUTOMATIQUE
// ==========================
function scheduleTokenRefresh() {
  setInterval(async () => {
    const refreshToken = localStorage.getItem("refresh_token");
    if (!refreshToken) return;

    try {
      const response = await fetch(`${API_BASE_URL}/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: refreshToken })
      });
      const data = await response.json();
      if (!response.ok) throw new Error("Impossible de rafraîchir le token");

      localStorage.setItem("access_token", data.access);
      console.log("🔄 Token JWT rafraîchi:", data.access.substring(0, 30) + "...");
    } catch (error) {
      console.error("❌ Erreur refresh token:", error);
      logout();
    }
  }, REFRESH_INTERVAL);
}

// ==========================
// LOGOUT
// ==========================
function logout() {
  localStorage.clear();
  window.location.href = "/static/dist/html/login.html";
}

// ==========================
// UI SWITCH
// ==========================
function showResetForm() {
  document.getElementById("login-form").classList.add("hidden");
  document.getElementById("reset-form").classList.remove("hidden");
}

function showLoginForm() {
  document.getElementById("reset-form").classList.add("hidden");
  document.getElementById("login-form").classList.remove("hidden");
}

// ==========================
// PASSWORD RESET REQUEST
// ==========================
async function requestPasswordReset(event) {
  event.preventDefault();
  const email = document.getElementById("reset-email").value;

  try {
    const response = await fetch(`http://localhost:8000/api/users/password-reset/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });

    if (response.ok) {
        alert("Si cet email existe, un lien de réinitialisation a été envoyé.");
        showLoginForm();
    } else {
        throw new Error();
    }
  } catch (error) {
    alert("Erreur lors de l'envoi du lien.");
  }
}