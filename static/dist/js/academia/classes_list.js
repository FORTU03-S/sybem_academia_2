document.addEventListener("DOMContentLoaded", () => {
    // Initialisation unique au chargement
    loadClasses();
    initModalEvents();
});

// --- GESTION DES DONNÉES ---

async function loadClasses() {
    const table = document.getElementById("classesTable");
    table.innerHTML = '<tr><td colspan="5" class="text-center p-4">Chargement...</td></tr>';

    try {
        // L'appel API standardisé (GET)
        const classes = await apiRequest("/api/academia/classes/"); 
        table.innerHTML = "";

        if (!classes || classes.length === 0) {
            table.innerHTML = `
                <tr>
                    <td colspan="5" class="p-4 text-center text-slate-500">Aucune classe disponible.</td>
                </tr>`;
            return;
        }

        classes.forEach(classe => renderClassRow(classe, table));

    } catch (e) {
        console.error(e);
        table.innerHTML = `<tr><td colspan="5" class="p-4 text-red-600">Erreur: ${e.message}</td></tr>`;
    }
}

function renderClassRow(classe, table) {
    // ... tes variables existantes ...
    const titulaireName = classe.titulaire_name || "-"; 

    const tr = document.createElement("tr");
    tr.className = "border-t dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-slate-800 transition";
    tr.innerHTML = `
        <td class="p-3 font-medium text-slate-800 dark:text-white">${classe.name}</td>
        <td class="text-slate-600 dark:text-slate-300">${classe.education_level}</td>
        <td>${classe.academic_period_name || "-"}</td>
        <td>${titulaireName}</td>
        <td class="p-3 flex gap-3 justify-end">
            <a href="/static/dist/html/school_admin/class_assignments.html?id=${classe.id}&name=${encodeURIComponent(classe.name)}" 
               class="text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
               <i data-lucide="book-open" class="w-4 h-4"></i> Cours
            </a>
            
            <button onclick="openEditModal(${classe.id})" class="text-blue-600 hover:underline">Modifier</button>
            <button onclick="deleteClass(${classe.id})" class="text-red-600 hover:underline">Supprimer</button>
        </td>
    `;
    table.appendChild(tr);
// Utilise la sécurité pour éviter l'erreur si Lucide n'est pas encore là
if (window.lucide) {
    window.lucide.createIcons();
} // Rafraîchir les icônes
}

async function loadTeachers() {
    try {
        const teachers = await apiRequest("/api/school/users/?user_type=teacher");
        const select = document.getElementById("teacherSelect");
        // On sauvegarde la sélection actuelle si c'est une édition
        const currentVal = select.value;
        
        select.innerHTML = `<option value="">-- Aucun titulaire --</option>`;
        teachers.forEach(t => {
            const option = document.createElement("option");
            option.value = t.id;
            option.textContent = `${t.first_name} ${t.last_name}`;
            select.appendChild(option);
        });
        
        if (currentVal) select.value = currentVal;
    } catch (e) {
        console.error("Erreur chargement enseignants :", e);
    }
}

// --- GESTION DE LA MODALE ---

let isEditing = false;
let currentClassId = null;

function initModalEvents() {
    const openBtn = document.getElementById("openModalBtn"); // Le bouton "Créer une classe" dans ton HTML
    const closeBtn = document.getElementById("closeModalBtn");
    const form = document.getElementById("classForm");

    if (openBtn) openBtn.addEventListener("click", () => openCreateModal());
    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    
    if (form) {
        // Retirer les anciens listeners pour éviter les doublons (bonne pratique)
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        
        newForm.addEventListener("submit", handleFormSubmit);
    }
}

function openCreateModal() {
    isEditing = false;
    currentClassId = null;
    document.getElementById("modalTitle").textContent = "Créer une nouvelle classe";
    document.getElementById("classForm").reset();
    toggleModal(true);
    loadTeachers(); // Charger les profs à l'ouverture
}

async function openEditModal(id) {
    isEditing = true;
    currentClassId = id;
    document.getElementById("modalTitle").textContent = "Modifier la classe";
    
    toggleModal(true);
    await loadTeachers(); // Charger les profs d'abord

    try {
        const data = await apiRequest(`/api/academia/classes/${id}/`);
        const form = document.getElementById("classForm");
        
        // Remplir le formulaire
        form.elements["name"].value = data.name;
        form.elements["education_level"].value = data.education_level;
        if (data.titulaire_id) form.elements["titulaire_id"].value = data.titulaire_id;
        else if (data.titulaire) form.elements["titulaire_id"].value = data.titulaire.id;

    } catch (e) {
        alert("Impossible de charger les données : " + e.message);
        closeModal();
    }
}

function closeModal() {
    toggleModal(false);
    document.getElementById("classForm").reset();
}

function toggleModal(show) {
    const modal = document.getElementById("classModal"); // ID unique pour ta modale
    const inner = modal.querySelector("div"); // Le conteneur interne pour l'animation

    if (show) {
        modal.classList.remove("hidden");
        // Petit délai pour permettre l'animation CSS
        setTimeout(() => {
            inner.classList.remove("scale-0", "opacity-0");
            inner.classList.add("scale-100", "opacity-100");
        }, 10);
    } else {
        inner.classList.remove("scale-100", "opacity-100");
        inner.classList.add("scale-0", "opacity-0");
        setTimeout(() => {
            modal.classList.add("hidden");
        }, 300); // Correspond à la durée de transition CSS
    }
}

// --- ACTIONS CRUD ---

async function handleFormSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    // Construction propre du payload
    // Note: On n'envoie PAS school_id, le backend le gère via le Token/User
    const payload = {
        name: formData.get("name"),
        education_level: formData.get("education_level"),
        titulaire_id: formData.get("titulaire_id") || null
    };

    try {
        let url = "/api/academia/classes/";
        let method = "POST";

        if (isEditing && currentClassId) {
            url += `${currentClassId}/`;
            method = "PUT"; // ou PATCH
        }

        await apiRequest(url, method, payload);
        
        closeModal();
        loadClasses(); // Rafraîchir le tableau
        
        // Notification (Optionnel)
        // showToast(isEditing ? "Classe modifiée" : "Classe créée", "success");

    } catch (error) {
        alert("Erreur lors de l'enregistrement : " + error.message);
    }
}

async function deleteClass(id) {
    if (!confirm("Voulez-vous vraiment supprimer cette classe ?")) return;

    try {
        await apiRequest(`/api/academia/classes/${id}/`, "DELETE");
        loadClasses();
    } catch (e) {
        alert("Erreur suppression : " + e.message);
    }
}

// --- UTILITAIRE API (CRUCIAL POUR LE 403) ---
// Cette fonction doit gérer le CSRF Token automatiquement
async function apiRequest(url, method = "GET", body = null) {
    // On récupère le token stocké lors du login
    const token = localStorage.getItem("access_token"); 

    const headers = {
        "Content-Type": "application/json",
    };

    // SI LE TOKEN EXISTE, ON L'AJOUTE (C'est ce qui manque actuellement)
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const config = {
        method: method,
        headers: headers,
    };

    if (body) config.body = JSON.stringify(body);

    const response = await fetch(url, config);

    if (response.status === 401) {
        // Rediriger vers le login si le token est mort
        window.location.href = "/api/auth/login/"; 
        return;
    }

    if (response.status === 204) return null;
    return await response.json();
}

// Helper pour récupérer le cookie CSRF
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