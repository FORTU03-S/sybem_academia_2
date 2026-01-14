function initClassesPage() {
    console.log("Init page classes", new Date().toISOString());

    loadClasses();
    initModalEvents();
}

function initMobileSync() {
    const tableBody = document.getElementById('classesTable');
    const mobileContainer = document.getElementById('mobileClassesContainer');

    if (!tableBody || !mobileContainer) return;

    // 🔥 Nettoyage CRITIQUE
    if (classesObserver) {
        classesObserver.disconnect();
        classesObserver = null;
    }

    function updateMobileView() {
        const rows = tableBody.querySelectorAll('tr');
        let html = '';

        rows.forEach((row, index) => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 5) return;

            html += `
                <div class="bg-white dark:bg-slate-800 rounded-xl p-4 border mb-3">
                    <h3 class="font-semibold">${cells[0].textContent}</h3>
                    <p>${cells[1].textContent}</p>
                    <p>${cells[2].textContent}</p>
                    <p>${cells[3].textContent || 'Aucun titulaire'}</p>
                </div>
            `;
        });

        mobileContainer.innerHTML = html;
        if (window.lucide) lucide.createIcons();
    }

    classesObserver = new MutationObserver(() => {
        requestAnimationFrame(updateMobileView);
    });

    classesObserver.observe(tableBody, {
        childList: true,
        subtree: true
    });

    updateMobileView();
}

// --- GESTION DES DONNÉES ---

async function loadClasses() {
    const table = document.getElementById("classesTable");
    table.innerHTML = '<tr><td colspan="5" class="text-center p-4">Chargement...</td></tr>';

    try {
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
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

async function loadTeachers() {
    try {
        const teachers = await apiRequest("/api/school/users/?user_type=teacher");
        const select = document.getElementById("teacherSelect");
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

/**
 * NOUVEAU: Charge les périodes académiques depuis le backend
 */
// --- DANS classes_list.js ---

async function loadAcademicPeriods() {
    try {
        // CORRECTION : L'URL est /api/academic-periods/ d'après ton router principal
        const periods = await apiRequest("/api/academic-periods/"); 
        const select = document.getElementById("periodSelect");
        if (!select) return;

        select.innerHTML = `<option value="">-- Sélectionner la période --</option>`;
        
        periods.forEach(p => {
            const option = document.createElement("option");
            option.value = p.id;
            // On affiche le nom et on indique si c'est l'actuelle
            option.textContent = p.is_current ? `${p.name} (Actuelle)` : p.name;
            if (p.is_current && !isEditing) option.selected = true; 
            select.appendChild(option);
        });
    } catch (e) {
        console.error("Erreur chargement périodes :", e);
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    const periodId = formData.get("academic_period_id");
    if (!periodId) {
        alert("Veuillez sélectionner une période académique.");
        return;
    }

    const payload = {
        name: formData.get("name"),
        education_level: formData.get("education_level"),
        titulaire_id: formData.get("titulaire_id") || null,
        // Envoi de l'ID à la clé attendue par le modèle
        academic_period: parseInt(periodId) 
    };

    try {
        let url = "/api/academia/classes/";
        let method = "POST";
        if (isEditing && currentClassId) {
            url += `${currentClassId}/`;
            method = "PUT";
        }

        await apiRequest(url, method, payload);
        closeModal();
        loadClasses();
    } catch (error) {
        alert("Erreur : " + error.message);
    }
}
// --- GESTION DE LA MODALE ---

let isEditing = false;
let currentClassId = null;

function initModalEvents() {
    const openBtn = document.getElementById("openModalBtn");
    const closeBtn = document.getElementById("closeModalBtn");
    const form = document.getElementById("classForm");

    if (openBtn) openBtn.addEventListener("click", () => openCreateModal());
    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    
    if (form) {
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
    loadTeachers();
    loadAcademicPeriods(); // Dynamique !
}

async function openEditModal(id) {
    isEditing = true;
    currentClassId = id;
    document.getElementById("modalTitle").textContent = "Modifier la classe";
    
    toggleModal(true);
    await Promise.all([loadTeachers(), loadAcademicPeriods()]);

    try {
        const data = await apiRequest(`/api/academia/classes/${id}/`);
        const form = document.getElementById("classForm");
        
        form.elements["name"].value = data.name;
        form.elements["education_level"].value = data.education_level;
        
        // On sélectionne la période
        if (data.academic_period) {
            form.elements["academic_period_id"].value = data.academic_period;
        }

        if (data.titulaire_id) {
            form.elements["titulaire_id"].value = data.titulaire_id;
        } else if (data.titulaire) {
            form.elements["titulaire_id"].value = data.titulaire.id;
        }

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
    const modal = document.getElementById("classModal");
    const inner = modal.querySelector("div");

    if (show) {
        modal.classList.remove("hidden");
        modal.classList.add("flex");
        setTimeout(() => {
            inner.classList.remove("scale-0", "opacity-0");
            inner.classList.add("scale-100", "opacity-100");
        }, 10);
    } else {
        inner.classList.remove("scale-100", "opacity-100");
        inner.classList.add("scale-0", "opacity-0");
        setTimeout(() => {
            modal.classList.add("hidden");
            modal.classList.remove("flex");
        }, 300);
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

// --- UTILITAIRE API ---

async function apiRequest(url, method = "GET", body = null) {
    const token = localStorage.getItem("access_token"); 

    const headers = {
        "Content-Type": "application/json",
        "X-CSRFToken": getCookie('csrftoken') // Sécurité Django standard
    };

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
        window.location.href = "/api/auth/login/"; 
        return;
    }

    if (response.status === 204) return null;
    
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.detail || data.message || "Erreur serveur");
    }
    return data;
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