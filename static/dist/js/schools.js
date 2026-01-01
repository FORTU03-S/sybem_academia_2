// static/dist/js/schools.js
async function loadSchools() {
    const token = localStorage.getItem('access_token');
    if (!token) {
        console.warn("Token manquant, redirection login");
        window.location.href = '/static/dist/html/login.html';
        return;
    }

    console.log("Chargement des écoles (SuperAdmin)");

    try {
        const response = await fetch('/api/superadmin/schools/', {
            headers: {
                Authorization: `Bearer ${token}`,

                'Content-Type': 'application/json'
            }
        });

        console.log("Status API:", response.status);

        if (!response.ok) {
            const text = await response.text();
            console.error("Erreur API:", text);
            return;
        }

        const schools = await response.json();
        console.log("Écoles reçues:", schools);

        displaySchools(schools);

    } catch (error) {
        console.error("Erreur réseau:", error);
    }
}


function displaySchools(schools) {
    const tbody = document.getElementById('schools-table-body');
    const loadingRow = document.getElementById('loading-row');
    
    if (loadingRow) loadingRow.remove();
    
    if (schools.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    <i data-lucide="school" class="w-12 h-12 mx-auto mb-3 opacity-50"></i>
                    <p>Aucune école trouvée</p>
                </td>
            </tr>
        `;
        lucide.createIcons();
        return;
    }
    
    tbody.innerHTML = schools.map(school => `
        <tr>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="font-medium">${school.name}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-gray-600 dark:text-gray-400">${school.email || '-'}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-gray-600 dark:text-gray-400">${school.phone_number || '-'}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 py-1 text-xs rounded-full ${school.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">
                    ${school.status || 'inactive'}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button onclick="editSchool(${school.id})" class="text-primary hover:text-secondary mr-3">
                    <i data-lucide="edit" class="w-4 h-4"></i>
                </button>
                <button onclick="deleteSchool(${school.id})" class="text-red-600 hover:text-red-800">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </td>
        </tr>
    `).join('');
    
    lucide.createIcons();
}

function editSchool(id) {
    console.log('Éditer école:', id);
    // Implémenter l'édition
}

function deleteSchool(id) {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette école ?')) {
        console.log('Supprimer école:', id);
        // Implémenter la suppression
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadSchools();
});


function openSchoolModal() {
    const modal = document.getElementById('school-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeSchoolModal() {
    const modal = document.getElementById('school-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function showTab(tab) {
    document.querySelectorAll('.tab-content').forEach(el => {
        el.classList.add('hidden');
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    document.getElementById(`tab-${tab}`).classList.remove('hidden');
    event.target.classList.add('active');
}


// Exposer les fonctions globalement
window.loadSchools = loadSchools;
window.editSchool = editSchool;
window.deleteSchool = deleteSchool;