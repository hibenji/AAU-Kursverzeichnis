// State
const state = {
    filters: {
        search: '',
        course_type: '',
        schedule_day: '',
        lv_modell: '',
        unterrichtssprache: '',
        semester: '',
        ects_min: '',
        ects_max: ''
    },
    sort: 'course_code',
    dir: 'asc',
    page: 1,
    limit: 25
};

// DOM Elements
const elements = {
    search: document.getElementById('search'),
    courseType: document.getElementById('course_type'),
    scheduleDay: document.getElementById('schedule_day'),
    lvModell: document.getElementById('lv_modell'),
    sprache: document.getElementById('unterrichtssprache'),
    semester: document.getElementById('semester'),
    ectsMin: document.getElementById('ects_min'),
    ectsMax: document.getElementById('ects_max'),
    perPage: document.getElementById('per-page'),
    resetBtn: document.getElementById('reset-filters'),
    resultCount: document.getElementById('result-count'),
    tbody: document.getElementById('courses-body'),
    pagination: document.getElementById('pagination'),
    table: document.getElementById('courses-table')
};

// Debounce helper
function debounce(fn, delay) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

// URL state management
function updateURLState() {
    const params = new URLSearchParams();
    Object.entries(state.filters).forEach(([key, val]) => {
        if (val) params.set(key, val);
    });
    if (state.sort !== 'course_code') params.set('sort', state.sort);
    if (state.dir !== 'asc') params.set('dir', state.dir);
    if (state.page > 1) params.set('page', state.page);
    if (state.limit !== 25) params.set('limit', state.limit);
    
    const url = params.toString() ? `?${params.toString()}` : window.location.pathname;
    history.replaceState(null, '', url);
}

function loadURLState() {
    const params = new URLSearchParams(window.location.search);
    
    Object.keys(state.filters).forEach(key => {
        if (params.has(key)) {
            state.filters[key] = params.get(key);
        }
    });
    
    if (params.has('sort')) state.sort = params.get('sort');
    if (params.has('dir')) state.dir = params.get('dir');
    if (params.has('page')) state.page = parseInt(params.get('page')) || 1;
    if (params.has('limit')) state.limit = parseInt(params.get('limit')) || 25;
    
    // Sync UI with state
    syncUIWithState();
}

function syncUIWithState() {
    elements.search.value = state.filters.search;
    
    elements.courseType.value = state.filters.course_type;
    elements.scheduleDay.value = state.filters.schedule_day;
    elements.lvModell.value = state.filters.lv_modell;
    elements.sprache.value = state.filters.unterrichtssprache;
    elements.semester.value = state.filters.semester;
    elements.ectsMin.value = state.filters.ects_min;
    elements.ectsMax.value = state.filters.ects_max;
    elements.perPage.value = state.limit;
}

// Load filter options
async function loadFilterOptions() {
    try {
        const response = await fetch('api/options.php');
        const options = await response.json();
        
        const populateSelect = (select, values) => {
            const currentVal = select.value;
            const firstOption = select.options[0].outerHTML;
            select.innerHTML = firstOption;
            values.forEach(val => {
                if (val) {
                    const option = document.createElement('option');
                    option.value = val;
                    option.textContent = val;
                    select.appendChild(option);
                }
            });
            select.value = currentVal;
        };
        
        populateSelect(elements.courseType, options.course_type || []);
        populateSelect(elements.scheduleDay, options.schedule_day || []);
        populateSelect(elements.lvModell, options.lv_modell || []);
        populateSelect(elements.sprache, options.unterrichtssprache || []);
        populateSelect(elements.semester, options.semester || []);
        
        // Sync again after options load
        syncUIWithState();
    } catch (err) {
        console.error('Failed to load filter options:', err);
    }
}

// Fetch courses
async function fetchCourses() {
    showLoading();
    
    const params = new URLSearchParams();
    Object.entries(state.filters).forEach(([key, val]) => {
        if (val) params.set(key, val);
    });
    params.set('sort', state.sort);
    params.set('dir', state.dir);
    params.set('page', state.page);
    params.set('limit', state.limit);
    
    try {
        const response = await fetch(`api/courses.php?${params.toString()}`);
        const data = await response.json();
        renderCourses(data.courses);
        renderPagination(data.pages, data.page);
        elements.resultCount.textContent = data.total;
        updateURLState();
    } catch (err) {
        console.error('Failed to fetch courses:', err);
        showError();
    } finally {
        hideLoading();
    }
}

