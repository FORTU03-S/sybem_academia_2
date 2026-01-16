// État global
let configState = {
    assignmentId: null,
    assignmentData: null,
    gradingPeriods: [],
    schoolLevel: 'SECOND'
};

document.addEventListener('DOMContentLoaded', async function() {
    console.log("🚀 Initialisation de la configuration...");
    
    // Initialisation des icônes Lucide
    if (window.lucide) window.lucide.createIcons();

    // Récupération de l'ID depuis l'URL
    const urlParams = new URLSearchParams(window.location.search);
    const assignmentId = urlParams.get('id') || urlParams.get('assignment_id');

    console.log("ID du cours détecté:", assignmentId);

    if (!assignmentId) {
        Swal.fire({
            icon: 'warning',
            title: 'Sélection requise',
            text: 'Veuillez sélectionner un cours depuis le tableau de bord.',
            showConfirmButton: false,
            timer: 2000
        }).then(() => {
            window.location.href = '/static/dist/html/teacher/dashboard.html';
        });
        return;
    }

    configState.assignmentId = assignmentId;

    // Lancement du chargement
    await loadAssignmentDetails(assignmentId);
    await loadGradingPeriods();
    
    setupEventListeners();
});

/**
 * 1. Charge les infos du cours (Version sécurisée sans dépendance api.js pour le debug)
 */
