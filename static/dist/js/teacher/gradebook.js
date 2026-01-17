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

// ... Garde tes fonctions renderGradebookTable, calculateTotal et saveAllGrades identiques ...



/* ==============================

   RENDU DU TABLEAU (INCHANGÉ)

================================ */

function renderGradebookTable() {
    const headerRow = document.getElementById('dynamicHeaders');
    const body = document.getElementById('gradebookBody');
    // On extrait les données globales
    const { students, evaluations, grades } = gradebookData;

    headerRow.innerHTML = '';
    body.innerHTML = '';

    if (!students || students.length === 0) {
        body.innerHTML = '<tr><td colspan="99" class="text-center py-10">Aucun élève inscrit dans cette classe.</td></tr>';
        return;
    }

    // 1. Génération des En-têtes (Headers)
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

    // 2. Génération des Lignes Élèves
    students.forEach(student => {
        let rowHtml = `
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                <td class="px-4 py-3 font-medium sticky left-0 bg-white dark:bg-gray-800 z-10 border-r">
                    ${student.full_name}
                </td>`;

        evaluations.forEach(ev => {
            // IMPORTANT : On compare l'ID de l'inscription (enrollment)
            // Dans ton JSON, l'id de l'élève est student.id (qui est en fait l'enrollment_id)
            const gradeObj = grades.find(g => 
                g.enrollment === student.id && g.evaluation === ev.id
            );

            const scoreValue = gradeObj ? gradeObj.score : '';

            rowHtml += `
                <td class="p-2 text-center">
                    <input type="number" 
                        class="grade-input w-16 text-center bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded"
                        step="0.5" min="0" max="${ev.max_score}"
                        value="${scoreValue}"
                        data-enrollment="${student.id}"
                        data-evaluation="${ev.id}"
                        onchange="calculateTotal(${student.id})">
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

    // Mise à jour du max global dans l'UI
    const maxLabel = document.getElementById('maxPeriodPoints');
    if (maxLabel) maxLabel.textContent = maxTotalPoints;
}



/* ==============================

   CALCUL TOTAL (INCHANGÉ)

================================ */

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



/* ==============================

   SAUVEGARDE BULK (INCHANGÉ)

================================ */

window.saveAllGrades = async function () {

    const payload = [];



    document.querySelectorAll('.grade-input').forEach(input => {

        if (input.value !== '') {

            payload.push({

                enrollment: Number(input.dataset.enrollment),

                evaluation: Number(input.dataset.evaluation),

                score: Number(input.value)

            });

        }

    });



    if (!payload.length) {

        Swal.fire('Info', 'Aucune note à enregistrer', 'info');

        return;

    }



    try {

        await fetchAPI('/api/academia/grades/bulk-save/', {

            method: 'POST',

            body: JSON.stringify(payload)

        });



        Swal.fire('Succès', 'Notes enregistrées avec succès', 'success');

    } catch (err) {

        console.error(err);

        Swal.fire('Erreur', 'Échec de sauvegarde', 'error');

    }

};

