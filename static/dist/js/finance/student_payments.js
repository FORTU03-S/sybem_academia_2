

document.addEventListener('DOMContentLoaded', () => {
    
    lucide.createIcons();
    loadClasses();
    
   
    const dateInput = document.getElementById('p_date');
    if(dateInput) dateInput.valueAsDate = new Date();

 
    const searchInput = document.getElementById('searchInput');
    if(searchInput) {
        searchInput.addEventListener('input', debounce((e) => {
            loadStudents(e.target.value);
        }, 400));
    }
    
    
    const payForm = document.getElementById('paymentForm');
    if(payForm) payForm.addEventListener('submit', handlePaymentSubmit);

    const exemptForm = document.getElementById('exemptionForm');
    if(exemptForm) exemptForm.addEventListener('submit', handleExemptionSubmit);
});


let loadedStudents = []; 
let currentFees = []; 

// --- CHARGEMENT DES DONNÉES ---

async function loadClasses() {
    try {
        const res = await fetch('/api/academia/classes/', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem("access_token")}` }
        });
        const classes = await res.json();
        const select = document.getElementById('classFilter');
        if(select) {
            classes.forEach(c => {
                select.innerHTML += `<option value="${c.id}">${c.name}</option>`;
            });
        }
    } catch (e) { console.error("Erreur chargement classes:", e); }
}

async function loadStudents(searchQuery = "") {
    const classId = document.getElementById('classFilter').value;
    const tbody = document.getElementById('studentsTableBody');

    if (!classId && searchQuery.length < 2) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-500 italic">Veuillez sélectionner une classe ou taper au moins 2 lettres.</td></tr>`;
        document.getElementById('studentCountBadge').innerText = "0 Élèves";
        return;
    }

    tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center"><div class="animate-spin inline-block w-6 h-6 border-2 border-primary-500 rounded-full border-t-transparent"></div></td></tr>`;

    try {
        let url = `/api/pupils/students/?status=active`;
        if (classId) url += `&current_classe=${classId}`;
        if (searchQuery) url += `&search=${searchQuery}`;

        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem("access_token")}` }
        });
        const data = await res.json();
        loadedStudents = data.results || data;

        renderStudentTable(loadedStudents);
        document.getElementById('studentCountBadge').innerText = `${loadedStudents.length} Élèves trouvés`;

    } catch (error) {
        console.error("Erreur chargement élèves:", error);
        tbody.innerHTML = `<tr><td colspan="5" class="text-red-500 text-center p-4">Erreur lors du chargement des données.</td></tr>`;
    }
}

function renderStudentTable(students) {
    const tbody = document.getElementById('studentsTableBody');
    
    if (!students || students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-slate-500 italic">Aucun élève trouvé.</td></tr>';
        return;
    }

    tbody.innerHTML = students.map(student => {
        
        const fullName = [
            student.last_name, 
            student.middle_name, 
            student.first_name
        ].filter(Boolean).join(' ').toUpperCase();

        
        let imageUrl = student.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=6366f1&color=fff&bold=true`;

       
        const balance = parseFloat(student.balance || 0);
        const debt = parseFloat(student.debt || 0);
        const debtColor = debt > 0 ? 'text-red-600' : 'text-emerald-600';

        return `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b dark:border-slate-800">
                <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                        <img class="h-10 w-10 rounded-full object-cover border border-slate-200" src="${imageUrl}">
                        <div class="font-bold text-slate-900 dark:text-white text-sm">${fullName}</div>
                    </div>
                </td>
                <td class="px-6 py-4 font-mono text-xs text-slate-500">
                    ${student.student_id_code || '---'}
                </td>
                <td class="px-6 py-4">
                    <span class="px-2 py-1 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 text-xs font-medium">
                        ${student.current_classe ? (student.current_classe.name || student.current_classe) : 'N/A'}
                    </span>
                </td>
                <td class="px-6 py-4 text-right font-bold text-slate-700 dark:text-slate-300">
                    ${balance.toFixed(2)} $
                </td>
                <td class="px-6 py-4 text-right font-bold ${debtColor}">
                    ${debt.toFixed(2)} $
                </td>
                <td class="px-6 py-4">
                    <div class="flex justify-center gap-1">
                        <button onclick="preparePaymentModal(${student.id})" class="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Paiement">
                            <i data-lucide="banknote" class="w-5 h-5"></i>
                        </button>
                        <button onclick="prepareExemptionModal(${student.id})" class="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="Exonération">
                            <i data-lucide="percent" class="w-5 h-5"></i>
                        </button>
                        <button onclick="openHistoryModal(${student.id}, '${fullName.replace(/'/g, "\\'")}')" class="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors" title="Historique">
                            <i data-lucide="history" class="w-5 h-5"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    
    lucide.createIcons();
}



function preparePaymentModal(studentId) {
    const student = loadedStudents.find(s => s.id == studentId);
    if (student) openPaymentModal(student);
}

async function openPaymentModal(student) {
    document.getElementById('paymentForm').reset();
    document.getElementById('p_date').valueAsDate = new Date();
    document.getElementById('p_studentId').value = student.id;
    
    const photoUrl = student.photo || student.profile_picture || `https://ui-avatars.com/api/?name=${student.first_name}`;
    document.getElementById('modalStudentInfo').innerHTML = `
        <div class="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700 mb-4">
            <img src="${photoUrl}" class="w-12 h-12 rounded-full object-cover">
            <div>
                <h4 class="font-bold text-slate-800 dark:text-white">${student.first_name} ${student.last_name}</h4>
                <p class="text-xs text-slate-500 font-mono">${student.matricule || 'SANS MATRICULE'}</p>
            </div>
        </div>
    `;
    
    const feeSelect = document.getElementById('p_feeStructure');
    const modal = document.getElementById('paymentModal');
    modal.classList.replace('hidden', 'flex');

    await loadFeesForStudent(student, feeSelect);
}

