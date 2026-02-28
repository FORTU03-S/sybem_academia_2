const schoolId = new URLSearchParams(window.location.search).get("id");
const token = localStorage.getItem("access_token");

if (!token) {
    window.location.href = "/static/dist/html/login.html";
}

async function loadSchool() {
    const res = await fetch(`/api/schools/${schoolId}/`, {
        headers: { Authorization: `Token ${token}` }
    });

    const s = await res.json();

    document.getElementById("school-name").innerText = s.name;
    document.getElementById("school-code").innerText = s.code || "—";
    document.getElementById("school-created").innerText =
        new Date(s.created_at).toLocaleDateString();

    const badge = document.getElementById("school-status");
    badge.innerText = s.status;
    badge.className =
        "px-3 py-1 rounded-full text-xs font-semibold " +
        (s.status === "ACTIVE"
            ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
            : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300");
}

async function toggleStatus() {
    if (!confirm("Confirmer la désactivation ?")) return;

    await fetch(`/api/schools/${schoolId}/`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Token ${token}`
        },
        body: JSON.stringify({ status: "INACTIVE" })
    });

    loadSchool();
}

function openEdit() {
    alert("Édition à venir");
}

loadSchool();
