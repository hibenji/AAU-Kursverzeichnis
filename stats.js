// State
const state = {
    search: '',
    search_id: '',
    typ: '',
    semester: '',
    org: '',
    sort: 'averageGrade',
    dir: 'asc',
    page: 1,
    limit: 25,
    exclude_nan: true,
    exclude_participation: true
};

// DOM
const els = {
    search: document.getElementById('search'),
    searchId: document.getElementById('search-id'),
    typ: document.getElementById('typ'),
    semester: document.getElementById('semester'),
    org: document.getElementById('org'),
    sortSelect: document.getElementById('sort-select'),
    perPage: document.getElementById('per-page'),
    resetBtn: document.getElementById('reset-filters'),
    excludeNan: document.getElementById('exclude-nan'),
    excludeParticipation: document.getElementById('exclude-participation'),
    resultCount: document.getElementById('result-count'),
    list: document.getElementById('stats-list'),
    pagination: document.getElementById('pagination')
};

// Grade colors (1 = best, 5 = worst)
const gradeColors = ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444'];
const gradeLabels = ['Sehr Gut (1)', 'Gut (2)', 'Befriedigend (3)', 'Genügend (4)', 'Nicht Genügend (5)'];

function debounce(fn, delay) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), delay); };
}

// URL state
function updateURL() {
    const p = new URLSearchParams();
    if (state.search) p.set('search', state.search);
    if (state.search_id) p.set('search_id', state.search_id);
    if (state.typ) p.set('typ', state.typ);
    if (state.semester) p.set('semester', state.semester);
    if (state.org) p.set('org', state.org);
    if (state.sort !== 'averageGrade' || state.dir !== 'asc') {
        p.set('sort', state.sort);
        p.set('dir', state.dir);
    }
    if (state.page > 1) p.set('page', state.page);
    if (state.limit !== 25) p.set('limit', state.limit);
    if (!state.exclude_nan) p.set('exclude_nan', '0');
    if (!state.exclude_participation) p.set('exclude_participation', '0');
    history.replaceState(null, '', p.toString() ? `?${p}` : window.location.pathname);
}

function loadURL() {
    const p = new URLSearchParams(window.location.search);
    if (p.has('search')) state.search = p.get('search');
    if (p.has('search_id')) state.search_id = p.get('search_id');
    if (p.has('typ')) state.typ = p.get('typ');
    if (p.has('semester')) state.semester = p.get('semester');
    if (p.has('org')) state.org = p.get('org');
    if (p.has('sort')) state.sort = p.get('sort');
    if (p.has('dir')) state.dir = p.get('dir');
    if (p.has('page')) state.page = parseInt(p.get('page')) || 1;
    if (p.has('limit')) state.limit = parseInt(p.get('limit')) || 25;
    if (p.has('exclude_nan')) state.exclude_nan = p.get('exclude_nan') !== '0';
    if (p.has('exclude_participation')) state.exclude_participation = p.get('exclude_participation') !== '0';
    syncUI();
}

function syncUI() {
    els.search.value = state.search;
    els.searchId.value = state.search_id;
    els.typ.value = state.typ;
    els.semester.value = state.semester;
    els.org.value = state.org;
    els.sortSelect.value = `${state.sort}:${state.dir}`;
    els.perPage.value = state.limit;
    els.excludeNan.checked = state.exclude_nan;
    els.excludeParticipation.checked = state.exclude_participation;
}

// Fetch
async function fetchStats() {
    els.list.classList.add('loading');

    const p = new URLSearchParams();
    if (state.search) p.set('search', state.search);
    if (state.search_id) p.set('search_id', state.search_id);
    if (state.typ) p.set('typ', state.typ);
    if (state.semester) p.set('semester', state.semester);
    if (state.org) p.set('org', state.org);
    p.set('sort', state.sort);
    p.set('dir', state.dir);
    p.set('page', state.page);
    p.set('limit', state.limit);
    if (state.exclude_nan) p.set('exclude_nan', '1');
    if (state.exclude_participation) p.set('exclude_participation', '1');

    try {
        const res = await fetch(`api/stats.php?${p}`);
        const data = await res.json();
        renderStats(data.courses);
        renderPagination(data.pages, data.page);
        els.resultCount.textContent = data.total;
        updateURL();

        // Populate filter dropdowns on first load
        if (els.semester.options.length <= 1 && data.semesters) {
            data.semesters.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s;
                opt.textContent = s;
                els.semester.appendChild(opt);
            });
            els.semester.value = state.semester;
        }
        if (els.typ.options.length <= 1 && data.typen) {
            data.typen.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t;
                opt.textContent = t;
                els.typ.appendChild(opt);
            });
            els.typ.value = state.typ;
        }
        if (els.org.options.length <= 1 && data.orgs) {
            data.orgs.forEach(o => {
                const opt = document.createElement('option');
                opt.value = o;
                opt.textContent = o;
                els.org.appendChild(opt);
            });
            els.org.value = state.org;
        }
    } catch (e) {
        console.error('Fetch error:', e);
        els.list.innerHTML = '<div class="loading-state">Fehler beim Laden. Bitte versuchen Sie es erneut.</div>';
    } finally {
        els.list.classList.remove('loading');
    }
}

function esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
}

