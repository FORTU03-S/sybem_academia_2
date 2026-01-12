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
        { name: "Dashboard", url: "/static/dist/html/school_admin/direction_dashboard.html", icon: "layout-dashboard" },
        { name: "Classes & Programmes", url: "/static/dist/html/school_admin/classes_list.html", icon: "layers" },
        { name: "Catalogue des Cours", url: "/static/dist/html/school_admin/courses_list.html", icon: "library" },
        { name: "Personnels & Créer / Inviter", url: "/static/dist/html/school_admin/users_list.html", icon: "users" },
        { name: "Élèves", url: "/static/dist/html/school_admin/pupils_list.html", icon: "users" },
     //   { name: "Créer / Inviter", url: "/static/dist/html/school_admin/create_users.html", icon: "user-plus" },
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

/**
 * Génère le HTML du Sidebar (VERSION AMÉLIORÉE)
 */
function renderSidebar(role, name, email, pic) {
    const sidebarContainer = document.getElementById("sidebar");
    if (!sidebarContainer) return;

    const links = sidebarLinksByRole[role] || [];
    const avatarDefault = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff`;

    // Structure améliorée avec overlay mobile
    sidebarContainer.innerHTML = `
        <!-- Overlay mobile -->
        <div id="sidebar-overlay" onclick="toggleSidebar()" 
             class="fixed inset-0 bg-slate-900/70 z-40 hidden lg:hidden backdrop-blur-sm transition-opacity duration-300"></div>

        <!-- Sidebar Principal -->
        <aside id="sidebar-container" 
               class="fixed inset-y-0 left-0 w-[280px] bg-gradient-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 
                      border-r border-slate-200/80 dark:border-slate-700/80 flex flex-col font-[Inter] z-50 
                      transition-all duration-300 transform -translate-x-full lg:translate-x-0 
                      shadow-xl dark:shadow-slate-900/50">

            <!-- Logo avec effet glassmorphism -->
            <div class="h-20 flex items-center justify-between px-6 border-b dark:border-slate-700/50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
                <div class="flex items-center gap-3">
                    <div class="relative">
                        <img src="/static/src/img/Transpa-Logo.PNG" alt="SYBEM" 
                             class="h-10 w-10 object-contain drop-shadow-lg"/>
                        <div class="absolute inset-0 bg-indigo-500/10 rounded-full blur-sm"></div>
                    </div>
                    <div>
                        <p class="text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                            SYBEM
                        </p>
                        <p class="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Education Suite</p>
                    </div>
                </div>
                <button onclick="toggleSidebar()" 
                        class="lg:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors group">
                    <i data-lucide="x" class="w-5 h-5 text-slate-600 dark:text-slate-300 group-hover:scale-110 transition-transform"></i>
                </button>
            </div>

            <!-- Profil utilisateur -->
            <div class="px-6 py-5 border-b dark:border-slate-700/50 flex items-center gap-4 group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                <div class="relative">
                    <img src="${pic || avatarDefault}" 
                         class="h-12 w-12 rounded-full border-2 border-white dark:border-slate-700 shadow-lg object-cover"/>
                    <div class="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-slate-800"></div>
                </div>
                <div class="overflow-hidden flex-1">
                    <p class="font-semibold text-sm text-slate-800 dark:text-white truncate">${name}</p>
                    <p class="text-xs text-slate-500 dark:text-slate-400 truncate">${email}</p>
                    <span class="inline-block mt-1 px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 
                                 text-[10px] font-bold uppercase rounded-full">
                        ${role.replace('_', ' ')}
                    </span>
                </div>
            </div>

            <!-- Menu de navigation -->
            <nav class="flex-1 py-4 text-sm space-y-1 overflow-y-auto px-3">
                ${links.map((link, index) => `
                    <a href="${link.url}" 
                       class="flex items-center gap-3 px-4 py-3 text-slate-700 dark:text-slate-300 
                              hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 dark:hover:from-indigo-900/20 dark:hover:to-purple-900/20 
                              hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl mx-2
                              transition-all duration-300 group relative overflow-hidden
                              ${window.location.pathname.includes(link.url) ? 'bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 text-indigo-600 dark:text-indigo-400 border-l-4 border-indigo-500' : ''}">
                        <div class="relative z-10 flex items-center gap-3">
                            <i data-lucide="${link.icon}" 
                               class="w-5 h-5 transition-transform group-hover:scale-110 ${window.location.pathname.includes(link.url) ? 'text-indigo-600 dark:text-indigo-400' : ''}"></i>
                            <span class="font-medium">${link.name}</span>
                        </div>
                        <div class="absolute right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <i data-lucide="chevron-right" class="w-4 h-4"></i>
                        </div>
                    </a>
                `).join('')}
            </nav>
            
            <!-- Déconnexion -->
            <div class="p-4 border-t dark:border-slate-700/50 bg-gradient-to-r from-red-50/50 to-orange-50/50 dark:from-red-900/10 dark:to-orange-900/10">
                <button onclick="logout()" 
                        class="flex w-full items-center justify-center gap-3 px-4 py-3 bg-white dark:bg-slate-800 
                               text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 
                               rounded-xl font-medium transition-all duration-300 group hover:shadow-lg">
                    <i data-lucide="log-out" class="w-5 h-5 transition-transform group-hover:-translate-x-1"></i>
                    <span>Déconnexion</span>
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