// Render courses table
function renderCourses(courses) {
    if (!courses || courses.length === 0) {
        elements.tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="6">Keine Kurse gefunden. Versuchen Sie andere Filterkriterien.</td>
            </tr>
        `;
        return;
    }
    
    elements.tbody.innerHTML = courses.map(course => `
        <tr onclick="window.location='course.php?id=${course.id}'">
            <td>${escapeHtml(course.course_code)}</td>
            <td class="course-name">${escapeHtml(course.course_name || '')}</td>
            <td class="course-type-cell">${escapeHtml(course.course_type || '')}</td>
            <td class="instructor-cell" title="${escapeHtml(course.instructors || '')}">${escapeHtml(course.instructors || '–')}</td>
            <td class="schedule-cell">${formatSchedule(course)}</td>
            <td class="ects-cell">${course.ects || '–'}</td>
        </tr>
    `).join('');
}

function formatSchedule(course) {
    const parts = [];
    if (course.schedule_day) parts.push(course.schedule_day);
    if (course.schedule_time) parts.push(course.schedule_time);
    return parts.length > 0 ? escapeHtml(parts.join(' ')) : '–';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

function showLoading() {
    elements.tbody.classList.add('loading');
}

function hideLoading() {
    elements.tbody.classList.remove('loading');
}

function showError() {
    elements.tbody.innerHTML = `
        <tr class="empty-row">
            <td colspan="6">Fehler beim Laden. Bitte versuchen Sie es erneut.</td>
        </tr>
    `;
}

// Render pagination
function renderPagination(totalPages, currentPage) {
    if (totalPages <= 1) {
        elements.pagination.innerHTML = '';
        return;
    }
    
    let html = '';
    
    // Previous button
    html += `<button ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}">←</button>`;
    
    // Page buttons
    const maxVisible = 7;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    
    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }
    
    if (startPage > 1) {
        html += `<button data-page="1">1</button>`;
        if (startPage > 2) html += `<span class="pagination-ellipsis">…</span>`;
    }
    
    for (let i = startPage; i <= endPage; i++) {
        html += `<button data-page="${i}" class="${i === currentPage ? 'active' : ''}">${i}</button>`;
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<span class="pagination-ellipsis">…</span>`;
        html += `<button data-page="${totalPages}">${totalPages}</button>`;
    }
    
    // Next button
    html += `<button ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">→</button>`;
    
    elements.pagination.innerHTML = html;
}

// Event handlers
const debouncedFetch = debounce(() => fetchCourses(), 10);

elements.search.addEventListener('input', (e) => {
    state.filters.search = e.target.value;
    state.page = 1;
    debouncedFetch();
});

['courseType', 'scheduleDay', 'lvModell', 'sprache', 'semester'].forEach(key => {
    const fieldMap = {
        courseType: 'course_type',
        scheduleDay: 'schedule_day',
        lvModell: 'lv_modell',
        sprache: 'unterrichtssprache',
        semester: 'semester'
    };
    elements[key].addEventListener('change', (e) => {
        state.filters[fieldMap[key]] = e.target.value;
        state.page = 1;
        fetchCourses();
    });
});

elements.ectsMin.addEventListener('input', debounce((e) => {
    state.filters.ects_min = e.target.value;
    state.page = 1;
    fetchCourses();
}, 10));

elements.ectsMax.addEventListener('input', debounce((e) => {
    state.filters.ects_max = e.target.value;
    state.page = 1;
    fetchCourses();
}, 10));

elements.perPage.addEventListener('change', (e) => {
    state.limit = parseInt(e.target.value);
    state.page = 1;
    fetchCourses();
});

elements.resetBtn.addEventListener('click', () => {
    Object.keys(state.filters).forEach(key => state.filters[key] = '');
    state.page = 1;
    state.sort = 'course_code';
    state.dir = 'asc';
    syncUIWithState();
    updateSortUI();
    fetchCourses();
});

// Sorting
elements.table.querySelector('thead').addEventListener('click', (e) => {
    const th = e.target.closest('th.sortable');
    if (!th) return;
    
    const field = th.dataset.sort;
    if (state.sort === field) {
        state.dir = state.dir === 'asc' ? 'desc' : 'asc';
    } else {
        state.sort = field;
        state.dir = 'asc';
    }
    state.page = 1;
    updateSortUI();
    fetchCourses();
});

function updateSortUI() {
    document.querySelectorAll('th.sortable').forEach(th => {
        th.classList.remove('asc', 'desc');
        if (th.dataset.sort === state.sort) {
            th.classList.add(state.dir);
        }
    });
}

// Pagination clicks
elements.pagination.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    
    state.page = parseInt(btn.dataset.page);
    fetchCourses();
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    loadURLState();
    await loadFilterOptions();
    updateSortUI();
    fetchCourses();
});