function getGradeColor(avg) {
    if (avg <= 1.5) return '#22c55e';
    if (avg <= 2.5) return '#84cc16';
    if (avg <= 3.5) return '#eab308';
    if (avg <= 4.5) return '#f97316';
    return '#ef4444';
}

function renderStats(courses) {
    if (!courses || courses.length === 0) {
        els.list.innerHTML = '<div class="loading-state">Keine Kurse mit Notenstatistiken gefunden.</div>';
        return;
    }

    els.list.innerHTML = courses.map(c => {
        const dist = JSON.parse(c.gradeDistributionString || '[]');
        const total = dist.reduce((a, b) => a + b, 0);
        const avg = parseFloat(c.averageGrade);
        const avgColor = getGradeColor(avg);

        // Build bar segments
        const bars = dist.map((count, i) => {
            const pct = total > 0 ? (count / total * 100) : 0;
            if (pct === 0) return '';
            return `<div class="grade-segment" style="width:${pct}%;background:${gradeColors[i]}" title="${gradeLabels[i]}: ${count} (${pct.toFixed(1)}%)"></div>`;
        }).join('');

        // Build legend
        const legend = dist.map((count, i) => {
            const pct = total > 0 ? (count / total * 100).toFixed(1) : '0';
            return `<span class="grade-legend-item">
                <span class="grade-dot" style="background:${gradeColors[i]}"></span>
                <span class="grade-label">${i + 1}</span>
                <span class="grade-value">${count}</span>
                <span class="grade-pct">(${pct}%)</span>
            </span>`;
        }).join('');

        return `
        <div class="stat-card">
            <div class="stat-card-header">
                <div class="stat-card-info">
                    <h3 class="stat-title">${esc(c.title)}</h3>
                    <div class="stat-meta">
                        ${c.professors ? `<span class="stat-prof">${esc(c.professors)}</span>` : ''}
                        <span class="stat-semester">${esc(c.semester)}</span>
                        ${c.typ ? `<span class="stat-typ">${esc(c.typ)}</span>` : ''}
                        ${c.organisationseinheit ? `<span class="stat-org">${esc(c.organisationseinheit)}</span>` : ''}
                    </div>
                </div>
                <div class="stat-avg" style="--avg-color: ${avgColor}">
                    <span class="avg-number">Ø ${avg.toFixed(2)}</span>
                    <span class="avg-count">${c.numberOfGrades} Noten</span>
                </div>
            </div>
            <div class="grade-bar">${bars}</div>
            <div class="grade-legend">${legend}</div>
        </div>`;
    }).join('');
}

// Pagination (reuses same pattern as main site)
function renderPagination(totalPages, currentPage) {
    if (totalPages <= 1) {
        els.pagination.innerHTML = '';
        return;
    }

    let html = '';
    html += `<button ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}">←</button>`;

    const maxVisible = 7;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);

    if (start > 1) {
        html += `<button data-page="1">1</button>`;
        if (start > 2) html += `<span class="pagination-ellipsis">…</span>`;
    }
    for (let i = start; i <= end; i++) {
        html += `<button data-page="${i}" class="${i === currentPage ? 'active' : ''}">${i}</button>`;
    }
    if (end < totalPages) {
        if (end < totalPages - 1) html += `<span class="pagination-ellipsis">…</span>`;
        html += `<button data-page="${totalPages}">${totalPages}</button>`;
    }
    html += `<button ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">→</button>`;

    els.pagination.innerHTML = html;
}

// Events
const debouncedFetch = debounce(() => fetchStats(), 50);

els.search.addEventListener('input', e => {
    state.search = e.target.value;
    state.page = 1;
    debouncedFetch();
});

els.searchId.addEventListener('input', debounce(e => {
    state.search_id = e.target.value;
    state.page = 1;
    fetchStats();
}, 250));

els.typ.addEventListener('change', e => {
    state.typ = e.target.value;
    state.page = 1;
    fetchStats();
});

els.semester.addEventListener('change', e => {
    state.semester = e.target.value;
    state.page = 1;
    fetchStats();
});

els.org.addEventListener('change', e => {
    state.org = e.target.value;
    state.page = 1;
    fetchStats();
});

els.sortSelect.addEventListener('change', e => {
    const [sort, dir] = e.target.value.split(':');
    state.sort = sort;
    state.dir = dir;
    state.page = 1;
    fetchStats();
});

els.perPage.addEventListener('change', e => {
    state.limit = parseInt(e.target.value);
    state.page = 1;
    fetchStats();
});

els.excludeNan.addEventListener('change', e => {
    state.exclude_nan = e.target.checked;
    state.page = 1;
    fetchStats();
});

els.excludeParticipation.addEventListener('change', e => {
    state.exclude_participation = e.target.checked;
    state.page = 1;
    fetchStats();
});

els.resetBtn.addEventListener('click', () => {
    state.search = '';
    state.search_id = '';
    state.typ = '';
    state.semester = '';
    state.org = '';
    state.sort = 'averageGrade';
    state.dir = 'asc';
    state.page = 1;
    state.exclude_nan = true;
    state.exclude_participation = true;
    syncUI();
    fetchStats();
});

els.pagination.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    state.page = parseInt(btn.dataset.page);
    fetchStats();
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Init
document.addEventListener('DOMContentLoaded', () => {
    loadURL();
    fetchStats();
});
