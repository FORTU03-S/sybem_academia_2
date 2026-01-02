document.addEventListener("DOMContentLoaded", () => {
    loadClasses();

    const modal = document.getElementById("classModal");
    const openBtn = document.getElementById("openModalBtn");
    const closeBtn = document.getElementById("closeModalBtn");
    const form = document.getElementById("classForm");

    // Ouvrir modal
    openBtn.addEventListener("click", () => {
        modal.classList.remove("hidden");
        modal.classList.add("flex");
    });

    // Fermer modal
    closeBtn.addEventListener("click", () => {
        modal.classList.add("hidden");
        modal.classList.remove("flex");
        form.reset();
    });

    // Soumettre formulaire
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const data = {
            name: form.name.value,
            education_level: form.education_level.value,
            academic_period_id: form.academic_period_id.value,
            school_id: form.school_id.value
        };

        try {
            await apiRequest("/api/academia/classes/", "POST", data);
            form.reset();
            modal.classList.add("hidden");
            modal.classList.remove("flex");
            loadClasses();
        } catch (err) {
            alert(err.message);
        }
    });
});

// ------------------------------
// LOAD CLASSES
// ------------------------------
async function loadClasses() {
    const table = document.getElementById("classesTable");
    table.innerHTML = "";

    try {
        const classes = await apiRequest("/api/academia/classes/");

        if (!classes.length) {
            table.innerHTML = `<tr>
                <td colspan="5" class="p-4 text-center text-slate-500 dark:text-slate-400">Aucune classe disponible.</td>
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
                    <button onclick="editClass(${classe.id})" class="text-blue-600 hover:underline transition">Modifier</button>
                    <button onclick="deleteClass(${classe.id})" class="text-red-600 hover:underline transition">Supprimer</button>
                </td>
            `;
            table.appendChild(tr);
        });

    } catch (err) {
        table.innerHTML = `<tr><td colspan="5" class="p-4 text-red-600">${err.message}</td></tr>`;
    }
}

// ------------------------------
// EDIT & DELETE
// ------------------------------
async function editClass(id) {
    const newName = prompt("Nouveau nom de la classe :");
    if (!newName) return;
    await apiRequest(`/api/academia/classes/${id}/`, "PUT", { name: newName });
    loadClasses();
}

async function deleteClass(id) {
    if (!confirm("Supprimer définitivement cette classe ?")) return;
    await apiRequest(`/api/academia/classes/${id}/`, "DELETE");
    loadClasses();
}
