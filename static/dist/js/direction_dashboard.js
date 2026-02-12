// direction_dashboard.js - Version Debug

let dashboardData = null;

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Dashboard Direction chargé');
    loadDashboardData();
});

async function loadDashboardData() {
    try {
        const token = localStorage.getItem('access_token');
        if (!token) {
            console.error("⛔ Pas de token !");
            window.location.href = '/static/dist/html/login.html';
            return;
        }

        console.log("📡 Appel de l'API...");
        const response = await fetch('/api/school/dashboard/', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);

        dashboardData = await response.json();
        console.log("✅ Données reçues :", dashboardData);
        
        renderDashboard();

    } catch (error) {
        console.error('❌ Erreur chargement :', error);
        document.getElementById('stats-container').innerHTML = `
            <div class="col-span-full text-red-500 p-4 bg-red-50 rounded">
                Erreur: ${error.message}
            </div>`;
    }
}

function renderDashboard() {
    if (!dashboardData) return;

    // 1. Titres
    const user = dashboardData.user || {};
    const school = dashboardData.school || {};
    
    // Utilisation de ?. pour éviter les crashs si un élément manque dans le HTML
    document.getElementById('dashboard-title')?.replaceChildren(document.createTextNode(`Tableau de bord - ${user.full_name || 'Utilisateur'}`));
    document.getElementById('dashboard-subtitle')?.replaceChildren(document.createTextNode(`${school.name || 'École'} • ${user.custom_role || user.user_type}`));

    // 2. Stats
    renderStats();

    // 3. Modules (si la fonction existe)
    if (typeof renderModules === 'function') renderModules();

    // 4. Icônes
    if (window.lucide) {
        window.lucide.createIcons();
    } else {
        console.warn("⚠️ La librairie Lucide Icons n'est pas chargée !");
    }
}

function renderStats() {
    const container = document.getElementById('stats-container');
    if (!container) {
        console.error("❌ Élément 'stats-container' introuvable dans le HTML");
        return;
    }

    const stats = dashboardData.stats || {};
    
    // Sécurisation des valeurs (0 par défaut)
    const usersTotal = stats.users?.total || 0;
    const usersActive = stats.users?.active_today || 0;
    const teachers = stats.academic?.teachers || 0;
    const classes = stats.academic?.classes || 0;
    const revenue = stats.finance?.total_payments || 0;

    container.innerHTML = `
        <div class="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
            <div class="flex justify-between items-start">
                <div>
                    <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Utilisateurs</p>
                    <h3 class="text-2xl font-bold mt-2 dark:text-white">${usersTotal}</h3>
                </div>
                <div class="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <i data-lucide="users" class="w-6 h-6 text-blue-600 dark:text-blue-400"></i>
                </div>
            </div>
            <div class="mt-4 flex items-center text-sm text-gray-600 dark:text-gray-300">
                <span class="text-green-500 flex items-center gap-1 font-medium">
                    <i data-lucide="activity" class="w-3 h-3"></i> ${usersActive}
                </span>
                <span class="ml-2">actifs aujourd'hui</span>
            </div>
        </div>

        <div class="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
            <div class="flex justify-between items-start">
                <div>
                    <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Enseignants</p>
                    <h3 class="text-2xl font-bold mt-2 dark:text-white">${teachers}</h3>
                </div>
                <div class="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <i data-lucide="graduation-cap" class="w-6 h-6 text-purple-600 dark:text-purple-400"></i>
                </div>
            </div>
            <div class="mt-4 text-sm text-gray-600 dark:text-gray-300">
                ${classes} classes actives
            </div>
        </div>

        <div class="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
            <div class="flex justify-between items-start">
                <div>
                    <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Revenus</p>
                    <h3 class="text-2xl font-bold mt-2 dark:text-white">${revenue} $</h3>
                </div>
                <div class="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <i data-lucide="dollar-sign" class="w-6 h-6 text-green-600 dark:text-green-400"></i>
                </div>
            </div>
        </div>
    `;
}