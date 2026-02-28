

const API_BASE_URL = '/api'; //
const ENDPOINT_FEES = `${API_BASE_URL}/finance/fee-structures/`;
const ENDPOINT_CLASSES = `${API_BASE_URL}/academia/classes/`;
const ENDPOINT_FEE_TYPES = `${API_BASE_URL}/finance/fee-types/`; 

const getHeaders = () => {
    const token = localStorage.getItem('access_token');
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
    };
};

document.addEventListener('DOMContentLoaded', () => {
    loadDropdowns();
    loadFees();
});

// --- 1. CHARGEMENT DES DONNÉES ---

async function loadDropdowns() {
    try {
        
        const classRes = await fetch(ENDPOINT_CLASSES, { headers: getHeaders() });
        const classesData = await classRes.json();
        const classes = classesData.results || classesData;
        
        const classSelect = document.getElementById('classeSelect');
        const filterSelect = document.getElementById('filterClasse');
        
        classSelect.innerHTML = '<option value="">Choisir...</option>';
        filterSelect.innerHTML = '<option value="">Toutes les classes</option>';

        classes.forEach(c => {
           
            const opt1 = document.createElement('option');
            opt1.value = c.id;
            opt1.textContent = c.name;
            classSelect.appendChild(opt1);
            
            
            const opt2 = document.createElement('option');
            opt2.value = c.id;
            opt2.textContent = c.name;
            filterSelect.appendChild(opt2);
        });

       
        const typeRes = await fetch(ENDPOINT_FEE_TYPES, { headers: getHeaders() });
        const typesData = await typeRes.json();
        const types = typesData.results || typesData;

        const typeSelect = document.getElementById('feeTypeSelect');
        typeSelect.innerHTML = '<option value="">Choisir...</option>';
        
        types.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = t.name;
            typeSelect.appendChild(opt);
        });

    } catch (error) {
        console.error("Erreur chargement dropdowns:", error);
    }
}

async function loadFees() {
    const tableBody = document.getElementById('feesTableBody');
    const spinner = document.getElementById('loadingSpinner');
    const filterClasse = document.getElementById('filterClasse').value;
    
    tableBody.innerHTML = '';
    if(spinner) spinner.classList.remove('hidden');

    let url = ENDPOINT_FEES;
    if (filterClasse) url += `?classe=${filterClasse}`;

    try {
        const response = await fetch(url, { headers: getHeaders() });
        
        
        if (response.status === 403) {
            tableBody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-red-500 font-bold">Accès refusé. Vérifiez vos droits.</td></tr>`;
            return;
        }

        const data = await response.json();
        const fees = data.results || data;

        if (fees.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-500 italic">Aucun frais configuré.</td></tr>`;
            return;
        }

        fees.forEach(fee => {
            
            let dateDisplay = '-';
            if (fee.due_date) {
                const d = new Date(fee.due_date);
                dateDisplay = d.toLocaleDateString('fr-FR');
            }

                    
            const mandatoryBadge = fee.is_mandatory 
                ? `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Oui</span>`
                : `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300">Non</span>`;

            
            const row = `
                <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-gray-100 dark:border-slate-700">
                    <td class="p-4 font-medium text-slate-900 dark:text-white">
                        ${fee.classe_name || 'Classe inconnue'}
                    </td>
                    <td class="p-4 text-slate-600 dark:text-slate-300">
                        ${fee.fee_type_name || 'Type inconnu'}
                    </td>
                    <td class="p-4 text-primary-600 dark:text-primary-400 font-bold">
                        ${parseFloat(fee.amount).toFixed(2)} ${fee.currency}
                    </td>
                    <td class="p-4 text-slate-600 dark:text-slate-400">
                        ${dateDisplay}
                    </td>
                    <td class="p-4 text-center">
                        ${mandatoryBadge}
                    </td>
                    <td class="p-4 text-right">
                        <div class="flex items-center justify-end gap-2">
                            <button onclick="editFee(${fee.id})" class="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
                                <i data-lucide="edit-2" class="w-4 h-4"></i>
                            </button>
                            <button onclick="deleteFee(${fee.id})" class="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            tableBody.insertAdjacentHTML('beforeend', row);
        });

        
        if (typeof lucide !== 'undefined') lucide.createIcons();

    } catch (error) {
        console.error(error);
        tableBody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-red-500">Erreur de chargement.</td></tr>`;
    } finally {
        if(spinner) spinner.classList.add('hidden');
    }
}



function openCreateModal() {
    document.getElementById('feeForm').reset();
    document.getElementById('feeId').value = '';
    document.getElementById('feeModalTitle').textContent = "Configurer un nouveau frais";
    

    const modal = document.getElementById('feeModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

async function editFee(id) {
    try {
        const response = await fetch(`${ENDPOINT_FEES}${id}/`, { headers: getHeaders() });
        const fee = await response.json();

        document.getElementById('feeId').value = fee.id;
        document.getElementById('classeSelect').value = fee.classe;
        document.getElementById('feeTypeSelect').value = fee.fee_type;
        document.getElementById('amountInput').value = fee.amount;
        document.getElementById('currencySelect').value = fee.currency;
        document.getElementById('dueDateInput').value = fee.due_date || ''; 
        document.getElementById('academicPeriodInput').value = fee.academic_period;
        document.getElementById('isMandatoryCheck').checked = fee.is_mandatory;

        document.getElementById('feeModalTitle').textContent = "Modifier le frais";
        
        const modal = document.getElementById('feeModal');
        modal.classList.remove('hidden');
        modal.classList.add('flex');

    } catch (error) {
        alert("Impossible de charger les données.");
    }
}

async function saveFee() {
    const id = document.getElementById('feeId').value;
    const isUpdate = !!id;
    
    const payload = {
        classe: document.getElementById('classeSelect').value,
        fee_type: document.getElementById('feeTypeSelect').value,
        amount: document.getElementById('amountInput').value,
        currency: document.getElementById('currencySelect').value,
        due_date: document.getElementById('dueDateInput').value || null, 
        is_mandatory: document.getElementById('isMandatoryCheck').checked
    };

    const method = isUpdate ? 'PUT' : 'POST';
    const url = isUpdate ? `${ENDPOINT_FEES}${id}/` : ENDPOINT_FEES;

    try {
        const response = await fetch(url, {
            method: method,
            headers: getHeaders(),
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            closeModal();
            loadFees(); 
        } else {
            const err = await response.json();
            alert("Erreur: " + JSON.stringify(err));
        }
    } catch (error) {
        console.error(error);
        alert("Une erreur technique est survenue.");
    }
}

async function deleteFee(id) {
    if(!confirm("Êtes-vous sûr de vouloir supprimer ?")) return;

    try {
        const response = await fetch(`${ENDPOINT_FEES}${id}/`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        
        if (response.ok) {
            loadFees();
        } else {
            alert("Impossible de supprimer.");
        }
    } catch (error) {
        console.error(error);
    }
}