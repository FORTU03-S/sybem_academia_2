// static/dist/js/teacher/dashboard.js
document.addEventListener("DOMContentLoaded", loadTeacherDashboard);

async function loadTeacherDashboard() {
    const container = document.getElementById("classesContainer");
    const emptyState = document.getElementById("emptyState");
    
    // Stats Elements
    const totalClassesEl = document.getElementById("totalClasses");
    const totalCoursesEl = document.getElementById("totalCourses");
    // Ajoute ici les ID de tes autres stats si tu les as dans ton HTML (ex: successRate)

    // Loading State
    container.innerHTML = `
        <div class="col-span-full text-center py-12">
            <div class="inline-block p-4 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
                <svg class="w-8 h-8 text-blue-600 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            </div>
            <p class="text-gray-600 dark:text-gray-400">Chargement du tableau de bord...</p>
        </div>`;

    try {
        const response = await apiRequest("/api/academia/teacher-dashboard/");
        
        // --- CORRECTION MAJEURE ICI ---
        // On sépare les stats et les classes
        const stats = response.stats;
        const classes = response.classes; 

        // 1. Mise à jour des Stats
        if(stats) {
            if(totalClassesEl) totalClassesEl.textContent = stats.total_classes || 0;
            if(totalCoursesEl) totalCoursesEl.textContent = stats.total_assignments || 0;
            // Tu peux ajouter d'autres stats ici :
            // document.getElementById("successRate").textContent = stats.success_rate + "%";
        }

        // 2. Gestion de l'état vide
        container.innerHTML = ""; // Clear loader
        
        if (!classes || classes.length === 0) {
            if(emptyState) emptyState.classList.remove("hidden");
            return;
        }

        if(emptyState) emptyState.classList.add("hidden");

        // 3. Rendu des cartes de classes
        classes.forEach((classe, index) => {
            const card = createClassCard(classe, index);
            container.appendChild(card);
        });

    } catch (e) {
        console.error("Dashboard loading error:", e);
        container.innerHTML = `
            <div class="col-span-full text-center py-12">
                <p class="text-red-500">Erreur lors du chargement des données.</p>
                <button onclick="loadTeacherDashboard()" class="mt-4 px-4 py-2 bg-blue-600 text-white rounded">Réessayer</button>
            </div>`;
    }
}

function createClassCard(classe, index) {
    const card = document.createElement("div");
    // Animation d'entrée
    card.className = `
        bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 
        overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300
        transform hover:-translate-y-1 opacity-0 animate-fade-in-up
    `;
    card.style.animation = `fadeInUp 0.5s ease-out forwards ${index * 0.1}s`;

    // Dégradés dynamiques
    const gradients = [
        "from-blue-600 to-blue-400",
        "from-purple-600 to-purple-400",
        "from-emerald-600 to-emerald-400",
        "from-amber-600 to-amber-400",
        "from-rose-600 to-rose-400"
    ];
    const gradientClass = gradients[index % gradients.length];

    // --- CORRECTION SÉCURITÉ ---
    // On vérifie que my_courses existe avant de map
    const courses = classe.courses || []; // Note: le Serializer renvoie 'courses', pas 'my_courses' (voir Serializer)

    // Dans dashboard.js
const coursesHtml = courses.length > 0 
    ? courses.map(c => `
        <div onclick="window.location.href='/static/dist/html/teacher/evaluations_setup.html?assignment_id=${c.assignment_id}'"
             class="flex items-center justify-between py-3 px-4 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-b border-gray-100 dark:border-gray-700 last:border-0 cursor-pointer group transition-colors">
            <div class="flex items-center gap-3">
                <div class="w-2 h-2 rounded-full bg-blue-500 group-hover:scale-125 transition-transform"></div>
                <span class="font-medium text-gray-700 dark:text-gray-200 text-sm group-hover:text-blue-600">${c.course_name}</span>
            </div>
            <div class="flex items-center gap-2">
                <span class="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-400">
                    Pond: ${c.weight}
                </span>
                <i data-lucide="settings" class="w-4 h-4 text-gray-400 group-hover:text-blue-500"></i>
            </div>
        </div>
    `).join("") 
    : `<div class="p-4 text-sm text-gray-500 italic">Aucun cours assigné.</div>`;

    card.innerHTML = `
        <div class="bg-gradient-to-r ${gradientClass} p-4 text-white">
            <div class="flex justify-between items-start">
                <div>
                    <h3 class="font-bold text-lg leading-tight">${classe.name}</h3>
                    <p class="text-blue-50 text-xs mt-1 opacity-90">${classe.academic_period || 'Période indéfinie'}</p>
                </div>
                <div class="bg-white/20 p-1.5 rounded-lg backdrop-blur-sm">
                    <span class="text-xs font-bold">${classe.success_rate}% Réussite</span>
                </div>
            </div>
        </div>
        
        <div class="grid grid-cols-2 border-b border-gray-100 dark:border-gray-700 divide-x divide-gray-100 dark:divide-gray-700">
            <div class="p-3 text-center">
                <span class="block text-xs text-gray-500 uppercase">Cours</span>
                <span class="font-bold text-gray-800 dark:text-white">${courses.length}</span>
            </div>
            <div class="p-3 text-center">
                <span class="block text-xs text-gray-500 uppercase">Sans notes</span>
                <span class="font-bold ${classe.students_without_grades > 0 ? 'text-amber-500' : 'text-green-500'}">
                    ${classe.students_without_grades}
                </span>
            </div>
        </div>

        <div class="max-h-48 overflow-y-auto custom-scrollbar">
            ${coursesHtml}
        </div>
        
        <div class="p-3 bg-gray-50 dark:bg-gray-900/30 border-t border-gray-100 dark:border-gray-700">
            <button onclick="window.location.href='/teacher/class/${classe.id}/gradebook/'" 
                class="w-full flex items-center justify-center gap-2 py-2 px-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 hover:border-blue-500 hover:text-blue-600 text-gray-600 dark:text-gray-300 rounded-lg transition-all text-sm font-medium shadow-sm hover:shadow">
                <span>Gérer le carnet de notes</span>
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
            </button>
        </div>
    `;

    return card;
}

// Ajoute ce CSS dans ton fichier style ou dans un tag <style> pour l'animation
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
    }
`;
document.head.appendChild(style);