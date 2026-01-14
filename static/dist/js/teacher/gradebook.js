// static/dist/js/teacher/gradebook.js - Version Ultra Pro

async function apiRequest(endpoint, method = 'GET', body = null) {
    const token = localStorage.getItem('access_token');
    const baseUrl = 'http://localhost:8000'; // Ajuste selon ton serveur
    
    const options = {
        method,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    };

    if (body) options.body = JSON.stringify(body);

    const response = await fetch(`${baseUrl}${endpoint}`, options);
    
    if (response.status === 401) {
        window.location.href = '/static/dist/html/login.html';
        return;
    }

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Erreur API');
    }

    return await response.json();
}

let gradebookData = null;
let modifiedGrades = new Map();
let editMode = true;

// DOM Elements
const courseNameEl = document.getElementById('courseName');
const classNameEl = document.getElementById('className');
const studentsCountEl = document.getElementById('studentsCount');
const evaluationsCountEl = document.getElementById('evaluationsCount');
const gradesCountEl = document.getElementById('gradesCount');
const averageScoreEl = document.getElementById('averageScore');
const gradesTableBody = document.getElementById('gradesTableBody');
const evaluationsList = document.getElementById('evaluationsList');
const searchInput = document.getElementById('searchInput');
const addEvaluationBtn = document.getElementById('addEvaluationBtn');
const saveAllBtn = document.getElementById('saveAllBtn');
const exportBtn = document.getElementById('exportBtn');
const gradingPeriodFilter = document.getElementById('gradingPeriodFilter');


// Fonction utilitaire pour extraire l'ID peu importe l'URL
function getAssignmentIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    // On cherche en priorité 'id' ou 'assignment_id' dans l'URL (?id=5)
    const id = urlParams.get('id') || urlParams.get('assignment_id');
    if (id) return id;

    // Si pas de paramètre GET, on cherche dans le chemin (/5/)
    const pathSegments = window.location.pathname.split('/').filter(s => s !== "");
    const lastSegment = pathSegments[pathSegments.length - 1];
    const secondLastSegment = pathSegments[pathSegments.length - 2];

    // Retourne le dernier segment s'il est numérique, sinon l'avant-dernier
    if (/^\d+$/.test(lastSegment)) return lastSegment;
    if (/^\d+$/.test(secondLastSegment)) return secondLastSegment;

    return null;
}

// Load gradebook data
async function loadGradebook() {
    // UTILISATION DE LA NOUVELLE FONCTION
    const assignmentId = getAssignmentIdFromUrl();
    
    if (!assignmentId) {
        console.error("URL actuelle:", window.location.href); // Pour le debug
        showError('ID d\'assignation introuvable dans l\'URL');
        return;
    }

    try {
        // ... le reste de ton code reste identique ...
        // Show loading state
        showLoadingState();

        // Fetch gradebook data from API
        // FAUX : /api/academia/teaching_assignment/
        const data = await apiRequest(`/api/academia/assignments/${assignmentId}/gradebook/`);
        gradebookData = data;
        
        // Update UI
        updatePageHeader(data);
        updateStats(data);
        renderEvaluationsHeader(data);
        renderStudentsTable(data);
        renderEvaluationsList(data);
        
        // Add event listeners
        setupEventListeners();
        
    } catch (error) {
        console.error('Error loading gradebook:', error);
        showError('Erreur de chargement des données');
    }
}

function showLoadingState() {
    gradesTableBody.innerHTML = `
        <tr>
            <td colspan="10" class="py-12 text-center">
                <div class="inline-block p-4 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
                    <svg class="w-8 h-8 text-gray-400 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                </div>
                <p class="text-gray-600 dark:text-gray-400">Chargement des données...</p>
            </td>
        </tr>
    `;
}

function updatePageHeader(data) {
    if (data.assignment_info) {
        courseNameEl.textContent = data.assignment_info.course_name || 'Cours';
        classNameEl.textContent = data.assignment_info.classe_name || 'Classe';
    }
}

function updateStats(data) {
    const students = data.students || [];
    const evaluations = data.evaluations || [];
    const grades = data.grades || [];
    
    studentsCountEl.textContent = students.length;
    evaluationsCountEl.textContent = evaluations.length;
    gradesCountEl.textContent = grades.length;
    
    // Calculate average score
    const validGrades = grades.filter(g => g.score !== null && g.score !== undefined);
    if (validGrades.length > 0) {
        const total = validGrades.reduce((sum, grade) => sum + grade.score, 0);
        const average = (total / validGrades.length).toFixed(2);
        averageScoreEl.textContent = average;
    } else {
        averageScoreEl.textContent = '0.00';
    }
}

