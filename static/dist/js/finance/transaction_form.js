

let currentType = 'INCOME'; 
let exchangeRate = 2800;

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    loadInitialData();
    
   
    document.getElementById('transactionForm').addEventListener('submit', handleTransactionSubmit);
});


async function loadInitialData() {
    try {
        const token = localStorage.getItem("access_token");
        const headers = { 'Authorization': `Bearer ${token}` };

    
        const classRes = await fetch('/api/academia/classes/', { headers });
        const classes = await classRes.json();
        const classSelect = document.getElementById('classSelect');
        
        classes.forEach(cls => {
            const opt = document.createElement('option');
            opt.value = cls.id;
            opt.textContent = cls.name;     
            classSelect.appendChild(opt);
        });

    
        const configRes = await fetch('/api/finance/config/', { headers }); 
        
        const configData = await configRes.json();
        const config = Array.isArray(configData) ? configData[0] : configData;

        if (config && config.exchange_rate) {
            exchangeRate = config.exchange_rate;
            document.getElementById('currentRateDisplay').textContent = exchangeRate;
        }

    } catch (error) {
        console.error("Erreur chargement initial:", error);
    }
}


function setTransactionType(type) {
    currentType = type;
    const isIncome = type === 'INCOME';
    
    
    const btnIncome = document.getElementById('btnIncome');
    const btnExpense = document.getElementById('btnExpense');
    
    if (isIncome) {
        btnIncome.className = "flex items-center justify-center gap-2 py-3 rounded-lg font-bold transition-all bg-white dark:bg-slate-700 shadow-sm text-green-600 ring-2 ring-green-100 dark:ring-green-900";
        btnExpense.className = "flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-all text-slate-500 hover:text-slate-700";
    } else {
        btnExpense.className = "flex items-center justify-center gap-2 py-3 rounded-lg font-bold transition-all bg-white dark:bg-slate-700 shadow-sm text-red-600 ring-2 ring-red-100 dark:ring-red-900";
        btnIncome.className = "flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-all text-slate-500 hover:text-slate-700";
    }

    
    const indicator = document.getElementById('sideIndicator');
    indicator.className = `absolute left-0 top-0 bottom-0 w-1.5 transition-colors duration-300 ${isIncome ? 'bg-green-500' : 'bg-red-500'}`;

    
    const submitBtn = document.getElementById('submitBtn');
    const submitText = document.getElementById('submitBtnText');
    
    if (isIncome) {
        submitBtn.className = "px-8 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-lg shadow-green-200 dark:shadow-none transform active:scale-95 transition-all flex items-center gap-2";
        submitText.textContent = "Encaisser";
       
        document.getElementById('studentSection').classList.remove('opacity-50', 'pointer-events-none');
    } else {
        submitBtn.className = "px-8 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-200 dark:shadow-none transform active:scale-95 transition-all flex items-center gap-2";
        submitText.textContent = "Payer (Dépense)";
        
    }
    
 
    document.getElementById('feeStructureSelect').innerHTML = '<option value="">-- Sélectionner un motif --</option>';
    if (!isIncome) {

        loadExpenseCategories();
    }
}


async function loadStudentsAndFees(classId) {
    if (!classId) return;
    
    const token = localStorage.getItem("access_token");
    const headers = { 'Authorization': `Bearer ${token}` };
    
   
    const studentSelect = document.getElementById('studentSelect');
    const feeSelect = document.getElementById('feeStructureSelect');
    
    studentSelect.disabled = true;
    studentSelect.innerHTML = '<option>Chargement...</option>';

    try {
        
        const studentsRes = await fetch(`/api/pupils/students/?enrollment__classe=${classId}`, { headers });
        const students = await studentsRes.json();

        studentSelect.innerHTML = '<option value="">-- Choisir un élève --</option>';
        const list = students.results || students;
        
        list.forEach(std => {
            const opt = document.createElement('option');
            opt.value = std.id;
            opt.textContent = `${std.last_name} ${std.first_name}`;
            studentSelect.appendChild(opt);
        });
        studentSelect.disabled = false;

      
        if (currentType === 'INCOME') {
            const feesRes = await fetch(`/api/finance/fee-structures/?classe=${classId}`, { headers });
            const fees = await feesRes.json();
            
            feeSelect.innerHTML = '<option value="">-- Choisir le motif --</option>';
            const feeList = fees.results || fees;

            feeList.forEach(fee => {
                const opt = document.createElement('option');
                opt.value = fee.id;
                
                opt.textContent = `${fee.fee_type_name} (${fee.amount} ${fee.currency})`; 
                feeSelect.appendChild(opt);
            });
        }

    } catch (e) {
        console.error(e);
        studentSelect.innerHTML = '<option>Erreur chargement</option>';
    }
}


async function loadExpenseCategories() {
    const feeSelect = document.getElementById('feeStructureSelect');
   
    feeSelect.innerHTML = `
        <option value="">-- Autre / Dépense Diverse --</option>
        <option value="EXPENSE_SALARY">Avance sur Salaire</option>
        <option value="EXPENSE_MATERIAL">Achat Matériel</option>
        <option value="EXPENSE_TRANSPORT">Transport</option>
    `;
    
}


async function handleTransactionSubmit(e) {
    e.preventDefault();
    
    // Récupération des données
    const studentId = document.getElementById('studentSelect').value;
    const feeStructureId = document.getElementById('feeStructureSelect').value;
    const amount = document.getElementById('amountInput').value;
    const currency = document.getElementById('currencySelect').value;
    const method = document.getElementById('methodSelect').value;
    const description = document.getElementById('descriptionInput').value;

    
    if (!amount || amount <= 0) {
        alert("Veuillez entrer un montant valide.");
        return;
    }

    if (currentType === 'INCOME') {
        if (!studentId) {
            alert("Pour un encaissement, veuillez sélectionner un élève.");
            return;
        }
        if (!feeStructureId) {
            alert("Veuillez sélectionner le type de frais (Motif).");
            return;
        }
    } else {
        
        if (!description && !feeStructureId) {
            alert("Pour une dépense, veuillez ajouter une note ou description.");
            return;
        }
    }

    // Construction du payload
    const payload = {
        transaction_type: currentType,
        amount: parseFloat(amount),
        currency: currency,
        payment_method: method,
        description: description,
        student: studentId || null, 
        fee_structure: (feeStructureId && !isNaN(feeStructureId)) ? parseInt(feeStructureId) : null 
    };

    
    const submitBtn = document.getElementById('submitBtn');
    const originalText = document.getElementById('submitBtnText').textContent;
    submitBtn.disabled = true;
    document.getElementById('submitBtnText').textContent = "Traitement...";

    try {
        const token = localStorage.getItem("access_token");
        const response = await fetch('/api/finance/transactions/', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const data = await response.json();
            alert(`Succès ! Transaction #${data.receipt_number} enregistrée.`);
            
            document.getElementById('amountInput').value = "";
            document.getElementById('descriptionInput').value = "";
            
            
        } else {
            const err = await response.json();
            console.error(err);
            alert("Erreur lors de l'enregistrement: " + JSON.stringify(err));
        }
    } catch (error) {
        console.error(error);
        alert("Erreur réseau.");
    } finally {
        submitBtn.disabled = false;
        document.getElementById('submitBtnText').textContent = originalText;
    }
}

function resetForm() {
    document.getElementById('transactionForm').reset();
    setTransactionType('INCOME'); 
}