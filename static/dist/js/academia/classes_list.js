// C:\Users\user\sybem_academia2\sybem\static\dist\js\academia\classes_list.js

// 1. DÉCLARATIONS GLOBALES
let classesObserver = null;
let isEditing = false;
let currentClassId = null;

// 2. INITIALISATION PRINCIPALE
document.addEventListener('DOMContentLoaded', () => {
    // On lance l'init même si le DOM est déjà chargé (cas des scripts en fin de body)
    initClassesPage();
});

function initClassesPage() {
    console.log("🚀 Démarrage de l'initialisation...");
    
    try {
        initMobileSync();
        initModalEvents(); // C'est ici que le formulaire est "branché"
        loadClasses();
    } catch (error) {
        console.error("❌ Erreur critique init:", error);
    }
}

// 3. GESTION DE LA MODALE ET DU FORMULAIRE (Le cœur du problème)
function initModalEvents() {
    const openBtn = document.getElementById("openModalBtn");
    const closeBtn = document.getElementById("closeModalBtn");
    const form = document.getElementById("classForm");

    if (openBtn) openBtn.onclick = openCreateModal;
    if (closeBtn) closeBtn.onclick = closeModal;

    // --- CORRECTION MAJEURE ICI ---
    // On s'assure de supprimer les anciens écouteurs pour éviter les doublons
    if (form) {
        // On clone le noeud pour supprimer tous les event listeners précédents (méthode radicale mais efficace)
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        
        // On attache l'écouteur sur le nouveau formulaire propre
        newForm.addEventListener('submit', handleFormSubmit);
        console.log("✅ Écouteur 'submit' attaché au formulaire avec succès.");
    } else {
        console.error("⚠️ Formulaire #classForm introuvable !");
    }
}

// 4. SOUMISSION DU FORMULAIRE (Corrigée et Blindée)
async function handleFormSubmit(e) {
    // STOPPE LE RECHARGEMENT DE LA PAGE IMMÉDIATEMENT
    e.preventDefault(); 
    console.log("🛑 Soumission standard bloquée. Traitement JS en cours...");

    const form = e.target; // On récupère le formulaire qui a déclenché l'event
    const formData = new FormData(form);
    
    // Récupération sécurisée des valeurs
    const name = formData.get("name");
    const education_level = formData.get("education_level");
    const periodRaw = formData.get("academic_period_id"); // Attention au nom du champ dans le HTML
    const titulaireRaw = formData.get("titulaire_id");

    console.log("📝 Valeurs brutes:", { name, education_level, periodRaw, titulaireRaw });

    // Validation
    if (!periodRaw) {
        alert("Erreur : La période académique est obligatoire.");
        return;
    }

    // Construction du JSON
    const payload = {
        name: name,
        education_level: education_level,
        academic_period: parseInt(periodRaw, 10),
        titulaire_id: (titulaireRaw && titulaireRaw !== "") ? parseInt(titulaireRaw, 10) : null
    };

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.innerHTML = "Enregistrement...";
    submitBtn.disabled = true;

    try {
        const method = isEditing ? "PUT" : "POST";
        const url = isEditing ? `/api/academia/classes/${currentClassId}/` : "/api/academia/classes/";
        
        console.log(`📡 Envoi ${method} vers ${url}`, payload);

        await apiRequest(url, method, payload);
        
        console.log("✅ Succès !");
        closeModal();
        loadClasses(); // Recharger la liste
        
    } catch (error) {
        console.error("❌ Erreur API:", error);
        alert("Erreur lors de l'enregistrement : " + (error.message || "Erreur inconnue"));
    } finally {
        // Remettre le bouton normal
        if(submitBtn) {
            submitBtn.innerHTML = originalBtnText;
            submitBtn.disabled = false;
        }
    }
}

