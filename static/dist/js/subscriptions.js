// subscriptions.js - Gestion des abonnements et modules
// Version: 1.0.0
// Auteur: SYBEM

const token = localStorage.getItem("access_token");
if (!token) {
    window.location.href = "/static/dist/html/login.html";
}

// Variables globales
let currentSubscriptionId = null;
let currentPlanId = null;
let currentModuleId = null;
let currentPaymentId = null;

/* ================== INITIALISATION ================== */
document.addEventListener("DOMContentLoaded", function() {
    // Initialiser les onglets
    initTabs();
    
    // Charger les données initiales
    loadStats();
    loadSubscriptions();
    loadPlans();
    loadModules();
    loadPayments();
    
    // Initialiser les formulaires
    initForms();
});

/* ================== GESTION DES ONGLETS ================== */
function initTabs() {
    const tabButtons = document.querySelectorAll(".tab-button");
    const tabContents = document.querySelectorAll(".tab-content");
    
    tabButtons.forEach(button => {
        button.addEventListener("click", function() {
            const tabId = this.getAttribute("data-tab");
            
            // Mettre à jour les boutons
            tabButtons.forEach(btn => btn.classList.remove("active"));
            this.classList.add("active");
            
            // Afficher le contenu correspondant
            tabContents.forEach(content => {
                content.classList.remove("active");
                if (content.id === tabId) {
                    content.classList.add("active");
                }
            });
        });
    });
}

/* ================== CHARGEMENT DES DONNÉES ================== */

