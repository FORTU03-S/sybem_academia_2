

let currentPage = 1;
let currentFilters = {
    search: "",
    status: "",
    transaction_type: ""
};
let currentTransactionId = null;
const userRole = localStorage.getItem("user_specific_role") || "STAFF"; 
const userType = localStorage.getItem("user_type"); 

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    loadTransactions();

    
    document.getElementById('searchInput').addEventListener('input', debounce((e) => {
        currentFilters.search = e.target.value;
        currentPage = 1;
        loadTransactions();
    }, 500));

    document.getElementById('typeFilter').addEventListener('change', (e) => {
        currentFilters.transaction_type = e.target.value;
        currentPage = 1;
        loadTransactions();
    });

    document.getElementById('statusFilter').addEventListener('change', (e) => {
        currentFilters.status = e.target.value;
        currentPage = 1;
        loadTransactions();
    });
});


async function loadTransactions() {
    const tbody = document.getElementById('transactionsTableBody');
    tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center"><div class="animate-spin inline-block w-6 h-6 border-2 border-primary-500 rounded-full border-t-transparent"></div></td></tr>`;

    try {
        
        const params = new URLSearchParams({
            page: currentPage,
            search: currentFilters.search,
            status: currentFilters.status,
            transaction_type: currentFilters.transaction_type
        });

        
        const response = await fetch(`/api/finance/transactions/?${params.toString()}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem("access_token")}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error("Erreur chargement");
        
        const data = await response.json();
        
        
        const results = data.results || [];
        renderTable(results);
        updatePagination(data.next, data.previous);

    } catch (error) {
        console.error(error);
        tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-red-500">Erreur lors du chargement des données.</td></tr>`;
    }
}


function renderTable(transactions) {
    const tbody = document.getElementById('transactionsTableBody');
    tbody.innerHTML = '';

    if (transactions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-500 italic">Aucune transaction trouvée.</td></tr>`;
        return;
    }

    transactions.forEach(txn => {
        const row = document.createElement('tr');
        row.className = "hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group";
        
        const dateObj = new Date(txn.created_at);
        const dateStr = dateObj.toLocaleDateString('fr-FR');
        const timeStr = dateObj.toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'});

        const isIncome = txn.transaction_type === 'INCOME';
        const typeIcon = isIncome ? 'arrow-down-left' : 'arrow-up-right';
        const typeColor = isIncome ? 'text-green-600' : 'text-red-600';

        row.innerHTML = `
            <td class="px-6 py-4">
                <div class="flex flex-col">
                    <span class="font-medium text-slate-900 dark:text-white">${dateStr} <span class="text-xs text-slate-400">${timeStr}</span></span>
                    <span class="text-xs font-mono text-slate-500 text-ellipsis overflow-hidden w-24">${txn.receipt_number || '-'}</span>
                </div>
            </td>
            <td class="px-6 py-4">
                <div class="flex items-center gap-2 ${typeColor}">
                    <i data-lucide="${typeIcon}" class="w-4 h-4"></i>
                    <span class="font-medium text-xs uppercase">${isIncome ? 'Recette' : 'Dépense'}</span>
                </div>
            </td>
            <td class="px-6 py-4">
                <div class="flex flex-col">
                    <span class="text-sm font-medium text-slate-800 dark:text-slate-200">
                        ${txn.student_name !== "N/A" ? txn.student_name : (txn.description || "Autre")}
                    </span>
                    <span class="text-xs text-slate-500">${txn.fee_type_name}</span>
                </div>
            </td>
            <td class="px-6 py-4 font-mono font-semibold text-slate-700 dark:text-slate-300">
                ${parseFloat(txn.amount).toLocaleString('fr-FR')} ${txn.currency}
            </td>
            <td class="px-6 py-4">
                ${getStatusBadge(txn.status)}
            </td>
            <td class="px-6 py-4 text-right">
                <button onclick='openDetailModal(${JSON.stringify(txn).replace(/'/g, "&apos;")})' 
                        class="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 text-slate-600 dark:text-slate-300 shadow-sm">
                    <i data-lucide="eye" class="w-4 h-4"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
    lucide.createIcons();
}


function getStatusBadge(status) {
    const styles = {
        'PENDING': 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
        'AUDITED': 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
        'APPROVED': 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
        'REJECTED': 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'
    };
    const labels = {
        'PENDING': 'En Attente',
        'AUDITED': 'Audité',
        'APPROVED': 'Validé',
        'REJECTED': 'Rejeté'
    };
    const style = styles[status] || 'bg-slate-100 text-slate-600';
    return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${style}">
                ${labels[status] || status}
            </span>`;
}


function openDetailModal(txn) {
    currentTransactionId = txn.id;

    // Remplissage des données
    document.getElementById('modalReceipt').innerText = txn.receipt_number || "Non généré";
    document.getElementById('modalDate').innerText = new Date(txn.created_at).toLocaleString();
    document.getElementById('modalType').innerText = txn.transaction_type === 'INCOME' ? "Recette" : "Dépense";
    document.getElementById('modalAmount').innerText = `${txn.amount} ${txn.currency}`;
    document.getElementById('modalStudent').innerText = txn.student_name;
    document.getElementById('modalFeeType').innerText = txn.fee_type_name;
    document.getElementById('modalAuthor').innerText = txn.created_by_name;
    
    
    const badgeContainer = document.getElementById('modalStatusContainer');
    
    badgeContainer.className = `flex items-center justify-between p-3 rounded-lg border bg-slate-50 dark:bg-slate-800/50 dark:border-slate-700`;
    document.getElementById('modalStatusBadge').innerHTML = getStatusBadge(txn.status);

    //  (Workflow)
    const actionsDiv = document.getElementById('modalActions');
    actionsDiv.innerHTML = `<button onclick="closeDetailModal()" class="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">Fermer</button>`;

    
    if (isAccountant() && txn.status === 'PENDING') {
        actionsDiv.innerHTML += `
            <button onclick="performAction('audit')" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg flex items-center gap-2">
                <i data-lucide="check-circle" class="w-4 h-4"></i> Auditer (Caisse OK)
            </button>
        `;
    }

    
    if (isDirector()) {
        if (txn.transaction_type === 'EXPENSE' && (txn.status === 'PENDING' || txn.status === 'AUDITED')) {
            actionsDiv.innerHTML += `
                <button onclick="performAction('validate_expense')" class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg flex items-center gap-2">
                    <i data-lucide="check-circle-2" class="w-4 h-4"></i> Valider Dépense
                </button>
            `;
        }
        
       
        if (txn.status !== 'REJECTED' && txn.status !== 'APPROVED') {
            actionsDiv.innerHTML += `
                <button onclick="performAction('reject')" class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg flex items-center gap-2 ml-2">
                    <i data-lucide="x-circle" class="w-4 h-4"></i> Rejeter
                </button>
            `;
        }
    }

    
    document.getElementById('detailModal').classList.remove('hidden');
    document.getElementById('detailModal').classList.add('flex');
    lucide.createIcons();
}

function closeDetailModal() {
    document.getElementById('detailModal').classList.add('hidden');
    document.getElementById('detailModal').classList.remove('flex');
    currentTransactionId = null;
}


async function performAction(actionName) {
    if (!currentTransactionId) return;
    if (!confirm("Confirmer cette action ?")) return;

    try {
        const url = `/api/finance/transactions/${currentTransactionId}/${actionName}/`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem("access_token")}`,
                'Content-Type': 'application/json',

            }
        });

        if (response.ok) {
            // Succès
            closeDetailModal();
            loadTransactions(); 
            showNotification("Action effectuée avec succès", "success");
        } else {
            const err = await response.json();
            alert("Erreur: " + (err.error || "Impossible d'effectuer l'action"));
        }
    } catch (e) {
        console.error(e);
        alert("Erreur réseau");
    }
}


function isAccountant() {
   
    return (userRole && userRole.toLowerCase().includes('accountant')) || userType === 'superadmin';
}

function isDirector() {
   
    return (userType === 'school_admin' || userType === 'superadmin');
}


function updatePagination(next, prev) {
    document.getElementById('nextPageBtn').disabled = !next;
    document.getElementById('prevPageBtn').disabled = !prev;
    document.getElementById('pageIndicator').innerText = `Page ${currentPage}`;
}

function changePage(delta) {
    currentPage += delta;
    if (currentPage < 1) currentPage = 1;
    loadTransactions();
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function showNotification(msg, type) {
    
    alert(msg); 
}