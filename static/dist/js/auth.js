/**
 * SYBEM Academia - Auth Engine
 * VERSION FINALE PROD
 */

const API_BASE_URL = "http://localhost:8000/api/auth";
const REFRESH_INTERVAL = 5 * 60 * 1000; 

// ==========================
// UTILS & UI
// ==========================
function displayMessage(text, isError = true) {
    const box = document.getElementById("message-box");
    if (!box) return;
    
    box.innerText = text;
    box.classList.remove("hidden", "bg-red-100", "text-red-700", "bg-green-100", "text-green-700", "dark:bg-red-900", "dark:text-red-300");
    
    if (isError) {
        box.classList.add("bg-red-100", "text-red-700", "dark:bg-red-900", "dark:text-red-300");
    } else {
        box.classList.add("bg-green-100", "text-green-700", "dark:bg-green-800", "dark:text-green-200");
    }
}

function setLoader(btnId, isLoading) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = isLoading;
    btn.innerText = isLoading ? "Traitement en cours..." : (btnId === "login-submit" ? "Se connecter" : "Envoyer le lien");
    btn.style.opacity = isLoading ? "0.7" : "1";
}

// ==========================
// CORE LOGIC
// ==========================
async function login(event) {
    event.preventDefault();
    setLoader("login-submit", true);

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {
        const response = await fetch(`${API_BASE_URL}/login/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || data.error || "Identifiants invalides");
        }

        storeUserData(data);
        displayMessage("Connexion réussie !", false);
        
        // Petite pause pour laisser l'utilisateur voir le succès
        setTimeout(() => {
            redirectUser(data.user);
            scheduleTokenRefresh();
        }, 800);

    } catch (error) {
        console.error("❌ Login Error:", error);
        displayMessage(error.message);
    } finally {
        setLoader("login-submit", false);
    }
}

function storeUserData(data) {
    const user = data.user;
    localStorage.setItem("access_token", data.access);
    localStorage.setItem("refresh_token", data.refresh);
    localStorage.setItem("user_id", user.id);
    localStorage.setItem("user_email", user.email);
    localStorage.setItem("user_type", user.user_type);
    localStorage.setItem("is_superadmin", user.is_superadmin);
    localStorage.setItem("must_change_password", user.must_change_password);
}

function redirectUser(userData) {
    const userType = userData.user_type?.toLowerCase();
    const isSuperAdmin = userData.is_superadmin === true;
    const mustChangePassword = userData.must_change_password === true;

    if (mustChangePassword) {
        window.location.href = "/static/dist/html/force-change-password.html";
        return;
    }

    const routes = {
        "superadmin": "/static/dist/html/superadmin/dashboard.html",
        "school_admin": "/static/dist/html/school_admin/direction_dashboard.html",
        "teacher": "/static/dist/html/teacher/dashboard.html",
        "staff": "/static/dist/html/staff/dashboard.html"
    };

    const target = (isSuperAdmin) ? routes["superadmin"] : routes[userType];
    
    if (target) {
        window.location.href = target;
    } else {
        alert("Type utilisateur non reconnu. Contactez l'administrateur.");
    }
}

// ==========================
// AUTH CYCLE
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
            if (response.ok) {
                localStorage.setItem("access_token", data.access);
                console.log("🔄 Token rafraîchi");
            }
        } catch (error) {
            logout();
        }
    }, REFRESH_INTERVAL);
}

function logout() {
    localStorage.clear();
    window.location.href = "/static/dist/html/login.html";
}

// ==========================
// INITIALIZATION
// ==========================
document.addEventListener("DOMContentLoaded", () => {
    // Form Events
    document.getElementById("login-form")?.addEventListener("submit", login);
    document.getElementById("reset-form")?.addEventListener("submit", requestPasswordReset);

    // Navigation UI
    document.getElementById("btn-show-reset")?.addEventListener("click", () => {
        document.getElementById("login-form").classList.add("hidden");
        document.getElementById("reset-form").classList.remove("hidden");
    });

    document.getElementById("btn-show-login")?.addEventListener("click", () => {
        document.getElementById("reset-form").classList.add("hidden");
        document.getElementById("login-form").classList.remove("hidden");
    });
});

async function requestPasswordReset(event) {
    event.preventDefault();
    setLoader("reset-submit", true);
    const email = document.getElementById("reset-email").value;

    try {
        const response = await fetch(`http://localhost:8000/api/users/password-reset/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email })
        });

        if (response.ok) {
            displayMessage("Lien envoyé ! Vérifiez vos emails.", false);
        } else {
            throw new Error("Erreur lors de l'envoi.");
        }
    } catch (error) {
        displayMessage(error.message);
    } finally {
        setLoader("reset-submit", false);
    }
}