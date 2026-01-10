// Pupils Management System - Complete CRUD with Filtering & Pagination

// Fonction utilitaire pour les appels API (inspirée de votre autre fichier)
// C:\Users\user\sybem_academia2\sybem\static\dist\js\school_admin\pupils.js

async function apiRequest(url, method = 'GET', data = null) {
    // 1. Récupérer le token
    const token = localStorage.getItem('access_token');

    const headers = {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCookie('csrftoken')
    };

    // 2. Si le token existe, on l'ajoute au Header Authorization
    // Note: Vérifie si ton backend attend "Bearer" ou "Token" ou "JWT"
    if (token) {
        headers['Authorization'] = `Bearer ${token}`; 
    }

    const config = {
        method: method,
        headers: headers, // Utilise l'objet headers modifié
        credentials: 'same-origin'
    };

    if (data) {
        config.body = JSON.stringify(data);
    }

    const response = await fetch(url, config);

    if (!response.ok) {
        if (response.status === 401) {
            console.error("Erreur 401: Token invalide ou expiré");
            localStorage.clear();
            window.location.href = '/static/dist/html/login.html';
            throw new Error('Session expirée. Veuillez vous reconnecter.');
        }
        const error = await response.json();
        throw new Error(error.message || 'Une erreur est survenue');
    }

    return response.json();
}

// Fonction pour récupérer le cookie CSRF
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

// Fonction pour vérifier l'authentification
function checkAuth() {
    const token = localStorage.getItem('access_token') || localStorage.getItem('auth_token');
    const userRole = localStorage.getItem('user_role') || localStorage.getItem('user_type');
    
    if (!token || !userRole) {
        console.warn('Aucun token ou rôle utilisateur trouvé, redirection vers login');
        window.location.href = '/static/dist/html/login.html';
        return false;
    }
    return true;
}