function renderEvaluationsHeader(data) {
    const evaluations = data.evaluations || [];
    const tableHead = document.querySelector('thead tr');
    
    // Clear existing evaluation headers (keep student column)
    const studentColumn = tableHead.querySelector('th:first-child');
    tableHead.innerHTML = '';
    tableHead.appendChild(studentColumn);
    
    // Add evaluation columns
    evaluations.forEach(evaluation => {
        const th = document.createElement('th');
        th.className = 'py-3 px-4 text-left text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700';
        th.innerHTML = `
            <div class="text-center space-y-1">
                <div class="font-medium truncate" title="${evaluation.name}">${evaluation.name}</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">
                    Max: ${evaluation.max_score} • Coef: ${evaluation.weight}
                </div>
                <div class="flex items-center justify-center gap-1">
                    <span class="status-badge ${evaluation.is_published ? 'status-published' : 'status-draft'}">
                        ${evaluation.is_published ? 'Publié' : 'Brouillon'}
                    </span>
                    <button onclick="editEvaluation(${evaluation.id})" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        <i class="fas fa-edit text-xs"></i>
                    </button>
                </div>
            </div>
        `;
        th.dataset.evaluationId = evaluation.id;
        tableHead.appendChild(th);
    });
    
    // Add average column
    const avgTh = document.createElement('th');
    avgTh.className = 'py-3 px-4 text-left text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700';
    avgTh.innerHTML = '<div class="text-center">Moyenne</div>';
    tableHead.appendChild(avgTh);
}

