// Récupérer l'ID de la classe depuis l'URL (ex: ?id=5&name=6èmeA)
const urlParams = new URLSearchParams(window.location.search);
const CLASS_ID = urlParams.get('id');
const CLASS_NAME = urlParams.get('name');

if (!CLASS_ID) {
    alert("Classe non spécifiée !");
    window.location.href = "classes_list.html";
}

document.getElementById("classNameDisplay").textContent = CLASS_NAME || "Classe inconnue";

document.addEventListener("DOMContentLoaded", () => {
    loadDropdowns();
    loadAssignments();
    document.getElementById("assignmentForm").addEventListener("submit", handleAssignmentSubmit);
});

// 1. Charger les Selects (Cours et Profs)
async function loadDropdowns() {
    try {
        const [courses, teachers] = await Promise.all([
            apiRequest("/api/academia/courses/"),
            apiRequest("/api/school/users/?user_type=teacher")
        ]);

        const courseSelect = document.getElementById("courseSelect");
        const teacherSelect = document.getElementById("teacherSelect");

        courseSelect.innerHTML = '<option value="">-- Choisir un cours --</option>';
        courses.forEach(c => {
            courseSelect.innerHTML += `<option value="${c.id}">${c.name} (${c.code || ''})</option>`;
        });

        teacherSelect.innerHTML = '<option value="">-- Aucun (Vacant) --</option>';
        teachers.forEach(t => {
            teacherSelect.innerHTML += `<option value="${t.id}">${t.first_name} ${t.last_name}</option>`;
        });

    } catch (e) {
        console.error("Erreur chargement listes:", e);
    }
}

// 2. Charger la liste des cours assignés à CETTE classe
async function loadAssignments() {
    const table = document.getElementById("assignmentsTable");
    table.innerHTML = '<tr><td colspan="4" class="p-4 text-center">Chargement...</td></tr>';

    try {
        // L'API doit supporter le filtre ?classe_id=X (Voir Modif Views plus haut)
        const assignments = await apiRequest(`/api/academia/assignments/?classe_id=${CLASS_ID}`);
        
        table.innerHTML = "";
        if (assignments.length === 0) {
            table.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-gray-500">Aucun cours assigné pour le moment.</td></tr>';
            return;
        }

        assignments.forEach(assign => {
            const tr = document.createElement("tr");
            tr.className = "hover:bg-gray-50 dark:hover:bg-slate-700";
            tr.innerHTML = `
                <td class="p-4 font-medium">${assign.course_name}</td>
                <td class="p-4 ${!assign.teacher ? 'text-orange-500' : ''}">
                    ${assign.teacher_name || "⚠️ Poste Vacant"}
                </td>
                <td class="p-4 text-center">
                    <span class="bg-indigo-100 text-indigo-800 text-xs font-bold px-2 py-1 rounded dark:bg-indigo-900 dark:text-indigo-200">
                        ${assign.weight}
                    </span>
                </td>
                <td class="p-4 text-right">
                    <button onclick="deleteAssignment(${assign.id})" class="text-red-600 hover:text-red-800 text-sm font-medium">
                        Retirer
                    </button>
                </td>
            `;
            table.appendChild(tr);
        });

    } catch (e) {
        table.innerHTML = `<tr><td colspan="4" class="p-4 text-red-600">Erreur: ${e.message}</td></tr>`;
    }
}

async function handleAssignmentSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    // On utilise les noms de champs exacts du modèle/serializer
    const payload = {
        classe: CLASS_ID, 
        course: formData.get("course"),
        teacher: formData.get("teacher") || null,
        weight: parseInt(formData.get("weight")) || 1,
        is_evaluative: formData.get("is_evaluative") === "on"
    };

    try {
        await apiRequest("/api/academia/assignments/", "POST", payload);
        e.target.reset();
        // Force le poids à 1 après le reset
        if(e.target.elements['weight']) e.target.elements['weight'].value = 1;
        loadAssignments(); 
    } catch (e) {
        // Affiche l'erreur réelle renvoyée par Django pour déboguer
        console.error("Erreur Serveur:", e);
        alert("Erreur : " + (e.message || "Vérifiez les données"));
    }
}

async function deleteAssignment(id) {
    if(!confirm("Retirer ce cours de la classe ?")) return;
    try {
        await apiRequest(`/api/academia/assignments/${id}/`, "DELETE");
        loadAssignments();
    } catch (e) {
        alert(e.message);
    }
}