// Fonction pour afficher un toast
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 transform transition-all duration-300 ${
        type === 'success' ? 'bg-green-500 text-white' :
        type === 'error' ? 'bg-red-500 text-white' :
        'bg-blue-500 text-white'
    }`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => document.body.removeChild(toast), 300);
    }, 3000);
}

// Fonction pour générer un badge de statut
function statusBadge(status) {
    const styles = {
        active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
        dropped: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
    };
    return `
        <span class="px-2 py-1 rounded text-xs ${styles[status] || "bg-gray-100 text-gray-700"}">
            ${status === 'active' ? 'Actif' : 'Abandonné'}
        </span>`;
}

class PupilsManager {
    constructor() {
        this.baseUrl = '/api/pupils/students/';
        this.currentPage = 1;
        this.rowsPerPage = 10;
        this.totalRows = 0;
        this.totalPages = 0;
        this.filters = {};
        this.selectedStudents = new Set();
        this.currentStudentId = null;
        
        this.init();
    }
    
    init() {
        // Vérifier l'authentification avant d'initialiser
        if (!checkAuth()) {
            return;
        }
        
        this.bindEvents();
        this.loadInitialData();
        this.setupDataTable();
    }
    
    bindEvents() {
        // Toggle filters
        $('#toggleFilters').click(() => $('#filtersSection').toggle());
        
        // Export dropdown
        $('#exportBtn').click(() => $('#exportMenu').toggle());
        $('.export-option').click((e) => this.handleExport(e.target.textContent));
        
        // Add student
        $('#addStudentBtn').click(() => this.openStudentModal());
        
        // Apply filters
        $('#applyFilters').click(() => this.applyFilters());
        $('#resetFilters').click(() => this.resetFilters());
        
        // Pagination
        $('#prevPage').click(() => this.changePage(this.currentPage - 1));
        $('#nextPage').click(() => this.changePage(this.currentPage + 1));
        $('#rowsPerPage').change((e) => {
            this.rowsPerPage = parseInt(e.target.value);
            this.currentPage = 1;
            this.loadStudents();
        });
        
        // Search with debounce
        let searchTimeout;
        $('#searchInput').on('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.filters.search = e.target.value;
                this.currentPage = 1;
                this.loadStudents();
            }, 500);
        });
        
        // Quick filter changes
        $('#statusFilter, #classFilter, #genderFilter, #periodFilter').change((e) => {
            const filterId = e.target.id.replace('Filter', '');
            this.filters[filterId] = e.target.value;
            this.currentPage = 1;
            this.loadStudents();
        });
        
        // Date range filter
        if ($('#dateRangeFilter').length) {
            flatpickr('#dateRangeFilter', {
                mode: 'range',
                dateFormat: 'Y-m-d',
                locale: 'fr',
                onChange: (selectedDates) => {
                    if (selectedDates.length === 2) {
                        this.filters.enrollment_date_start = selectedDates[0].toISOString().split('T')[0];
                        this.filters.enrollment_date_end = selectedDates[1].toISOString().split('T')[0];
                        this.currentPage = 1;
                        this.loadStudents();
                    }
                }
            });
        }
        
        // Modal events
        $('#closeModal, #cancelModal').click(() => this.closeStudentModal());
        $('#studentForm').submit((e) => {
            e.preventDefault();
            this.saveStudent();
        });
        
        // Status change shows/hides dropped date
        $('#status').change((e) => {
            $('#droppedAtContainer').toggle(e.target.value === 'dropped');
        });
        
        // Add parent button
        $('#addParentBtn').click(() => this.addParentRow());
        
        // Select all checkbox
        $('#selectAll').change((e) => {
            const isChecked = e.target.checked;
            $('.student-checkbox').prop('checked', isChecked);
            this.updateSelectedCount();
        });
        
        // Bulk actions
        $('#bulkActionsBtn').click(() => this.showBulkActions());
        
        // Delete modal
        $('#cancelDelete').click(() => $('#deleteModal').addClass('hidden'));
        $('#confirmDelete').click(() => this.deleteStudent());
        
        // Profile picture preview
        $('#profilePicture').change((e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    $('#profilePreview').attr('src', e.target.result);
                };
                reader.readAsDataURL(file);
            }
        });
        
        // Close dropdown when clicking outside
        $(document).click((e) => {
            if (!$(e.target).closest('#exportBtn').length) {
                $('#exportMenu').addClass('hidden');
            }
        });
    }
    
    setupDataTable() {
        // Initialize DataTable for advanced features
        this.dataTable = $('#studentsTable').DataTable({
            paging: false,
            searching: false,
            info: false,
            ordering: false,
            responsive: true,
            dom: 'Bfrtip',
            buttons: [
                'copy', 'csv', 'excel', 'pdf', 'print'
            ]
        });
        
        // Hide default DataTable controls since we have custom ones
        $('.dt-buttons').hide();
    }
    
    async loadInitialData() {
        try {
            // Vérifier l'authentification
            if (!checkAuth()) {
                return;
            }

            // Load classes for filters and forms
            const classes = await apiRequest('/api/academia/classes/');
            
            // Load academic periods - CORRECTED URL
            const periods = await apiRequest('/api/academic-periods/');
            
            // Load parents (users with parent role) - with school filter
            const schoolId = localStorage.getItem('school_id');
            let parentsUrl = '/api/users/?role=parent';
            if (schoolId) {
                parentsUrl += `&school=${schoolId}`;
            }
            
            let parents = {results: []};
            try {
                parents = await apiRequest(parentsUrl);
            } catch (error) {
                console.warn('Could not load parents, continuing without:', error);
            }
            
            // Populate dropdowns
            this.populateDropdowns(classes, periods, parents);
            
            // Load initial student data
            await this.loadStudents();
            
        } catch (error) {
            console.error('Error loading initial data:', error);
            showToast('Erreur de chargement des données: ' + error.message, 'error');
        }
    }
    
    populateDropdowns(classes, periods, parents) {
        // Class dropdown
        const classFilter = $('#classFilter');
        const currentClasse = $('#currentClasse');
        
        classFilter.empty().append('<option value="">Toutes les classes</option>');
        currentClasse.empty().append('<option value="">Sélectionner une classe</option>');
        
        if (classes && classes.length) {
            classes.forEach(cls => {
                const option = `<option value="${cls.id}">${cls.name}</option>`;
                classFilter.append(option);
                currentClasse.append(option);
            });
        }
        
        // Period dropdown
        const periodFilter = $('#periodFilter');
        const academicPeriod = $('#academicPeriod');
        
        periodFilter.empty().append('<option value="">Toutes les périodes</option>');
        academicPeriod.empty().append('<option value="">Sélectionner une période</option>');
        
        if (periods && periods.length) {
            periods.forEach(period => {
                const option = `<option value="${period.id}">${period.name}</option>`;
                periodFilter.append(option);
                academicPeriod.append(option);
            });
            
            // Select active period by default
            const activePeriod = periods.find(p => p.is_current === true);
            if (activePeriod) {
                academicPeriod.val(activePeriod.id);
                console.log('Active academic period set:', activePeriod.name);
            }
        }
        
        // Parent search select2 - with proper data handling
        let parentData = [];
        if (parents && parents.results && parents.results.length) {
            parentData = parents.results.map(parent => ({
                id: parent.id,
                text: `${parent.first_name || ''} ${parent.last_name || ''} (${parent.email || 'No email'})`
            }));
        }

        $('.search-parent-select').select2({
            placeholder: 'Rechercher un parent...',
            allowClear: true,
            data: parentData
        });
    }
    
    async loadStudents() {
        try {
            // Vérifier l'authentification
            if (!checkAuth()) {
                return;
            }

            // Show loading state
            $('#studentsTableBody').html(`
                <tr>
                    <td colspan="8" class="px-6 py-12 text-center">
                        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                        <p class="mt-2 text-gray-500">Chargement des élèves...</p>
                    </td>
                </tr>
            `);
            
            // Build query string - ADD SCHOOL FILTER
            const schoolId = localStorage.getItem('school_id');
            const queryParams = new URLSearchParams({
                page: this.currentPage,
                page_size: this.rowsPerPage,
                ...this.filters
            });
            
            // Add school filter if available
            if (schoolId) {
                queryParams.append('school', schoolId);
            }
            
            const url = `${this.baseUrl}?${queryParams}`;
            const data = await apiRequest(url);
            
            // Check if paginated response or simple array
            if (data.results !== undefined) {
                // Paginated response (DRF default)
                this.renderStudents(data.results);
                this.updatePagination(data.count);
                this.updateStats(data.stats || this.calculateStats(data.results));
            } else {
                // Simple array response
                this.renderStudents(data);
                this.updatePagination(data.length);
                this.updateStats(this.calculateStats(data));
            }
            
        } catch (error) {
            console.error('Error loading students:', error);
            $('#studentsTableBody').html(`
                <tr>
                    <td colspan="8" class="px-6 py-12 text-center text-red-600">
                        <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                        <p>Erreur de chargement: ${error.message}</p>
                        <button onclick="pupilsManager.loadStudents()" class="mt-2 text-indigo-600 hover:underline">
                            <i class="fas fa-redo mr-1"></i>Réessayer
                        </button>
                    </td>
                </tr>
            `);
        }
    }
    
   renderStudents(students) {
    if (!students || students.length === 0) {
        $('#studentsTableBody').html(`
            <tr>
                <td colspan="8" class="px-6 py-12 text-center text-gray-500">
                    <i class="fas fa-user-slash text-3xl mb-3"></i>
                    <p class="text-lg">Aucun élève trouvé</p>
                    <p class="text-sm mt-1">Cliquez sur "Nouvel Élève" pour en ajouter</p>
                </td>
            </tr>
        `);
        return;
    }

    const rows = students.map(student => {
        // --- 1. GESTION DE L'IMAGE (Correction 404) ---
        let imageUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(student.last_name + ' ' + student.first_name)}&background=6366f1&color=fff`;
        
        if (student.profile_picture) {
            // Si Django renvoie un chemin relatif (ex: "students/photo.jpg"), on ajoute /media/
            imageUrl = (student.profile_picture.startsWith('http') || student.profile_picture.startsWith('/media/'))
                ? student.profile_picture
                : `/media/${student.profile_picture}`;
        }

        // --- 2. GESTION DE LA CLASSE (Correction undefined) ---
        // On utilise l'objet sérialisé "current_classe" envoyé par le Serializer
        const className = student.current_classe ? student.current_classe.name : 'Non assigné';

        return `
            <tr class="student-card ${student.status} hover:bg-gray-100 dark:hover:bg-slate-900 transition-colors">
                <td class="px-6 py-4 whitespace-nowrap">
                    <input type="checkbox" class="student-checkbox rounded border-gray-300" 
                           value="${student.id}" onchange="pupilsManager.updateSelectedCount()">
                </td>
                <td class="px-6 py-4">
                    <div class="flex items-center">
                        <div class="flex-shrink-0 h-10 w-10">
                            <img class="h-10 w-10 rounded-full object-cover border border-gray-200" 
                                 src="${imageUrl}" 
                                 alt="${student.first_name}"
                                 onerror="this.src='https://ui-avatars.com/api/?name=Error&background=f87171&color=fff'">
                        </div>
                        <div class="ml-4">
                            <div class="text-sm font-medium text-gray-900 dark:text-white">
                                ${student.last_name} ${student.middle_name || ''} ${student.first_name}
                            </div>
                            <div class="text-sm text-gray-500 dark:text-gray-400">
                                ${student.gender === 'Male' ? '♂' : student.gender === 'Female' ? '♀' : '⚧'} 
                                ${student.date_of_birth ? `• ${new Date(student.date_of_birth).toLocaleDateString('fr-FR')}` : ''}
                            </div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 py-1 text-xs font-mono bg-gray-100 dark:bg-slate-700 rounded">
                        ${student.student_id_code || 'N/A'}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-3 py-1 text-xs rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                        ${className}
                    </span>
                </td>
                <td class="px-6 py-4">
                    <div class="flex flex-wrap gap-1">
                        ${student.parents && student.parents.length > 0 
                            ? student.parents.slice(0, 2).map(parent => `
                                <span class="inline-flex items-center px-2 py-1 rounded-full text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">
                                    ${parent.first_name} ${parent.last_name}
                                </span>
                            `).join('') 
                            : '<span class="text-gray-400 text-sm italic">Aucun parent</span>'
                        }
                        ${student.parents && student.parents.length > 2 
                            ? `<span class="text-xs text-gray-500">+${student.parents.length - 2}</span>` 
                            : ''
                        }
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    ${new Date(student.enrollment_date).toLocaleDateString('fr-FR')}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    ${typeof statusBadge === 'function' ? statusBadge(student.status) : student.status}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div class="flex gap-3">
                        <button onclick="pupilsManager.viewStudent(${student.id})" 
                                class="text-blue-600 hover:text-blue-900 transition-colors" title="Voir">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button onclick="pupilsManager.editStudent(${student.id})" 
                                class="text-indigo-600 hover:text-indigo-900 transition-colors" title="Modifier">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="pupilsManager.confirmDelete(${student.id})" 
                                class="text-red-600 hover:text-red-900 transition-colors" title="Supprimer">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    
    $('#studentsTableBody').html(rows);
}
    
    updatePagination(total) {
        this.totalRows = total;
        this.totalPages = Math.ceil(total / this.rowsPerPage);
        
        // Update pagination info
        const start = (this.currentPage - 1) * this.rowsPerPage + 1;
        const end = Math.min(this.currentPage * this.rowsPerPage, total);
        
        $('#paginationInfo').text(`Affichage de ${start} à ${end} sur ${total} élèves`);
        
        // Update page numbers
        const pageNumbers = $('#pageNumbers');
        pageNumbers.empty();
        
        // Previous page button state
        $('#prevPage').prop('disabled', this.currentPage === 1);
        
        // Generate page numbers
        const maxVisiblePages = 5;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);
        
        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            const active = i === this.currentPage ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300';
            pageNumbers.append(`
                <button onclick="pupilsManager.changePage(${i})" 
                        class="w-8 h-8 rounded-lg border dark:border-slate-700 ${active}">
                    ${i}
                </button>
            `);
        }
        
        // Next page button state
        $('#nextPage').prop('disabled', this.currentPage === this.totalPages);
    }
    
    updateStats(students) {
        const stats = Array.isArray(students) ? this.calculateStats(students) : students;
        
        $('#totalStudents').text(stats.total || 0);
        $('#activeStudents').text(stats.active || 0);
        $('#droppedStudents').text(stats.dropped || 0);
        
        if (stats.male !== undefined && stats.female !== undefined) {
            $('#genderRatio').text(`${stats.female || 0}:${stats.male || 0}`);
        }
    }
    
    calculateStats(students) {
        return {
            total: students.length,
            active: students.filter(s => s.status === 'active').length,
            dropped: students.filter(s => s.status === 'dropped').length,
            male: students.filter(s => s.gender === 'Male').length,
            female: students.filter(s => s.gender === 'Female').length
        };
    }
    
    changePage(page) {
        if (page < 1 || page > this.totalPages) return;
        this.currentPage = page;
        this.loadStudents();
    }
    
    applyFilters() {
        this.currentPage = 1;
        this.loadStudents();
        $('#filtersSection').addClass('hidden');
    }
    
    resetFilters() {
        $('#searchInput').val('');
        $('#statusFilter').val('');
        $('#classFilter').val('');
        $('#genderFilter').val('');
        $('#periodFilter').val('');
        $('#dateRangeFilter').val('');
        
        this.filters = {};
        this.currentPage = 1;
        this.loadStudents();
    }
    
    openStudentModal(student = null) {
        $('#modalTitle').text(student ? 'Modifier Élève' : 'Nouvel Élève');
        
        if (student) {
            // Populate form with student data
            $('#studentId').val(student.id);
            $('#lastName').val(student.last_name);
            $('#middleName').val(student.middle_name || '');
            $('#firstName').val(student.first_name);
            $('#dateOfBirth').val(student.date_of_birth || '');
            $('#gender').val(student.gender || '');
            $('#studentIdCode').val(student.student_id_code || '');
            $('#currentClasse').val(student.current_classe?.id || '');
            $('#academicPeriod').val(student.academic_period?.id || '');
            $('#status').val(student.status || 'active');
            $('#droppedAt').val(student.dropped_at || '');
            
            if (student.profile_picture) {
                $('#profilePreview').attr('src', student.profile_picture);
            }
            
            // Populate parents
            this.populateParents(student.parents || []);
        } else {
            // Reset form for new student
            $('#studentForm')[0].reset();
            $('#studentId').val('');
            $('#profilePreview').attr('src', 'https://ui-avatars.com/api/?name=Élève&background=6366f1&color=fff');
            $('#status').val('active');
            $('#droppedAtContainer').addClass('hidden');
            $('#parentsContainer').empty();
            
            // Auto-generate student ID
            this.generateStudentId();
        }
        
        $('#studentModal').removeClass('hidden');
    }
    
    generateStudentId() {
        const prefix = 'STU';
        const year = new Date().getFullYear().toString().slice(-2);
        const random = Math.floor(1000 + Math.random() * 9000);
        $('#studentIdCode').val(`${prefix}${year}${random}`);
    }
    
    populateParents(parents) {
        $('#parentsContainer').empty();
        parents.forEach(parent => {
            this.addParentRow(parent);
        });
    }
    
    addParentRow(parent = null) {
        const parentId = parent?.id || '';
        const parentName = parent ? `${parent.first_name} ${parent.last_name}` : '';
        const parentEmail = parent?.email || '';
        
        const parentRow = `
            <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-900 rounded-lg border dark:border-slate-700">
                <div class="flex-1">
                    <input type="hidden" name="parents[]" value="${parentId}" class="parent-id">
                    <p class="font-medium">${parentName || 'Nouveau parent'}</p>
                    ${parentEmail ? `<p class="text-sm text-gray-500">${parentEmail}</p>` : ''}
                </div>
                <button type="button" class="remove-parent text-red-600 hover:text-red-800">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        $('#parentsContainer').append(parentRow);
        
        // Bind remove event
        $('#parentsContainer .remove-parent:last').click(function() {
            $(this).closest('div').remove();
        });
    }
    
    async saveStudent() {
        try {
            if (!checkAuth()) {
                return;
            }

            // Collect form data - CORRECTED FOR DJANGO REST
            const formData = new FormData();

            // Add all fields directly (not as JSON)
            formData.append('last_name', $('#lastName').val());
            formData.append('middle_name', $('#middleName').val());
            formData.append('first_name', $('#firstName').val());
            formData.append('date_of_birth', $('#dateOfBirth').val());
            formData.append('gender', $('#gender').val());
            formData.append('student_id_code', $('#studentIdCode').val());
            formData.append('current_classe', $('#currentClasse').val());
            formData.append('academic_period', $('#academicPeriod').val());
            formData.append('status', $('#status').val());

            // Add dropped_at only if status is dropped
            if ($('#status').val() === 'dropped' && $('#droppedAt').val()) {
                formData.append('dropped_at', $('#droppedAt').val());
            }

            // Add parents as array
            const parentIds = $('.parent-id').map((i, el) => el.value).get();
            parentIds.forEach((id, index) => {
                if (id) { // Only add if not empty
                    formData.append(`parents`, id);
                }
            });

            // Add profile picture if changed
            const profilePic = $('#profilePicture')[0].files[0];
            if (profilePic) {
                formData.append('profile_picture', profilePic);
            }
            
            const studentId = $('#studentId').val();
            const url = studentId ? `${this.baseUrl}${studentId}/` : this.baseUrl;
            const method = studentId ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method: method,
                headers: {
                    'X-CSRFToken': getCookie('csrftoken'),
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                },
                body: formData
            });
            
            if (response.ok) {
                showToast(
                    studentId ? 'Élève mis à jour avec succès' : 'Élève créé avec succès',
                    'success'
                );
                this.closeStudentModal();
                this.loadStudents();
            } else {
                const error = await response.json();
                console.error('API Error:', error);
                showToast(`Erreur: ${JSON.stringify(error)}`, 'error');
            }
        } catch (error) {
            console.error('Error saving student:', error);
            showToast('Erreur lors de la sauvegarde: ' + error.message, 'error');
        }
    }
    
    async viewStudent(id) {
        try {
            const student = await apiRequest(`${this.baseUrl}${id}/`);
            this.showStudentDetails(student);
        } catch (error) {
            console.error('Error viewing student:', error);
            showToast('Erreur de chargement des détails: ' + error.message, 'error');
        }
    }
    
    async editStudent(id) {
        try {
            const student = await apiRequest(`${this.baseUrl}${id}/`);
            this.openStudentModal(student);
        } catch (error) {
            console.error('Error loading student for edit:', error);
            showToast('Erreur de chargement: ' + error.message, 'error');
        }
    }
    
    confirmDelete(id, bulk = false) {
        this.currentStudentId = id;
        let message = 'Êtes-vous sûr de vouloir supprimer cet élève ?';
        
        if (bulk) {
            const count = this.selectedStudents.size;
            message = `Êtes-vous sûr de vouloir supprimer ${count} élève(s) sélectionné(s) ?`;
        }
        
        $('#deleteMessage').text(message);
        $('#deleteModal').removeClass('hidden');
    }
    
    async deleteStudent() {
        try {
            if (this.selectedStudents.size > 0) {
                // Bulk delete
                const promises = Array.from(this.selectedStudents).map(id => 
                    apiRequest(`${this.baseUrl}${id}/`, 'DELETE')
                );
                
                await Promise.all(promises);
                showToast(`${this.selectedStudents.size} élève(s) supprimé(s)`, 'success');
                this.selectedStudents.clear();
                this.updateSelectedCount();
            } else if (this.currentStudentId) {
                // Single delete
                await apiRequest(`${this.baseUrl}${this.currentStudentId}/`, 'DELETE');
                showToast('Élève supprimé avec succès', 'success');
            }
            
            $('#deleteModal').addClass('hidden');
            this.loadStudents();
        } catch (error) {
            console.error('Error deleting student:', error);
            showToast('Erreur lors de la suppression: ' + error.message, 'error');
        }
    }
    
    updateSelectedCount() {
        this.selectedStudents.clear();
        $('.student-checkbox:checked').each((i, el) => {
            this.selectedStudents.add(el.value);
        });
        
        const count = this.selectedStudents.size;
        $('#selectedCount').text(`${count} sélectionné(s)`);
        $('#bulkActionsBtn').toggleClass('hidden', count === 0);
        $('#selectAll').prop('checked', count > 0 && count === $('.student-checkbox').length);
    }
    
    showBulkActions() {
        const actions = `
            <div class="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg z-10 border dark:border-slate-700">
                <button class="bulk-action w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-slate-700" data-action="activate">
                    <i class="fas fa-user-check mr-2 text-green-600"></i>Activer
                </button>
                <button class="bulk-action w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-slate-700" data-action="drop">
                    <i class="fas fa-user-slash mr-2 text-red-600"></i>Marquer comme abandonné
                </button>
                <button class="bulk-action w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-slate-700" data-action="export">
                    <i class="fas fa-download mr-2 text-blue-600"></i>Exporter sélection
                </button>
                <button class="bulk-action w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-slate-700 text-red-600" data-action="delete">
                    <i class="fas fa-trash mr-2"></i>Supprimer
                </button>
            </div>
        `;
        
        // Show bulk actions menu
        $('#bulkActionsBtn').after(actions);
        
        // Bind bulk action events
        $('.bulk-action').click((e) => {
            const action = e.target.dataset.action;
            this.handleBulkAction(action);
            $(e.target).closest('div').remove();
        });
        
        // Close on click outside
        $(document).one('click', (e) => {
            if (!$(e.target).closest('#bulkActionsBtn').length) {
                $('.bulk-action').closest('div').remove();
            }
        });
    }
    
    async handleBulkAction(action) {
        const ids = Array.from(this.selectedStudents);
        
        switch(action) {
            case 'activate':
                await this.bulkUpdateStatus(ids, 'active');
                break;
            case 'drop':
                await this.bulkUpdateStatus(ids, 'dropped');
                break;
            case 'export':
                this.exportSelected(ids);
                break;
            case 'delete':
                this.confirmDelete(null, true);
                break;
        }
    }
    
    async bulkUpdateStatus(ids, status) {
        try {
            const promises = ids.map(id => 
                apiRequest(`${this.baseUrl}${id}/`, 'PATCH', { 
                    status: status,
                    dropped_at: status === 'dropped' ? new Date().toISOString().split('T')[0] : null
                })
            );
            
            await Promise.all(promises);
            showToast(`${ids.length} élève(s) mis à jour`, 'success');
            this.selectedStudents.clear();
            this.updateSelectedCount();
            this.loadStudents();
        } catch (error) {
            console.error('Error updating status:', error);
            showToast('Erreur lors de la mise à jour: ' + error.message, 'error');
        }
    }
    
    exportSelected(ids) {
        // Create CSV data
        const rows = $('.student-checkbox:checked').closest('tr');
        const data = rows.map((i, row) => {
            const cells = $(row).find('td');
            return [
                $(cells[1]).text().trim(),
                $(cells[2]).text().trim(),
                $(cells[3]).text().trim(),
                $(cells[5]).text().trim(),
                $(cells[6]).text().trim()
            ].join(',');
        }).get();
        
        const csvContent = [
            'Nom,ID,Classe,Date d\'inscription,Statut',
            ...data
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `eleves_${new Date().toISOString().slice(0,10)}.csv`;
        link.click();
    }
    
    handleExport(format) {
        switch(format.trim()) {
            case 'Excel':
                this.dataTable.button('.buttons-excel').trigger();
                break;
            case 'PDF':
                this.dataTable.button('.buttons-pdf').trigger();
                break;
            case 'Imprimer':
                window.print();
                break;
        }
    }
    
    closeStudentModal() {
        $('#studentModal').addClass('hidden');
        $('#studentForm')[0].reset();
    }
    
    showStudentDetails(student) {
        // Implementation for detailed view modal
        const modalContent = `
            <div class="p-6">
                <div class="flex flex-col md:flex-row gap-6">
                    <div class="flex flex-col items-center">
                        <img src="${student.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(student.last_name + ' ' + student.first_name)}&size=200&background=6366f1&color=fff`}" 
                             class="w-32 h-32 rounded-full object-cover mb-4 border-4 border-indigo-100">
                        <h3 class="text-xl font-bold">${student.last_name} ${student.middle_name || ''} ${student.first_name}</h3>
                        <p class="text-gray-600">${student.student_id_code || 'N/A'}</p>
                    </div>
                    
                    <div class="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <h4 class="font-semibold text-gray-500">Informations Personnelles</h4>
                            <p><strong>Date de naissance:</strong> ${student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString('fr-FR') : 'N/A'}</p>
                            <p><strong>Genre:</strong> ${student.gender || 'N/A'}</p>
                        </div>
                        
                        <div>
                            <h4 class="font-semibold text-gray-500">Informations Académiques</h4>
                            <p><strong>Classe:</strong> ${student.current_classe?.name || 'N/A'}</p>
                            <p><strong>Période académique:</strong> ${student.academic_period?.name || 'N/A'}</p>
                            <p><strong>Date d'inscription:</strong> ${new Date(student.enrollment_date).toLocaleDateString('fr-FR')}</p>
                        </div>
                        
                        <div class="md:col-span-2">
                            <h4 class="font-semibold text-gray-500">Parents / Tuteurs</h4>
                            ${student.parents && student.parents.length > 0 
                                ? student.parents.map(parent => `
                                    <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg my-2">
                                        <i class="fas fa-user-circle text-xl text-gray-400"></i>
                                        <div>
                                            <p class="font-medium">${parent.first_name} ${parent.last_name}</p>
                                            <p class="text-sm text-gray-600">${parent.email}</p>
                                        </div>
                                    </div>
                                `).join('')
                                : '<p class="text-gray-500">Aucun parent associé</p>'
                            }
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Create modal if it doesn't exist
        if ($('#viewStudentModal').length === 0) {
            const modalHtml = `
                <div id="viewStudentModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden">
                    <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden mx-4">
                        <div class="p-6 border-b dark:border-slate-700 flex justify-between items-center">
                            <h3 class="text-xl font-bold">Détails de l'élève</h3>
                            <button onclick="$('#viewStudentModal').addClass('hidden')" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                                <i class="fas fa-times text-2xl"></i>
                            </button>
                        </div>
                        <div class="modal-content p-6 overflow-y-auto" style="max-height: 70vh;"></div>
                        <div class="p-6 border-t dark:border-slate-700 flex justify-end">
                            <button onclick="$('#viewStudentModal').addClass('hidden')" class="btn btn-secondary">Fermer</button>
                        </div>
                    </div>
                </div>
            `;
            $('body').append(modalHtml);
        }
        
        $('#viewStudentModal .modal-content').html(modalContent);
        $('#viewStudentModal').removeClass('hidden');
    }
}


