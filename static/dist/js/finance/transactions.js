/**
 * Logique de gestion des Transactions (Journal)
 */

let currentPage = 1;
let currentFilters = {
    search: "",
    status: "",
    transaction_type: ""
};
let currentTransactionId = null; // Pour le modal

// Rôles stockés (Simulé pour l'exemple, à récupérer de votre système d'auth)
const userRole = localStorage.getItem("user_specific_role") || "STAFF"; // EX: ACCOUNTANT, DIRECTOR
const userType = localStorage.getItem("user_type"); // superadmin, etc.

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    loadTransactions();

    // Event Listeners sur les filtres
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

/**
 * Charge les transactions depuis l'API
 */
async function loadTransactions() {
    const tbody = document.getElementById('transactionsTableBody');
    tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center"><div class="animate-spin inline-block w-6 h-6 border-2 border-primary-500 rounded-full border-t-transparent"></div></td></tr>`;

    try {
        // Construction de l'URL avec Query Params (compatible DjangoFilterBackend)
        const params = new URLSearchParams({
            page: currentPage,
            search: currentFilters.search,
            status: currentFilters.status,
            transaction_type: currentFilters.transaction_type
        });

        // NOTE: Ajustez l'URL de l'API selon votre routing Django
        const response = await fetch(`/api/finance/transactions/?${params.toString()}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem("access_token")}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error("Erreur chargement");
        
        const data = await response.json();
        
        // Gestion de la pagination Django REST Framework (results / count)
        const results = data.results || [];
        renderTable(results);
        updatePagination(data.next, data.previous);

    } catch (error) {
        console.error(error);
        tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-red-500">Erreur lors du chargement des données.</td></tr>`;
    }
}

/**
 * Affiche le tableau HTML
 */
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
        
        // Formatage Date
        const dateObj = new Date(txn.created_at);
        const dateStr = dateObj.toLocaleDateString('fr-FR');
        const timeStr = dateObj.toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'});

        // Formatage Type & Icône
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

/**
 * Génère le badge HTML selon le statut
 */
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

/**
 * Ouverture du modal avec logique conditionnelle des boutons
 */
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
    
    // Badge status dans le modal
    const badgeContainer = document.getElementById('modalStatusContainer');
    // On met à jour la couleur du bord selon le status (simple)
    badgeContainer.className = `flex items-center justify-between p-3 rounded-lg border bg-slate-50 dark:bg-slate-800/50 dark:border-slate-700`;
    document.getElementById('modalStatusBadge').innerHTML = getStatusBadge(txn.status);

    // GESTION DES BOUTONS D'ACTION (Workflow)
    const actionsDiv = document.getElementById('modalActions');
    actionsDiv.innerHTML = `<button onclick="closeDetailModal()" class="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">Fermer</button>`;

    // --- Logique ACCOUNTANT (Comptable) ---
    // Peut auditer une transaction PENDING
    if (isAccountant() && txn.status === 'PENDING') {
        actionsDiv.innerHTML += `
            <button onclick="performAction('audit')" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg flex items-center gap-2">
                <i data-lucide="check-circle" class="w-4 h-4"></i> Auditer (Caisse OK)
            </button>
        `;
    }

    // --- Logique DIRECTOR (Direction) ---
    // Peut valider une Dépense (si PENDING ou AUDITED selon votre flow, ici le code dit PENDING ou AUDITED -> APPROVED)
    // Le code Python perform_create met PENDING si > threshold.
    // La méthode validate_expense ne check pas le statut previous, mais c'est logique si c'est PENDING ou AUDITED.
    if (isDirector()) {
        if (txn.transaction_type === 'EXPENSE' && (txn.status === 'PENDING' || txn.status === 'AUDITED')) {
            actionsDiv.innerHTML += `
                <button onclick="performAction('validate_expense')" class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg flex items-center gap-2">
                    <i data-lucide="check-circle-2" class="w-4 h-4"></i> Valider Dépense
                </button>
            `;
        }
        
        // Peut rejeter tout ce qui n'est pas déjà rejeté ou validé
        if (txn.status !== 'REJECTED' && txn.status !== 'APPROVED') {
            actionsDiv.innerHTML += `
                <button onclick="performAction('reject')" class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg flex items-center gap-2 ml-2">
                    <i data-lucide="x-circle" class="w-4 h-4"></i> Rejeter
                </button>
            `;
        }
    }

    // Afficher le modal
    document.getElementById('detailModal').classList.remove('hidden');
    document.getElementById('detailModal').classList.add('flex');
    lucide.createIcons();
}

function closeDetailModal() {
    document.getElementById('detailModal').classList.add('hidden');
    document.getElementById('detailModal').classList.remove('flex');
    currentTransactionId = null;
}

/**
 * Exécute l'action via l'API (Audit, Validate, Reject)
 */
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
                // Ajouter X-CSRFToken si nécessaire pour Django
            }
        });

        if (response.ok) {
            // Succès
            closeDetailModal();
            loadTransactions(); // Rafraichir le tableau
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

// Utilitaires de Rôle (A adapter selon comment vous stockez les rôles exactement)
function isAccountant() {
    // Vérifie si le rôle contient 'accountant' ou si c'est superadmin
    return (userRole && userRole.toLowerCase().includes('accountant')) || userType === 'superadmin';
}

function isDirector() {
    // Vérifie si le rôle est 'school_admin' (Directeur) ou superadmin
    // Attention : Dans votre sidebarLinksByRole, "school_admin" est le directeur
    return (userType === 'school_admin' || userType === 'superadmin');
}

// Utilitaires UI
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
    // Implémentation simple, peut être remplacée par un toast lib
    alert(msg); 
}