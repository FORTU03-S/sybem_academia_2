// C:\Users\user\sybem_academia2\sybem\static\dist\js\academia\classes_list.js

let classesObserver = null;
let isEditing = false;
let currentClassId = null;

document.addEventListener('DOMContentLoaded', () => {
    initClassesPage();
});

function initClassesPage() {
    console.log("🚀 Initialisation de la page classes...");
    try {
        initModalEvents();
        loadClasses();
        // L'initMobileSync sera géré à l'intérieur de loadClasses pour plus de stabilité
    } catch (error) {
        console.error("❌ Erreur critique init:", error);
    }
}

function initModalEvents() {
    const openBtn = document.getElementById("openModalBtn");
    const closeBtn = document.getElementById("closeModalBtn");
    const form = document.getElementById("classForm");

    if (openBtn) openBtn.onclick = openCreateModal;
    if (closeBtn) closeBtn.onclick = closeModal;

    if (form) {
        // 1. Nettoyage des anciens écouteurs (Clonage)
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        
        // 2. Réattacher l'événement de soumission
        newForm.addEventListener('submit', handleFormSubmit);

        // --- 3. LOGIQUE AUTOMATIQUE (Niveau -> Système) ---
        const levelSelect = newForm.querySelector('select[name="education_level"]');
        const systemSelect = newForm.querySelector('select[name="system_type"]');

        if (levelSelect && systemSelect) {
            levelSelect.addEventListener('change', (e) => {
                const level = e.target.value;
                
                // Logique conditionnelle
                if (level === 'PRIMARY') {
                    // Primaire = Trimestre
                    systemSelect.value = 'TRIMESTER'; 
                } 
                else if (level === 'SECONDARY') {
                    // Secondaire = Souvent Trimestre (à adapter selon ton pays)
                    systemSelect.value = 'TRIMESTER'; 
                } 
                else if (level === 'UNIVERSITY') {
                    // Université = Semestre
                    systemSelect.value = 'SEMESTER'; 
                }
            });
        }
        // --------------------------------------------------
    }
}

// --- CHARGEMENT DES DONNÉES ---
// C:\Users\user\sybem_academia2\sybem\static\dist\js\academia\classes_list.js

// ... (Garder le début identique jusqu'à loadClasses) ...

async function loadClasses() {
    const table = document.getElementById("classesTable");
    if (!table) return;

    if (classesObserver) classesObserver.disconnect();
    table.innerHTML = '<tr><td colspan="6" class="text-center p-8">Chargement...</td></tr>';

    try {
        const response = await apiRequest("/api/academia/classes/");
        const classes = Array.isArray(response) ? response : (response.results || []);
        
        table.innerHTML = "";

        if (classes.length === 0) {
            table.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-gray-500">Aucune classe trouvée.</td></tr>';
        } else {
            classes.forEach(classe => {
                const tr = document.createElement("tr");
                tr.className = "border-t dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition fade-in-row";
                
                const assignmentUrl = `class_assignments.html?id=${classe.id}&name=${encodeURIComponent(classe.name)}`;

                // AJOUT DU CHAMP system_type_display DANS LE HTML
                tr.innerHTML = `
                    <td class="p-4 font-medium text-slate-800 dark:text-white">${classe.name}</td>
                    <td class="p-4 text-slate-600 dark:text-slate-300">
                        <span class="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs">
                            ${classe.education_level}
                        </span>
                    </td>
                    <td class="p-4 text-slate-600 dark:text-slate-300">
                        ${classe.system_type_display} </td>
                    <td class="p-4 text-slate-600 dark:text-slate-300">${classe.academic_period_name || "-"}</td>
                    <td class="p-4 text-slate-600 dark:text-slate-300">${classe.titulaire_name || "Non assigné"}</td>
                    <td class="p-4 flex gap-3 justify-end items-center">
                        <a href="${assignmentUrl}" class="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-lg text-sm font-bold">
                            <i data-lucide="book-open" class="w-4 h-4"></i> Assigner
                        </a>
                        <button onclick="openEditModal(${classe.id})" class="text-indigo-600 hover:text-indigo-800 font-medium">Modifier</button>
                        <button onclick="deleteClass(${classe.id})" class="text-red-600 hover:text-red-800 font-medium">Supprimer</button>
                    </td>
                `;
                table.appendChild(tr);
            });
        }
        
        if (window.lucide) window.lucide.createIcons();
        initMobileSync();

    } catch (e) {
        console.error("Erreur loadClasses:", e);
        table.innerHTML = `<tr><td colspan="6" class="p-4 text-red-600 text-center">Erreur de chargement</td></tr>`;
    }
}

