
console.log("Envoi type:", name);

const API_TYPES_URL = '/api/finance/fee-types/';


const getHeaders = () => {
    const token = localStorage.getItem('access_token');
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
    };
};

document.addEventListener('DOMContentLoaded', loadTypes);


async function loadTypes() {
    const tableBody = document.getElementById('feeTypesTableBody');
    
    try {
        const response = await fetch(API_TYPES_URL, { headers: getHeaders() });
        
        if (!response.ok) throw new Error('Erreur réseau');
        
        const types = await response.json();
        const data = types.results || types; 

        tableBody.innerHTML = '';

        if (data.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="3" class="p-8 text-center text-slate-400 italic">Aucun type de frais enregistré.</td></tr>`;
            return;
        }

        data.forEach(t => {
            let statusBadge = '';
         
            if (t.status === 'PENDING') {
                statusBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                    <span class="w-1.5 h-1.5 mr-1.5 rounded-full bg-amber-500"></span> En attente
                </span>`;
            } else if (t.status === 'APPROVED') {
                statusBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    <span class="w-1.5 h-1.5 mr-1.5 rounded-full bg-green-500"></span> Approuvé
                </span>`;
            } else {
                statusBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400">
                    <span class="w-1.5 h-1.5 mr-1.5 rounded-full bg-rose-500"></span> Rejeté
                </span>`;
            }

            const row = `
                <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-100 dark:border-slate-800">
                    <td class="p-4 font-medium text-slate-900 dark:text-white capitalize">${t.name}</td>
                    <td class="p-4">${statusBadge}</td>
                    <td class="p-4 text-right">
                        ${t.status === 'PENDING' ? `
                            <button onclick="deleteType(${t.id})" class="p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors" title="Supprimer la demande">
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                        ` : '<span class="text-slate-300 dark:text-slate-700 text-xs">Verrouillé</span>'}
                    </td>
                </tr>
            `;
            tableBody.insertAdjacentHTML('beforeend', row);
        });

        if (typeof lucide !== 'undefined') lucide.createIcons();

    } catch (error) {
        console.error("Erreur chargement:", error);
        tableBody.innerHTML = `<tr><td colspan="3" class="p-8 text-center text-rose-500">Erreur lors de la récupération des données.</td></tr>`;
    }
}

function openTypeModal() {
    const modal = document.getElementById('typeModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.getElementById('typeNameInput').focus();
}

function closeTypeModal() {
    const modal = document.getElementById('typeModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.getElementById('typeNameInput').value = '';
}


async function saveType() {
    const nameInput = document.getElementById('typeNameInput');
    const btn = document.getElementById('btnSave');
    const name = nameInput.value.trim();

    if (!name) {
        alert("Veuillez saisir un nom pour le type de frais.");
        return;
    }

    
    btn.disabled = true;
    btn.classList.add('opacity-50', 'cursor-not-allowed');
    const originalText = document.getElementById('btnText').innerText;
    document.getElementById('btnText').innerText = "Envoi...";

    try {
        const response = await fetch(API_TYPES_URL, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ name: name })
        });

        if (response.ok) {
            closeTypeModal();
            loadTypes();

        } else {
            const errData = await response.json();
            alert("Erreur : " + (errData.name || "Impossible de créer ce type."));
        }
    } catch (error) {
        alert("Une erreur technique est survenue.");
    } finally {
        btn.disabled = false;
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
        document.getElementById('btnText').innerText = originalText;
    }
}


async function deleteType(id) {
    if (!confirm("Voulez-vous vraiment annuler cette proposition ?")) return;

    try {
        const response = await fetch(`${API_TYPES_URL}${id}/`, {
            method: 'DELETE',
            headers: getHeaders()
        });

        if (response.ok) {
            loadTypes();
        } else {
            alert("Suppression impossible.");
        }
    } catch (error) {
        console.error(error);
    }
}