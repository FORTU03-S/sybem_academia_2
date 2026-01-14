// static/dist/js/teacher/dashboard.js - VERSION AMÉLIORÉE
document.addEventListener("DOMContentLoaded", loadTeacherDashboard);

async function loadTeacherDashboard() {
    const container = document.getElementById("classesContainer");
    const emptyState = document.getElementById("emptyState");
    const totalClassesEl = document.getElementById("totalClasses");
    const totalCoursesEl = document.getElementById("totalCourses");
    
    // Reset container with loading state
    container.innerHTML = `
        <div class="col-span-full text-center py-12">
            <div class="inline-block p-4 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
                <svg class="w-8 h-8 text-gray-400 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            </div>
            <p class="text-gray-600 dark:text-gray-400">Chargement de vos classes...</p>
        </div>`;

    try {
        const classes = await apiRequest("/api/academia/teacher/dashboard/");

        // Hide loading and empty state
        container.innerHTML = "";
        emptyState.classList.add("hidden");

        if (!classes || classes.length === 0) {
            emptyState.classList.remove("hidden");
            totalClassesEl.textContent = "0";
            totalCoursesEl.textContent = "0";
            return;
        }

        // Calculate totals
        let totalCourses = 0;
        classes.forEach(classe => {
            totalCourses += classe.my_courses.length;
        });
        
        totalClassesEl.textContent = classes.length;
        totalCoursesEl.textContent = totalCourses;

        // Render classes
        classes.forEach((classe, index) => {
            const card = createClassCard(classe, index);
            container.appendChild(card);
        });

        // Trigger animation event
        document.dispatchEvent(new Event('dashboardDataLoaded'));

    } catch (e) {
        container.innerHTML = `
            <div class="col-span-full text-center py-12">
                <div class="inline-block p-4 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
                    <svg class="w-12 h-12 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                </div>
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Erreur de chargement</h3>
                <p class="text-gray-600 dark:text-gray-400 mb-6">Impossible de charger vos données</p>
                <button onclick="loadTeacherDashboard()" 
                        class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
                    Réessayer
                </button>
            </div>`;
        console.error("Dashboard loading error:", e);
    }
}

function createClassCard(classe, index) {
    const card = document.createElement("div");
    card.className = `
        bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 
        overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300
        transform hover:-translate-y-1
        animate-slide-up
    `;
    card.style.animationDelay = `${index * 0.1}s`;

    // Color gradient based on class index
    const gradients = [
        "from-blue-500 to-blue-600",
        "from-purple-500 to-purple-600",
        "from-green-500 to-green-600",
        "from-amber-500 to-amber-600",
        "from-pink-500 to-pink-600"
    ];
    const gradientClass = gradients[index % gradients.length];

    const coursesHtml = classe.my_courses.map(course => `
        <div class="flex items-center justify-between py-3 px-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0">
            <div class="flex items-center gap-3">
                <div class="p-2 rounded-lg bg-gray-100 dark:bg-gray-700">
                    <svg class="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                    </svg>
                </div>
                <div>
                    <h4 class="font-medium text-gray-900 dark:text-white">${course.course_name}</h4>
                    <p class="text-xs text-gray-500 dark:text-gray-400">Code: ${course.course_id}</p>
                </div>
            </div>
            <span class="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-sm font-medium">
                Coef ${course.weight}
            </span>
        </div>
    `).join("");

    card.innerHTML = `
        <!-- Header with gradient -->
        <div class="bg-gradient-to-r ${gradientClass} p-6">
            <div class="flex items-center justify-between">
                <div>
                    <h3 class="text-xl font-bold text-white mb-1">${classe.name}</h3>
                    <p class="text-blue-100 text-sm">${classe.academic_period}</p>
                </div>
                <div class="p-2 bg-white/20 rounded-lg">
                    <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                    </svg>
                </div>
            </div>
        </div>
        
        <!-- Courses List -->
        <div class="divide-y divide-gray-100 dark:divide-gray-700">
            ${coursesHtml}
        </div>
        
        <!-- Actions -->
        <div class="p-4 bg-gray-50 dark:bg-gray-900/50">
            <button
                onclick="goToClass(${classe.id})"
                class="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 
                       text-white font-medium rounded-lg transition-all duration-300 
                       flex items-center justify-center gap-2 group">
                <svg class="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                </svg>
                Gérer notes & présences
            </button>
        </div>
    `;

    return card;
}

function goToClass(classId) {
    window.location.href = `/static/dist/html/teacher/class_detail.html?id=${classId}`;
}

// Refresh button functionality
if (typeof window !== 'undefined') {
    window.refreshDashboard = function() {
        loadTeacherDashboard();
    };
}

const data = await apiRequest("/api/academia/teacher/dashboard/");
const stats = data.stats;
const classes = data.classes;

totalClassesEl.textContent = stats.total_classes;
totalCoursesEl.textContent = stats.total_assignments;
