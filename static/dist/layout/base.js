 // ------------------------------
// base.js - version finale propre
// ------------------------------

const sidebarLinksByRole = {
    superadmin: [
        { name: "Dashboard", url: "/static/dist/html/superadmin/dashboard.html", icon: "layout-dashboard" },
        { name: "Écoles", url: "/static/dist/html/superadmin/schools.html", icon: "school" },
        { name: "Utilisateurs", url: "/static/dist/html/superadmin/users.html", icon: "users" },
        { name: "Abonnements", url: "/static/dist/html/superadmin/subscriptions.html", icon: "credit-card" },
    ],
    school_admin: [
        { name: "Dashboard", url: "/static/dist/html/superadmin/direction_dashboard.html", icon: "layout-dashboard" },
        { name: "Créer / Inviter", url: "/static/dist/html/school_admin/create_users.html", icon: "user-plus" },
        { name: "Liste des utilisateurs", url: "/static/dist/html/school_admin/users_list.html", icon: "users" },
        { name: "Classes", url: "/static/dist/html/school_admin/classes_list.html", icon: "layers" },
        { name: "Modules", url: "/school/modules/", icon: "package" },
        { name: "Finance", url: "/school/finance/", icon: "dollar-sign" },
    ],
    teacher: [
        { name: "Dashboard", url: "/teacher/dashboard/", icon: "layout-dashboard" },
        { name: "Mes Modules", url: "/teacher/modules/", icon: "book" },
    ],
    staff: [
        { name: "Dashboard", url: "/staff/dashboard/", icon: "layout-dashboard" },
    ]
};

// ------------------------------
// Charger le layout (topbar + sidebar)
// ------------------------------
async function loadLayout() {
    // 1️⃣ Charger le topbar
    const topbar = await fetch("/static/dist/layout/topbar.html").then(r => r.text());
    document.getElementById("topbar").innerHTML = topbar;

    // 2️⃣ Récupérer infos utilisateur depuis localStorage
    const userRole = localStorage.getItem("user_role") || localStorage.getItem("user_type") || "superadmin";
    const userName = (localStorage.getItem("first_name") || "") + " " + (localStorage.getItem("last_name") || "");
    const userEmail = localStorage.getItem("user_email") || "";
    const profilePic = localStorage.getItem("profile_picture");

    

    // 3️⃣ Photo de profil
    const avatarFallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=6366f1&color=fff`;
    const profileImage = profilePic || avatarFallback;

    // 3️⃣ Construire le sidebar
    const links = sidebarLinksByRole[userRole] || [];
    const sidebarContainer = document.getElementById("sidebar");
    sidebarContainer.innerHTML = `
      <aside class="fixed inset-y-0 left-0 w-[280px] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 flex flex-col font-[Inter]">
        <div class="h-20 flex items-center gap-4 px-6 border-b dark:border-slate-700">
          <img src="/static/src/img/Transpa-Logo.PNG" alt="SYBEM" class="h-12 w-12 object-contain"/>
          <div>
            <p class="text-xl font-bold text-slate-800 dark:text-white">SYBEM</p>
            <p class="text-xs text-slate-500 dark:text-slate-400">${userRole}</p>
          </div>
        </div>

        <div class="px-6 py-5 border-b dark:border-slate-700 flex items-center gap-4">
          <img id="profilePreview" src="https://ui-avatars.com/api/?name=${encodeURIComponent(userName || "Utilisateur")}&background=6366f1&color=fff"
               class="h-12 w-12 rounded-full border-2 border-indigo-500 object-cover"/>
          <div>
            <p class="font-semibold text-slate-800 dark:text-white">${userName || "Utilisateur"}</p>
            <p class="text-xs text-slate-500 dark:text-slate-400">${userEmail}</p>
          </div>
        </div>

        <nav class="flex-1 py-4 text-sm space-y-1">
          ${links.map(link => `
            <a href="${link.url}" class="flex items-center gap-3 px-6 py-3 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition rounded-r-full">
              <i data-lucide="${link.icon}"></i>
              ${link.name}
            </a>
          `).join('')}
        </nav>
      </aside>
    `;

    // 4️⃣ Initialiser les icônes lucide
    lucide.createIcons();

    // 5️⃣ Initialiser le thème
    if (localStorage.getItem("theme") === "dark") {
        document.documentElement.classList.add("dark");
    }
}

// ------------------------------
// Fonctions utilitaires
// ------------------------------
function toggleDarkMode() {
    document.documentElement.classList.toggle("dark");
    localStorage.setItem(
        "theme",
        document.documentElement.classList.contains("dark") ? "dark" : "light"
    );
}

function logout() {
    localStorage.clear();
    window.location.href = "/static/dist/html/login.html";
}

function previewProfile(event) {
    const file = event.target.files[0];
    if (!file) return;
    document.getElementById("profilePreview").src = URL.createObjectURL(file);
}

// ------------------------------
// Initialisation
// ------------------------------
loadLayout();