async function loadAssignmentDetails(id) {
    const courseNameEl = document.getElementById('courseName');
    const classNameEl = document.getElementById('className');
    
    try {
        // 1. Récupération manuelle du token pour être sûr
        const token = localStorage.getItem('access_token') || localStorage.getItem('accessToken');
        
        if (!token) {
            throw new Error("Vous n'êtes pas connecté (Token manquant)");
        }

        console.log(`Tentative fetch: /api/academia/assignments/${id}/`);

        // 2. Appel direct (bypass fetchAPI pour tester)
        const response = await fetch(`/api/academia/assignments/${id}/`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        // 3. Gestion précise des erreurs HTTP
        if (!response.ok) {
            if (response.status === 404) throw new Error("Cours introuvable (404)");
            if (response.status === 403) throw new Error("Accès refusé (403)");
            if (response.status === 401) throw new Error("Session expirée (401)");
            throw new Error(`Erreur serveur: ${response.status}`);
        }

        const data = await response.json();
        console.log("Données reçues:", data);

        configState.assignmentData = data;
        configState.schoolLevel = data.classe_level === 'PRIMARY' ? 'PRIMAIRE' : 'SECOND';

        // 4. Mise à jour de l'interface
        courseNameEl.textContent = data.course_name || "Nom non défini";
        classNameEl.textContent = data.classe_name || "Classe non définie";
        document.getElementById('schoolName').textContent = data.school_name || "École";
        
        const badge = document.getElementById('weightBadge');
        if (badge) badge.textContent = `MAX: ${data.weight || 0} PTS`;

        toggleLevelFilters();

    } catch (error) {
        console.error("❌ ERREUR DETAILS:", error);
        
        // Affiche l'erreur explicite à l'écran
        courseNameEl.innerHTML = `<span class="text-red-500 text-sm">${error.message}</span>`;
        classNameEl.textContent = "Veuillez réessayer ou contacter l'admin.";
        
        Swal.fire({
            icon: 'error',
            title: 'Erreur de chargement',
            text: error.message
        });
    }
}

/**
 * 2. Charge les périodes
 */
async function loadGradingPeriods() {
    try {
        // Ici on essaie d'utiliser fetchAPI si dispo, sinon fallback
        let data;
        if (typeof fetchAPI !== 'undefined') {
            data = await fetchAPI('/api/academia/grading-periods/');
        } else {
            // Fallback manuel si api.js n'est pas chargé
            const token = localStorage.getItem('access_token');
            const res = await fetch('/api/academia/grading-periods/', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Erreur chargement périodes");
            data = await res.json();
        }
        
        configState.gradingPeriods = data;
        console.log("Périodes chargées:", data.length);
    } catch (error) {
        console.error("Erreur périodes:", error);
    }
}

/**
 * 3. Gestion de l'affichage Primaire/Secondaire
 */
function toggleLevelFilters() {
    const sec = document.getElementById('secondaryFilters');
    const prim = document.getElementById('primaryFilters');
    
    if (configState.schoolLevel === 'PRIMAIRE') {
        sec?.classList.add('hidden');
        prim?.classList.remove('hidden');
    } else {
        sec?.classList.remove('hidden');
        prim?.classList.add('hidden');
    }
}

/**
 * 4. Filtrage des périodes
 */
window.selectSemester = function(filter) {
    document.querySelectorAll('.semester-btn').forEach(btn => {
        btn.classList.remove('border-primary-500', 'bg-primary-50', 'text-primary-700', 'ring-2');
    });
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('border-primary-500', 'bg-primary-50', 'text-primary-700', 'ring-2');
    }

    const select = document.getElementById('gradingPeriod');
    select.innerHTML = '<option value="">-- Choisir la période --</option>';
    
    const search = filter.toUpperCase();
    let filtered = configState.gradingPeriods.filter(p => {
        const name = p.name ? p.name.toUpperCase() : "";
        return name.includes(search) || name.includes("PÉRIODE") || name.includes("EXAMEN");
    });

    if (filtered.length === 0) filtered = configState.gradingPeriods;

    filtered.forEach(p => {
        const opt = new Option(p.name, p.id);
        select.add(opt);
    });

    document.getElementById('periodSelectContainer').classList.remove('hidden');
    document.getElementById('parametersContainer').classList.add('hidden');
};

/**
 * 5. Écouteurs d'événements
 */
function setupEventListeners() {
    const periodSelect = document.getElementById('gradingPeriod');
    const totalPointsInput = document.getElementById('totalPoints');
    const countInput = document.getElementById('evaluationCount');
    const typeSelect = document.getElementById('evaluationType');
    const submitBtn = document.getElementById('submitConfig');

    if(periodSelect) {
        periodSelect.addEventListener('change', function() {
            const container = document.getElementById('parametersContainer');
            if (this.value) container.classList.remove('hidden');
            else container.classList.add('hidden');
            updatePreview();
        });
    }

    if(totalPointsInput) totalPointsInput.addEventListener('input', updatePreview);
    if(countInput) countInput.addEventListener('input', updatePreview);
    if(typeSelect) typeSelect.addEventListener('input', updatePreview);

    if(submitBtn) submitBtn.addEventListener('click', submitConfiguration);
}

/**
 * 6. Mise à jour de l'aperçu
 */
function updatePreview() {
    const weight = parseFloat(document.getElementById('totalPoints').value);
    const count = parseInt(document.getElementById('evaluationCount').value);
    const type = document.getElementById('evaluationType').value;
    const periodId = document.getElementById('gradingPeriod').value;
    
    const previewCard = document.getElementById('previewCard');
    const previewText = document.getElementById('preview');
    const pointsDisplay = document.getElementById('pointsPerEval');
    const submitBtn = document.getElementById('submitConfig');

    const isValid = periodId && !isNaN(weight) && weight > 0 && !isNaN(count) && count > 0;

    if (isValid) {
        const pointsPerCol = (weight / count);
        previewCard.classList.remove('opacity-50');
        previewText.textContent = `${count} x ${type}`;
        pointsDisplay.textContent = `${parseFloat(pointsPerCol.toFixed(2))} pts / col`;
        
        submitBtn.disabled = false;
        submitBtn.classList.remove('bg-gray-200', 'text-gray-400', 'cursor-not-allowed');
        submitBtn.classList.add('bg-primary-600', 'text-white', 'hover:bg-primary-700', 'cursor-pointer');
    } else {
        previewCard.classList.add('opacity-50');
        previewText.textContent = "En attente...";
        pointsDisplay.textContent = "--";
        
        submitBtn.disabled = true;
        submitBtn.classList.add('bg-gray-200', 'text-gray-400', 'cursor-not-allowed');
        submitBtn.classList.remove('bg-primary-600', 'text-white', 'hover:bg-primary-700', 'cursor-pointer');
    }
}

async function submitConfiguration() {
    const btn = document.getElementById('submitConfig');
    const weight = parseFloat(document.getElementById('totalPoints').value);
    const count = parseInt(document.getElementById('evaluationCount').value);
    const periodId = document.getElementById('gradingPeriod').value;
    const evalTypeLabel = document.getElementById('evaluationType').value; 
    
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-5 h-5"></i> Création...';

    const pointsPerEval = (weight / count);
    const token = localStorage.getItem('access_token');

    try {
        for (let i = 1; i <= count; i++) {
            // Logique de conversion des types vers les codes du modèle Django
            let typeCode = 'AU'; // Par défaut 'Autre'
            if (evalTypeLabel === 'Examen') typeCode = 'EX';
            else if (evalTypeLabel === 'Interrogation') typeCode = 'IN';
            else if (evalTypeLabel === 'Devoir') typeCode = 'DV';

            const payload = {
                teaching_assignment: parseInt(configState.assignmentId),
                grading_period: parseInt(periodId),
                name: `${evalTypeLabel} ${i}`,
                max_score: parseFloat(pointsPerEval.toFixed(2)),
                weight: 1.00, // On met 1.00 par défaut comme dans ton modèle
                is_published: true,
                date: new Date().toISOString().split('T')[0],
                evaluation_type: typeCode // Utilisation du CODE ('IN', 'EX', etc.)
            };
            
            console.log("Envoi du payload corrigé:", payload);

            const response = await fetch('/api/academia/evaluations/', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("Erreur serveur détaillée:", errorData);
                throw new Error(JSON.stringify(errorData));
            }
        }

        Swal.fire({
            title: 'Succès !',
            text: `${count} évaluation(s) créée(s) avec succès.`,
            icon: 'success'
        }).then(() => {
            window.location.href = `/static/dist/html/teacher/gradebook.html?assignment_id=${configState.assignmentId}&period_id=${periodId}`;
        });

    } catch (error) {
        console.error("Erreur complète:", error);
        Swal.fire('Erreur 400', `Le serveur a refusé les données : ${error.message}`, 'error');
        btn.disabled = false;
        btn.innerHTML = 'Réessayer';
    }
}

// Fonction utilitaire pour le CSRF (souvent requis par Django)
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