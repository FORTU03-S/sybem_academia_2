/**
 * FINANCE DASHBOARD LOGIC (VERSION ULTRA PRO)
 * Connecté au template finance_dashboard.html
 * S'adapte au backend AccountingDashboardView
 */

// Variables globales pour les instances de graphiques (pour destruction/mise à jour)
let chartCashFlow = null;
let chartIncomeSources = null;

document.addEventListener('DOMContentLoaded', function() {
    // 1. Charger les données par défaut (Mois en cours)
    // On utilise 'monthly' qui correspond à la logique backend "get_date_range"
    fetchDashboardData('monthly');

    // 2. Gestion des clics sur les boutons de filtre (Auj, Semaine, Mois, Année)
    const buttons = document.querySelectorAll('.period-selector');
    buttons.forEach(btn => {
        btn.addEventListener('click', function() {
            // Gestion visuelle des boutons (Active state)
            buttons.forEach(b => {
                b.classList.remove('active', 'btn-primary');
                b.classList.add('btn-outline-primary');
            });
            this.classList.remove('btn-outline-primary');
            this.classList.add('active', 'btn-primary');

            // Récupération de la période (ex: 'today', 'weekly', 'monthly', 'yearly')
            const range = this.getAttribute('data-period');
            fetchDashboardData(range);
        });
    });
});

/**
 * ORCHESTRATION CENTRALE
 * Fait un seul appel API et distribue les données aux fonctions d'affichage
 */
/**
 * ORCHESTRATION CENTRALE (CORRIGÉE)
 */
async function fetchDashboardData(range = 'monthly') {
    try {
        const data = await secureFetch(`/api/finance/dashboard/?range=${range}&group_by=day`);
        
        if (!data) return;

        // 1. KPIs
        updateKPIs(data.kpi);

        // 2. Graphique Linéaire (Évolution)
        if (data.chart_data) {
            renderEvolutionChart(data.chart_data);
        }

        // 3. Graphique Donut (Répartition) - Corrigé pour correspondre à la vue
        if (data.payment_stats) {
            renderBreakdownChart(data.payment_stats);
        }

        // 4. Tableau des Transactions - Corrigé pour correspondre à la vue
        if (data.recent_transactions) {
            renderRecentTransactions(data.recent_transactions);
        }

    } catch (error) {
        console.error("Erreur critique dashboard:", error);
    }
}

// Assure-toi que l'écouteur de boutons cible les bons éléments
document.addEventListener('DOMContentLoaded', function() {
    fetchDashboardData('monthly');

    // On cible tous les boutons qui ont l'attribut data-period
    const buttons = document.querySelectorAll('button[data-period]');
    buttons.forEach(btn => {
        btn.addEventListener('click', function() {
            buttons.forEach(b => b.classList.remove('active', 'btn-primary'));
            this.classList.add('active', 'btn-primary');
            fetchDashboardData(this.getAttribute('data-period'));
        });
    });
});

// ==========================================
// A. LOGIQUE KPI (Mise à jour du DOM)
// ==========================================
function updateKPIs(kpiData) {
    if (!kpiData) return;

    const currency = kpiData.currency || 'USD';

    // On map les clés du JSON backend aux ID du HTML
    // income_real -> Montant encaissé réel
    updateText('kpiIncome', kpiData.income_real, currency);
    
    // expense_real -> Dépenses réelles
    updateText('kpiExpense', kpiData.expense_real, currency);
    
    // net_balance -> Solde (Peut être négatif)
    updateText('kpiBalance', kpiData.net_balance, currency);
    
    // exemptions_given -> Manque à gagner (Cadeaux)
    updateText('kpiExemptions', kpiData.exemptions_given, currency);

    // [NOUVEAU] Pertes sur abandons (Si tu as ajouté la card dans le HTML)
    if (document.getElementById('kpiLoss')) {
        updateText('kpiLoss', kpiData.dropout_loss, currency);
    }
}

