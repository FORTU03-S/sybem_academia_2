/**
 * Logique du Guichet (Transaction Form)
 */

let currentType = 'INCOME'; // INCOME ou EXPENSE
let exchangeRate = 2800; // Valeur par défaut, sera mise à jour par l'API

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    loadInitialData();
    
    // Écouteur de soumission du formulaire
    document.getElementById('transactionForm').addEventListener('submit', handleTransactionSubmit);
});

/**
 * Charge les données de base : Classes et Config Finance (Taux)
 */
async function loadInitialData() {
    try {
        const token = localStorage.getItem("access_token");
        const headers = { 'Authorization': `Bearer ${token}` };

        // 1. Charger les Classes
        const classRes = await fetch('/api/academia/classes/', { headers });
        const classes = await classRes.json();
        const classSelect = document.getElementById('classSelect');
        
        classes.forEach(cls => {
            const opt = document.createElement('option');
            opt.value = cls.id;
            opt.textContent = cls.name; // Assurez-vous que le modèle a un champ 'name'
            classSelect.appendChild(opt);
        });

        // 2. Charger la Config Finance (Taux)
        // Note: Assurez-vous d'avoir un endpoint pour récupérer la config de l'école
        const configRes = await fetch('/api/finance/config/', { headers }); 
        // Si c'est une liste, on prend le premier élément
        const configData = await configRes.json();
        const config = Array.isArray(configData) ? configData[0] : configData; // Adapter selon votre API

        if (config && config.exchange_rate) {
            exchangeRate = config.exchange_rate;
            document.getElementById('currentRateDisplay').textContent = exchangeRate;
        }

    } catch (error) {
        console.error("Erreur chargement initial:", error);
    }
}

/**
 * Change le mode entre Recette et Dépense
 */
function setTransactionType(type) {
    currentType = type;
    const isIncome = type === 'INCOME';
    
    // 1. Gestion des boutons (Tabs)
    const btnIncome = document.getElementById('btnIncome');
    const btnExpense = document.getElementById('btnExpense');
    
    if (isIncome) {
        btnIncome.className = "flex items-center justify-center gap-2 py-3 rounded-lg font-bold transition-all bg-white dark:bg-slate-700 shadow-sm text-green-600 ring-2 ring-green-100 dark:ring-green-900";
        btnExpense.className = "flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-all text-slate-500 hover:text-slate-700";
    } else {
        btnExpense.className = "flex items-center justify-center gap-2 py-3 rounded-lg font-bold transition-all bg-white dark:bg-slate-700 shadow-sm text-red-600 ring-2 ring-red-100 dark:ring-red-900";
        btnIncome.className = "flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-all text-slate-500 hover:text-slate-700";
    }

    // 2. Indicateur visuel
    const indicator = document.getElementById('sideIndicator');
    indicator.className = `absolute left-0 top-0 bottom-0 w-1.5 transition-colors duration-300 ${isIncome ? 'bg-green-500' : 'bg-red-500'}`;

    // 3. Bouton Submit
    const submitBtn = document.getElementById('submitBtn');
    const submitText = document.getElementById('submitBtnText');
    
    if (isIncome) {
        submitBtn.className = "px-8 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-lg shadow-green-200 dark:shadow-none transform active:scale-95 transition-all flex items-center gap-2";
        submitText.textContent = "Encaisser";
        // Rendre la sélection élève obligatoire visuellement (logique gérée au submit)
        document.getElementById('studentSection').classList.remove('opacity-50', 'pointer-events-none');
    } else {
        submitBtn.className = "px-8 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-200 dark:shadow-none transform active:scale-95 transition-all flex items-center gap-2";
        submitText.textContent = "Payer (Dépense)";
        // Pour une dépense, l'élève est souvent optionnel voire inutile
        // On peut le laisser accessible mais non obligatoire
    }
    
    // Recharger les types de frais (Certains frais ne sont que des dépenses ?)
    // Pour simplifier, on vide juste le select actuel
    document.getElementById('feeStructureSelect').innerHTML = '<option value="">-- Sélectionner un motif --</option>';
    if (!isIncome) {
        // Charger les catégories de dépenses génériques si elles existent
        loadExpenseCategories();
    }
}

