// direction_dashboard.js - Version Pilotage Financier

let dashboardData = null;

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Dashboard Direction chargé');
    
    // 1. Initialiser le calendrier à la date du jour
    const dateFilter = document.getElementById('dateFilter');
    if (dateFilter && !dateFilter.value) {
        dateFilter.valueAsDate = new Date();
    }

    // 2. Écouter les changements de date
    dateFilter?.addEventListener('change', () => {
        loadDashboardData(dateFilter.value);
    });

    // 3. Premier chargement
    loadDashboardData(dateFilter?.value);
});

async function loadDashboardData(selectedDate = "") {
    try {
        const token = localStorage.getItem('access_token');
        if (!token) {
            window.location.href = '/static/dist/html/login.html';
            return;
        }

        // On prépare l'URL avec le filtre date pour les stats et les transactions
        let url = `/api/school/dashboard/`;
        if (selectedDate) url += `?date=${selectedDate}`;

        console.log(`📡 Récupération des données pour le : ${selectedDate || 'Global'}`);
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);

        dashboardData = await response.json();
        
        // Rendu complet
        renderDashboard();
        renderFinanceTable(selectedDate); // Fonction pour le tableau financier

    } catch (error) {
        console.error('❌ Erreur chargement :', error);
        const container = document.getElementById('stats-container');
        if(container) container.innerHTML = `<div class="col-span-full text-red-500 p-4">Erreur: ${error.message}</div>`;
    }
}

// --- RENDU DU TABLEAU FINANCIER ---
async function renderFinanceTable(date) {
    const tbody = document.getElementById('financeTableBody');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="5" class="text-center p-4">Chargement des transactions...</td></tr>`;

    try {
        const token = localStorage.getItem('access_token');
        // On récupère les transactions filtrées par date
        const res = await fetch(`/api/finance/transactions/?date=${date}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const transactions = data.results || data;

        if (transactions.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-500 italic">Aucune transaction enregistrée pour cette date.</td></tr>`;
            return;
        }

        tbody.innerHTML = transactions.map(t => {
            const isIncome = t.transaction_type === 'INCOME' || t.transaction_type === 'RECETTE';
            const typeLabel = isIncome ? 'Entrée' : 'Dépense';
            const typeClass = isIncome 
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
            
            return `
                <tr class="border-b dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td class="px-4 py-3 font-mono text-xs">${new Date(t.date_payment || t.created_at).toLocaleTimeString()}</td>
                    <td class="px-4 py-3">
                        <div class="font-medium text-slate-900 dark:text-white">${t.description || 'Paiement frais'}</div>
                        <div class="text-xs text-slate-500">${t.student_name || t.category_name || ''}</div>
                    </td>
                    <td class="px-4 py-3">
                        <span class="px-2 py-1 rounded-full text-[10px] font-bold uppercase ${typeClass}">
                            ${typeLabel}
                        </span>
                    </td>
                    <td class="px-4 py-3 font-bold text-right ${isIncome ? 'text-emerald-600' : 'text-rose-600'}">
                        ${isIncome ? '+' : '-'} ${parseFloat(t.amount).toFixed(2)} ${t.currency || '$'}
                    </td>
                    <td class="px-4 py-3 text-center">
                         <span class="text-slate-400"><i data-lucide="check-circle" class="w-4 h-4 inline"></i></span>
                    </td>
                </tr>
            `;
        }).join('');

        lucide.createIcons();

    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-red-500 text-center p-4">Erreur de chargement des transactions.</td></tr>`;
    }
}

function renderDashboard() {
    if (!dashboardData) return;
    renderStats();
    if (window.lucide) window.lucide.createIcons();
}

function renderStats() {
    const container = document.getElementById('stats-container');
    if (!container) return;

    const stats = dashboardData.stats || {};
    
    // --- Données Académiques ---
    const usersTotal = stats.users?.total || 0;
    const usersActive = stats.users?.active_today || 0;
    const teachers = stats.academic?.teachers || 0;
    const classes = stats.academic?.classes || 0;

    // --- Données Financières ---
    const totalIncome = stats.finance?.daily_income || stats.finance?.total_payments || 0;
    const totalExpense = stats.finance?.daily_expense || 0;
    const balance = totalIncome - totalExpense;

    container.innerHTML = `
        <div class="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
            <div class="flex justify-between items-start">
                <div>
                    <p class="text-sm font-medium text-gray-500">Utilisateurs</p>
                    <h3 class="text-2xl font-bold mt-2 dark:text-white">${usersTotal}</h3>
                </div>
                <div class="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <i data-lucide="users" class="w-6 h-6 text-blue-600"></i>
                </div>
            </div>
            <div class="mt-4 flex items-center text-sm">
                <span class="text-green-500 flex items-center gap-1 font-medium">
                    <i data-lucide="activity" class="w-3 h-3"></i> ${usersActive}
                </span>
                <span class="ml-2 text-gray-600 dark:text-gray-400">actifs aujourd'hui</span>
            </div>
        </div>

        <div class="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
            <div class="flex justify-between items-start">
                <div>
                    <p class="text-sm font-medium text-gray-500">Enseignants</p>
                    <h3 class="text-2xl font-bold mt-2 dark:text-white">${teachers}</h3>
                </div>
                <div class="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <i data-lucide="graduation-cap" class="w-6 h-6 text-purple-600"></i>
                </div>
            </div>
            <div class="mt-4 text-sm text-gray-600 dark:text-gray-400">
                ${classes} classes actives
            </div>
        </div>

        <div class="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 border-l-4 border-l-emerald-500">
            <div class="flex justify-between items-start">
                <div>
                    <p class="text-sm font-medium text-gray-500">Recettes</p>
                    <h3 class="text-2xl font-bold mt-2 text-emerald-600">${totalIncome.toFixed(2)} $</h3>
                </div>
                <div class="p-2 bg-emerald-50 rounded-lg">
                    <i data-lucide="trending-up" class="w-6 h-6 text-emerald-600"></i>
                </div>
            </div>
        </div>

        <div class="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 border-l-4 border-l-rose-500">
            <div class="flex justify-between items-start">
                <div>
                    <p class="text-sm font-medium text-gray-500">Dépenses</p>
                    <h3 class="text-2xl font-bold mt-2 text-rose-600">${totalExpense.toFixed(2)} $</h3>
                </div>
                <div class="p-2 bg-rose-50 rounded-lg">
                    <i data-lucide="trending-down" class="w-6 h-6 text-rose-600"></i>
                </div>
            </div>
        </div>

        <div class="bg-slate-900 text-white p-6 rounded-xl shadow-lg border border-slate-800 col-span-1 md:col-span-2 lg:col-span-1">
            <div class="flex justify-between items-start">
                <div>
                    <p class="text-sm font-medium text-slate-400">Solde de Caisse</p>
                    <h3 class="text-2xl font-bold mt-2 ${balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
                        ${balance.toFixed(2)} $
                    </h3>
                </div>
                <div class="p-2 bg-slate-800 rounded-lg">
                    <i data-lucide="wallet" class="w-6 h-6 text-blue-400"></i>
                </div>
            </div>
        </div>
    `;
}

// Fonction utilitaire Debounce (si besoin)
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}