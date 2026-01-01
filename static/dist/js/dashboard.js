// dashboard.js — VERSION STABLE & PRO (AUTH SAFE, AUTO-REFRESH TOKEN)

// ==========================
// CONFIG
// ==========================
const API_BASE_URL = "http://localhost:8000/api/auth";
const DASHBOARD_API = "http://localhost:8000/api/superadmin/dashboard/";
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

console.log("🔎 Dashboard chargé");

// ==========================
// INITIALISATION PRINCIPALE
// ==========================
document.addEventListener("DOMContentLoaded", async () => {
    console.log("🚀 Initialisation sécurisée du dashboard...");

    const token = await getValidToken();
    if (!token) {
        console.warn("⛔ Token absent ou invalide → redirection login");
        logout();
        return;
    }

    // Vérifie si l'utilisateur est superadmin
    const isSuperAdmin = localStorage.getItem("is_superadmin") === "true";
    if (!isSuperAdmin) {
        console.error("❌ Accès interdit: non superadmin");
        logout();
        return;
    }

    console.log("✅ Token valide et superadmin détecté");

    // Icônes
    if (typeof lucide !== "undefined") lucide.createIcons();

    // Initialisations UI
    initTheme();
    initNavInteractions();
    initActionButtons();
    loadDashboardStats();

    // Démarre refresh automatique du token
    scheduleTokenRefresh();
});

// ==========================
// TOKEN JWT
// ==========================
async function getValidToken() {
    let token = localStorage.getItem("access_token");
    const refresh = localStorage.getItem("refresh_token");
    if (!token || !refresh) return null;

    try {
        // Test token actuel
        const res = await fetch(DASHBOARD_API, {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (res.status === 401 || res.status === 403) {
            // Token expiré → refresh
            const refreshRes = await fetch(`${API_BASE_URL}/refresh/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refresh })
            });
            const data = await refreshRes.json();
            if (!refreshRes.ok || !data.access) return null;

            localStorage.setItem("access_token", data.access);
            token = data.access;
            console.log("🔄 Token JWT rafraîchi automatiquement");
        }
    } catch (e) {
        console.error("❌ Erreur token:", e);
        return null;
    }

    return token;
}

function scheduleTokenRefresh() {
    setInterval(async () => {
        const refresh = localStorage.getItem("refresh_token");
        if (!refresh) return;

        try {
            const res = await fetch(`${API_BASE_URL}/refresh/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refresh })
            });
            const data = await res.json();
            if (data.access) localStorage.setItem("access_token", data.access);
        } catch (e) {
            console.error("❌ Erreur refresh token:", e);
            logout();
        }
    }, REFRESH_INTERVAL);
}

// ==========================
// THEME
// ==========================
function initTheme() {
    const html = document.documentElement;
    const themeBtn = document.getElementById("themeBtn");
    const savedTheme = localStorage.getItem("theme") || "light";
    html.classList.toggle("dark", savedTheme === "dark");

    themeBtn?.addEventListener("click", () => {
        const isDark = html.classList.contains("dark");
        html.classList.toggle("dark", !isDark);
        localStorage.setItem("theme", isDark ? "light" : "dark");
        if (typeof lucide !== "undefined") {
            themeBtn.innerHTML = `<i data-lucide="${isDark ? "moon" : "sun"}"></i>`;
            lucide.createIcons();
        }
    });
}

// ==========================
// NAVIGATION SIDEBAR
// ==========================



// ==========================
// ACTIONS UI
// ==========================
function initActionButtons() {
    document.getElementById("logoutBtn")?.addEventListener("click", logout);
    document.getElementById("refreshBtn")?.addEventListener("click", loadDashboardStats);
    document.getElementById("createSchoolBtn")?.addEventListener("click", goToCreateSchool);
}

// ==========================
// API — DASHBOARD STATS
// ==========================
async function loadDashboardStats() {
    console.log("📊 Chargement stats dashboard...");
    const token = await getValidToken();
    if (!token) { logout(); return; }

    showLoadingState(true);
    try {
        const response = await fetch(DASHBOARD_API, {
            headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }
        });

        if (!response.ok) {
            showErrorMessage("Accès non autorisé ou API indisponible");
            showLoadingState(false);
            return;
        }

        const data = await response.json();
        animateDataDisplay(data);

    } catch (error) {
        console.error("❌ API error:", error);
        showErrorMessage("Erreur serveur");
        showLoadingState(false);
    }
}

// ==========================
// AFFICHAGE DES DONNÉES
// ==========================
function animateDataDisplay(data) {
    showLoadingState(false);
    animateCounter("total-schools", 0, data.total_schools || 0, 800);
    animateCounter("total-users", 0, data.total_users || 0, 1000);
    animateCounter("active-plans", 0, data.active_plans || 0, 1200);
    updateLastUpdateTime();
    showSuccessMessage("Dashboard mis à jour");
}

function animateCounter(id, start, end, duration) {
    const el = document.getElementById(id);
    if (!el) return;
    let startTime = null;
    const step = timestamp => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        el.textContent = Math.floor(progress * (end - start) + start);
        if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}

// ==========================
// UI FEEDBACK
// ==========================
function showLoadingState(show) {
    document.querySelectorAll(".stat-card h2").forEach(el => el.textContent = show ? "..." : el.textContent);
}
function showSuccessMessage(msg) { showToast(msg, "green", "check-circle"); }
function showErrorMessage(msg) { showToast(msg, "red", "alert-circle"); }
function showToast(message, color, icon) {
    const toast = document.createElement("div");
    toast.className = `fixed top-4 right-4 bg-${color}-600 text-white px-4 py-3 rounded-lg shadow-lg z-50`;
    toast.innerHTML = `<i data-lucide="${icon}"></i> ${message}`;
    document.body.appendChild(toast);
    lucide?.createIcons();
    setTimeout(() => toast.remove(), 3000);
}

// ==========================
// LOGOUT
// ==========================


// ==========================
// NAVIGATION CRUD
// ==========================
function goToSchools() { window.location.href = "/static/dist/html/superadmin/schools.html"; }
function goToUsers() { window.location.href = "/static/dist/html/superadmin/users.html"; }
function goToSubscriptions() { window.location.href = "/static/dist/html/superadmin/subscriptions.html"; }
function goToCreateSchool() { window.location.href = "/static/dist/html/superadmin/schools/create.html"; }

// ==========================
// UTILS
// ==========================
function updateLastUpdateTime() {
    const el = document.getElementById("last-update");
    if (el) el.textContent = new Date().toLocaleTimeString("fr-FR");
}

// ==========================
// EXPOSITION GLOBALE
// ==========================
window.logout = logout;
window.refreshDashboard = loadDashboardStats;
window.goToSchools = goToSchools;
window.goToUsers = goToUsers;
window.goToSubscriptions = goToSubscriptions;
window.goToCreateSchool = goToCreateSchool;

console.log("✅ dashboard.js chargé (version stable & PRO)");