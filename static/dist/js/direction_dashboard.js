// Variables globales
let dashboardData = null;

// Initialiser les icônes
lucide.createIcons();

// Formater la date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Obtenir l'icône d'un module
function getModuleIcon(moduleCode) {
    const icons = {
        'academic': 'book-open',
        'finance': 'dollar-sign',
        'hr': 'users',
        'reports': 'bar-chart',
        'users': 'user-check'
    };
    return icons[moduleCode] || 'package';
}

// Obtenir la couleur d'un module
function getModuleColor(moduleCode) {
    const colors = {
        'academic': 'primary',
        'finance': 'success',
        'hr': 'secondary',
        'reports': 'warning',
        'users': 'danger'
    };
    return colors[moduleCode] || 'gray';
}

// Charger les données du dashboard
async function loadDashboardData() {
    try {
        // Utiliser le token d'authentification stocké (géré par base.js)
        const token = localStorage.getItem('access_token');
        
        if (!token) {
            throw new Error('Non authentifié');
        }
        
        const response = await fetch('/api/school/dashboard/', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.status === 401) {
            // Rediriger vers la page de login
            window.location.href = '/login/';
            return;
        }
        
        if (!response.ok) {
            throw new Error(`Erreur HTTP ${response.status}`);
        }
        
        dashboardData = await response.json();
        renderDashboard();
        
    } catch (error) {
        console.error('Erreur chargement dashboard:', error);
        showError('Impossible de charger les données du dashboard');
    }
}

// Rendre le dashboard
function renderDashboard() {
    if (!dashboardData) return;
    
    // Mettre à jour le titre et sous-titre
    const user = dashboardData.user;
    const school = dashboardData.school;
    
    document.getElementById('dashboard-title').textContent = `Tableau de bord - ${user.full_name}`;
    document.getElementById('dashboard-subtitle').textContent = 
        `${school.name} • ${user.custom_role || user.user_type}`;
    
    // Rendre les statistiques
    renderStats();
    
    // Rendre les modules
    renderModules();
    
    // Rendre les activités
    renderActivities();
    
    // Rendre les actions rapides
    renderQuickActions();
    
    // Rendre les rôles
    renderRoles();
}

// Rendre les statistiques
function renderStats() {
    const container = document.getElementById('stats-container');
    const stats = dashboardData.stats || {};
    
    let statsHTML = '';
    
    // Statistiques utilisateurs
    if (stats.users) {
        statsHTML += `
            <div class="stat-card bg-white dark:bg-slate-800 p-4 rounded-xl border-l-primary">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-sm text-gray-500 dark:text-gray-400">Utilisateurs</p>
                        <p class="text-2xl font-bold">${stats.users.total || 0}</p>
                    </div>
                    <div class="p-2 bg-primary/10 rounded-lg">
                        <i data-lucide="users" class="w-6 h-6 text-primary"></i>
                    </div>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    ${stats.users.active_today || 0} actifs aujourd'hui
                </p>
            </div>
        `;
    }
    
    // Statistiques académiques
    if (stats.academic) {
        statsHTML += `
            <div class="stat-card bg-white dark:bg-slate-800 p-4 rounded-xl border-l-success">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-sm text-gray-500 dark:text-gray-400">Enseignants</p>
                        <p class="text-2xl font-bold">${stats.academic.teachers || 0}</p>
                    </div>
                    <div class="p-2 bg-success/10 rounded-lg">
                        <i data-lucide="user-check" class="w-6 h-6 text-success"></i>
                    </div>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    ${stats.academic.classes || 0} classes
                </p>
            </div>
        `;
    }
    
    // Statistiques financières
    if (stats.finance) {
        statsHTML += `
            <div class="stat-card bg-white dark:bg-slate-800 p-4 rounded-xl border-l-warning">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-sm text-gray-500 dark:text-gray-400">Revenus</p>
                        <p class="text-2xl font-bold">${stats.finance.total_payments || 0} $</p>
                    </div>
                    <div class="p-2 bg-warning/10 rounded-lg">
                        <i data-lucide="dollar-sign" class="w-6 h-6 text-warning"></i>
                    </div>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Dépenses: ${stats.finance.total_expenses || 0} $
                </p>
            </div>
        `;
    }
    
    // Statistiques modules
    const modulesCount = dashboardData.available_modules?.length || 0;
    statsHTML += `
        <div class="stat-card bg-white dark:bg-slate-800 p-4 rounded-xl border-l-secondary">
            <div class="flex items-center justify-between">
                <div>
                    <p class="text-sm text-gray-500 dark:text-gray-400">Modules</p>
                    <p class="text-2xl font-bold">${modulesCount}</p>
                </div>
                <div class="p-2 bg-secondary/10 rounded-lg">
                    <i data-lucide="package" class="w-6 h-6 text-secondary"></i>
                </div>
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Accessibles
            </p>
        </div>
    `;
    
    container.innerHTML = statsHTML;
    lucide.createIcons();
}