function renderStudentsTable(data) {
    const students = data.students || [];
    const evaluations = data.evaluations || [];
    const grades = data.grades || [];
    
    if (students.length === 0) {
        gradesTableBody.innerHTML = `
            <tr>
                <td colspan="${evaluations.length + 2}" class="py-12 text-center">
                    <div class="inline-block p-4 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
                        <i class="fas fa-users text-3xl text-gray-400"></i>
                    </div>
                    <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Aucun élève trouvé</h3>
                    <p class="text-gray-600 dark:text-gray-400">Aucun élève n'est inscrit à ce cours.</p>
                </td>
            </tr>
        `;
        return;
    }
    
    gradesTableBody.innerHTML = '';
    
    students.forEach((student, index) => {
        const tr = document.createElement('tr');
        tr.className = index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900/50';
        tr.dataset.studentId = student.student_id;
        
        // Student name cell
        const nameTd = document.createElement('td');
        nameTd.className = 'py-3 px-4 text-sm text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 sticky left-0 bg-inherit z-10';
        nameTd.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center text-white text-sm font-medium">
                    ${student.full_name.charAt(0)}
                </div>
                <div>
                    <div class="font-medium">${student.full_name}</div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">ID: ${student.student_id}</div>
                </div>
            </div>
        `;
        tr.appendChild(nameTd);
        
        // Grade cells for each evaluation
        let totalWeightedScore = 0;
        let totalWeight = 0;
        
        evaluations.forEach(evaluation => {
            const grade = grades.find(g => 
                g.enrollment === student.id && 
                g.evaluation === evaluation.id
            );
            
            const td = document.createElement('td');
            td.className = 'py-3 px-4 text-center border-b border-gray-200 dark:border-gray-700';
            td.dataset.evaluationId = evaluation.id;
            td.dataset.enrollmentId = student.id;
            
            if (grade && grade.score !== null && grade.score !== undefined) {
                // REMPLACE la partie interne de la boucle par ceci :
const score = grade ? grade.score : '';
const gradeId = grade ? grade.id : null; // Récupérer l'ID de la note existante
const maxScore = evaluation.max_score;

td.innerHTML = `
    <div class="relative">
        <input type="number"
               value="${score}"
               data-enrollment-id="${student.id}" 
               data-evaluation-id="${evaluation.id}"
               data-grade-id="${gradeId}" 
               min="0"
               max="${maxScore}"
               step="0.5"
               class="grade-input px-2 py-1 rounded ${bgColor} text-center font-medium w-16"
               onchange="updateGrade(${student.id}, ${evaluation.id}, this.value)"
               ${!editMode ? 'disabled' : ''}>
    </div>
`;
                
                totalWeightedScore += score * evaluation.weight;
                totalWeight += evaluation.weight;
            } else {
                td.innerHTML = `
                    <input type="number"
                           placeholder="--"
                           min="0"
                           max="${evaluation.max_score}"
                           step="0.5"
                           class="grade-input px-2 py-1 rounded bg-gray-50 dark:bg-gray-700 text-center w-16"
                           onchange="updateGrade(${student.id}, ${evaluation.id}, this.value)"
                           ${!editMode ? 'disabled' : ''}>
                `;
            }
            
            tr.appendChild(td);
        });
        
        // Average cell
        const avgTd = document.createElement('td');
        avgTd.className = 'py-3 px-4 text-center border-b border-gray-200 dark:border-gray-700 font-semibold';
        
        if (totalWeight > 0) {
            const average = (totalWeightedScore / totalWeight).toFixed(2);
            const average20 = (average / 20).toFixed(1);
            avgTd.innerHTML = `
                <div class="space-y-1">
                    <div class="text-lg ${average >= 10 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}">
                        ${average}
                    </div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">
                        ${average20}/20
                    </div>
                </div>
            `;
        } else {
            avgTd.innerHTML = '<span class="text-gray-400">--</span>';
        }
        
        tr.appendChild(avgTd);
        gradesTableBody.appendChild(tr);
    });
}

function renderEvaluationsList(data) {
    const evaluations = data.evaluations || [];
    
    if (evaluations.length === 0) {
        evaluationsList.innerHTML = `
            <div class="col-span-full text-center py-12">
                <div class="inline-block p-4 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
                    <i class="fas fa-clipboard-list text-3xl text-gray-400"></i>
                </div>
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Aucune évaluation</h3>
                <p class="text-gray-600 dark:text-gray-400 mb-6">Créez votre première évaluation.</p>
                <button onclick="showAddEvaluationModal()" 
                        class="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-blue-700 transition-all duration-300">
                    <i class="fas fa-plus mr-2"></i>
                    Créer une évaluation
                </button>
            </div>
        `;
        return;
    }
    
    evaluationsList.innerHTML = '';
    
    evaluations.forEach(evaluation => {
        const evaluationCard = document.createElement('div');
        evaluationCard.className = 'bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5';
        evaluationCard.innerHTML = `
            <div class="flex items-start justify-between mb-3">
                <div>
                    <h4 class="font-semibold text-gray-900 dark:text-white">${evaluation.name}</h4>
                    <p class="text-sm text-gray-600 dark:text-gray-400">${evaluation.evaluation_type || 'Évaluation'}</p>
                </div>
                <span class="status-badge ${evaluation.is_published ? 'status-published' : 'status-draft'}">
                    ${evaluation.is_published ? 'Publié' : 'Brouillon'}
                </span>
            </div>
            
            <div class="space-y-2 text-sm">
                <div class="flex justify-between">
                    <span class="text-gray-500 dark:text-gray-400">Date :</span>
                    <span class="font-medium">${new Date(evaluation.date).toLocaleDateString('fr-FR')}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-500 dark:text-gray-400">Note max :</span>
                    <span class="font-medium">${evaluation.max_score}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-500 dark:text-gray-400">Coefficient :</span>
                    <span class="font-medium">${evaluation.weight}</span>
                </div>
            </div>
            
            <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div class="flex gap-2">
                    <button onclick="editEvaluation(${evaluation.id})" 
                            class="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors">
                        <i class="fas fa-edit mr-1"></i> Modifier
                    </button>
                    <button onclick="deleteEvaluation(${evaluation.id})" 
                            class="px-3 py-2 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-800/50 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium transition-colors">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
        evaluationsList.appendChild(evaluationCard);
    });
}

function updateGrade(enrollmentId, evaluationId, value) {
    if (!editMode) return;
    
    const input = document.querySelector(`input[data-enrollment-id="${enrollmentId}"][data-evaluation-id="${evaluationId}"]`);
    if (!input) return;
    
    const score = value === '' ? null : parseFloat(value);
    const evaluation = gradebookData.evaluations.find(e => e.id === evaluationId);
    
    // Validation
    if (score !== null) {
        if (score < 0) {
            showNotification('La note ne peut pas être négative', 'error');
            input.value = '';
            return;
        }
        
        if (score > evaluation.max_score) {
            showNotification(`La note (${score}) dépasse le maximum autorisé (${evaluation.max_score})`, 'error');
            input.value = evaluation.max_score;
            return;
        }
    }
    
    // Store modified grade
    const key = `${enrollmentId}_${evaluationId}`;
    if (score !== null) {
        modifiedGrades.set(key, {
            enrollment: enrollmentId,
            evaluation: evaluationId,
            score: score
        });
        
        // Visual feedback
        input.classList.add('cell-modified');
        setTimeout(() => input.classList.remove('cell-modified'), 2000);
    } else {
        modifiedGrades.delete(key);
    }
    
    // Update save button state
    updateSaveButtonState();
}

