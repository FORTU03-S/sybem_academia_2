let gradebookData = {
    assignment_info: null,
    students: [],
    evaluations: [],
    grades: []
};

document.addEventListener('DOMContentLoaded', async () => {
    console.log("📘 Initialisation du Gradebook");
    
    if (window.lucide) lucide.createIcons();

    await Promise.all([
        loadTeacherAssignments(),
        loadGradingPeriods()
    ]);

    const params = new URLSearchParams(window.location.search);
    const assignmentId = params.get('assignment_id');
    if (assignmentId) {
        const select = document.getElementById('courseSelect');
        select.value = assignmentId;
        loadGradebook(); 
    }
});

async function loadTeacherAssignments() {
    const select = document.getElementById('courseSelect');
    if (!select) return;

    try {
        const data = await fetchAPI('/api/academia/teacher-dashboard/');
        console.log("Données Dashboard reçues:", data);

        select.innerHTML = '<option value="">-- Sélectionner un cours --</option>';

        if (data && data.classes) {
            data.classes.forEach(classe => {
                if (classe.courses) {
                    classe.courses.forEach(course => {
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
        console.error(" Erreur assignations:", err);
        select.innerHTML = '<option value="">Erreur de chargement</option>';
    }
}

async function loadGradingPeriods() {
    const select = document.getElementById('periodFilter');
    if (!select) return;

    try {
        const periods = await fetchAPI('/api/academia/grading-periods/');
        console.log("Périodes reçues:", periods);

        select.innerHTML = '<option value="">-- Choisir la période --</option>';

        if (Array.isArray(periods)) {
            periods.forEach(p => {
                select.add(new Option(p.name, p.id));
            });
        }
    } catch (err) {
        console.error(" Erreur périodes:", err);
    }
}

async function loadGradebook() {
    const assignmentId = document.getElementById('courseSelect').value;
    const periodId = document.getElementById('periodFilter').value;
    if (!assignmentId || !periodId) return;

    const tbody = document.getElementById('gradebookBody');
    tbody.innerHTML = `<tr><td colspan="99" class="text-center py-10">Chargement...</td></tr>`;

    try {
        const url = `/api/academia/assignments/${assignmentId}/gradebook/?period=${periodId}`;
        gradebookData = await fetchAPI(url);

        renderGradebookTable();
    } catch (err) {
        console.error(" Erreur Gradebook:", err);
        tbody.innerHTML = `<tr><td colspan="99" class="text-center text-red-500 py-10">Erreur de chargement des données.</td></tr>`;
    }
}

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

            const scoreValue = gradeObj ? gradeObj.score : '';
            
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


async function handleGradeChange(input, enrollmentId) {
    const newValue = parseFloat(input.value);
    const maxScore = parseFloat(input.dataset.max);
    
    const originalValueStr = input.dataset.originalValue; 
    
    if (!isNaN(newValue) && newValue > maxScore) {
        Swal.fire({
            icon: 'error',
            title: 'Note invalide',
            text: `La note (${newValue}) ne peut pas dépasser la pondération de l'évaluation (${maxScore}).`,
            confirmButtonColor: '#d33'
        });
        
        input.value = originalValueStr !== '' ? originalValueStr : '';
        calculateTotal(enrollmentId); 
        return; 
    }

    if (originalValueStr !== '' && input.value != originalValueStr) {
        
        const attemptedValue = input.value;
        input.value = originalValueStr; 
    
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
            
            await sendModificationRequest({
                enrollment_id: enrollmentId,
                evaluation_id: input.dataset.evaluation,
                old_score: originalValueStr,
                new_score: attemptedValue,
                reason: reason
            });
        }
        
        calculateTotal(enrollmentId);
        return;
    }

    calculateTotal(enrollmentId);
}

async function sendModificationRequest(data) {
    try {

        Swal.fire({
            title: 'Envoi en cours...',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        
        const result = await fetchAPI('/api/academia/grades/request-change/', 'POST', data);

        Swal.fire({
            icon: 'success',
            title: 'Demande envoyée',
            text: 'La direction a été notifiée de votre demande.',
            confirmButtonColor: '#10b981'
        });

    } catch (error) {
        console.error("Erreur Request Change:", error);
        
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
    
    document.querySelectorAll('.grade-input').forEach(input => {
        const val = input.value;

        if (val !== '' && val !== null) {
            payload.push({
                enrollment: parseInt(input.dataset.enrollment),
                evaluation: parseInt(input.dataset.evaluation),
                score: parseFloat(val)
            });
        }
    });

    if (payload.length === 0) {
        return Swal.fire('Info', 'Aucune note à sauvegarder.', 'info');
    }

    try {
        Swal.fire({
            title: 'Enregistrement...',
            text: 'Synchronisation avec le serveur',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        const result = await fetchAPI('/api/academia/grades/bulk-save/', 'POST', payload);

        //  Succès
        await Swal.fire({
            icon: 'success',
            title: 'Notes enregistrées !',
            text: result.message || 'La synchronisation est terminée.',
            timer: 2000,
            showConfirmButton: false
        });

        document.querySelectorAll('.grade-input').forEach(input => {
            input.dataset.originalValue = input.value;
        });

    } catch (err) {
        console.error("Erreur Bulk Save:", err);
        
        if (err.message === "Utilisateur non connecté") {
            Swal.fire('Session expirée', 'Veuillez vous reconnecter pour sauvegarder.', 'error');
        } else {
            Swal.fire('Échec', err.message || 'Une erreur est survenue lors de la sauvegarde.', 'error');
        }
    }
};

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