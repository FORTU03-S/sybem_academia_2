/**
 * SYBEM ACADEMIA - Cahier de cotes
 * Correction du chargement des sélecteurs
 */

let gradebookData = {
    assignment_info: null,
    students: [],
    evaluations: [],
    grades: []
};

document.addEventListener('DOMContentLoaded', async () => {
    console.log("📘 Initialisation du Gradebook");
    
    // Initialisation des icônes Lucide
    if (window.lucide) lucide.createIcons();

    // On charge les sélecteurs en parallèle
    await Promise.all([
        loadTeacherAssignments(),
        loadGradingPeriods()
    ]);

    // Gestion des paramètres URL (si on arrive d'une autre page)
    const params = new URLSearchParams(window.location.search);
    const assignmentId = params.get('assignment_id');
    if (assignmentId) {
        const select = document.getElementById('courseSelect');
        select.value = assignmentId;
        loadGradebook(); 
    }
});

/* ============================================================
   1. CHARGEMENT DES COURS (DEPUIS DASHBOARD STATS)
   ============================================================ */
async function loadTeacherAssignments() {
    const select = document.getElementById('courseSelect');
    if (!select) return;

    try {
        // Appelle l'URL : /api/academia/teacher-dashboard/
        const data = await fetchAPI('/api/academia/teacher-dashboard/');
        console.log("Données Dashboard reçues:", data);

        select.innerHTML = '<option value="">-- Sélectionner un cours --</option>';

        if (data && data.classes) {
            data.classes.forEach(classe => {
                if (classe.courses) {
                    classe.courses.forEach(course => {
                        // Utilise assignment_id car c'est la PK de TeachingAssignment
                        const option = new Option(
                            `${course.course_name} — ${classe.name}`, 
                            course.assignment_id
                        );
                        select.add(option);
                    });
                }
            });
        }
    } catch (err) {
        console.error("❌ Erreur assignations:", err);
        select.innerHTML = '<option value="">Erreur de chargement</option>';
    }
}

/* ============================================================
   2. CHARGEMENT DES PÉRIODES (TRIMESTRE / SEMESTRE)
   ============================================================ */
async function loadGradingPeriods() {
    const select = document.getElementById('periodFilter');
    if (!select) return;

    try {
        // Appelle l'URL : /api/academia/grading-periods/
        const periods = await fetchAPI('/api/academia/grading-periods/');
        console.log("Périodes reçues:", periods);

        select.innerHTML = '<option value="">-- Choisir la période --</option>';

        if (Array.isArray(periods)) {
            periods.forEach(p => {
                select.add(new Option(p.name, p.id));
            });
        }
    } catch (err) {
        console.error("❌ Erreur périodes:", err);
    }
}

/* ============================================================
   3. CHARGEMENT DU TABLEAU DE NOTES
   ============================================================ */
async function loadGradebook() {
    const assignmentId = document.getElementById('courseSelect').value;
    const periodId = document.getElementById('periodFilter').value;

    // On ne charge que si les deux sont sélectionnés
    if (!assignmentId || !periodId) return;

    const tbody = document.getElementById('gradebookBody');
    tbody.innerHTML = `<tr><td colspan="99" class="text-center py-10">Chargement...</td></tr>`;

    try {
        // Appelle l'URL : /api/academia/assignments/{id}/gradebook/?period={id}
        const url = `/api/academia/assignments/${assignmentId}/gradebook/?period=${periodId}`;
        gradebookData = await fetchAPI(url);

        renderGradebookTable();
    } catch (err) {
        console.error("❌ Erreur Gradebook:", err);
        tbody.innerHTML = `<tr><td colspan="99" class="text-center text-red-500 py-10">Erreur de chargement des données.</td></tr>`;
    }
}



