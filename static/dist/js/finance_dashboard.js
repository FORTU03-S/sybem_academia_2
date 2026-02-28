
let chartCashFlow = null;
let chartIncomeSources = null;

document.addEventListener('DOMContentLoaded', function() {
    
    fetchDashboardData('monthly');

    const buttons = document.querySelectorAll('.period-selector');
    buttons.forEach(btn => {
        btn.addEventListener('click', function() {
            buttons.forEach(b => {
                b.classList.remove('active', 'btn-primary');
                b.classList.add('btn-outline-primary');
            });
            this.classList.remove('btn-outline-primary');
            this.classList.add('active', 'btn-primary');
            const range = this.getAttribute('data-period');
            fetchDashboardData(range);
        });
    });
});


async function fetchDashboardData(range = 'monthly') {
    try {
        const data = await secureFetch(`/api/finance/dashboard/?range=${range}&group_by=day`);
        
        if (!data) return;

        //  KPIs
        updateKPIs(data.kpi);

        //  Graphique 
        if (data.chart_data) {
            renderEvolutionChart(data.chart_data);
        }

        
        if (data.payment_stats) {
            renderBreakdownChart(data.payment_stats);
        }

        
        if (data.recent_transactions) {
            renderRecentTransactions(data.recent_transactions);
        }

    } catch (error) {
        console.error("Erreur critique dashboard:", error);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    fetchDashboardData('monthly');

    const buttons = document.querySelectorAll('button[data-period]');
    buttons.forEach(btn => {
        btn.addEventListener('click', function() {
            buttons.forEach(b => b.classList.remove('active', 'btn-primary'));
            this.classList.add('active', 'btn-primary');
            fetchDashboardData(this.getAttribute('data-period'));
        });
    });
});

function updateKPIs(kpiData) {
    if (!kpiData) return;

    const currency = kpiData.currency || 'USD';

    updateText('kpiIncome', kpiData.income_real, currency);
    
    updateText('kpiExpense', kpiData.expense_real, currency);
    
    updateText('kpiBalance', kpiData.net_balance, currency);
    
    updateText('kpiExemptions', kpiData.exemptions_given, currency);

    if (document.getElementById('kpiLoss')) {
        updateText('kpiLoss', kpiData.dropout_loss, currency);
    }
}

function renderEvolutionChart(chartData) {
    if (!chartData || chartData.length === 0) return;

    const uniqueDates = [...new Set(chartData.map(item => item.period))].sort();

    const incomeSeries = [];
    const expenseSeries = [];

    uniqueDates.forEach(date => {
        const incomeItem = chartData.find(d => d.period === date && d.transaction_type === 'INCOME');
        incomeSeries.push(incomeItem ? parseFloat(incomeItem.total) : 0);

        const expenseItem = chartData.find(d => d.period === date && d.transaction_type === 'EXPENSE');
        expenseSeries.push(expenseItem ? parseFloat(expenseItem.total) : 0);
    });

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
            type: 'area', 
            height: 350,
            toolbar: { show: false },
            zoom: { enabled: false }
        },
        colors: ['#1cc88a', '#e74a3b'], 
        dataLabels: { enabled: false },
        stroke: { curve: 'smooth', width: 2 },
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.7,
                opacityTo: 0.3,
                stops: [0, 90, 100]
            }
        },
        xaxis: {
            categories: dateLabels,
            labels: { style: { colors: '#858796' } },
            tooltip: { enabled: false } 
        },
        yaxis: {
            labels: {
                formatter: (val) => val.toLocaleString(), 
                style: { colors: '#858796' }
            }
        },
        tooltip: {
            y: { formatter: function (val) { return val.toLocaleString() + " $"; } }
        },
        grid: { borderColor: '#e3e6f0', strokeDashArray: 4 }
    };

    const chartDiv = document.querySelector("#chartCashFlow");
    if (chartDiv) {
        if (chartCashFlow) {
            chartCashFlow.destroy();
        }
        chartCashFlow = new ApexCharts(chartDiv, options);
        chartCashFlow.render();
    }
}

function renderBreakdownChart(paymentStats) {
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
        colors: ['#4e73df', '#1cc88a', '#36b9cc', '#f6c23e'], 
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

    if (window.lucide) lucide.createIcons();
}

function formatPaymentMethod(methodCode) {
    const map = {
        'CASH': 'Espèces',
        'BANK': 'Virement Bancaire',
        'MOBILE': 'Mobile Money',
        'CHECK': 'Chèque'
    };
    return map[methodCode] || methodCode;
}

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

async function secureFetch(url) {
    try {
        const headers = {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken') 
        };

        const token = localStorage.getItem('accessToken');
        if (token) {
            headers['Authorization'] = 'Bearer ' + token;
        }

        const response = await fetch(url, {
            method: 'GET', 
            headers: headers,
            credentials: 'same-origin' 
        });
        
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                console.warn("Accès refusé. L'utilisateur n'est peut-être pas connecté.");
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (e) {
        console.error("Erreur Fetch:", e);
        return null;
    }
}

function updateText(elementId, amount, currency) {
    const el = document.getElementById(elementId);
    if (el) {
        let val = parseFloat(amount);
        if (isNaN(val)) val = 0;
        
        if (elementId === 'kpiBalance') {
            el.className = val < 0 ? 'h5 mb-0 font-weight-bold text-danger' : 'h5 mb-0 font-weight-bold text-gray-800';
        }

        el.textContent = val.toLocaleString('fr-FR', {
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
        }) + ' ' + (currency || 'USD');
    }
}