async function loadFeesForStudent(student, selectElement) {
    try {
        let classId = document.getElementById('classFilter').value;
        const url = `/api/finance/fee-structures/?classe=${classId || ''}`;
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem("access_token")}` }
        });
        const fees = await res.json();
        currentFees = fees.results || fees;

        selectElement.innerHTML = '<option value="">-- Sélectionner le motif --</option>';
        currentFees.forEach(fee => {
            selectElement.innerHTML += `<option value="${fee.id}">${fee.fee_type_name} (${fee.amount} ${fee.currency})</option>`;
        });
    } catch (e) {
        selectElement.innerHTML = '<option>Erreur chargement</option>';
    }
}

function updateAmountFromFee() {
    const feeId = document.getElementById('p_feeStructure').value;
    const fee = currentFees.find(f => f.id == feeId);
    if (fee) {
        document.getElementById('p_amount').value = fee.amount;
        document.getElementById('p_currency').value = fee.currency;
    }
}

function closePaymentModal() {
    const modal = document.getElementById('paymentModal');
    modal.classList.replace('flex', 'hidden');
}



async function handlePaymentSubmit(e) {
    e.preventDefault();
    
   
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;
    
    const payload = {
        student: parseInt(document.getElementById('p_studentId').value),
        fee_structure: parseInt(document.getElementById('p_feeStructure').value),
        amount: parseFloat(document.getElementById('p_amount').value),
        currency: document.getElementById('p_currency').value,
        payment_method: document.getElementById('p_method').value,
        date_payment: document.getElementById('p_date').value, 
        transaction_type: 'INCOME', 
        status: 'APPROVED',
        exchange_rate_used: 1.0
    };

    try {
        
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="animate-spin inline-block w-4 h-4 border-2 border-white rounded-full border-t-transparent"></span>';

        const response = await fetch('/api/finance/transactions/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken'),
               
                'Authorization': `Bearer ${localStorage.getItem("access_token")}`
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok) {
            
            Swal.fire({
                icon: 'success',
                title: 'Paiement encaissé !',
                text: `Le solde de l'élève a été mis à jour.`,
                timer: 2000,
                showConfirmButton: false
            });

            
            closePaymentModal();

           
            const currentSearch = document.getElementById('searchInput').value;
            loadStudents(currentSearch);

        } else {
       
            console.error("Erreur Backend:", data);
            let errorMsg = "Vérifiez les informations saisies.";
            if (typeof data === 'object') {
                errorMsg = Object.values(data).flat().join(' | ');
            }
            Swal.fire('Erreur', errorMsg, 'error');
        }
    } catch (error) {
        console.error("Erreur réseau :", error);
        Swal.fire('Erreur', 'Impossible de contacter le serveur.', 'error');
    } finally {
        
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
    }
}



