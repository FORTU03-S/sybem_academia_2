// users.js - Gestion complète des utilisateurs (CRUD)
// Version: 1.1.0
// Auteur: SYBEM

const token = localStorage.getItem("access_token");
if (!token) {
    window.location.href = "/static/dist/html/login.html";
}



let table, roleFilter, schoolFilter, statusFilter, schoolSelect;
document.addEventListener("DOMContentLoaded", function () {

    table = document.getElementById("users-table");
    roleFilter = document.getElementById("filter-role");
    schoolFilter = document.getElementById("filter-school");
    statusFilter = document.getElementById("filter-status");
    schoolSelect = document.getElementById("school");

    if (!table || !roleFilter || !schoolFilter) {
        console.error("❌ DOM non prêt ou éléments manquants");
        return;
    }

    roleFilter.onchange = loadUsers;
    schoolFilter.onchange = loadUsers;
    if (statusFilter) statusFilter.onchange = loadUsers;

    loadSchools();
    loadUsers();

    if (typeof lucide !== "undefined") {
        lucide.createIcons();
    }
});


let isEditing = false;
let currentUserId = null;

/* =========================
   DEBUG HELPER
========================= */
function debug(label, data) {
    console.log(`🟣 ${label}`, data);
}

/* =========================
   LOAD USERS
========================= */
async function loadUsers() {
    try {
        let url = "/api/superadmin/users/?";
        const params = new URLSearchParams();

        if (roleFilter.value) {
            params.append("user_type", roleFilter.value);
        }
        if (schoolFilter.value) {
            params.append("school", schoolFilter.value);
        }
        if (statusFilter.value) {
            params.append("is_active", statusFilter.value);
        }

        url += params.toString();
        debug("Fetching users from", url);

        const res = await fetch(url, {
            headers: {
                Authorization: `Bearer ${token}`,

            },
        });

        const users = await res.json();
        debug("Users response", users);

        // Mettre à jour le compteur
        document.getElementById("user-count").textContent = users.length;

        // Supprimer la ligne de chargement si elle existe
        const loadingRow = document.getElementById("loading-row");
        if (loadingRow) {
            loadingRow.remove();
        }

        if (users.length === 0) {
            table.innerHTML = `
                <tr>
                    <td colspan="5" class="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                        <i data-lucide="users" class="w-12 h-12 mx-auto mb-3 opacity-50"></i>
                        <p class="text-lg font-medium mb-2">Aucun utilisateur trouvé</p>
                        <p class="text-sm mb-4">Commencez par créer votre premier utilisateur</p>
                        <button onclick="openUserModal()" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">
                            Ajouter un utilisateur
                        </button>
                    </td>
                </tr>
            `;
            lucide.createIcons();
            return;
        }

        table.innerHTML = "";

        users.forEach((u) => {
            table.innerHTML += `
                <tr class="border-b dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50">
                    <td class="px-4 py-3">
                        <div class="font-medium">${u.full_name}</div>
                        <div class="text-gray-500 text-xs">${u.email}</div>
                    </td>

                    <td class="px-4 py-3 text-center">
                        ${badgeRole(u.user_type)}
                    </td>

                    <td class="px-4 py-3 text-center">
                        ${u.school_name || "—"}
                    </td>

                    <td class="px-4 py-3 text-center">
                        ${badgeStatus(u.is_active)}
                    </td>

                    <td class="px-4 py-3 text-center">
                        <div class="flex justify-center gap-2">
                            <button onclick="editUser(${u.id})" 
                                    class="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                                    title="Modifier">
                                <i data-lucide="edit" class="w-4 h-4"></i>
                            </button>
                            <button onclick="toggleUserStatus(${u.id}, ${u.is_active})" 
                                    class="p-1.5 ${u.is_active ? 'text-yellow-600' : 'text-green-600'} hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                    title="${u.is_active ? 'Désactiver' : 'Activer'}">
                                <i data-lucide="${u.is_active ? 'toggle-left' : 'toggle-right'}" class="w-4 h-4"></i>
                            </button>
                            <button onclick="confirmDeleteUser(${u.id}, '${escapeHtml(u.full_name)}')" 
                                    class="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                                    title="Supprimer">
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        lucide.createIcons();
    } catch (err) {
        console.error("❌ Erreur loadUsers", err);
        showError("Erreur lors du chargement des utilisateurs");
    }
}

/* =========================
   LOAD SCHOOLS (IMPORTANT)
========================= */
async function loadSchools() {
    try {
        debug("Fetching schools", "/api/superadmin/schools/");

        const res = await fetch("/api/superadmin/schools/", {
            headers: {
                Authorization: `Bearer ${token}`,

            },
        });

        const schools = await res.json();
        debug("Schools response", schools);

        // Remplir les selects d'école
        const schoolElements = [schoolSelect, schoolFilter];
        
        schoolElements.forEach(element => {
            if (!element) return;
            
            const defaultOption = element.tagName === 'SELECT' ? 
                '<option value="">' + (element.id === 'school' ? 'École (optionnel)' : 'Toutes les écoles') + '</option>' : '';
            
            element.innerHTML = defaultOption;
            
            schools.forEach((s) => {
                element.innerHTML += `
                    <option value="${s.id}">${s.name}</option>
                `;
            });
        });
    } catch (err) {
        console.error("❌ Erreur loadSchools", err);
        showError("Erreur lors du chargement des écoles");
    }
}

/* =========================
   BADGE ROLE
========================= */
function badgeRole(role) {
    const map = {
        superadmin: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
        SCHOOL_ADMIN: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
        teacher: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
        student: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
    };

    const labels = {
        superadmin: "Super Admin",
        SCHOOL_ADMIN: "Admin École",
        teacher: "Enseignant",
        student: "Élève"
    };

    return `
        <span class="px-3 py-1 text-xs rounded-full ${map[role] || "bg-gray-200 dark:bg-gray-700"}">
            ${labels[role] || role}
        </span>
    `;
}

/* =========================
   BADGE STATUS
========================= */
function badgeStatus(isActive) {
    if (isActive) {
        return `<span class="status-badge status-active">Actif</span>`;
    } else {
        return `<span class="status-badge status-inactive">Inactif</span>`;
    }
}

/* =========================
   MODAL FUNCTIONS
========================= */
function openUserModal(userId = null) {
    const modal = document.getElementById("userModal");
    const modalTitle = document.getElementById("modal-title");
    const submitBtn = document.getElementById("modal-submit-btn");
    const passwordField = document.getElementById("password");
    const statusField = document.getElementById("status-field");
    
    // Réinitialiser le formulaire
    document.getElementById("user-id").value = "";
    document.getElementById("userForm").reset();
    
    if (userId) {
        // Mode édition
        isEditing = true;
        currentUserId = userId;
        modalTitle.textContent = "Modifier l'utilisateur";
        submitBtn.textContent = "Mettre à jour";
        passwordField.placeholder = "Mot de passe (laisser vide pour ne pas changer)";
        passwordField.required = false;
        statusField.classList.remove("hidden");
        
        // Charger les données de l'utilisateur
        loadUserData(userId);
    } else {
        // Mode création
        isEditing = false;
        currentUserId = null;
        modalTitle.textContent = "Ajouter un utilisateur";
        submitBtn.textContent = "Créer l'utilisateur";
        passwordField.placeholder = "Mot de passe (minimum 6 caractères)";
        passwordField.required = true;
        statusField.classList.add("hidden");
        
        // Charger les écoles pour le select
        loadSchools();
    }
    
    // Gérer le changement de rôle (désactiver école pour superadmin)
    document.getElementById("role").addEventListener("change", function() {
        const schoolSelect = document.getElementById("school");
        if (this.value === "superadmin") {
            schoolSelect.disabled = true;
            schoolSelect.value = "";
        } else {
            schoolSelect.disabled = false;
        }
    });
    
    // Afficher le modal
    modal.classList.remove("hidden");
    modal.classList.add("flex");
}

function closeUserModal() {
    document.getElementById("userModal").classList.add("hidden");
    document.getElementById("userModal").classList.remove("flex");
    isEditing = false;
    currentUserId = null;
}

/* =========================
   LOAD USER DATA FOR EDITING
========================= */
async function loadUserData(userId) {
    try {
        debug("Loading user data for ID:", userId);
        
        const res = await fetch(`/api/superadmin/users/${userId}/`, {
            headers: {
                Authorization: `Bearer ${token}`,

            },
        });
        
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }
        
        const user = await res.json();
        debug("User data:", user);
        
        // Remplir le formulaire
        document.getElementById("user-id").value = user.id;
        document.getElementById("email").value = user.email || "";
        document.getElementById("last_name").value = user.last_name || "";
        document.getElementById("username").value = user.username || "";
        document.getElementById("first_name").value = user.first_name || "";
        document.getElementById("role").value = user.user_type || "";
        document.getElementById("is_active").value = user.is_active ? "true" : "false";
        
        // Désactiver le champ école pour superadmin
        if (user.user_type === "superadmin") {
            document.getElementById("school").disabled = true;
        } else {
            // Charger et sélectionner l'école
            await loadSchools();
            if (user.school) {
                document.getElementById("school").value = user.school;
            }
        }
        
    } catch (err) {
        console.error("❌ Erreur loadUserData", err);
        showError("Erreur lors du chargement des données utilisateur");
    }
}

/* =========================
   SAVE USER (CREATE OR UPDATE)
========================= */
async function saveUser() {
    try {
        const formData = new FormData(document.getElementById("userForm"));
        const userId = document.getElementById("user-id").value;
        const isActive = document.getElementById("is_active")?.value === "true";
        
        const payload = {
            email: document.getElementById("email").value,
            last_name: document.getElementById("last_name").value,
            username: document.getElementById("username").value,
            first_name: document.getElementById("first_name").value,
            role: document.getElementById("role").value,
            school: document.getElementById("school").value || null,
        };
        
        // Ajouter le mot de passe seulement s'il est fourni
        const password = document.getElementById("password").value;
        if (password) {
            payload.password = password;
        }
        
        // En mode édition, ajouter le statut
        if (isEditing) {
            payload.is_active = isActive;
        }
        
        debug("Saving user payload:", payload);
        
        const url = isEditing 
            ? `/api/superadmin/users/${userId}/`
            : "/api/superadmin/users/";
            
        const method = isEditing ? "PUT" : "POST";
        
        const res = await fetch(url, {
            method: method,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,

            },
            body: JSON.stringify(payload),
        });
        
        const data = await res.json();
        debug("Save user response:", data);
        
        if (!res.ok) {
            let errorMsg = "Erreur inconnue";
            if (data.detail) {
                errorMsg = data.detail;
            } else if (data.message) {
                errorMsg = data.message;
            } else if (data.email) {
                errorMsg = `Email: ${data.email[0]}`;
            }
            throw new Error(errorMsg);
        }
        
        showSuccess(isEditing ? "Utilisateur mis à jour avec succès" : "Utilisateur créé avec succès");
        closeUserModal();
        loadUsers();
        
    } catch (err) {
        console.error("❌ Erreur saveUser", err);
        showError(err.message || "Erreur lors de la sauvegarde");
    }
}

/* =========================
   TOGGLE USER STATUS
========================= */
async function toggleUserStatus(userId, currentStatus) {
    try {
        const newStatus = !currentStatus;
        const action = newStatus ? "activer" : "désactiver";
        
        if (!confirm(`Êtes-vous sûr de vouloir ${action} cet utilisateur ?`)) {
            return;
        }
        
        debug(`Toggling user ${userId} status from ${currentStatus} to ${newStatus}`);
        
        const res = await fetch(`/api/superadmin/users/${userId}/`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,

            },
            body: JSON.stringify({
                is_active: newStatus
            }),
        });
        
        const data = await res.json();
        debug("Toggle status response:", data);
        
        if (!res.ok) {
            throw new Error(data.detail || "Erreur lors de la modification du statut");
        }
        
        showSuccess(`Utilisateur ${newStatus ? "activé" : "désactivé"} avec succès`);
        loadUsers();
        
    } catch (err) {
        console.error("❌ Erreur toggleUserStatus", err);
        showError(err.message || "Erreur lors de la modification du statut");
    }
}

/* =========================
   DELETE USER
========================= */
async function confirmDeleteUser(userId, userName) {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer l'utilisateur "${userName}" ?\n\nCette action est irréversible.`)) {
        return;
    }
    
    await deleteUser(userId);
}

async function deleteUser(userId) {
    try {
        debug("Deleting user ID:", userId);
        
        const res = await fetch(`/api/superadmin/users/${userId}/`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${token}`,

            },
        });
        
        if (!res.ok && res.status !== 204) {
            const data = await res.json();
            throw new Error(data.detail || "Erreur lors de la suppression");
        }
        
        showSuccess("Utilisateur supprimé avec succès");
        loadUsers();
        
    } catch (err) {
        console.error("❌ Erreur deleteUser", err);
        showError(err.message || "Erreur lors de la suppression");
    }
}

/* =========================
   FILTER FUNCTIONS
========================= */
function resetFilters() {
    roleFilter.value = "";
    schoolFilter.value = "";
    if (statusFilter) statusFilter.value = "";
    loadUsers();
}

/* =========================
   UTILITY FUNCTIONS
========================= */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showSuccess(message) {
    // Vous pouvez remplacer par un système de toast plus élégant
    alert("✅ " + message);
}

function showError(message) {
    alert("❌ " + message);
}

/* =========================
   EVENTS
========================= */
roleFilter.onchange = loadUsers;
schoolFilter.onchange = loadUsers;
if (statusFilter) {
    statusFilter.onchange = loadUsers;
}

/* =========================
   INIT
========================= */
document.addEventListener("DOMContentLoaded", function() {
    loadSchools();
    loadUsers();
    
    // Initialiser les icônes Lucide
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
});

/* =========================
   EXPORT FUNCTIONS FOR GLOBAL USE
========================= */
window.openUserModal = openUserModal;
window.closeUserModal = closeUserModal;
window.saveUser = saveUser;
window.editUser = (userId) => openUserModal(userId);
window.toggleUserStatus = toggleUserStatus;
window.confirmDeleteUser = confirmDeleteUser;
window.resetFilters = resetFilters;
window.deleteUser = deleteUser;