// MISE À JOUR DE LA VUE MOBILE (pour inclure la nouvelle colonne)
function initMobileSync() {
    const tableBody = document.getElementById('classesTable');
    const mobileContainer = document.getElementById('mobileClassesContainer');
    if (!tableBody || !mobileContainer) return;

    const updateMobileView = () => {
        const rows = tableBody.querySelectorAll('tr');
        let html = '';
        rows.forEach((row) => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 6) { // On passe à 6 cellules
                html += `
                    <div class="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-gray-100 dark:border-slate-700 shadow-sm mb-4">
                        <div class="flex justify-between items-start mb-3">
                            <div>
                                <h3 class="font-bold text-slate-800 dark:text-white text-lg">${cells[0].textContent}</h3>
                                <p class="text-xs text-indigo-500 font-bold uppercase">${cells[2].textContent}</p>
                            </div>
                            <span class="px-2 py-1 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300 text-xs rounded-lg font-bold">
                                ${cells[1].textContent}
                            </span>
                        </div>
                        <div class="space-y-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
                            <p class="flex items-center gap-2"><i data-lucide="calendar" class="w-4 h-4"></i> ${cells[3].textContent}</p>
                            <p class="flex items-center gap-2"><i data-lucide="user" class="w-4 h-4"></i> ${cells[4].textContent}</p>
                        </div>
                        <div class="flex justify-end gap-3 pt-3 border-t dark:border-slate-700">
                            ${cells[5].innerHTML}
                        </div>
                    </div>`;
            }
        });
        mobileContainer.innerHTML = html || '<p class="text-center text-gray-500 py-10">Aucune classe</p>';
        if (window.lucide) window.lucide.createIcons();
    };

    classesObserver = new MutationObserver(updateMobileView);
    classesObserver.observe(tableBody, { childList: true });
    updateMobileView();
}

// --- FONCTIONS AUXILIAIRES (Formulaire, Modal, etc.) ---

async function handleFormSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const payload = {
        name: formData.get("name"),
        education_level: formData.get("education_level"),
        system_type: formData.get("system_type"), // <--- AJOUTEZ CETTE LIGNE
        academic_period: parseInt(formData.get("academic_period_id"), 10),
        titulaire_id: formData.get("titulaire_id") ? parseInt(formData.get("titulaire_id"), 10) : null
    };

    try {
        const method = isEditing ? "PUT" : "POST";
        const url = isEditing ? `/api/academia/classes/${currentClassId}/` : "/api/academia/classes/";
        await apiRequest(url, method, payload);
        closeModal();
        loadClasses();
    } catch (error) {
        alert("Erreur: " + error.message);
    }
}

function openCreateModal() {
    isEditing = false;
    currentClassId = null;
    const form = document.getElementById("classForm");
    if(form) form.reset();
    document.getElementById("modalTitle").textContent = "Nouvelle Classe";
    toggleModal(true);
    loadTeachers();
    loadAcademicPeriods();
}

async function openEditModal(id) {
    isEditing = true;
    currentClassId = id;
    document.getElementById("modalTitle").textContent = "Modifier la classe";
    toggleModal(true);
    try {
        const data = await apiRequest(`/api/academia/classes/${id}/`);
        const form = document.getElementById("classForm");
        
        form.elements["name"].value = data.name;
        form.elements["education_level"].value = data.education_level;
        
        // --- AJOUTER CETTE LIGNE ---
        // Assure-toi que ton select HTML a bien name="system_type"
        if(form.elements["system_type"]) {
            form.elements["system_type"].value = data.system_type; 
        }
        // ---------------------------

        await Promise.all([loadTeachers(), loadAcademicPeriods()]);
        form.elements["academic_period_id"].value = data.academic_period;
        form.elements["titulaire_id"].value = data.titulaire_id || "";
    } catch (e) { console.error(e); }
}

function toggleModal(show) {
    const modal = document.getElementById("classModal");
    if (!modal) return;
    modal.classList.toggle("hidden", !show);
    modal.classList.toggle("flex", show);
}

function closeModal() { toggleModal(false); }

async function loadTeachers() {
    try {
        const teachers = await apiRequest("/api/school/users/?user_type=teacher");
        const select = document.getElementById("teacherSelect");
        if (select) {
            select.innerHTML = '<option value="">-- Aucun titulaire --</option>';
            teachers.forEach(t => {
                select.innerHTML += `<option value="${t.id}">${t.first_name} ${t.last_name}</option>`;
            });
        }
    } catch (e) { console.error(e); }
}

async function loadAcademicPeriods() {
    try {
        const periods = await apiRequest("/api/academic-periods/");
        const select = document.getElementById("periodSelect");
        if (select) {
            select.innerHTML = '<option value="">-- Sélectionner --</option>';
            periods.forEach(p => {
                const selected = (!isEditing && p.is_current) ? 'selected' : '';
                select.innerHTML += `<option value="${p.id}" ${selected}>${p.name}</option>`;
            });
        }
    } catch (e) { console.error(e); }
}

async function deleteClass(id) {
    if (!confirm("Supprimer cette classe ?")) return;
    try {
        await apiRequest(`/api/academia/classes/${id}/`, "DELETE");
        loadClasses();
    } catch (e) { alert(e.message); }
}