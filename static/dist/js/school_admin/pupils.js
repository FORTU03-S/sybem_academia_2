
async function apiRequest(url, method = 'GET', data = null) {
    
    const token = localStorage.getItem('access_token');

    const headers = {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCookie('csrftoken')
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`; 
    }

    const config = {
        method: method,
        headers: headers, 
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
        
        if (!checkAuth()) {
            return;
        }
        
        this.bindEvents();
        this.loadInitialData();
        this.setupDataTable();
    }
    
    bindEvents() {
        
        $('#toggleFilters').click(() => $('#filtersSection').toggle());
        $('#exportBtn').click(() => $('#exportMenu').toggle());
        $('.export-option').click((e) => this.handleExport(e.target.textContent));
        
        $('#addStudentBtn').click(() => this.openStudentModal());
        
        $('#applyFilters').click(() => this.applyFilters());
        $('#resetFilters').click(() => this.resetFilters());
        
        $('#prevPage').click(() => this.changePage(this.currentPage - 1));
        $('#nextPage').click(() => this.changePage(this.currentPage + 1));
        $('#rowsPerPage').change((e) => {
            this.rowsPerPage = parseInt(e.target.value);
            this.currentPage = 1;
            this.loadStudents();
        });
        
        let searchTimeout;
        $('#searchInput').on('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.filters.search = e.target.value;
                this.currentPage = 1;
                this.loadStudents();
            }, 500);
        });
        
        $('#statusFilter, #classFilter, #genderFilter, #periodFilter').change((e) => {
            const filterId = e.target.id.replace('Filter', '');
            this.filters[filterId] = e.target.value;
            this.currentPage = 1;
            this.loadStudents();
        });
        
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
    
        $('#closeModal, #cancelModal').click(() => this.closeStudentModal());
        $('#studentForm').submit((e) => {
            e.preventDefault();
            this.saveStudent();
        });
        
        $('#status').change((e) => {
            $('#droppedAtContainer').toggle(e.target.value === 'dropped');
        });
        
        $('#addParentBtn').click(() => this.addParentRow());
        
        $('#selectAll').change((e) => {
            const isChecked = e.target.checked;
            $('.student-checkbox').prop('checked', isChecked);
            this.updateSelectedCount();
        });
        
        $('#bulkActionsBtn').click(() => this.showBulkActions());
        
        $('#cancelDelete').click(() => $('#deleteModal').addClass('hidden'));
        $('#confirmDelete').click(() => this.deleteStudent());
        
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
        
        $(document).click((e) => {
            if (!$(e.target).closest('#exportBtn').length) {
                $('#exportMenu').addClass('hidden');
            }
        });
    }
    
    setupDataTable() {
    
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
        
        $('.dt-buttons').hide();
    }
    
    async loadInitialData() {
        try {
            if (!checkAuth()) {
                return;
            }

            const classes = await apiRequest('/api/academia/classes/');
            
            const periods = await apiRequest('/api/academic-periods/');
            
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
        
            this.populateDropdowns(classes, periods, parents);
        
            await this.loadStudents();
            
        } catch (error) {
            console.error('Error loading initial data:', error);
            showToast('Erreur de chargement des données: ' + error.message, 'error');
        }
    }
    
    populateDropdowns(classes, periods, parents) {
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
            
            const activePeriod = periods.find(p => p.is_current === true);
            if (activePeriod) {
                academicPeriod.val(activePeriod.id);
                console.log('Active academic period set:', activePeriod.name);
            }
        }
        
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
            if (!checkAuth()) {
                return;
            }

            $('#studentsTableBody').html(`
                <tr>
                    <td colspan="8" class="px-6 py-12 text-center">
                        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                        <p class="mt-2 text-gray-500">Chargement des élèves...</p>
                    </td>
                </tr>
            `);
            
            const schoolId = localStorage.getItem('school_id');
            const queryParams = new URLSearchParams({
                page: this.currentPage,
                page_size: this.rowsPerPage,
                ...this.filters
            });
            
            if (schoolId) {
                queryParams.append('school', schoolId);
            }
            
            const url = `${this.baseUrl}?${queryParams}`;
            const data = await apiRequest(url);
            
            if (data.results !== undefined) {
                // Paginated
                this.renderStudents(data.results);
                this.updatePagination(data.count);
                this.updateStats(data.stats || this.calculateStats(data.results));
            } else {
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
    viewBulletin(studentId, classId) {
    if (!classId || classId === null) {
        Swal.fire({
            title: 'Attention',
            text: "Cet élève n'est affecté à aucune classe. Impossible de voir son bulletin.",
            icon: 'warning',
            confirmButtonColor: '#4f46e5'
        });
        return;
    }
    
    window.location.href = `/static/dist/html/school_admin/student_report.html?student_id=${studentId}&class_id=${classId}`;
}
   renderStudents(students) {
    if (!students || students.length === 0) {
        $('#studentsTableBody').html(`
            <tr>
                <td colspan="8" class="px-6 py-12 text-center text-gray-500">
                    <i class="fas fa-user-slash text-3xl mb-3"></i>
                    <p class="text-lg">Aucun élève trouvé</p>
                </td>
            </tr>
        `);
        return;
    }

    const rows = students.map(student => {
        
        const fullName = [student.last_name, student.middle_name, student.first_name].filter(Boolean).join(' ');
        let imageUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=6366f1&color=fff`;
        if (student.profile_picture) {
            imageUrl = student.profile_picture; 
        }

    console.log(`Élève: ${student.last_name}, Classe Data:`, student.current_classe);

    const className = student.current_classe 
    ? (student.current_classe.name || "Objet trouvé mais nom vide") 
    : `<span class="text-red-400">ID: ${student.id} n'a pas de classe dans le JSON</span>`;

        return `
            <tr class="hover:bg-gray-50 dark:hover:bg-slate-900 transition-colors">
                <td class="px-6 py-4">
                    <input type="checkbox" class="student-checkbox rounded" value="${student.id}" onchange="pupilsManager.updateSelectedCount()">
                </td>
                <td class="px-6 py-4">
                    <div class="flex items-center">
                        <img class="h-10 w-10 rounded-full object-cover" src="${imageUrl}">
                        <div class="ml-4">
                            <div class="text-sm font-medium text-gray-900 dark:text-white">
                                ${student.last_name} ${student.middle_name ? student.middle_name : ''} ${student.first_name}
                            </div>
                            <div class="text-xs text-gray-500">
                                ${student.gender === 'Male' ? 'Garçon' : 'Fille'}
                            </div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 text-sm font-mono">${student.student_id_code || 'N/A'}</td>
                <td class="px-6 py-4">
                    <span class="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                        ${className}
                    </span>
                </td>
                <td class="px-6 py-4">
                    <div class="flex flex-wrap gap-1">
                        ${student.parents && student.parents.length > 0 
                            ? student.parents.map(p => `
                                <span class="px-2 py-1 rounded-full text-[10px] bg-purple-100 text-purple-800" title="${p.user_email}">
                                    ${p.full_name}
                                </span>
                            `).join('') 
                            : '<span class="text-gray-400 text-xs italic">Aucun parent</span>'
                        }
                    </div>
                </td>
                <td class="px-6 py-4 text-sm">${student.enrollment_date || 'N/A'}</td>
                <td class="px-6 py-4">${statusBadge(student.status)}</td>
                // ... (ton code précédent)
<td class="px-6 py-4">
    <div class="flex gap-2">
        <button onclick="pupilsManager.viewBulletin(${student.id}, ${student.current_classe ? student.current_classe.id : 'null'})" 
                                class="flex items-center justify-center w-8 h-8 text-purple-600 hover:bg-purple-600 hover:text-white bg-purple-50 rounded-lg transition-all" 
                                title="Bulletin Officiel">
                            <i class="fas fa-file-invoice"></i>
                        </button>

        <button onclick="pupilsManager.editStudent(${student.id})" class="text-indigo-600 hover:text-indigo-900 p-1.5">
            <i class="fas fa-edit"></i>
        </button>
        
        <button onclick="pupilsManager.confirmDelete(${student.id})" class="text-red-600 hover:text-red-900 p-1.5">
            <i class="fas fa-trash"></i>
        </button>
    </div>
</td>
// ...
            </tr>
        `;
    }).join('');
    
    $('#studentsTableBody').html(rows);
}
    
    updatePagination(total) {
        this.totalRows = total;
        this.totalPages = Math.ceil(total / this.rowsPerPage);
        
        // Update 
        const start = (this.currentPage - 1) * this.rowsPerPage + 1;
        const end = Math.min(this.currentPage * this.rowsPerPage, total);
        
        $('#paginationInfo').text(`Affichage de ${start} à ${end} sur ${total} élèves`);
        
        const pageNumbers = $('#pageNumbers');
        pageNumbers.empty();
        
        // Previous page 
        $('#prevPage').prop('disabled', this.currentPage === 1);
        
        // Generate page 
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
            
            this.populateParents(student.parents || []);
        } else {
            $('#studentForm')[0].reset();
            $('#studentId').val('');
            $('#profilePreview').attr('src', 'https://ui-avatars.com/api/?name=Élève&background=6366f1&color=fff');
            $('#status').val('active');
            $('#droppedAtContainer').addClass('hidden');
            $('#parentsContainer').empty();
            
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
    
        $('#parentsContainer .remove-parent:last').click(function() {
            $(this).closest('div').remove();
        });
    }
    
    async saveStudent() {
        try {
            if (!checkAuth()) {
                return;
            }
            console.log("ID de la classe sélectionnée :", $('#currentClasse').val());
            const formData = new FormData();

            formData.append('last_name', $('#lastName').val());
            formData.append('middle_name', $('#middleName').val());
            formData.append('first_name', $('#firstName').val());
            formData.append('date_of_birth', $('#dateOfBirth').val());
            formData.append('gender', $('#gender').val());
            formData.append('student_id_code', $('#studentIdCode').val());
            // Remplace :
            formData.append('current_classe_id', $('#currentClasse').val());
            formData.append('academic_period', $('#academicPeriod').val());
            formData.append('status', $('#status').val());
            if ($('#status').val() === 'dropped' && $('#droppedAt').val()) {
                formData.append('dropped_at', $('#droppedAt').val());
            }

            const parentIds = $('.parent-id').map((i, el) => el.value).get();
            parentIds.forEach((id, index) => {
                if (id) { 
                    formData.append(`parents`, id);
                }
            });

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
                
                const promises = Array.from(this.selectedStudents).map(id => 
                    apiRequest(`${this.baseUrl}${id}/`, 'DELETE')
                );
                
                await Promise.all(promises);
                showToast(`${this.selectedStudents.size} élève(s) supprimé(s)`, 'success');
                this.selectedStudents.clear();
                this.updateSelectedCount();
            } else if (this.currentStudentId) {
            
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
        
        $('#bulkActionsBtn').after(actions);
        
        $('.bulk-action').click((e) => {
            const action = e.target.dataset.action;
            this.handleBulkAction(action);
            $(e.target).closest('div').remove();
        });
        
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
    
    const addParentBtn = document.getElementById('addParentBtn');
    const parentsContainer = document.getElementById('parentsContainer');
    const parentTemplate = document.getElementById('parentSearchTemplate');

    if(addParentBtn && parentsContainer && parentTemplate) {
        addParentBtn.addEventListener('click', function() {
            
            const newParentRow = parentTemplate.cloneNode(true);
            
            newParentRow.removeAttribute('id');
            newParentRow.classList.remove('hidden');
        
            parentsContainer.appendChild(newParentRow);

            const closeBtn = newParentRow.querySelector('.closeParentSearch');
            closeBtn.addEventListener('click', function() {
                newParentRow.remove();
            });

        
            $(newParentRow.find('.search-parent-select')).select2({
                placeholder: "Rechercher un parent existant...",
                width: '100%',
                ajax: {
                    url: '/api/parents/search/',
                    dataType: 'json',
                    delay: 250,
                    processResults: function (data) {
                        return {
                            results: data.results 
                        };
                    }
                }
            });
        });
    }
});

// Initialisation 
let pupilsManager;
$(document).ready(() => {
    pupilsManager = new PupilsManager();
});


document.addEventListener('DOMContentLoaded', () => {
    
    if (checkAuth()) {
        window.pupilsManager = new PupilsManager();
    }
});