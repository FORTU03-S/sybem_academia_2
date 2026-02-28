document.addEventListener("DOMContentLoaded", () => {
    loadCourses();
    document.getElementById("courseForm").addEventListener("submit", handleCourseSubmit);
});

async function loadCourses() {
    const table = document.getElementById("coursesTable");
    try {
        const courses = await apiRequest("/api/academia/courses/");
        table.innerHTML = courses.map(c => `
            <tr class="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700">
                <td class="p-3 font-medium">${c.name}</td>
                <td class="p-3">${c.code || '-'}</td>
                <td class="p-3 text-right">
                    <button onclick='editCourse(${JSON.stringify(c)})' class="text-blue-500 mr-2">Éditer</button>
                    <button onclick="deleteCourse(${c.id})" class="text-red-500">Supprimer</button>
                </td>
            </tr>
        `).join("");
    } catch (e) {
        console.error(e);
    }
}


let isEditing = false;

function openCourseModal() {
    isEditing = false;
    document.getElementById("courseForm").reset();
    document.getElementById("modalTitle").innerText = "Nouveau Cours";
    document.getElementById("courseModal").classList.remove("hidden");
    document.getElementById("courseModal").classList.add("flex");
}

function closeCourseModal() {
    document.getElementById("courseModal").classList.add("hidden");
    document.getElementById("courseModal").classList.remove("flex");
}

function editCourse(course) {
    isEditing = true;
    const form = document.getElementById("courseForm");
    form.elements["id"].value = course.id;
    form.elements["name"].value = course.name;
    form.elements["code"].value = course.code;
    document.getElementById("modalTitle").innerText = "Modifier Cours";
    document.getElementById("courseModal").classList.remove("hidden");
    document.getElementById("courseModal").classList.add("flex");
}

async function handleCourseSubmit(e) {
    e.preventDefault();
    const data = new FormData(e.target);
    const payload = { name: data.get("name"), code: data.get("code") };
    const id = data.get("id");

    try {
        if (isEditing) {
            await apiRequest(`/api/academia/courses/${id}/`, "PUT", payload);
        } else {
            await apiRequest("/api/academia/courses/", "POST", payload);
        }
        closeCourseModal();
        loadCourses();
    } catch (err) { alert(err.message); }
}

async function deleteCourse(id) {
    if(confirm("Supprimer ce cours ?")) {
        await apiRequest(`/api/academia/courses/${id}/`, "DELETE");
        loadCourses();
    }
}