// 5. FONCTIONS API (Helpers)
async function loadClasses() {
    const table = document.getElementById("classesTable");
    if (!table) return;
    
    table.innerHTML = '<tr><td colspan="5" class="text-center p-8">Chargement...</td></tr>';

    try {
        // On récupère TOUTES les classes (le backend filtre déjà par école)
        const response = await apiRequest("/api/academia/classes/");
        const classes = Array.isArray(response) ? response : (response.results || []);
        
        table.innerHTML = "";

        if (classes.length === 0) {
            table.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-gray-500">Aucune classe trouvée.</td></tr>';
            return;
        }

        classes.forEach(classe => {
            const tr = document.createElement("tr");
            tr.className = "border-t dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition fade-in-row";
            tr.innerHTML = `
                <td class="p-4 font-medium text-slate-800 dark:text-white">${classe.name}</td>
                <td class="p-4 text-slate-600 dark:text-slate-300">${classe.education_level}</td>
                <td class="p-4 text-slate-600 dark:text-slate-300">${classe.academic_period_name || "-"}</td>
                <td class="p-4 text-slate-600 dark:text-slate-300">${classe.titulaire_name || "Non assigné"}</td>
                <td class="p-4 flex gap-3 justify-end">
                    <button onclick="openEditModal(${classe.id})" class="text-indigo-600 hover:text-indigo-800 font-medium">Modifier</button>
                    <button onclick="deleteClass(${classe.id})" class="text-red-600 hover:text-red-800 font-medium">Supprimer</button>
                </td>
            `;
            table.appendChild(tr);
        });
        
        // Refresh icons if needed
        if (window.lucide) window.lucide.createIcons();

    } catch (e) {
        console.error(e);
        table.innerHTML = `<tr><td colspan="5" class="p-4 text-red-600 text-center">Erreur de chargement</td></tr>`;
    }
}

// ... (Garder loadTeachers, loadAcademicPeriods, openCreateModal, openEditModal, toggleModal, deleteClass, initMobileSync inchangés ou les remettre ici si besoin) ...
// Pour être sûr, je remets les fonctions auxiliaires essentielles ci-dessous :

function openCreateModal() {
    isEditing = false;
    currentClassId = null;
    const form = document.getElementById("classForm");
    // Important: on réinitialise le formulaire mais ON GARDE l'event listener car on a cloné l'élément
    // Le plus simple est de reset les valeurs
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
        // Remplissage des champs...
        if(form.elements["name"]) form.elements["name"].value = data.name;
        if(form.elements["education_level"]) form.elements["education_level"].value = data.education_level;
        
        await Promise.all([loadTeachers(), loadAcademicPeriods()]);
        
        if (data.academic_period && form.elements["academic_period_id"]) 
            form.elements["academic_period_id"].value = data.academic_period;
            
        if (data.titulaire_id && form.elements["titulaire_id"]) 
            form.elements["titulaire_id"].value = data.titulaire_id;
            
    } catch (e) {
        console.error(e);
    }
}

function toggleModal(show) {
    const modal = document.getElementById("classModal");
    if (!modal) return;
    if (show) {
        modal.classList.remove("hidden");
        modal.classList.add("flex");
    } else {
        modal.classList.add("hidden");
        modal.classList.remove("flex");
    }
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
                // On pré-sélectionne la période en cours par défaut si c'est une création
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

// 3. SYNCHRONISATION MOBILE (Optimisée)

function initMobileSync() {

    const tableBody = document.getElementById('classesTable');

    const mobileContainer = document.getElementById('mobileClassesContainer');



    if (!tableBody || !mobileContainer) return;



    if (classesObserver) classesObserver.disconnect();



    const updateMobileView = () => {

        const rows = tableBody.querySelectorAll('tr');

        let html = '';



        rows.forEach((row) => {

            const cells = row.querySelectorAll('td');

            // On ne traite que les lignes qui ont les 5 colonnes (données réelles)

            if (cells.length >= 5) {

                const actions = cells[4].innerHTML;

                html += `

                    <div class="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-gray-100 dark:border-slate-700 shadow-sm mb-4">

                        <div class="flex justify-between items-start mb-3">

                            <h3 class="font-bold text-slate-800 dark:text-white text-lg">${cells[0].textContent}</h3>

                            <span class="px-2 py-1 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300 text-xs rounded-lg font-bold">

                                ${cells[1].textContent}

                            </span>

                        </div>

                        <div class="space-y-2 text-sm text-gray-600 dark:text-gray-400 mb-4">

                            <p class="flex items-center gap-2"><i data-lucide="calendar" class="w-4 h-4"></i> ${cells[2].textContent}</p>

                            <p class="flex items-center gap-2"><i data-lucide="user" class="w-4 h-4"></i> ${cells[3].textContent || '-'}</p>

                        </div>

                        <div class="flex justify-end gap-3 pt-3 border-t dark:border-slate-700">

                            ${actions}

                        </div>

                    </div>`;

            }

        });



        mobileContainer.innerHTML = html || '<p class="text-center text-gray-500 py-10">Aucune classe à afficher</p>';

        if (window.lucide) window.lucide.createIcons();

    };



    classesObserver = new MutationObserver(updateMobileView);

    classesObserver.observe(tableBody, { childList: true, subtree: true });

    updateMobileView();

}