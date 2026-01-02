document.addEventListener("DOMContentLoaded", loadClasses);

// ------------------------------
// LOAD CLASSES
// ------------------------------
async function loadClasses() {
    const table = document.getElementById("classesTable");
    table.innerHTML = "";

    try {
        const classes = await apiRequest("/api/academia/classes/");

        if (classes.length === 0) {
            table.innerHTML = `
                <tr>
                    <td colspan="5" class="p-4 text-center text-slate-500 dark:text-slate-400">
                        Aucune classe disponible.
                    </td>
                </tr>`;
            return;
        }

        classes.forEach(classe => {
            const tr = document.createElement("tr");
            tr.className = "border-t dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-slate-800 transition";

            tr.innerHTML = `
                <td class="p-3 font-medium text-slate-800 dark:text-white">${classe.name}</td>
                <td class="text-slate-600 dark:text-slate-300">${classe.education_level}</td>
                <td>${classe.academic_period_id || "-"}</td>
                <td>${classe.titulaire_id || "-"}</td>
                <td class="p-3 flex gap-3">
                    ${classActions(classe)}
                </td>
            `;
            table.appendChild(tr);
        });

    } catch (e) {
        table.innerHTML = `
            <tr>
                <td colspan="5" class="p-4 text-red-600">${e.message}</td>
            </tr>`;
    }
}

// ------------------------------
// ACTIONS
// ------------------------------
function classActions(classe) {
    return `
        <button onclick="editClass(${classe.id})"
                class="text-blue-600 hover:underline transition">Modifier</button>
        <button onclick="deleteClass(${classe.id})"
                class="text-red-600 hover:underline transition">Supprimer</button>
    `;
}

// ------------------------------
// API CALLS
// ------------------------------
async function editClass(id) {
    const name = prompt("Nouveau nom de la classe :");
    if (!name) return;

    await apiRequest(`/api/academia/classes/${id}/`, "PUT", { name });
    loadClasses();
}

async function deleteClass(id) {
    if (!confirm("Supprimer définitivement cette classe ?")) return;
    await apiRequest(`/api/academia/classes/${id}/`, "DELETE");
    loadClasses();
}

// ------------------------------
// CREATE NEW CLASS
// ------------------------------
async function createClass() {
    const name = prompt("Nom de la classe :");
    if (!name) return;

    const education_level = prompt("Niveau d'éducation (PRIMARY, SECONDARY, UNIVERSITY, OTHER) :");
    const school_id = prompt("ID de l'école :");
    const academic_period_id = prompt("ID de la période académique :");

    if (!education_level || !school_id || !academic_period_id) return;

    await apiRequest("/api/academia/classes/", "POST", {
        name,
        education_level,
        school_id,
        academic_period_id
    });

    loadClasses();
}