// ==========================================
// B. LOGIQUE GRAPHIQUE ÉVOLUTION (Area Chart)
// ==========================================
function renderEvolutionChart(chartData) {
    if (!chartData || chartData.length === 0) return;

    // Le backend renvoie une liste plate : [{period: '2023-01-01', transaction_type: 'INCOME', total: 100}, ...]
    // Nous devons la transformer pour ApexCharts (Séries temporelles alignées)

    // 1. Extraire toutes les dates uniques et les trier
    const uniqueDates = [...new Set(chartData.map(item => item.period))].sort();

    // 2. Préparer les tableaux de données alignés sur ces dates
    const incomeSeries = [];
    const expenseSeries = [];

    uniqueDates.forEach(date => {
        // Trouver l'entrée INCOME pour cette date
        const incomeItem = chartData.find(d => d.period === date && d.transaction_type === 'INCOME');
        incomeSeries.push(incomeItem ? parseFloat(incomeItem.total) : 0);

        // Trouver l'entrée EXPENSE pour cette date
        const expenseItem = chartData.find(d => d.period === date && d.transaction_type === 'EXPENSE');
        expenseSeries.push(expenseItem ? parseFloat(expenseItem.total) : 0);
    });

    // Formatage des dates pour l'axe X (ex: 12 Jan)
    const dateLabels = uniqueDates.map(d => {
        const dateObj = new Date(d);
        return dateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    });

    const options = {
        series: [
            { name: 'Entrées (Recettes)', data: incomeSeries },
            { name: 'Sorties (Dépenses)', data: expenseSeries }
        ],
        chart: {
            type: 'area', // Area remplit la zone sous la courbe (très visuel pour la trésorerie)
            height: 350,
            toolbar: { show: false },
            zoom: { enabled: false }
        },
        colors: ['#1cc88a', '#e74a3b'], // Vert (Succès) et Rouge (Danger)
        dataLabels: { enabled: false },
        stroke: { curve: 'smooth', width: 2 },
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.7,
                opacityTo: 0.3, // Dégradé vers le bas
                stops: [0, 90, 100]
            }
        },
        xaxis: {
            categories: dateLabels,
            labels: { style: { colors: '#858796' } },
            tooltip: { enabled: false } // Désactive tooltip sur l'axe X pour éviter surcharge
        },
        yaxis: {
            labels: {
                formatter: (val) => val.toLocaleString(), // Ajoute séparateur millier
                style: { colors: '#858796' }
            }
        },
        tooltip: {
            y: { formatter: function (val) { return val.toLocaleString() + " $"; } }
        },
        grid: { borderColor: '#e3e6f0', strokeDashArray: 4 }
    };

    // Gestion du re-rendu (Destroy old -> Create new)
    const chartDiv = document.querySelector("#chartCashFlow");
    if (chartDiv) {
        if (chartCashFlow) {
            chartCashFlow.destroy();
        }
        chartCashFlow = new ApexCharts(chartDiv, options);
        chartCashFlow.render();
    }
}

// ==========================================
// C. LOGIQUE GRAPHIQUE RÉPARTITION (Donut)
// ==========================================
function renderBreakdownChart(paymentStats) {
    // paymentStats attendu: [{ payment_method: 'CASH', total: 5000 }, ...]
    if (!paymentStats || paymentStats.length === 0) return;

    const labels = paymentStats.map(item => formatPaymentMethod(item.payment_method));
    const series = paymentStats.map(item => parseFloat(item.total));

    const options = {
        series: series,
        labels: labels,
        chart: {
            type: 'donut',
            height: 350,
        },
        colors: ['#4e73df', '#1cc88a', '#36b9cc', '#f6c23e'], // Palette Bleu/Vert/Cyan/Jaune
        plotOptions: {
            pie: {
                donut: {
                    size: '75%',
                    labels: {
                        show: true,
                        total: {
                            show: true,
                            label: 'Total',
                            formatter: function (w) {
                                const total = w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                                return total.toLocaleString() + " $";
                            }
                        }
                    }
                }
            }
        },
        legend: { position: 'bottom' },
        tooltip: {
            y: { formatter: function (val) { return val.toLocaleString() + " $"; } }
        }
    };

    const chartDiv = document.querySelector("#chartIncomeSources");
    if (chartDiv) {
        if (chartIncomeSources) {
            chartIncomeSources.destroy();
        }
        chartIncomeSources = new ApexCharts(chartDiv, options);
        chartIncomeSources.render();
    }
}

