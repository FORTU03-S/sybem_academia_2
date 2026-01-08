/**
 * Configuration des menus par rôle
 */
const sidebarLinksByRole = {
    superadmin: [
        { name: "Dashboard", url: "/static/dist/html/superadmin/dashboard.html", icon: "layout-dashboard" },
        { name: "Écoles", url: "/static/dist/html/superadmin/schools.html", icon: "school" },
        { name: "Utilisateurs", url: "/static/dist/html/superadmin/users.html", icon: "users" },
        { name: "Abonnements", url: "/static/dist/html/superadmin/subscriptions.html", icon: "credit-card" },
    ],
    school_admin: [
        { name: "Tableau de Bord", url: "/static/dist/html/superadmin/direction_dashboard.html", icon: "layout-dashboard" },
        { name: "Classes & Programmes", url: "/static/dist/html/school_admin/classes_list.html", icon: "layers" },
        { name: "Catalogue des Cours", url: "/static/dist/html/school_admin/courses_list.html", icon: "library" },
        { name: "Personnels", url: "/static/dist/html/school_admin/users_list.html", icon: "users" },
        { name: "Élèves", url: "/static/dist/html/school_admin/pupils_list.html", icon: "users" },
        { name: "Créer / Inviter", url: "/static/dist/html/school_admin/create_users.html", icon: "user-plus" },
        { name: "Finance", url: "/school/finance/", icon: "dollar-sign" },
    ],
    teacher: [
        { name: "Dashboard", url: "/static/dist/html/teacher/dashboard.html", icon: "layout-dashboard" },
        { name: "Mes Classes & Cours", url: "/static/dist/html/teacher/classes.html", icon: "book-open" }
    ],
    staff: [
        { name: "Dashboard", url: "/staff/dashboard/", icon: "layout-dashboard" },
    ]
};

/**
 * Initialisation au chargement du DOM
 */
document.addEventListener('DOMContentLoaded', () => {
    loadLayout();
    initTheme();
});

/**
 * Charge le Topbar et génère le Sidebar dynamiquement
 */
async function loadLayout() {
    // 1. Récupération des données utilisateur avec Fallbacks
    const rawRole = localStorage.getItem("user_role") || localStorage.getItem("user_type");
    
    // Sécurité : Si pas de rôle, on redirige vers le login
    if (!rawRole) {
        console.warn("Utilisateur non identifié, redirection...");
        window.location.href = "/static/dist/html/login.html";
        return;
    }

    // Normalisation du rôle (ex: "School-Admin" -> "school_admin")
    const userRole = rawRole.toLowerCase().replace('-', '_');
    
    const userName = `${localStorage.getItem("first_name") || "Utilisateur"} ${localStorage.getItem("last_name") || ""}`.trim();
    const userEmail = localStorage.getItem("user_email") || "email@exemple.com";
    const profilePic = localStorage.getItem("profile_picture");

    // 2. Charger le topbar (optionnel selon ton setup)
    try {
        const res = await fetch("/static/dist/layout/topbar.html");
        if (res.ok) {
            document.getElementById("topbar").innerHTML = await res.text();
        }
    } catch (e) { console.warn("Topbar non trouvée"); }

    // 3. Construction du Sidebar
    renderSidebar(userRole, userName, userEmail, profilePic);
}

/**
 * Génère le HTML du Sidebar
 */
// --- AJOUTER CES FONCTIONS ---

function toggleSidebar() {
    const sidebar = document.getElementById("sidebar-container");
    const overlay = document.getElementById("sidebar-overlay");
    
    if (sidebar.classList.contains("-translate-x-full")) {
        // Ouvrir
        sidebar.classList.remove("-translate-x-full");
        overlay.classList.remove("hidden");
    } else {
        // Fermer
        sidebar.classList.add("-translate-x-full");
        overlay.classList.add("hidden");
    }
}

// --- MODIFIER LA FONCTION renderSidebar ---

function renderSidebar(role, name, email, pic) {
    const sidebarContainer = document.getElementById("sidebar");
    if (!sidebarContainer) return;

    const links = sidebarLinksByRole[role] || [];
    const avatarDefault = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff`;

    // Structure avec Overlay pour le mobile
    sidebarContainer.innerHTML = `
      <div id="sidebar-overlay" onclick="toggleSidebar()" class="fixed inset-0 bg-slate-900/50 z-40 hidden lg:hidden backdrop-blur-sm"></div>

      <aside id="sidebar-container" class="fixed inset-y-0 left-0 w-[280px] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 flex flex-col font-[Inter] z-50 transition-transform duration-300 transform -translate-x-full lg:translate-x-0">
        
        <div class="h-20 flex items-center justify-between px-6 border-b dark:border-slate-700">
          <div class="flex items-center gap-3">
            <img src="/static/src/img/Transpa-Logo.PNG" alt="SYBEM" class="h-10 w-10 object-contain"/>
            <p class="text-lg font-bold text-slate-800 dark:text-white">SYBEM</p>
          </div>
          <button onclick="toggleSidebar()" class="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg">
            <i data-lucide="x"></i>
          </button>
        </div>

        <div class="px-6 py-5 border-b dark:border-slate-700 flex items-center gap-4">
          <img src="${pic || avatarDefault}" class="h-11 w-11 rounded-full border-2 border-indigo-500 object-cover"/>
          <div class="overflow-hidden">
            <p class="font-semibold text-sm text-slate-800 dark:text-white truncate">${name}</p>
            <p class="text-[10px] text-indigo-500 font-bold uppercase">${role.replace('_', ' ')}</p>
          </div>
        </div>

        <nav class="flex-1 py-4 text-sm space-y-1 overflow-y-auto">
          ${links.map(link => `
            <a href="${link.url}" class="flex items-center gap-3 px-6 py-3 text-slate-600 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-slate-800 hover:text-indigo-600 transition-colors">
              <i data-lucide="${link.icon}" class="w-5 h-5"></i>
              <span>${link.name}</span>
            </a>
          `).join('')}
        </nav>
        
        <div class="p-4 border-t dark:border-slate-700">
             <button onclick="logout()" class="flex w-full items-center gap-3 px-6 py-2.5 text-red-500 hover:bg-red-50 rounded-lg font-medium">
                <i data-lucide="log-out" class="w-5 h-5"></i> <span>Déconnexion</span>
             </button>
        </div>
      </aside>
    `;
    initIconsSafe();
}

/**
 * Initialisation sécurisée de Lucide
 */
function initIconsSafe() {
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    } else {
        setTimeout(initIconsSafe, 50);
    }
}

/**
 * Thème & Utilitaires
 */
function initTheme() {
    if (localStorage.getItem("theme") === "dark" || 
        (!("theme" in localStorage) && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
        document.documentElement.classList.add("dark");
    }
}

function toggleDarkMode() {
    const isDark = document.documentElement.classList.toggle("dark");
    localStorage.setItem("theme", isDark ? "dark" : "light");
}

function logout() {
    // On ne garde que le thème si on veut, sinon on vide tout
    const theme = localStorage.getItem("theme");
    localStorage.clear();
    if(theme) localStorage.setItem("theme", theme);
    window.location.href = "/static/dist/html/login.html";
}