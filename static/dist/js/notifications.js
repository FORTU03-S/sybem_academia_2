
window.openNotificationPanel = function() {
    const panel = document.getElementById('notif-panel');
    const overlay = document.getElementById('notif-overlay');
    if(panel) panel.classList.remove('translate-x-full');
    if(overlay) overlay.classList.remove('hidden');
    loadNotifications(); 
};

window.closeNotificationPanel = function() {
    const panel = document.getElementById('notif-panel');
    const overlay = document.getElementById('notif-overlay');
    if(panel) panel.classList.add('translate-x-full');
    if(overlay) overlay.classList.add('hidden');
};

window.checkPendingRequests = async function() {
    const badge = document.getElementById('notif-badge');
    if (!badge) return;

    try {
        
        const data = await apiRequest('/api/notifications/count/');
        
        if (data && data.count > 0) {
            badge.classList.remove('hidden');
            badge.classList.add('animate-bounce');
        } else {
            badge.classList.add('hidden');
        }
    } catch (err) {
        console.warn("Erreur check notifications:", err);
    }
};

async function loadNotifications() {
    const container = document.getElementById('notif-content');
    if (!container) return;
    
    try {
        const requests = await apiRequest('/api/notifications/latest/');

        if (!requests || requests.length === 0) {
            container.innerHTML = '<p class="text-center text-slate-500 text-sm py-10">Aucune demande en attente.</p>';
            return;
        }

        container.innerHTML = requests.map(req => `
            <div class="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div class="flex justify-between items-start">
                    <span class="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">${req.teacher_name}</span>
                    <span class="text-[10px] text-slate-400">${req.time_ago}</span>
                </div>
                <p class="text-sm text-slate-700 dark:text-slate-200 font-medium">${req.student_name}</p>
                <div class="flex items-center gap-2 text-xs text-slate-500">
                    <span class="line-through text-red-400">${req.old_score}</span>
                    <i data-lucide="arrow-right" class="w-3 h-3"></i>
                    <span class="text-green-600 font-bold">${req.new_score}</span>
                </div>
                <div class="flex gap-2 pt-2">
                    <button onclick="quickProcess(${req.id}, 'approve')" class="flex-1 bg-green-600 text-white text-[11px] py-1.5 rounded-lg hover:bg-green-700 transition">Approuver</button>
                    <button onclick="quickProcess(${req.id}, 'reject')" class="flex-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] py-1.5 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition">Refuser</button>
                </div>
            </div>
        `).join('');
        
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        container.innerHTML = '<p class="text-red-500 text-xs">Erreur de chargement.</p>';
    }
}


(function initNotifs() {
    setTimeout(() => {
        checkPendingRequests();
        setInterval(checkPendingRequests, 60000); 
    }, 1000);
})();


window.quickProcess = async function(requestId, action) {
    try {
        const confirmText = action === 'approve' ? "approuver cette note" : "rejeter cette demande";
        
        
        const response = await apiRequest(`/api/notifications/${requestId}/process/`, 'POST', { 
            action: action 
        });

        if (response.status === 'success') {
            const msg = action === 'approve' ? 'Note mise à jour !' : 'Demande rejetée.';
            
            Swal.fire({ 
                icon: 'success', 
                title: msg, 
                timer: 1500, 
                showConfirmButton: false 
            });
            
            loadNotifications();
            checkPendingRequests(); 
        }
    } catch (err) {
        console.error("Erreur processing:", err);
        Swal.fire('Erreur', err.message || 'Action impossible', 'error');
    }
};