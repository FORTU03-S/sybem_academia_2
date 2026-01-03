document.addEventListener("DOMContentLoaded", () => loadUsers());

async function loadUsers(filters = {}) {
    const table = document.getElementById("usersTable");
    table.innerHTML = "";

    // 🔹 construire les query params
    const params = new URLSearchParams(filters).toString();
    const url = params
        ? `/api/school/users/?${params}`
        : `/api/school/users/`;

    try {
        const users = await apiRequest(url);

        if (!users.length) {
            table.innerHTML = `
                <tr>
                    <td colspan="6" class="p-4 text-center text-slate-500">
                        Aucun utilisateur trouvé
                    </td>
                </tr>`;
            return;
        }

        users.forEach(user => {
            const tr = document.createElement("tr");
            tr.className = "border-t dark:border-slate-700";

            tr.innerHTML = `
                <td class="p-3 font-medium text-slate-800 dark:text-white">
                    ${user.first_name} ${user.last_name}
                </td>
                <td class="text-slate-600 dark:text-slate-300">${user.email}</td>
                <td>${user.user_type}</td>
                <td>${statusBadge(user.status)}</td>
                <td>${new Date(user.date_joined).toLocaleDateString()}</td>
                <td class="p-3 flex gap-3">
                    ${userActions(user)}
                </td>
            `;
            table.appendChild(tr);
        });

    } catch (e) {
        table.innerHTML = `
            <tr>
                <td colspan="6" class="p-4 text-red-600">${e.message}</td>
            </tr>`;
    }
}


function statusBadge(status) {
    const styles = {
        active: "bg-green-100 text-green-700",
        pending: "bg-yellow-100 text-yellow-700",
        disabled: "bg-red-100 text-red-700"
    };
    return `
        <span class="px-2 py-1 rounded text-xs ${styles[status] || ""}">
            ${status}
        </span>`;
}

/* =========================
   ACTIONS
========================= */

function userActions(user) {
    let actions = "";

    if (user.status === "pending") {
        actions += `
            <button onclick="approveUser(${user.id})"
                    class="text-green-600 hover:underline">
                Approuver
            </button>`;
    }

    if (user.status === "active") {
        actions += `
            <button onclick="disableUser(${user.id})"
                    class="text-yellow-600 hover:underline">
                Désactiver
            </button>`;
    }

    actions += `
        <button onclick="deleteUser(${user.id})"
                class="text-red-600 hover:underline">
            Supprimer
        </button>`;

    return actions;
}

/* =========================
   API CALLS
========================= */

async function approveUser(id) {
    if (!confirm("Approuver cet utilisateur ?")) return;
    await apiRequest(`/api/school/users/${id}/approve/`, "POST");
    loadUsers();
}

async function disableUser(id) {
    if (!confirm("Désactiver cet utilisateur ?")) return;
    await apiRequest(`/api/school/users/${id}/disable/`, "POST");
    loadUsers();
}

async function deleteUser(id) {
    if (!confirm("Supprimer définitivement cet utilisateur ?")) return;
    await apiRequest(`/api/school/users/${id}/`, "DELETE");
    loadUsers();
}

function applyFilters() {
    const search = document.getElementById("searchInput").value;
    const userType = document.getElementById("typeFilter").value;
    const startDate = document.getElementById("startDate").value;
    const endDate = document.getElementById("endDate").value;

    const filters = {};

    if (search) filters.search = search;
    if (userType) filters.user_type = userType;
    if (startDate) filters.start_date = startDate;
    if (endDate) filters.end_date = endDate;

    loadUsers(filters);
}