/* ==============================
   RENDU DU TABLEAU (MODIFIÉ)
================================ */
function renderGradebookTable() {
    const headerRow = document.getElementById('dynamicHeaders');
    const body = document.getElementById('gradebookBody');
    const { students, evaluations, grades } = gradebookData;

    headerRow.innerHTML = '';
    body.innerHTML = '';

    if (!students || students.length === 0) {
        body.innerHTML = '<tr><td colspan="99" class="text-center py-10">Aucun élève inscrit dans cette classe.</td></tr>';
        return;
    }

    // 1. En-têtes
    let headerHtml = `<th class="px-6 py-4 sticky left-0 bg-gray-50 dark:bg-gray-800 z-10 border-r">Nom de l'Élève</th>`;
    let maxTotalPoints = 0;

    evaluations.forEach(ev => {
        maxTotalPoints += parseFloat(ev.max_score);
        headerHtml += `
            <th class="text-center px-4 py-3 min-w-[100px]">
                <span class="text-xs font-bold text-primary-600">${ev.evaluation_type || 'EVAL'}</span><br>
                <span class="text-sm">${ev.name}</span><br>
                <span class="text-xs text-gray-400">/${ev.max_score}</span>
            </th>`;
    });

    headerHtml += `<th class="text-center font-bold bg-gray-100 dark:bg-gray-700">Total /${maxTotalPoints}</th>`;
    headerRow.innerHTML = headerHtml;

    // 2. Lignes Élèves
    students.forEach(student => {
        let rowHtml = `
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                <td class="px-4 py-3 font-medium sticky left-0 bg-white dark:bg-gray-800 z-10 border-r">
                    ${student.full_name}
                </td>`;

        evaluations.forEach(ev => {
            const gradeObj = grades.find(g => 
                g.enrollment === student.id && g.evaluation === ev.id
            );

            // On stocke la valeur existante. Si pas de note, c'est une chaîne vide.
            const scoreValue = gradeObj ? gradeObj.score : '';
            
            // On détermine si le champ est "verrouillé" visuellement (optionnel, ici on le laisse éditable mais on bloque à la validation)
            const isExisting = scoreValue !== '';

            rowHtml += `
                <td class="p-2 text-center">
                    <input type="number" 
                        class="grade-input w-16 text-center bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded focus:ring-2 focus:ring-primary-500"
                        step="0.5" min="0" max="${ev.max_score}"
                        value="${scoreValue}"
                        
                        data-enrollment="${student.id}"
                        data-evaluation="${ev.id}"
                        data-max="${ev.max_score}"
                        data-original-value="${scoreValue}" 
                        
                        onchange="handleGradeChange(this, ${student.id})">
                </td>`;
        });

        rowHtml += `
            <td class="text-center font-bold text-primary-600">
                <span id="total-${student.id}">0</span>
            </td>
        </tr>`;

        body.insertAdjacentHTML('beforeend', rowHtml);
        calculateTotal(student.id);
    });

    const maxLabel = document.getElementById('maxPeriodPoints');
    if (maxLabel) maxLabel.textContent = maxTotalPoints;
}

/* ==============================

   CALCUL TOTAL (INCHANGÉ)

================================ */

/* ============================================================
   LOGIQUE DE VALIDATION ET DE DEMANDE DE MODIFICATION
   ============================================================ */
async function handleGradeChange(input, enrollmentId) {
    const newValue = parseFloat(input.value);
    const maxScore = parseFloat(input.dataset.max);
    // On récupère la valeur originale (celle qui vient de la DB)
    // Note: dataset stocke tout en string, donc "15" ou "" (vide)
    const originalValueStr = input.dataset.originalValue; 
    
    // 1. Validation de la Note Maximale
    if (!isNaN(newValue) && newValue > maxScore) {
        Swal.fire({
            icon: 'error',
            title: 'Note invalide',
            text: `La note (${newValue}) ne peut pas dépasser la pondération de l'évaluation (${maxScore}).`,
            confirmButtonColor: '#d33'
        });
        
        // Remettre la valeur précédente (ou vide si c'était vide)
        input.value = originalValueStr !== '' ? originalValueStr : '';
        calculateTotal(enrollmentId); // Recalculer pour corriger l'affichage total
        return; // On arrête tout
    }

    // 2. Gestion de la Modification d'une note existante
    // Si il y avait une valeur avant (originalValueStr n'est pas vide)
    // ET que la nouvelle valeur est différente de l'ancienne
    if (originalValueStr !== '' && input.value != originalValueStr) {
        
        // On bloque immédiatement : on remet l'ancienne valeur visuellement
        // pour empêcher la modification "sauvage"
        const attemptedValue = input.value;
        input.value = originalValueStr; 
        
        // Boîte de dialogue pour demander la justification
        const { value: reason } = await Swal.fire({
            title: 'Modification Restreinte',
            icon: 'warning',
            html: `
                <p class="text-sm text-gray-600 mb-4">
                    Vous tentez de modifier une note déjà enregistrée (${originalValueStr} ➔ ${attemptedValue}).<br>
                    Cette action nécessite une <b>approbation de la direction</b>.
                </p>
                <label class="block text-left text-xs font-bold mb-1">Motif de la modification :</label>
            `,
            input: 'textarea',
            inputPlaceholder: 'Ex: Erreur de saisie, copie réévaluée...',
            inputAttributes: {
                'aria-label': 'Motif de la modification'
            },
            showCancelButton: true,
            confirmButtonText: 'Envoyer la demande',
            cancelButtonText: 'Annuler',
            confirmButtonColor: '#f59e0b',
            inputValidator: (value) => {
                if (!value) {
                    return 'Vous devez écrire un motif explicatif !';
                }
            }
        });

        if (reason) {
            // L'utilisateur a rempli le motif et confirmé
            await sendModificationRequest({
                enrollment_id: enrollmentId,
                evaluation_id: input.dataset.evaluation,
                old_score: originalValueStr,
                new_score: attemptedValue,
                reason: reason
            });
        }
        
        // Dans tous les cas (annulé ou envoyé), on garde l'ancienne valeur dans l'input
        // tant que la direction n'a pas validé (ce qui débloquerait l'input coté serveur ou via rechargement)
        calculateTotal(enrollmentId);
        return;
    }

    // 3. Si tout est OK (nouvelle note valide), on met à jour le total
    calculateTotal(enrollmentId);
}