document.addEventListener('DOMContentLoaded', function() {
    // 1. Gestion du bouton "Ajouter Parent"
    const addParentBtn = document.getElementById('addParentBtn');
    const parentsContainer = document.getElementById('parentsContainer');
    const parentTemplate = document.getElementById('parentSearchTemplate');

    if(addParentBtn && parentsContainer && parentTemplate) {
        addParentBtn.addEventListener('click', function() {
            // Cloner le template
            const newParentRow = parentTemplate.cloneNode(true);
            
            // Enlever l'ID (car les ID doivent être uniques) et la classe hidden
            newParentRow.removeAttribute('id');
            newParentRow.classList.remove('hidden');
            
            // Ajouter au conteneur
            parentsContainer.appendChild(newParentRow);

            // Gestionnaire pour le bouton "Supprimer/Fermer" cette ligne
            const closeBtn = newParentRow.querySelector('.closeParentSearch');
            closeBtn.addEventListener('click', function() {
                newParentRow.remove();
            });

            // Initialiser Select2 sur le nouveau champ select (pour la recherche)
            // Assure-toi que jQuery et Select2 sont chargés
            $(newParentRow.find('.search-parent-select')).select2({
                placeholder: "Rechercher un parent existant...",
                width: '100%',
                ajax: {
                    url: '/api/parents/search/', // Ton URL d'API pour chercher les parents
                    dataType: 'json',
                    delay: 250,
                    processResults: function (data) {
                        return {
                            results: data.results // Adapte selon le format de ton API
                        };
                    }
                }
            });
        });
    }
});

// Initialize the pupils manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Vérifier l'authentification avant de créer l'instance
    if (checkAuth()) {
        window.pupilsManager = new PupilsManager();
    }
});