async function saveAllGrades() {
    if (modifiedGrades.size === 0) {
        showNotification('Aucune modification à sauvegarder', 'info');
        return;
    }
    
    try {
        saveAllBtn.disabled = true;
        saveAllBtn.innerHTML = '<i class="fas fa-spinner animate-spin mr-2"></i> Sauvegarde en cours...';
        
        const grades = Array.from(modifiedGrades.values());
        const errors = [];
        
        // Save each grade
        for (const grade of grades) {
            try {
                await saveGrade(grade);
            } catch (error) {
                errors.push(`Erreur pour l'élève ${grade.enrollment}, évaluation ${grade.evaluation}: ${error.message}`);
            }
        }
        
        if (errors.length > 0) {
            showNotification(`Certaines notes n'ont pas pu être sauvegardées (${errors.length} erreurs)`, 'error');
            console.error('Save errors:', errors);
        } else {
            showNotification(`${grades.length} note(s) sauvegardée(s) avec succès`, 'success');
            modifiedGrades.clear();
            updateSaveButtonState();
            
            // Reload data to get updated averages
            setTimeout(() => loadGradebook(), 1000);
        }
        
    } catch (error) {
        console.error('Error saving grades:', error);
        showNotification('Erreur lors de la sauvegarde', 'error');
    } finally {
        saveAllBtn.disabled = false;
        saveAllBtn.innerHTML = '<i class="fas fa-save"></i> Sauvegarder tout';
    }
}