// Charger les statistiques
async function loadStats() {
    try {
        const response = await fetch("/api/subscriptions/stats/", {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        
        if (response.ok) {
            const stats = await response.json();
            
            // Mettre à jour l'interface
            document.getElementById("active-count").textContent = stats.active_subscriptions;
            document.getElementById("revenue-total").textContent = `${stats.total_revenue} USD`;
            document.getElementById("expiring-count").textContent = stats.expired_subscriptions;
            document.getElementById("pending-count").textContent = stats.pending_subscriptions;
        }
    } catch (error) {
        console.error("Erreur chargement stats:", error);
    }
}

// Charger les abonnements
async function loadSubscriptions() {
    try {
        const response = await fetch("/api/subscriptions/subscriptions/", {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        
        if (response.ok) {
            const subscriptions = await response.json();
            displaySubscriptions(subscriptions);
            
            // Mettre à jour le filtre des plans
            updatePlanFilter(subscriptions);
        }
    } catch (error) {
        console.error("Erreur chargement abonnements:", error);
    }
}

// Charger les plans
async function loadPlans() {
    try {
        const response = await fetch("/api/subscriptions/plans/", {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        
        if (response.ok) {
            const plans = await response.json();
            displayPlans(plans);
            displayPlansTable(plans);
        }
    } catch (error) {
        console.error("Erreur chargement plans:", error);
    }
}

// Charger les modules
async function loadModules() {
    try {
        const response = await fetch("/api/modules/", {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        
        if (response.ok) {
            const modules = await response.json();
            displayModules(modules);
            displayModulesTable(modules);
        }
    } catch (error) {
        console.error("Erreur chargement modules:", error);
    }
}

// Charger les paiements
async function loadPayments() {
    try {
        const response = await fetch("/api/payments/", {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        
        if (response.ok) {
            const payments = await response.json();
            displayPayments(payments);
            
            // Calculer les statistiques
            calculatePaymentStats(payments);
        }
    } catch (error) {
        console.error("Erreur chargement paiements:", error);
    }
}

/* ================== AFFICHAGE DES DONNÉES ================== */

// Afficher les abonnements
function displaySubscriptions(subscriptions) {
    const container = document.getElementById("subscriptions-table");
    const loading = document.getElementById("loading-subscriptions");
    
    if (loading) loading.remove();
    
    if (!subscriptions || subscriptions.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="6" class="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    <i data-lucide="school" class="w-12 h-12 mx-auto mb-3 opacity-50"></i>
                    <p class="text-lg font-medium mb-2">Aucun abonnement trouvé</p>
                    <p class="text-sm mb-4">Commencez par créer votre premier abonnement</p>
                    <button onclick="openSubscriptionModal()" class="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg">
                        Créer un abonnement
                    </button>
                </td>
            </tr>
        `;
        lucide.createIcons();
        return;
    }
    
    container.innerHTML = subscriptions.map(sub => `
        <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50">
            <td class="px-4 py-3">
                <div class="font-medium">${escapeHtml(sub.school.name)}</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">${sub.reference}</div>
            </td>
            <td class="px-4 py-3 text-center">
                <span class="px-2 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs rounded">
                    ${escapeHtml(sub.plan.name)}
                </span>
            </td>
            <td class="px-4 py-3 text-center">
                <div class="text-sm">${formatDate(sub.start_date)} - ${formatDate(sub.end_date)}</div>
                <div class="text-xs text-gray-500">${sub.days_remaining} jours restants</div>
            </td>
            <td class="px-4 py-3 text-center">
                <span class="text-sm">${sub.activated_modules.length} modules</span>
            </td>
            <td class="px-4 py-3 text-center">
                ${getStatusBadge(sub.status)}
            </td>
            <td class="px-4 py-3 text-center">
                <div class="flex justify-center gap-2">
                    <button onclick="manageSubscriptionModules(${sub.id})" 
                            class="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                            title="Gérer les modules">
                        <i data-lucide="package" class="w-4 h-4"></i>
                    </button>
                    <button onclick="editSubscription(${sub.id})" 
                            class="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded"
                            title="Modifier">
                        <i data-lucide="edit" class="w-4 h-4"></i>
                    </button>
                    <button onclick="renewSubscription(${sub.id})" 
                            class="p-1.5 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 rounded"
                            title="Renouveler">
                        <i data-lucide="refresh-cw" class="w-4 h-4"></i>
                    </button>
                    <button onclick="deleteSubscription(${sub.id})" 
                            class="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                            title="Supprimer">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join("");
    
    lucide.createIcons();
}

// Afficher les plans dans les cartes
function displayPlans(plans) {
    const container = document.getElementById("plans-container");
    
    if (!plans || plans.length === 0) {
        container.innerHTML = `
            <div class="col-span-3 text-center py-8 text-gray-500 dark:text-gray-400">
                <i data-lucide="credit-card" class="w-12 h-12 mx-auto mb-3 opacity-50"></i>
                <p class="text-lg font-medium mb-2">Aucun plan d'abonnement</p>
                <p class="text-sm mb-4">Créez votre premier plan d'abonnement</p>
                <button onclick="openPlanModal()" class="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg">
                    Créer un plan
                </button>
            </div>
        `;
        lucide.createIcons();
        return;
    }
    
    container.innerHTML = plans.map(plan => `
        <div class="plan-card bg-white dark:bg-slate-800 rounded-xl p-6 ${plan.is_featured ? 'featured' : ''}">
            <div class="flex justify-between items-start mb-4">
                <div>
                    <h3 class="text-lg font-semibold">${escapeHtml(plan.name)}</h3>
                    <p class="text-sm text-gray-500 dark:text-gray-400">${escapeHtml(plan.code)}</p>
                </div>
                <span class="px-2 py-1 text-xs rounded ${plan.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                    ${plan.is_active ? 'Actif' : 'Inactif'}
                </span>
            </div>
            
            <div class="mb-4">
                <div class="text-3xl font-bold">${plan.price_per_unit} USD</div>
                <div class="text-sm text-gray-500">par ${plan.duration_display}</div>
            </div>
            
            <div class="space-y-2 mb-6">
                <div class="flex items-center gap-2 text-sm">
                    <i data-lucide="users" class="w-4 h-4 text-gray-400"></i>
                    <span>${plan.max_users} utilisateurs max</span>
                </div>
                <div class="flex items-center gap-2 text-sm">
                    <i data-lucide="graduation-cap" class="w-4 h-4 text-gray-400"></i>
                    <span>${plan.max_students} étudiants max</span>
                </div>
                <div class="flex items-center gap-2 text-sm">
                    <i data-lucide="hard-drive" class="w-4 h-4 text-gray-400"></i>
                    <span>${plan.max_storage_gb} GB stockage</span>
                </div>
                <div class="flex items-center gap-2 text-sm">
                    <i data-lucide="package" class="w-4 h-4 text-gray-400"></i>
                    <span>${plan.included_modules.length} modules</span>
                </div>
            </div>
            
            <div class="flex gap-2">
                <button onclick="editPlan(${plan.id})" 
                        class="flex-1 px-3 py-2 border rounded hover:bg-gray-50 dark:hover:bg-slate-700">
                    Modifier
                </button>
                <button onclick="deletePlan(${plan.id})" 
                        class="px-3 py-2 border rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </div>
        </div>
    `).join("");
    
    lucide.createIcons();
}

// Afficher les plans dans le tableau
function displayPlansTable(plans) {
    const container = document.getElementById("plans-table");
    
    container.innerHTML = plans.map(plan => `
        <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50">
            <td class="px-4 py-3">
                <div class="font-medium">${escapeHtml(plan.name)}</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">${escapeHtml(plan.code)}</div>
            </td>
            <td class="px-4 py-3 text-center">
                <div class="font-medium">${plan.price_per_unit} USD</div>
                <div class="text-xs text-gray-500">${plan.get_full_price} USD total</div>
            </td>
            <td class="px-4 py-3 text-center">
                ${escapeHtml(plan.duration_display)}
            </td>
            <td class="px-4 py-3 text-center">
                <span class="text-sm">${plan.included_modules.length} modules</span>
            </td>
            <td class="px-4 py-3 text-center">
                <div class="text-xs space-y-1">
                    <div>Users: ${plan.max_users}</div>
                    <div>Students: ${plan.max_students}</div>
                    <div>Storage: ${plan.max_storage_gb}GB</div>
                </div>
            </td>
            <td class="px-4 py-3 text-center">
                ${plan.is_active ? 
                    '<span class="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">Actif</span>' : 
                    '<span class="px-2 py-1 bg-red-100 text-red-700 text-xs rounded">Inactif</span>'}
            </td>
            <td class="px-4 py-3 text-center">
                <div class="flex justify-center gap-2">
                    <button onclick="editPlan(${plan.id})" class="p-1.5 text-blue-600 hover:bg-blue-50 rounded">
                        <i data-lucide="edit" class="w-4 h-4"></i>
                    </button>
                    <button onclick="togglePlanStatus(${plan.id}, ${plan.is_active})" 
                            class="p-1.5 ${plan.is_active ? 'text-yellow-600' : 'text-green-600'} hover:bg-gray-100 rounded">
                        <i data-lucide="${plan.is_active ? 'toggle-left' : 'toggle-right'}" class="w-4 h-4"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join("");
    
    lucide.createIcons();
}

// Afficher les modules
function displayModules(modules) {
    const container = document.getElementById("modules-container");
    
    if (!modules || modules.length === 0) {
        container.innerHTML = `
            <div class="col-span-4 text-center py-8 text-gray-500 dark:text-gray-400">
                <i data-lucide="package" class="w-12 h-12 mx-auto mb-3 opacity-50"></i>
                <p class="text-lg font-medium mb-2">Aucun module système</p>
                <p class="text-sm mb-4">Créez votre premier module</p>
                <button onclick="openModuleModal()" class="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg">
                    Créer un module
                </button>
            </div>
        `;
        lucide.createIcons();
        return;
    }
    
    container.innerHTML = modules.map(module => `
        <div class="module-card bg-white dark:bg-slate-800 rounded-xl p-4 ${module.is_active ? 'active' : ''}">
            <div class="flex items-start gap-3 mb-3">
                <div class="p-2 ${getModuleColor(module.module_type)} rounded-lg">
                    <i data-lucide="${module.icon || 'package'}" class="w-5 h-5"></i>
                </div>
                <div class="flex-1">
                    <h4 class="font-medium">${escapeHtml(module.name)}</h4>
                    <p class="text-xs text-gray-500 dark:text-gray-400">${escapeHtml(module.code)}</p>
                </div>
            </div>
            
            <p class="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">
                ${escapeHtml(module.description || 'Aucune description')}
            </p>
            
            <div class="flex justify-between items-center">
                <span class="px-2 py-1 text-xs rounded ${getModuleTypeBadge(module.module_type)}">
                    ${getModuleTypeLabel(module.module_type)}
                </span>
                <div class="flex gap-1">
                    <button onclick="editModule(${module.id})" 
                            class="p-1 text-blue-600 hover:bg-blue-50 rounded">
                        <i data-lucide="edit" class="w-4 h-4"></i>
                    </button>
                    <button onclick="deleteModule(${module.id})" 
                            class="p-1 text-red-600 hover:bg-red-50 rounded">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join("");
    
    lucide.createIcons();
}

// Afficher les modules dans le tableau
function displayModulesTable(modules) {
    const container = document.getElementById("modules-table");
    
    container.innerHTML = modules.map(module => `
        <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50">
            <td class="px-4 py-3">
                <div class="flex items-center gap-3">
                    <div class="p-2 ${getModuleColor(module.module_type)} rounded-lg">
                        <i data-lucide="${module.icon || 'package'}" class="w-4 h-4"></i>
                    </div>
                    <div>
                        <div class="font-medium">${escapeHtml(module.name)}</div>
                        <div class="text-xs text-gray-500 dark:text-gray-400">
                            ${escapeHtml(module.description || 'Aucune description')}
                        </div>
                    </div>
                </div>
            </td>
            <td class="px-4 py-3 text-center">
                <code class="text-sm bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded">
                    ${escapeHtml(module.code)}
                </code>
            </td>
            <td class="px-4 py-3 text-center">
                ${getModuleTypeBadge(module.module_type)}
            </td>
            <td class="px-4 py-3 text-center">
                <span class="text-sm">${module.included_in_plans?.length || 0} plans</span>
            </td>
            <td class="px-4 py-3 text-center">
                ${module.is_active ? 
                    '<span class="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">Actif</span>' : 
                    '<span class="px-2 py-1 bg-red-100 text-red-700 text-xs rounded">Inactif</span>'}
            </td>
            <td class="px-4 py-3 text-center">
                <div class="flex justify-center gap-2">
                    <button onclick="editModule(${module.id})" class="p-1.5 text-blue-600 hover:bg-blue-50 rounded">
                        <i data-lucide="edit" class="w-4 h-4"></i>
                    </button>
                    <button onclick="toggleModuleStatus(${module.id}, ${module.is_active})" 
                            class="p-1.5 ${module.is_active ? 'text-yellow-600' : 'text-green-600'} hover:bg-gray-100 rounded">
                        <i data-lucide="${module.is_active ? 'toggle-left' : 'toggle-right'}" class="w-4 h-4"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join("");
    
    lucide.createIcons();
}

// Afficher les paiements
function displayPayments(payments) {
    const container = document.getElementById("payments-table");
    
    container.innerHTML = payments.map(payment => `
        <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50">
            <td class="px-4 py-3">
                <div class="font-medium">${escapeHtml(payment.transaction_id)}</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">
                    ${payment.school_subscription.school.name}
                </div>
            </td>
            <td class="px-4 py-3 text-center">
                ${escapeHtml(payment.school_subscription.school.name)}
            </td>
            <td class="px-4 py-3 text-center">
                <div class="font-medium">${payment.amount} ${payment.currency}</div>
            </td>
            <td class="px-4 py-3 text-center">
                <span class="px-2 py-1 bg-gray-100 dark:bg-slate-700 text-xs rounded">
                    ${getPaymentMethodLabel(payment.payment_method)}
                </span>
            </td>
            <td class="px-4 py-3 text-center">
                ${payment.payment_date ? formatDateTime(payment.payment_date) : '—'}
            </td>
            <td class="px-4 py-3 text-center">
                ${getPaymentStatusBadge(payment.status)}
            </td>
            <td class="px-4 py-3 text-center">
                <div class="flex justify-center gap-2">
                    ${payment.status === 'PENDING' ? `
                        <button onclick="openPaymentConfirmModal(${payment.id})" 
                                class="p-1.5 text-green-600 hover:bg-green-50 rounded"
                                title="Confirmer le paiement">
                            <i data-lucide="check-circle" class="w-4 h-4"></i>
                        </button>
                    ` : ''}
                    <button onclick="viewPaymentDetails(${payment.id})" 
                            class="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                            title="Voir détails">
                        <i data-lucide="eye" class="w-4 h-4"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join("");
    
    lucide.createIcons();
}

/* ================== GESTION DES FORMULAIRES ================== */
function initForms() {
    // Formulaire d'abonnement
    const subscriptionForm = document.getElementById("subscription-form");
    if (subscriptionForm) {
        subscriptionForm.addEventListener("submit", function(e) {
            e.preventDefault();
            saveSubscription();
        });
    }
    
    // Formulaire de plan
    const planForm = document.getElementById("plan-form");
    if (planForm) {
        planForm.addEventListener("submit", function(e) {
            e.preventDefault();
            savePlan();
        });
    }
    
    // Formulaire de module
    const moduleForm = document.getElementById("module-form");
    if (moduleForm) {
        moduleForm.addEventListener("submit", function(e) {
            e.preventDefault();
            saveModule();
        });
    }
    
    // Initialiser les filtres
    initFilters();
}

function initFilters() {
    // Filtres abonnements
    const statusFilter = document.getElementById("filter-subscription-status");
    const planFilter = document.getElementById("filter-subscription-plan");
    const searchFilter = document.getElementById("search-subscription");
    
    if (statusFilter) {
        statusFilter.addEventListener("change", filterSubscriptions);
    }
    if (planFilter) {
        planFilter.addEventListener("change", filterSubscriptions);
    }
    if (searchFilter) {
        searchFilter.addEventListener("input", filterSubscriptions);
    }
}

/* ================== FONCTIONS DE MODAL ================== */

// Abonnements
function openSubscriptionModal(subscriptionId = null) {
    currentSubscriptionId = subscriptionId;
    const modal = document.getElementById("subscriptionModal");
    const title = document.getElementById("subscription-modal-title");
    const submitBtn = document.getElementById("subscription-submit-btn");
    
    if (subscriptionId) {
        title.textContent = "Modifier l'abonnement";
        submitBtn.textContent = "Mettre à jour";
        loadSubscriptionData(subscriptionId);
    } else {
        title.textContent = "Nouvel abonnement";
        submitBtn.textContent = "Créer l'abonnement";
        resetSubscriptionForm();
    }
    
    // Charger les écoles et plans
    loadSchoolsForSelect();
    loadPlansForSelect();
    loadModulesForSubscription();
    
    modal.classList.remove("hidden");
    modal.classList.add("flex");
}

function closeSubscriptionModal() {
    const modal = document.getElementById("subscriptionModal");
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    currentSubscriptionId = null;
}

// Gestion des modules d'un abonnement
function manageSubscriptionModules(subscriptionId) {
    currentSubscriptionId = subscriptionId;
    const modal = document.getElementById("moduleAccessModal");
    const title = document.getElementById("module-access-title");
    
    title.textContent = "Gérer les modules";
    
    // Charger les données
    loadSubscriptionModules(subscriptionId);
    
    modal.classList.remove("hidden");
    modal.classList.add("flex");
}

function closeModuleAccessModal() {
    const modal = document.getElementById("moduleAccessModal");
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    currentSubscriptionId = null;
}

// Plans
function openPlanModal(planId = null) {
    currentPlanId = planId;
    const modal = document.getElementById("planModal");
    const title = document.getElementById("plan-modal-title");
    const submitBtn = document.getElementById("plan-submit-btn");
    
    if (planId) {
        title.textContent = "Modifier le plan";
        submitBtn.textContent = "Mettre à jour";
        loadPlanData(planId);
    } else {
        title.textContent = "Nouveau plan d'abonnement";
        submitBtn.textContent = "Créer le plan";
        resetPlanForm();
    }
    
    // Charger les modules pour le plan
    loadModulesForPlan();
    
    modal.classList.remove("hidden");
    modal.classList.add("flex");
}

function closePlanModal() {
    const modal = document.getElementById("planModal");
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    currentPlanId = null;
}

// Modules
function openModuleModal(moduleId = null) {
    currentModuleId = moduleId;
    const modal = document.getElementById("moduleModal");
    const title = document.getElementById("module-modal-title");
    const submitBtn = document.getElementById("module-submit-btn");
    
    if (moduleId) {
        title.textContent = "Modifier le module";
        submitBtn.textContent = "Mettre à jour";
        loadModuleData(moduleId);
    } else {
        title.textContent = "Nouveau module";
        submitBtn.textContent = "Créer le module";
        resetModuleForm();
    }
    
    modal.classList.remove("hidden");
    modal.classList.add("flex");
}

function closeModuleModal() {
    const modal = document.getElementById("moduleModal");
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    currentModuleId = null;
}

// Confirmation de paiement
function openPaymentConfirmModal(paymentId) {
    currentPaymentId = paymentId;
    const modal = document.getElementById("paymentConfirmModal");
    modal.classList.remove("hidden");
    modal.classList.add("flex");
}

function closePaymentConfirmModal() {
    const modal = document.getElementById("paymentConfirmModal");
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    currentPaymentId = null;
}

/* ================== FONCTIONS CRUD ================== */

// Sauvegarder un abonnement
async function saveSubscription() {
    try {
        const formData = {
            school: document.getElementById("subscription-school").value,
            plan: document.getElementById("subscription-plan").value,
            start_date: document.getElementById("subscription-start-date").value,
            end_date: document.getElementById("subscription-end-date").value,
            status: document.getElementById("subscription-status").value,
        };
        
        const url = currentSubscriptionId 
            ? `/api/subscriptions/${currentSubscriptionId}/`
            : '/api/subscriptions/';
        
        const method = currentSubscriptionId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(formData),
        });
        
        if (response.ok) {
            showSuccess(currentSubscriptionId ? 'Abonnement mis à jour' : 'Abonnement créé');
            closeSubscriptionModal();
            loadSubscriptions();
            loadStats();
        } else {
            const error = await response.json();
            showError(`Erreur: ${error.detail || JSON.stringify(error)}`);
        }
    } catch (error) {
        console.error("Erreur sauvegarde abonnement:", error);
        showError("Erreur de connexion au serveur");
    }
}

// Sauvegarder un plan
async function savePlan() {
    try {
        const formData = {
            name: document.getElementById("plan-name").value,
            code: document.getElementById("plan-code").value,
            description: document.getElementById("plan-description").value,
            price_per_unit: parseFloat(document.getElementById("plan-price").value),
            duration_unit: document.getElementById("plan-duration-unit").value,
            duration_value: parseInt(document.getElementById("plan-duration-value").value),
            max_users: parseInt(document.getElementById("plan-max-users").value) || 50,
            max_students: parseInt(document.getElementById("plan-max-students").value) || 200,
            max_storage_gb: parseInt(document.getElementById("plan-max-storage").value) || 10,
            is_active: document.getElementById("plan-is-active").checked,
            is_public: document.getElementById("plan-is-public").checked,
        };
        
        // Récupérer les modules sélectionnés
        const selectedModules = Array.from(
            document.querySelectorAll('#plan-modules input[type="checkbox"]:checked')
        ).map(cb => parseInt(cb.value));
        
        formData.module_ids = selectedModules;
        
        const url = currentPlanId 
            ? `/api/subscriptions/plans/${currentPlanId}/`
            : '/api/subscriptions/plans/';
        
        const method = currentPlanId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(formData),
        });
        
        if (response.ok) {
            showSuccess(currentPlanId ? 'Plan mis à jour' : 'Plan créé');
            closePlanModal();
            loadPlans();
        } else {
            const error = await response.json();
            showError(`Erreur: ${error.detail || JSON.stringify(error)}`);
        }
    } catch (error) {
        console.error("Erreur sauvegarde plan:", error);
        showError("Erreur de connexion au serveur");
    }
}

// Sauvegarder un module
async function saveModule() {
    try {
        const formData = {
            name: document.getElementById("module-name").value,
            code: document.getElementById("module-code").value,
            description: document.getElementById("module-description").value,
            module_type: document.getElementById("module-type").value,
            icon: document.getElementById("module-icon").value || 'package',
            is_active: document.getElementById("module-is-active").checked,
            order: parseInt(document.getElementById("module-order").value) || 0,
        };
        
        const url = currentModuleId 
            ? `/api/modules/${currentModuleId}/`
            : '/api/modules/';
        
        const method = currentModuleId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(formData),
        });
        
        if (response.ok) {
            showSuccess(currentModuleId ? 'Module mis à jour' : 'Module créé');
            closeModuleModal();
            loadModules();
        } else {
            const error = await response.json();
            showError(`Erreur: ${error.detail || JSON.stringify(error)}`);
        }
    } catch (error) {
        console.error("Erreur sauvegarde module:", error);
        showError("Erreur de connexion au serveur");
    }
}

// Confirmer un paiement
async function confirmPayment() {
    try {
        const response = await fetch(`/api/payments/${currentPaymentId}/confirm/`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        
        if (response.ok) {
            showSuccess('Paiement confirmé avec succès');
            closePaymentConfirmModal();
            loadPayments();
            loadStats();
        } else {
            const error = await response.json();
            showError(`Erreur: ${error.detail || JSON.stringify(error)}`);
        }
    } catch (error) {
        console.error("Erreur confirmation paiement:", error);
        showError("Erreur de connexion au serveur");
    }
}

/* ================== FONCTIONS UTILITAIRES ================== */

function getStatusBadge(status) {
    const badges = {
        'ACTIVE': '<span class="badge badge-active"><i data-lucide="check-circle" class="w-3 h-3"></i> Actif</span>',
        'PENDING': '<span class="badge badge-pending"><i data-lucide="clock" class="w-3 h-3"></i> En attente</span>',
        'EXPIRED': '<span class="badge badge-expired"><i data-lucide="alert-circle" class="w-3 h-3"></i> Expiré</span>',
        'SUSPENDED': '<span class="badge badge-suspended"><i data-lucide="pause-circle" class="w-3 h-3"></i> Suspendu</span>',
    };
    return badges[status] || `<span class="badge">${status}</span>`;
}

function getPaymentStatusBadge(status) {
    const badges = {
        'COMPLETED': '<span class="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">Complété</span>',
        'PENDING': '<span class="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded">En attente</span>',
        'FAILED': '<span class="px-2 py-1 bg-red-100 text-red-700 text-xs rounded">Échoué</span>',
        'REFUNDED': '<span class="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">Remboursé</span>',
    };
    return badges[status] || `<span class="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">${status}</span>`;
}

function getPaymentMethodLabel(method) {
    const methods = {
        'MTN_MONEY': 'MTN Money',
        'AIRTM': 'Airtel Money',
        'ORANGE': 'Orange Money',
        'VISA': 'Carte Visa/Mastercard',
        'BANK': 'Virement Bancaire',
        'CASH': 'Espèces',
    };
    return methods[method] || method;
}

function getModuleTypeLabel(type) {
    const types = {
        'ACADEMIC': 'Académique',
        'FINANCE': 'Finance/Comptabilité',
        'HR': 'Ressources Humaines',
        'COMMUNICATION': 'Communication',
        'ADMIN': 'Administration',
    };
    return types[type] || type;
}

function getModuleTypeBadge(type) {
    const colors = {
        'ACADEMIC': 'bg-blue-100 text-blue-700',
        'FINANCE': 'bg-green-100 text-green-700',
        'HR': 'bg-purple-100 text-purple-700',
        'COMMUNICATION': 'bg-yellow-100 text-yellow-700',
        'ADMIN': 'bg-gray-100 text-gray-700',
    };
    return `<span class="px-2 py-1 text-xs rounded ${colors[type] || 'bg-gray-100'}">${getModuleTypeLabel(type)}</span>`;
}

function getModuleColor(type) {
    const colors = {
        'ACADEMIC': 'bg-blue-100 text-blue-600',
        'FINANCE': 'bg-green-100 text-green-600',
        'HR': 'bg-purple-100 text-purple-600',
        'COMMUNICATION': 'bg-yellow-100 text-yellow-600',
        'ADMIN': 'bg-gray-100 text-gray-600',
    };
    return colors[type] || 'bg-gray-100 text-gray-600';
}

function formatDate(dateString) {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR');
}

function formatDateTime(dateTimeString) {
    if (!dateTimeString) return '—';
    const date = new Date(dateTimeString);
    return date.toLocaleString('fr-FR');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showSuccess(message) {
    // À remplacer par un système de toast plus élégant
    alert('✅ ' + message);
}

function showError(message) {
    alert('❌ ' + message);
}

/* ================== FONCTIONS DE FILTRAGE ================== */

function filterSubscriptions() {
    // Implémenter le filtrage côté client ou faire un appel API filtré
    loadSubscriptions(); // Pour l'instant, recharger tout
}

function resetSubscriptionFilters() {
    document.getElementById("filter-subscription-status").value = "";
    document.getElementById("filter-subscription-plan").value = "";
    document.getElementById("search-subscription").value = "";
    filterSubscriptions();
}

/* ================== FONCTIONS D'ACTION ================== */

// Abonnements
async function renewSubscription(id) {
    if (!confirm("Êtes-vous sûr de vouloir renouveler cet abonnement ?")) {
        return;
    }
    
    try {
        const response = await fetch(`/api/subscriptions/subscriptions/${id}/renew/`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        
        if (response.ok) {
            showSuccess('Abonnement renouvelé avec succès');
            loadSubscriptions();
        } else {
            const error = await response.json();
            showError(`Erreur: ${error.detail || JSON.stringify(error)}`);
        }
    } catch (error) {
        console.error("Erreur renouvellement:", error);
        showError("Erreur de connexion au serveur");
    }
}

async function deleteSubscription(id) {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cet abonnement ? Cette action est irréversible.")) {
        return;
    }
    
    try {
        const response = await fetch(`/api/subscriptions/${id}/`, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        
        if (response.ok) {
            showSuccess('Abonnement supprimé avec succès');
            loadSubscriptions();
            loadStats();
        } else {
            const error = await response.json();
            showError(`Erreur: ${error.detail || JSON.stringify(error)}`);
        }
    } catch (error) {
        console.error("Erreur suppression abonnement:", error);
        showError("Erreur de connexion au serveur");
    }
}

// Plans
async function togglePlanStatus(id, currentStatus) {
    try {
        const response = await fetch(`/api/subscriptions/plans/${id}/`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                is_active: !currentStatus
            }),
        });
        
        if (response.ok) {
            showSuccess(`Plan ${!currentStatus ? 'activé' : 'désactivé'} avec succès`);
            loadPlans();
        } else {
            const error = await response.json();
            showError(`Erreur: ${error.detail || JSON.stringify(error)}`);
        }
    } catch (error) {
        console.error("Erreur changement statut plan:", error);
        showError("Erreur de connexion au serveur");
    }
}

async function deletePlan(id) {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce plan ? Cette action est irréversible.")) {
        return;
    }
    
    try {
        const response = await fetch(`/api/subscriptions/plans/${id}/`, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        
        if (response.ok) {
            showSuccess('Plan supprimé avec succès');
            loadPlans();
        } else {
            const error = await response.json();
            showError(`Erreur: ${error.detail || JSON.stringify(error)}`);
        }
    } catch (error) {
        console.error("Erreur suppression plan:", error);
        showError("Erreur de connexion au serveur");
    }
}

// Modules
async function toggleModuleStatus(id, currentStatus) {
    try {
        const response = await fetch(`/api/modules/${id}/`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                is_active: !currentStatus
            }),
        });
        
        if (response.ok) {
            showSuccess(`Module ${!currentStatus ? 'activé' : 'désactivé'} avec succès`);
            loadModules();
        } else {
            const error = await response.json();
            showError(`Erreur: ${error.detail || JSON.stringify(error)}`);
        }
    } catch (error) {
        console.error("Erreur changement statut module:", error);
        showError("Erreur de connexion au serveur");
    }
}

async function deleteModule(id) {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce module ? Cette action est irréversible.")) {
        return;
    }
    
    try {
        const response = await fetch(`/api/modules/${id}/`, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        
        if (response.ok) {
            showSuccess('Module supprimé avec succès');
            loadModules();
        } else {
            const error = await response.json();
            showError(`Erreur: ${error.detail || JSON.stringify(error)}`);
        }
    } catch (error) {
        console.error("Erreur suppression module:", error);
        showError("Erreur de connexion au serveur");
    }
}

/* ================== FONCTIONS D'ASSISTANCE ================== */

async function loadSchoolsForSelect() {
    try {
        const response = await fetch("/api/schools/", {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        
        if (response.ok) {
            const schools = await response.json();
            const select = document.getElementById("subscription-school");
            select.innerHTML = '<option value="">Sélectionner une école</option>';
            
            schools.forEach(school => {
                const option = document.createElement("option");
                option.value = school.id;
                option.textContent = `${school.name} (${school.code})`;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error("Erreur chargement écoles:", error);
    }
}

async function loadPlansForSelect() {
    try {
        const response = await fetch("/api/subscriptions/plans/", {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        
        if (response.ok) {
            const plans = await response.json();
            const select = document.getElementById("subscription-plan");
            select.innerHTML = '<option value="">Sélectionner un plan</option>';
            
            plans.forEach(plan => {
                const option = document.createElement("option");
                option.value = plan.id;
                option.textContent = `${plan.name} - ${plan.price_per_unit} USD/${plan.duration_unit}`;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error("Erreur chargement plans:", error);
    }
}

async function loadModulesForSubscription() {
    try {
        const response = await fetch("/api/modules/", {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        
        if (response.ok) {
            const modules = await response.json();
            const container = document.getElementById("subscription-modules");
            container.innerHTML = '';
            
            modules.forEach(module => {
                container.innerHTML += `
                    <label class="flex items-center gap-2 p-2 border rounded hover:bg-gray-50 dark:hover:bg-slate-700">
                        <input type="checkbox" name="modules" value="${module.id}" class="rounded">
                        <div>
                            <div class="font-medium text-sm">${module.name}</div>
                            <div class="text-xs text-gray-500">${module.code}</div>
                        </div>
                    </label>
                `;
            });
        }
    } catch (error) {
        console.error("Erreur chargement modules:", error);
    }
}

async function loadModulesForPlan() {
    try {
        const response = await fetch("/api/modules/", {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        
        if (response.ok) {
            const modules = await response.json();
            const container = document.getElementById("plan-modules");
            container.innerHTML = '';
            
            modules.forEach(module => {
                container.innerHTML += `
                    <label class="flex items-center gap-2 p-2 border rounded hover:bg-gray-50 dark:hover:bg-slate-700">
                        <input type="checkbox" name="plan-modules" value="${module.id}" class="rounded">
                        <div>
                            <div class="font-medium text-sm">${module.name}</div>
                            <div class="text-xs text-gray-500">${module.code}</div>
                        </div>
                    </label>
                `;
            });
        }
    } catch (error) {
        console.error("Erreur chargement modules:", error);
    }
}

async function loadSubscriptionData(id) {
    try {
        const response = await fetch(`/api/subscriptions/subscriptions/${id}/`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        
        if (response.ok) {
            const subscription = await response.json();
            
            document.getElementById("subscription-id").value = subscription.id;
            document.getElementById("subscription-school").value = subscription.school.id;
            document.getElementById("subscription-plan").value = subscription.plan.id;
            document.getElementById("subscription-start-date").value = subscription.start_date;
            document.getElementById("subscription-end-date").value = subscription.end_date;
            document.getElementById("subscription-status").value = subscription.status;
            
            // Pré-sélectionner les modules
            const moduleCheckboxes = document.querySelectorAll('#subscription-modules input[type="checkbox"]');
            moduleCheckboxes.forEach(cb => {
                cb.checked = subscription.activated_modules.some(m => m.id === parseInt(cb.value));
            });
        }
    } catch (error) {
        console.error("Erreur chargement abonnement:", error);
        showError("Erreur lors du chargement des données");
    }
}

async function loadPlanData(id) {
    try {
        const response = await fetch(`/api/subscriptions/plans/${id}/`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        
        if (response.ok) {
            const plan = await response.json();
            
            document.getElementById("plan-id").value = plan.id;
            document.getElementById("plan-name").value = plan.name;
            document.getElementById("plan-code").value = plan.code;
            document.getElementById("plan-description").value = plan.description || '';
            document.getElementById("plan-price").value = plan.price_per_unit;
            document.getElementById("plan-duration-unit").value = plan.duration_unit;
            document.getElementById("plan-duration-value").value = plan.duration_value;
            document.getElementById("plan-max-users").value = plan.max_users;
            document.getElementById("plan-max-students").value = plan.max_students;
            document.getElementById("plan-max-storage").value = plan.max_storage_gb;
            document.getElementById("plan-is-active").checked = plan.is_active;
            document.getElementById("plan-is-public").checked = plan.is_public;
            
            // Pré-sélectionner les modules
            setTimeout(() => {
                const moduleCheckboxes = document.querySelectorAll('#plan-modules input[type="checkbox"]');
                moduleCheckboxes.forEach(cb => {
                    cb.checked = plan.included_modules.some(m => m.id === parseInt(cb.value));
                });
            }, 100);
        }
    } catch (error) {
        console.error("Erreur chargement plan:", error);
        showError("Erreur lors du chargement des données");
    }
}

async function loadModuleData(id) {
    try {
        const response = await fetch(`/api/modules/${id}/`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        
        if (response.ok) {
            const module = await response.json();
            
            document.getElementById("module-id").value = module.id;
            document.getElementById("module-name").value = module.name;
            document.getElementById("module-code").value = module.code;
            document.getElementById("module-description").value = module.description || '';
            document.getElementById("module-type").value = module.module_type;
            document.getElementById("module-icon").value = module.icon || '';
            document.getElementById("module-is-active").checked = module.is_active;
            document.getElementById("module-order").value = module.order;
        }
    } catch (error) {
        console.error("Erreur chargement module:", error);
        showError("Erreur lors du chargement des données");
    }
}

async function loadSubscriptionModules(id) {
    try {
        const response = await fetch(`/api/subscriptions/subscriptions/${id}/`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        
        if (response.ok) {
            const subscription = await response.json();
            const container = document.getElementById("module-access-content");
            
            container.innerHTML = `
                <div class="mb-4">
                    <h3 class="font-semibold">${subscription.school.name}</h3>
                    <p class="text-sm text-gray-500">Plan: ${subscription.plan.name}</p>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    ${subscription.activated_modules.map(module => `
                        <div class="module-card p-3 ${module.is_active ? 'active' : ''}">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-3">
                                    <div class="${getModuleColor(module.module_type)} p-2 rounded-lg">
                                        <i data-lucide="${module.icon || 'package'}" class="w-4 h-4"></i>
                                    </div>
                                    <div>
                                        <div class="font-medium">${module.name}</div>
                                        <div class="text-xs text-gray-500">${module.code}</div>
                                    </div>
                                </div>
                                <button onclick="toggleModuleAccess(${id}, ${module.id}, true)" 
                                        class="p-1 text-red-600 hover:bg-red-50 rounded">
                                    <i data-lucide="x" class="w-4 h-4"></i>
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
            
            lucide.createIcons();
        }
    } catch (error) {
        console.error("Erreur chargement modules abonnement:", error);
        showError("Erreur lors du chargement des modules");
    }
}

async function toggleModuleAccess(subscriptionId, moduleId, isActive) {
    try {
        const endpoint = isActive ? 'deactivate_module' : 'activate_module';
        const response = await fetch(`/api/subscriptions/${subscriptionId}/${endpoint}/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ module_id: moduleId }),
        });
        
        if (response.ok) {
            showSuccess(`Module ${isActive ? 'désactivé' : 'activé'} avec succès`);
            loadSubscriptionModules(subscriptionId);
        } else {
            const error = await response.json();
            showError(`Erreur: ${error.detail || JSON.stringify(error)}`);
        }
    } catch (error) {
        console.error("Erreur changement accès module:", error);
        showError("Erreur de connexion au serveur");
    }
}

function resetSubscriptionForm() {
    document.getElementById("subscription-form").reset();
    document.getElementById("subscription-id").value = "";
}

function resetPlanForm() {
    document.getElementById("plan-form").reset();
    document.getElementById("plan-id").value = "";
    document.getElementById("plan-is-active").checked = true;
    document.getElementById("plan-is-public").checked = true;
}

function resetModuleForm() {
    document.getElementById("module-form").reset();
    document.getElementById("module-id").value = "";
    document.getElementById("module-is-active").checked = true;
    document.getElementById("module-order").value = 0;
}

function calculatePaymentStats(payments) {
    const monthlyPayments = payments.filter(p => {
        if (!p.payment_date) return false;
        const paymentDate = new Date(p.payment_date);
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        return paymentDate >= oneMonthAgo && p.status === 'COMPLETED';
    });
    
    const monthlyTotal = monthlyPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const completed = payments.filter(p => p.status === 'COMPLETED').length;
    const pending = payments.filter(p => p.status === 'PENDING').length;
    
    document.getElementById("monthly-payments").textContent = `${monthlyTotal.toFixed(2)} USD`;
    document.getElementById("completed-payments").textContent = completed;
    document.getElementById("pending-payments").textContent = pending;
}

function updatePlanFilter(subscriptions) {
    const planFilter = document.getElementById("filter-subscription-plan");
    if (!planFilter) return;
    
    // Extraire les plans uniques
    const uniquePlans = [...new Set(subscriptions.map(s => s.plan.name))];
    
    // Ajouter les options
    uniquePlans.forEach(planName => {
        const option = document.createElement("option");
        option.value = planName;
        option.textContent = planName;
        planFilter.appendChild(option);
    });
}

/* ================== EXPORT DES FONCTIONS ================== */
// Exposer les fonctions nécessaires au HTML
window.openSubscriptionModal = openSubscriptionModal;
window.closeSubscriptionModal = closeSubscriptionModal;
window.openPlanModal = openPlanModal;
window.closePlanModal = closePlanModal;
window.openModuleModal = openModuleModal;
window.closeModuleModal = closeModuleModal;
window.openPaymentConfirmModal = openPaymentConfirmModal;
window.closePaymentConfirmModal = closePaymentConfirmModal;
window.confirmPayment = confirmPayment;
window.manageSubscriptionModules = manageSubscriptionModules;
window.closeModuleAccessModal = closeModuleAccessModal;
window.editSubscription = (id) => openSubscriptionModal(id);
window.editPlan = (id) => openPlanModal(id);
window.editModule = (id) => openModuleModal(id);
window.renewSubscription = renewSubscription;
window.deleteSubscription = deleteSubscription;
window.deletePlan = deletePlan;
window.deleteModule = deleteModule;
window.togglePlanStatus = togglePlanStatus;
window.toggleModuleStatus = toggleModuleStatus;
window.resetSubscriptionFilters = resetSubscriptionFilters;
window.viewPaymentDetails = (id) => {
    // À implémenter: afficher les détails d'un paiement
    showInfo(`Détails du paiement ${id} (à implémenter)`);
};
window.toggleModuleAccess = toggleModuleAccess;

function showInfo(message) {
    alert('ℹ️ ' + message);
}