async function sendModificationRequest(data) {
    try {
        // On affiche un petit chargement
        Swal.fire({
            title: 'Envoi en cours...',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        // UTILISATION DE LA FONCTION GLOBALE QUI MARCHE
        // Elle va ajouter automatiquement le header Bearer + access_token
        const result = await fetchAPI('/api/academia/grades/request-change/', 'POST', data);

        // Si on arrive ici, c'est que fetchAPI n'a pas jeté d'erreur (response.ok était true)
        Swal.fire({
            icon: 'success',
            title: 'Demande envoyée',
            text: 'La direction a été notifiée de votre demande.',
            confirmButtonColor: '#10b981'
        });

    } catch (error) {
        console.error("Erreur Request Change:", error);
        
        // Gestion de l'erreur spécifique "Utilisateur non connecté" de ton api.js
        if (error.message === "Utilisateur non connecté") {
            Swal.fire('Session expirée', 'Veuillez vous reconnecter pour valider cette action.', 'error');
        } else {
            Swal.fire('Échec', error.message || 'Une erreur est survenue', 'error');
        }
    }
}

window.calculateTotal = function (enrollmentId) {

    let total = 0;



    document

        .querySelectorAll(`input[data-enrollment="${enrollmentId}"]`)

        .forEach(i => {

            const v = parseFloat(i.value);

            if (!isNaN(v)) total += v;

        });



    document.getElementById(`total-${enrollmentId}`).textContent = total.toFixed(2);

    updateStats();

};



/* ==============================

   STATISTIQUES (INCHANGÉ)

================================ */

function updateStats() {

    const max = Number(document.getElementById('maxPeriodPoints').textContent);

    let success = 0, warning = 0, danger = 0;



    document.querySelectorAll('[id^="total-"]').forEach(el => {

        const score = Number(el.textContent);

        if (score >= max * 0.6) success++;

        else if (score >= max * 0.4) warning++;

        else danger++;

    });



    document.getElementById('statSuccess').textContent = success;

    document.getElementById('statWarning').textContent = warning;

    document.getElementById('statDanger').textContent = danger;

}

window.saveAllGrades = async function () {
    const payload = [];
    
    // 1. Collecte des données
    document.querySelectorAll('.grade-input').forEach(input => {
        if (input.value !== '' && input.value !== null) {
            payload.push({
                enrollment: parseInt(input.dataset.enrollment),
                evaluation: parseInt(input.dataset.evaluation),
                score: parseFloat(input.value)
            });
        }
    });

    if (payload.length === 0) {
        return Swal.fire('Info', 'Aucune note saisie à sauvegarder.', 'info');
    }

    try {
        Swal.fire({
            title: 'Synchronisation...',
            text: 'Envoi des notes au serveur',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        // 2. Préparation des headers
        const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
        const csrftoken = getCookie('csrftoken');
        
        const headers = {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrftoken
        };

        // On ajoute l'Authorization seulement si le token existe et n'est pas "undefined"
        if (token && token !== "undefined") {
            headers['Authorization'] = `Bearer ${token}`;
        }

        // 3. Envoi de la requête
        const response = await fetch('/api/academia/grades/bulk-save/', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload)
        });

        // 4. Traitement de la réponse
        const result = await response.json();

        if (response.ok) {
            await Swal.fire({
                icon: 'success',
                title: 'Succès',
                text: 'Toutes les notes ont été synchronisées avec succès.',
                timer: 2000
            });
            
            // Mise à jour des valeurs de référence pour éviter les alertes de modification
            document.querySelectorAll('.grade-input').forEach(input => {
                input.dataset.originalValue = input.value;
            });
        } else {
            // Gestion des erreurs renvoyées par Django (400, 401, 403, etc.)
            let errorMsg = result.detail || result.error || "Erreur lors de la sauvegarde.";
            if (response.status === 401) errorMsg = "Session expirée. Veuillez vous reconnecter.";
            throw new Error(errorMsg);
        }

    } catch (err) {
        console.error("Erreur détaillée:", err);
        Swal.fire({
            icon: 'error',
            title: 'Échec de sauvegarde',
            text: err.message
        });
    }
};

/**
 * Fonction utilitaire pour récupérer le cookie CSRF de Django
 */
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