// Rendre les modules
function renderModules() {
    const container = document.getElementById('modules-container');
    const modules = dashboardData.available_modules || [];
    
    document.getElementById('modules-count').textContent = `${modules.length} modules disponibles`;
    
    if (modules.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-8">
                <i data-lucide="package" class="w-12 h-12 text-gray-400 mx-auto mb-3"></i>
                <p class="text-gray-500 dark:text-gray-400">Aucun module disponible</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }
    
    let modulesHTML = '';
    
    modules.forEach(module => {
        const icon = getModuleIcon(module.code);
        const color = getModuleColor(module.code);
        const permissionCount = module.permissions ? module.permissions.length : 0;
        
        modulesHTML += `
            <div class="module-card bg-white dark:bg-slate-800 p-4 rounded-xl cursor-pointer"
                 onclick="navigateToModule('${module.code}')">
                <div class="flex items-start gap-3">
                    <div class="p-2 bg-${color}/10 rounded-lg">
                        <i data-lucide="${icon}" class="w-5 h-5 text-${color}"></i>
                    </div>
                    <div class="flex-1">
                        <h3 class="font-semibold mb-1">${module.name}</h3>
                        <p class="text-sm text-gray-500 dark:text-gray-400 mb-2">
                            ${permissionCount} permission${permissionCount > 1 ? 's' : ''}
                        </p>
                        
                        ${permissionCount > 0 ? `
                            <div class="flex flex-wrap gap-1">
                                ${module.permissions.slice(0, 2).map(perm => {
                                    const permName = perm.split('.')[1] || perm;
                                    return `<span class="permission-badge">${permName}</span>`;
                                }).join('')}
                                ${permissionCount > 2 ? `<span class="permission-badge">+${permissionCount - 2}</span>` : ''}
                            </div>
                        ` : ''}
                    </div>
                    <i data-lucide="chevron-right" class="w-4 h-4 text-gray-400 mt-1"></i>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = modulesHTML;
    lucide.createIcons();
}

// Rendre les activités
function renderActivities() {
    const container = document.getElementById('activities-container');
    const activities = dashboardData.recent_activities || [];
    
    if (activities.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8">
                <i data-lucide="calendar" class="w-12 h-12 text-gray-400 mx-auto mb-3"></i>
                <p class="text-gray-500 dark:text-gray-400">Aucune activité récente</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }
    
    let activitiesHTML = '';
    
    activities.slice(0, 5).forEach(activity => {
        const moduleColor = getModuleColor(activity.module) || 'gray';
        
        activitiesHTML += `
            <div class="activity-item ${activity.module || 'academic'} mb-6" onclick="showActivityDetail(${JSON.stringify(activity).replace(/"/g, '&quot;')})">
                <div class="bg-white dark:bg-slate-700/50 p-4 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700">
                    <div class="flex justify-between items-start">
                        <div>
                            <h4 class="font-medium mb-1">${activity.action_label || 'Activité'}</h4>
                            <p class="text-sm text-gray-600 dark:text-gray-300">
                                ${activity.details || ''}
                            </p>
                        </div>
                        <span class="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap ml-2">
                            ${formatDate(activity.created_at)}
                        </span>
                    </div>
                    <div class="flex items-center gap-2 mt-2">
                        <span class="text-xs px-2 py-1 rounded-full bg-${moduleColor}/10 text-${moduleColor}">
                            ${activity.module || 'Système'}
                        </span>
                        ${activity.user ? `
                            <span class="text-xs text-gray-500 dark:text-gray-400">
                                par ${activity.user}
                            </span>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = activitiesHTML;
    lucide.createIcons();
}

// Rendre les actions rapides
function renderQuickActions() {
    const container = document.getElementById('quick-actions-container');
    const actions = dashboardData.quick_actions || [];
    
    if (actions.length === 0) {
        container.innerHTML = `
            <div class="text-center py-2">
                <p class="text-sm text-gray-500 dark:text-gray-400">Aucune action rapide disponible</p>
            </div>
        `;
        return;
    }
    
    let actionsHTML = '';
    
    actions.forEach(action => {
        actionsHTML += `
            <button onclick="handleQuickAction('${action.code}', '${action.url}')"
                    class="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-left">
                <div class="p-2 bg-${action.color || 'primary'}/10 rounded-lg">
                    <i data-lucide="${action.icon || 'zap'}" class="w-4 h-4 text-${action.color || 'primary'}"></i>
                </div>
                <div class="flex-1">
                    <span class="font-medium text-sm">${action.name}</span>
                </div>
                <i data-lucide="chevron-right" class="w-4 h-4 text-gray-400"></i>
            </button>
        `;
    });
    
    container.innerHTML = actionsHTML;
    lucide.createIcons();
}

// Rendre les rôles
function renderRoles() {
    const container = document.getElementById('roles-container');
    const roles = dashboardData.available_roles || [];
    
    if (roles.length === 0) {
        container.innerHTML = `
            <p class="text-sm text-gray-500 dark:text-gray-400 text-center">Aucun rôle disponible</p>
        `;
        return;
    }
    
    let rolesHTML = '';
    
    roles.slice(0, 3).forEach(role => {
        rolesHTML += `
            <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                <div>
                    <h4 class="font-medium text-sm">${role.name}</h4>
                    ${role.description ? `
                        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            ${role.description}
                        </p>
                    ` : ''}
                </div>
                <button onclick="viewRole(${role.id})" class="text-xs text-primary hover:text-primary/80">
                    Voir
                </button>
            </div>
        `;
    });
    
    container.innerHTML = rolesHTML;
}

// Naviguer vers un module
function navigateToModule(moduleCode) {
    // Redirection vers la page du module
    window.location.href = `/${moduleCode}/`;
}

// Gérer une action rapide
function handleQuickAction(actionCode, actionUrl) {
    if (actionUrl) {
        window.location.href = actionUrl;
    }
}

// Voir un rôle
function viewRole(roleId) {
    // Redirection vers la page de gestion des rôles
    window.location.href = `/admin/roles/${roleId}/`;
}

// Voir toutes les activités
function viewAllActivities() {
    window.location.href = '/timeline/';
}

// Afficher les détails d'une activité
function showActivityDetail(activity) {
    const modal = document.getElementById('activityDetailModal');
    const title = document.getElementById('activity-modal-title');
    const content = document.getElementById('activity-detail-content');
    
    title.textContent = activity.action_label || 'Détails de l\'activité';
    
    content.innerHTML = `
        <div class="space-y-4">
            <div>
                <label class="text-sm text-gray-500 dark:text-gray-400">Description</label>
                <p class="font-medium">${activity.details || 'Aucun détail disponible'}</p>
            </div>
            
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="text-sm text-gray-500 dark:text-gray-400">Module</label>
                    <p class="font-medium">${activity.module || 'Système'}</p>
                </div>
                <div>
                    <label class="text-sm text-gray-500 dark:text-gray-400">Type</label>
                    <p class="font-medium">${activity.action_type || 'Action'}</p>
                </div>
            </div>
            
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="text-sm text-gray-500 dark:text-gray-400">Utilisateur</label>
                    <p class="font-medium">${activity.user || 'Système'}</p>
                </div>
                <div>
                    <label class="text-sm text-gray-500 dark:text-gray-400">Date</label>
                    <p class="font-medium">${formatDate(activity.created_at)}</p>
                </div>
            </div>
        </div>
    `;
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

// Fermer le modal d'activité
function closeActivityModal() {
    const modal = document.getElementById('activityDetailModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

// Afficher une erreur
function showError(message) {
    // Créer une notification toast
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Initialiser le dashboard
document.addEventListener('DOMContentLoaded', () => {
    console.log('Dashboard Direction initialisé');
    loadDashboardData();
    
    // Rafraîchir les données toutes les 30 secondes
    setInterval(loadDashboardData, 30000);
});