/**
 * Charge les élèves et les structures de frais quand on choisit une classe
 */
async function loadStudentsAndFees(classId) {
    if (!classId) return;
    
    const token = localStorage.getItem("access_token");
    const headers = { 'Authorization': `Bearer ${token}` };
    
    // UI Loading
    const studentSelect = document.getElementById('studentSelect');
    const feeSelect = document.getElementById('feeStructureSelect');
    
    studentSelect.disabled = true;
    studentSelect.innerHTML = '<option>Chargement...</option>';

    try {
        // 1. Charger les élèves (Enrollments)
        // Attention : Adaptez l'URL selon votre API (ex: /api/academic/enrollments/?classe_id=X)
        const studentsRes = await fetch(`/api/pupils/students/?enrollment__classe=${classId}`, { headers });
        const students = await studentsRes.json();

        studentSelect.innerHTML = '<option value="">-- Choisir un élève --</option>';
        const list = students.results || students; // Gérer pagination DRF
        
        list.forEach(std => {
            const opt = document.createElement('option');
            opt.value = std.id;
            opt.textContent = `${std.last_name} ${std.first_name}`;
            studentSelect.appendChild(opt);
        });
        studentSelect.disabled = false;

        // 2. Charger les Frais (FeeStructure) pour cette classe
        // Uniquement si on est en mode INCOME. Si EXPENSE, c'est différent.
        if (currentType === 'INCOME') {
            const feesRes = await fetch(`/api/finance/fee-structures/?classe=${classId}`, { headers });
            const fees = await feesRes.json();
            
            feeSelect.innerHTML = '<option value="">-- Choisir le motif --</option>';
            const feeList = fees.results || fees;

            feeList.forEach(fee => {
                const opt = document.createElement('option');
                opt.value = fee.id;
                // Affiche: "Minerval (100 USD)"
                opt.textContent = `${fee.fee_type_name} (${fee.amount} ${fee.currency})`; 
                feeSelect.appendChild(opt);
            });
        }

    } catch (e) {
        console.error(e);
        studentSelect.innerHTML = '<option>Erreur chargement</option>';
    }
}

/**
 * Charge des catégories de dépenses (si votre API le supporte)
 * Sinon, on peut hardcoder ou laisser l'utilisateur écrire dans "Description"
 */
async function loadExpenseCategories() {
    const feeSelect = document.getElementById('feeStructureSelect');
    // Ici, soit on appelle l'API pour les types de dépenses, soit on ajoute une option générique
    feeSelect.innerHTML = `
        <option value="">-- Autre / Dépense Diverse --</option>
        <option value="EXPENSE_SALARY">Avance sur Salaire</option>
        <option value="EXPENSE_MATERIAL">Achat Matériel</option>
        <option value="EXPENSE_TRANSPORT">Transport</option>
    `;
    // Note: Le backend devra gérer ces valeurs si elles ne sont pas des IDs
}


/**
 * Envoi du formulaire
 */
async function handleTransactionSubmit(e) {
    e.preventDefault();
    
    // Récupération des données
    const studentId = document.getElementById('studentSelect').value;
    const feeStructureId = document.getElementById('feeStructureSelect').value;
    const amount = document.getElementById('amountInput').value;
    const currency = document.getElementById('currencySelect').value;
    const method = document.getElementById('methodSelect').value;
    const description = document.getElementById('descriptionInput').value;

    // Validation de base
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
        // Pour une dépense, la description est obligatoire si pas de motif
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
        student: studentId || null, // Peut être null pour dépense
        // Attention : Votre modèle attend 'fee_structure' (ID). 
        // Si c'est une dépense générique sans structure, assurez-vous que le backend l'accepte ou envoyez null.
        fee_structure: (feeStructureId && !isNaN(feeStructureId)) ? parseInt(feeStructureId) : null 
    };

    // Afficher état chargement
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
            // Reset partiel du form pour enchaîner
            document.getElementById('amountInput').value = "";
            document.getElementById('descriptionInput').value = "";
            // On garde la classe et l'élève pour aller plus vite si c'est le même parent qui paie plusieurs trucs
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
    setTransactionType('INCOME'); // Revenir par défaut
}