async function saveGrade(grade) {
    const token = localStorage.getItem('access_token');
    const url = grade.id ? `/api/academia/grades/${grade.id}/` : '/api/academia/grades/';
    const method = grade.id ? 'PUT' : 'POST';
    
    const response = await fetch(`http://localhost:8000${url}`, {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(grade)
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Erreur de sauvegarde');
    }
    
    return await response.json();
}

function updateSaveButtonState() {
    const saveBtn = document.getElementById('saveAllBtn');
    if (modifiedGrades.size > 0) {
        saveBtn.classList.remove('from-green-500', 'to-green-600');
        saveBtn.classList.add('from-amber-500', 'to-amber-600');
        saveBtn.innerHTML = `<i class="fas fa-save"></i> Sauvegarder (${modifiedGrades.size})`;
    } else {
        saveBtn.classList.remove('from-amber-500', 'to-amber-600');
        saveBtn.classList.add('from-green-500', 'to-green-600');
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Sauvegarder tout';
    }
}

function showAddEvaluationModal() {
    const modal = document.getElementById('addEvaluationModal');
    const modalContent = modal.querySelector('.bg-white, .dark\\:bg-gray-800');
    
    modalContent.innerHTML = `
        <div class="p-6">
            <div class="flex items-center justify-between mb-6">
                <h3 class="text-xl font-semibold text-gray-900 dark:text-white">Nouvelle évaluation</h3>
                <button onclick="closeModal()" class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                    <i class="fas fa-times text-gray-500"></i>
                </button>
            </div>
            
            <form id="evaluationForm" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nom de l'évaluation</label>
                    <input type="text" name="name" required 
                           class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800">
                </div>
                
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                        <select name="evaluation_type" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800">
                            <option value="INTERRO">Interrogation</option>
                            <option value="EXAMEN">Examen</option>
                            <option value="DEVOIR">Devoir</option>
                            <option value="PROJET">Projet</option>
                        </select>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                        <input type="date" name="date" required 
                               class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800">
                    </div>
                </div>
                
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Note maximale</label>
                        <input type="number" name="max_score" required min="0" step="0.5"
                               class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Coefficient</label>
                        <input type="number" name="weight" required min="0" step="0.1"
                               class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800">
                    </div>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                    <textarea name="description" rows="3"
                              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"></textarea>
                </div>
                
                <div class="flex items-center gap-2">
                    <input type="checkbox" name="is_published" id="is_published" class="rounded">
                    <label for="is_published" class="text-sm text-gray-700 dark:text-gray-300">Publier immédiatement</label>
                </div>
            </form>
            
            <div class="mt-6 flex gap-3">
                <button onclick="closeModal()" 
                        class="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors">
                    Annuler
                </button>
                <button onclick="createEvaluation()" 
                        class="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg font-medium transition-all duration-300">
                    Créer
                </button>
            </div>
        </div>
    `;
    
    modal.classList.remove('hidden');
}

function closeModal() {
    document.getElementById('addEvaluationModal').classList.add('hidden');
}

async function createEvaluation() {
    const form = document.getElementById('evaluationForm');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    
    const urlParams = new URLSearchParams(window.location.search);
    const assignmentId = urlParams.get('assignment_id') || urlParams.get('id');
    
    try {
        const evaluation = await apiRequest('/api/academia/evaluations/', 'POST', {
            ...data,
            teaching_assignment: assignmentId,
            max_score: parseFloat(data.max_score),
            weight: parseFloat(data.weight),
            is_published: data.is_published === 'on'
        });
        
        showNotification('Évaluation créée avec succès', 'success');
        closeModal();
        loadGradebook();
        
    } catch (error) {
        showNotification('Erreur lors de la création', 'error');
        console.error('Create evaluation error:', error);
    }
}

function toggleEditMode() {
    editMode = !editMode;
    const inputs = document.querySelectorAll('.grade-input');
    inputs.forEach(input => {
        input.disabled = !editMode;
    });
    
    const modeIndicator = document.querySelector('.bg-green-100');
    if (editMode) {
        modeIndicator.innerHTML = '<span class="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></span>Mode édition';
        showNotification('Mode édition activé', 'info');
    } else {
        modeIndicator.innerHTML = '<span class="w-2 h-2 bg-gray-500 rounded-full mr-2"></span>Mode consultation';
        showNotification('Mode consultation activé', 'info');
    }
}

function sortStudents() {
    const rows = Array.from(gradesTableBody.querySelectorAll('tr'));
    const currentOrder = gradesTableBody.innerHTML;
    
    rows.sort((a, b) => {
        const nameA = a.querySelector('td:first-child .font-medium').textContent;
        const nameB = b.querySelector('td:first-child .font-medium').textContent;
        return nameA.localeCompare(nameB);
    });
    
    gradesTableBody.innerHTML = '';
    rows.forEach(row => gradesTableBody.appendChild(row));
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 animate-slide-in-right ${
        type === 'error' ? 'bg-red-500 text-white' :
        type === 'success' ? 'bg-green-500 text-white' :
        'bg-blue-500 text-white'
    }`;
    
    notification.innerHTML = `
        <div class="flex items-center gap-3">
            <i class="fas fa-${type === 'error' ? 'exclamation-circle' : type === 'success' ? 'check-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

function showError(message) {
    gradesTableBody.innerHTML = `
        <tr>
            <td colspan="10" class="py-12 text-center">
                <div class="inline-block p-4 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
                    <i class="fas fa-exclamation-triangle text-3xl text-red-600 dark:text-red-400"></i>
                </div>
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Erreur</h3>
                <p class="text-gray-600 dark:text-gray-400 mb-6">${message}</p>
                <button onclick="loadGradebook()" 
                        class="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-lg font-medium transition-all duration-300">
                    <i class="fas fa-redo mr-2"></i> Réessayer
                </button>
            </td>
        </tr>
    `;
}

function setupEventListeners() {
    // Search functionality
    searchInput.addEventListener('input', debounce((e) => {
        const searchTerm = e.target.value.toLowerCase();
        const rows = gradesTableBody.querySelectorAll('tr');
        
        rows.forEach(row => {
            const studentName = row.querySelector('td:first-child .font-medium').textContent.toLowerCase();
            row.style.display = studentName.includes(searchTerm) ? '' : 'none';
        });
    }, 300));
    
    // Filter by grading period
    gradingPeriodFilter.addEventListener('change', (e) => {
        // Implement filter logic based on your API
        console.log('Filter by period:', e.target.value);
    });
    
    // Add evaluation button
    addEvaluationBtn.addEventListener('click', showAddEvaluationModal);
    
    // Export button
    exportBtn.addEventListener('click', () => {
        showNotification('Fonctionnalité d\'export à implémenter', 'info');
    });
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Initialize when DOM is loaded
// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const assignmentId = getAssignmentIdFromUrl();

    if (!assignmentId) {
        showError('ID d\'assignation manquant dans l\'URL');
    } else {
        loadGradebook();
    }
});

// Global functions for button clicks
window.toggleEditMode = toggleEditMode;
window.saveAllGrades = saveAllGrades;
window.showAddEvaluationModal = showAddEvaluationModal;
window.editEvaluation = (id) => {
    showNotification(`Modification de l'évaluation ${id} - À implémenter`, 'info');
};
window.deleteEvaluation = (id) => {
    if (confirm('Voulez-vous vraiment supprimer cette évaluation ? Cette action est irréversible.')) {
        showNotification(`Suppression de l'évaluation ${id} - À implémenter`, 'info');
    }
};