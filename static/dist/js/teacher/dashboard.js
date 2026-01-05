document.addEventListener("DOMContentLoaded", loadTeacherDashboard);

async function loadTeacherDashboard() {
    const container = document.getElementById("classesContainer");
    container.innerHTML = "";

    try {
        const classes = await apiRequest("/api/academia/teacher/dashboard/");

        if (!classes.length) {
            container.innerHTML = `
                <p class="text-slate-500 col-span-full">
                    Aucun cours assigné pour le moment.
                </p>`;
            return;
        }

        classes.forEach(classe => {
            const card = document.createElement("div");
            card.className = `
                bg-white dark:bg-slate-800 rounded-xl shadow
                border-l-4 border-indigo-600 p-5
            `;

            const coursesHtml = classe.my_courses.map(course => `
                <div class="flex justify-between items-center py-2 border-b dark:border-slate-700 last:border-0">
                    <span class="text-slate-700 dark:text-slate-200 font-medium">
                        ${course.course_name}
                    </span>
                    <span class="text-xs px-2 py-1 rounded bg-indigo-100 text-indigo-700">
                        Coef ${course.weight}
                    </span>
                </div>
            `).join("");

            card.innerHTML = `
                <h3 class="text-lg font-bold text-slate-800 dark:text-white mb-1">
                    ${classe.name}
                </h3>
                <p class="text-xs text-slate-500 mb-4">
                    ${classe.academic_period}
                </p>

                <div class="space-y-1">
                    ${coursesHtml}
                </div>

                <button
                    onclick="goToClass(${classe.id})"
                    class="mt-4 w-full py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 transition">
                    Gérer notes / présences
                </button>
            `;

            container.appendChild(card);
        });

    } catch (e) {
        container.innerHTML = `
            <p class="text-red-600 col-span-full">
                Erreur de chargement des données
            </p>`;
        console.error(e);
    }
}

function goToClass(classId) {
    window.location.href = `/static/dist/html/teacher/class_detail.html?id=${classId}`;
}