function renderRecentTransactions(transactions) {
    // 1. On utilise le BON ID présent dans ton HTML
    const tbody = document.getElementById('transactionsTableBody');
    if (!tbody) return;

    if (!transactions || transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-10 text-slate-500">Aucune transaction récente.</td></tr>';
        return;
    }

    tbody.innerHTML = transactions.map(t => {
        const isIncome = t.transaction_type === 'INCOME';
        const date = new Date(t.date_payment || t.created_at).toLocaleDateString('fr-FR', {
            day: '2-digit', month: 'short', year: 'numeric'
        });
        
        // On utilise les couleurs définies dans ton tailwind.config
        const badgeClass = isIncome 
            ? 'bg-income-50 dark:bg-income-500/10 text-income-600 border-income-200' 
            : 'bg-expense-50 dark:bg-expense-500/10 text-expense-600 border-expense-200';

        return `
            <tr class="table-row-hover border-b border-slate-100/50 dark:border-slate-800/50">
                <td class="px-8 py-5 font-mono text-sm">${date}</td>
                <td class="px-8 py-5 font-semibold">${t.student_name || t.description || 'N/A'}</td>
                <td class="px-8 py-5">
                    <span class="px-3 py-1 rounded-full text-[10px] font-bold border ${badgeClass}">
                        ${isIncome ? 'ENCAISSEMENT' : 'DÉPENSE'}
                    </span>
                </td>
                <td class="px-8 py-5 text-right font-mono font-bold ${isIncome ? 'text-income-600' : 'text-expense-600'}">
                    ${isIncome ? '+' : '-'}${parseFloat(t.amount).toLocaleString()} $
                </td>
            </tr>
        `;
    }).join('');

    // TRÈS IMPORTANT : Relancer Lucide pour les icônes si tu en as ajouté en JS
    if (window.lucide) lucide.createIcons();
}

// ==========================================
// UTILITAIRES & SÉCURITÉ
// ==========================================

// ==========================================
// UTILITAIRES & SÉCURITÉ (CORRIGÉ)
// ==========================================

function formatPaymentMethod(methodCode) {
    const map = {
        'CASH': 'Espèces',
        'BANK': 'Virement Bancaire',
        'MOBILE': 'Mobile Money',
        'CHECK': 'Chèque'
    };
    return map[methodCode] || methodCode;
}

// Fonction pour récupérer le cookie CSRF (Standard Django)
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

// Fonction Fetch sécurisée Hybride (Token OU Session)
async function secureFetch(url) {
    try {
        const headers = {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken') // Indispensable pour Django Session
        };

        // 1. Tenter de récupérer un token (si vous utilisez une auth API pure)
        const token = localStorage.getItem('accessToken');
        if (token) {
            headers['Authorization'] = 'Bearer ' + token;
        }

        // 2. Lancer la requête en incluant les cookies de session ('include' ou 'same-origin')
        const response = await fetch(url, {
            method: 'GET', // Par défaut
            headers: headers,
            credentials: 'same-origin' // <--- C'est LA clé pour que Django reconnaisse votre login admin
        });
        
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                console.warn("Accès refusé. L'utilisateur n'est peut-être pas connecté.");
                // Optionnel : Afficher une alerte
                // alert("Session expirée, veuillez recharger la page.");
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (e) {
        console.error("Erreur Fetch:", e);
        return null;
    }
}

// Mise à jour texte DOM avec animation simple (toLocaleString)
function updateText(elementId, amount, currency) {
    const el = document.getElementById(elementId);
    if (el) {
        // Conversion sécurisée en nombre
        let val = parseFloat(amount);
        if (isNaN(val)) val = 0;
        
        // Couleur dynamique pour le solde (Rouge si négatif)
        if (elementId === 'kpiBalance') {
            el.className = val < 0 ? 'h5 mb-0 font-weight-bold text-danger' : 'h5 mb-0 font-weight-bold text-gray-800';
        }

        el.textContent = val.toLocaleString('fr-FR', {
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
        }) + ' ' + (currency || 'USD');
    }
}