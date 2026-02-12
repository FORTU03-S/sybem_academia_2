/**
 * SYBEM - Gestion du paramétrage des évaluations
 */

let configState = {
    assignmentId: null,
    assignmentData: null,
    gradingPeriods: [],
    systemType: 'SEMESTER' 
};

document.addEventListener('DOMContentLoaded', async function() {
    const urlParams = new URLSearchParams(window.location.search);
    const assignmentId = urlParams.get('id') || urlParams.get('assignment_id');

    if (!assignmentId) {
        window.location.href = '/static/dist/html/teacher/dashboard.html';
        return;
    }

    configState.assignmentId = assignmentId;
    
    // Chargement initial des données
    await loadAssignmentDetails(assignmentId);
    await loadGradingPeriods();
    setupEventListeners();
});

async function loadAssignmentDetails(id) {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`/api/academia/assignments/${id}/`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error("Erreur API");

        const data = await response.json();
        console.log("DEBUG DATA ASSIGNMENT:", data); // Regarde bien ce qui s'affiche ici

        configState.assignmentData = data;
        // On s'assure que c'est bien TRIMESTER ou SEMESTER
        configState.systemType = data.system_type; 

        document.getElementById('courseName').textContent = data.course_name;
        document.getElementById('className').textContent = data.classe_name;
        document.getElementById('weightBadge').textContent = `MAX: ${data.weight || 0} PTS`;

        // Force l'affichage du bon filtre
        toggleLevelFilters();

    } catch (error) {
        console.error("Erreur chargement détails:", error);
    }
}

async function loadGradingPeriods() {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch('/api/academia/grading-periods/', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        configState.gradingPeriods = await response.json();
    } catch (error) {
        console.error("Erreur périodes:", error);
    }
    
}

function toggleLevelFilters() {
    const sec = document.getElementById('secondaryFilters');
    const prim = document.getElementById('primaryFilters');
    
    if (configState.systemType === 'TRIMESTER') {
        sec?.classList.add('hidden');
        prim?.classList.remove('hidden');
    } else {
        sec?.classList.remove('hidden');
        prim?.classList.add('hidden');
    }
}

window.selectSemester = function(parentCode) {
    // 1. UI : État actif des boutons
    document.querySelectorAll('.semester-btn').forEach(btn => {
        btn.classList.remove('border-primary-500', 'bg-primary-50', 'text-primary-700', 'ring-2');
    });
    if (event) event.currentTarget.classList.add('border-primary-500', 'bg-primary-50', 'text-primary-700', 'ring-2');

    const select = document.getElementById('gradingPeriod');
    select.innerHTML = '<option value="">-- Choisir la période précise --</option>';
    
    // 2. Traduction du code (T1 -> Trimestre 1, S1 -> Semestre 1)
    const systemName = (configState.systemType === 'TRIMESTER') ? 'TRIMESTRE' : 'SEMESTRE';
    const periodNumber = parentCode.replace(/\D/g, ''); // Récupère juste le chiffre (1, 2, ou 3)

    // 3. Filtrage basé sur les noms du Signal
    const filtered = configState.gradingPeriods.filter(p => {
        if (!p.parent) return false; 
        
        const parentObj = configState.gradingPeriods.find(parent => parent.id === p.parent);
        if (!parentObj) return false;

        const parentName = parentObj.name.toUpperCase(); // Ex: "TRIMESTRE 1"

        // On vérifie si le nom du parent contient "TRIMESTRE" (ou Semestre) ET le bon chiffre
        return parentName.includes(systemName) && parentName.includes(periodNumber);
    });

    console.log(`Recherche : ${systemName} ${periodNumber}. Trouvés :`, filtered.length);

    // 4. Affichage
    if (filtered.length === 0) {
        select.add(new Option("Aucune période trouvée", ""));
    } else {
        filtered.forEach(p => {
            select.add(new Option(p.name, p.id));
        });
    }

    document.getElementById('periodSelectContainer').classList.remove('hidden');
    document.getElementById('parametersContainer').classList.remove('hidden');
};

function updatePreview() {
    const weight = parseFloat(document.getElementById('totalPoints').value);
    const count = parseInt(document.getElementById('evaluationCount').value);
    const periodId = document.getElementById('gradingPeriod').value;
    const typeLabel = document.getElementById('evaluationType').options[document.getElementById('evaluationType').selectedIndex].text.split(' /')[0];
    
    const btn = document.getElementById('submitConfig');
    const previewCard = document.getElementById('previewCard');

    if (weight > 0 && count > 0 && periodId) {
        const pointsPerEval = (weight / count).toFixed(2);
        document.getElementById('preview').textContent = `${count} x ${typeLabel}`;
        document.getElementById('pointsPerEval').textContent = `${pointsPerEval} pts`;
        
        // Activer le bouton
        previewCard.classList.remove('opacity-50');
        btn.disabled = false;
        btn.className = "w-full py-4 px-4 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 bg-primary-600 text-white hover:bg-primary-700 cursor-pointer";
    } else {
        btn.disabled = true;
        btn.className = "w-full py-4 px-4 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 bg-gray-200 text-gray-400 cursor-not-allowed";
        previewCard.classList.add('opacity-50');
    }
}

async function submitConfiguration() {
    const btn = document.getElementById('submitConfig');
    const weight = parseFloat(document.getElementById('totalPoints').value);
    const count = parseInt(document.getElementById('evaluationCount').value);
    const periodId = document.getElementById('gradingPeriod').value;
    const typeCode = document.getElementById('evaluationType').value;
    const typeLabel = document.getElementById('evaluationType').options[document.getElementById('evaluationType').selectedIndex].text.split(' /')[0];
    
    const pointsPerEval = (weight / count).toFixed(2);
    
    btn.disabled = true;
    btn.innerHTML = `<i class="animate-spin" data-lucide="loader-2"></i> Création...`;
    lucide.createIcons();

    try {
        for (let i = 1; i <= count; i++) {
            const payload = {
                teaching_assignment: parseInt(configState.assignmentId),
                grading_period: parseInt(periodId),
                name: `${typeLabel} ${i}`,
                max_score: parseFloat(pointsPerEval),
                weight: 1.00,
                is_published: true,
                date: new Date().toISOString().split('T')[0],
                evaluation_type: typeCode
            };

            const response = await fetch('/api/academia/evaluations/', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error(`Erreur lors de la création de la colonne ${i}`);
        } 

        Swal.fire({
            title: 'Succès !',
            text: `${count} colonnes d'évaluations ont été créées avec succès.`,
            icon: 'success',
            confirmButtonText: 'Accéder au cahier de cotes'
        }).then(() => {
            window.location.href = `/static/dist/html/teacher/gradebook.html?assignment_id=${configState.assignmentId}&period_id=${periodId}`;
        });

    } catch (error) {
        Swal.fire('Erreur', error.message, 'error');
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="save"></i> Générer les colonnes`;
        lucide.createIcons();
    }
}

function setupEventListeners() {
    // Écouter les changements pour mettre à jour l'aperçu en temps réel
    document.getElementById('totalPoints').addEventListener('input', updatePreview);
    document.getElementById('evaluationCount').addEventListener('input', updatePreview);
    document.getElementById('gradingPeriod').addEventListener('change', updatePreview);
    document.getElementById('evaluationType').addEventListener('change', updatePreview);

    // Écouter le clic sur le bouton de génération
    const submitBtn = document.getElementById('submitConfig');
    if (submitBtn) {
        submitBtn.addEventListener('click', submitConfiguration);
    }
}