function prepareExemptionModal(studentId) {
    const student = loadedStudents.find(s => s.id == studentId);
    if (student) openExemptionModal(student);
}

async function openExemptionModal(student) {
    document.getElementById('exemptionForm').reset();
    document.getElementById('e_studentId').value = student.id;

    const photoUrl = student.photo || student.profile_picture || `https://ui-avatars.com/api/?name=${student.first_name}`;
    document.getElementById('exemptionStudentInfo').innerHTML = `
        <div class="flex items-center gap-4 bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl border border-purple-100 dark:border-purple-800/50 mb-6">
            <img src="${photoUrl}" class="w-16 h-16 rounded-full object-cover border-2 border-white shadow-md">
            <div>
                <h4 class="font-bold text-lg text-purple-900 dark:text-purple-300">${student.first_name} ${student.last_name}</h4>
                <p class="text-sm text-purple-600/80 font-mono">${student.matricule || 'SANS MATRICULE'}</p>
            </div>
        </div>
    `;

    const feeSelect = document.getElementById('e_feeStructure');
    const modal = document.getElementById('exemptionModal');
    modal.classList.replace('hidden', 'flex');
    
    await loadFeesForStudent(student, feeSelect);
    lucide.createIcons(); 
}

function toggleExemptionInputs(input) {
    if(input === 'amount') {
        document.getElementById('e_percentage').value = '';
    } else {
        document.getElementById('e_amount').value = '';
    }
}

function closeExemptionModal() {
    const modal = document.getElementById('exemptionModal');
    modal.classList.replace('flex', 'hidden');
}

async function handleExemptionSubmit(e) {
    e.preventDefault();
    
    const feeId = document.getElementById('p_feeStructure').value;
    if (!feeId) {
        return Swal.fire('Champ requis', 'Veuillez sélectionner le motif du paiement.', 'warning');
    }
    
    
    const feeStructureId = document.getElementById('e_feeStructure').value;
    const studentId = document.getElementById('e_studentId').value;
    const amount = document.getElementById('e_amount').value;
    const percentage = document.getElementById('e_percentage').value;

    
    if (!feeStructureId) {
        return Swal.fire('Attention', 'Veuillez sélectionner un motif de frais (Structure de frais).', 'warning');
    }

    const payload = {
        student: parseInt(studentId),
        fee_structure: parseInt(feeStructureId),
        discount_amount: amount ? parseFloat(amount) : 0,
        discount_percentage: percentage ? parseFloat(percentage) : 0,
        reason: document.getElementById('e_reason').value || "Exonération accordée",
    };

    try {
        const res = await fetch('/api/finance/exemptions/', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem("access_token")}`,
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken') 
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            closeExemptionModal();
            Swal.fire('Succès !', 'L\'exonération a été enregistrée.', 'success');
            
            loadStudents(document.getElementById('searchInput').value);
        } else {
            const err = await res.json();
            
            let errorMsg = JSON.stringify(err);
            if(err.fee_structure) errorMsg = "Le motif de frais est obligatoire.";
            Swal.fire('Erreur validation', errorMsg, 'error');
        }
    } catch (e) { 
        Swal.fire('Erreur', 'Impossible de contacter le serveur', 'error'); 
    }
}


async function openHistoryModal(studentId, name) {
    const tbody = document.getElementById('historyTableBody');
    tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center">Chargement...</td></tr>';
    
    document.getElementById('historyModal').classList.replace('hidden', 'flex');
    lucide.createIcons();

    try {
        const res = await fetch(`/api/finance/payments/?student=${studentId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem("access_token")}` }
        });
        const data = await res.json();
        const history = data.results || data;

        if (history.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center">Aucun paiement trouvé.</td></tr>';
            return;
        }

        tbody.innerHTML = history.map(p => `
            <tr class="border-b dark:border-slate-800">
                <td class="px-4 py-3">${new Date(p.date_payment).toLocaleDateString()}</td>
                <td class="px-4 py-3">${p.fee_structure_name || 'Frais'}</td>
                <td class="px-4 py-3 font-bold">${p.amount} ${p.currency}</td>
                <td class="px-4 py-3"><span class="text-green-600">Validé</span></td>
            </tr>
        `).join('');
    } catch (e) { tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-red-500">Erreur.</td></tr>'; }
}

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}