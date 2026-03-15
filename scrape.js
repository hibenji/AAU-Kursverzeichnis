// State
const state = {
    search: '',
    typ: '',
    semester: '',
    status: '',
    page: 1,
    limit: 25,
    selected: new Set()
};

// DOM
const els = {
    search: document.getElementById('search'),
    typ: document.getElementById('typ'),
    semester: document.getElementById('semester'),
    status: document.getElementById('status'),
    resetBtn: document.getElementById('reset-filters'),
    resultCount: document.getElementById('result-count'),
    list: document.getElementById('scrape-list'),
    pagination: document.getElementById('pagination'),
    selectAll: document.getElementById('select-all'),
    selectUnscraped: document.getElementById('select-unscraped'),
    scrapeBtn: document.getElementById('scrape-btn'),
    scrapeBtnCount: document.querySelector('.scrape-btn-count'),
    progressOverlay: document.getElementById('scrape-progress'),
    progressFill: document.getElementById('progress-fill'),
    progressText: document.getElementById('progress-text'),
    progressLog: document.getElementById('progress-log')
};

function debounce(fn, delay) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), delay); };
}

function esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
}

// URL state
function updateURL() {
    const p = new URLSearchParams();
    if (state.search) p.set('search', state.search);
    if (state.typ) p.set('typ', state.typ);
    if (state.semester) p.set('semester', state.semester);
    if (state.status) p.set('status', state.status);
    if (state.page > 1) p.set('page', state.page);
    history.replaceState(null, '', p.toString() ? `?${p}` : window.location.pathname);
}

function loadURL() {
    const p = new URLSearchParams(window.location.search);
    if (p.has('search')) state.search = p.get('search');
    if (p.has('typ')) state.typ = p.get('typ');
    if (p.has('semester')) state.semester = p.get('semester');
    if (p.has('status')) state.status = p.get('status');
    if (p.has('page')) state.page = parseInt(p.get('page')) || 1;
    syncUI();
}

function syncUI() {
    els.search.value = state.search;
    els.typ.value = state.typ;
    els.semester.value = state.semester;
    els.status.value = state.status;
}

function updateSelectionUI() {
    const count = state.selected.size;
    els.scrapeBtnCount.textContent = `(${count})`;
    els.scrapeBtn.disabled = count === 0;
}

// Fetch courses
async function fetchCourses() {
    els.list.classList.add('loading');

    const p = new URLSearchParams();
    p.set('action', 'list');
    if (state.search) p.set('search', state.search);
    if (state.typ) p.set('typ', state.typ);
    if (state.semester) p.set('semester', state.semester);
    if (state.status) p.set('status', state.status);
    p.set('page', state.page);
    p.set('limit', state.limit);

    try {
        const res = await fetch(`api/scrape.php?${p}`);
        const data = await res.json();
        renderCourses(data.courses);
        renderPagination(data.pages, data.page);
        els.resultCount.textContent = data.total;
        updateURL();

        // Populate filters on first load
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
    } catch (e) {
        console.error('Fetch error:', e);
        els.list.innerHTML = '<div class="loading-state">Fehler beim Laden.</div>';
    } finally {
        els.list.classList.remove('loading');
    }
}

function renderCourses(courses) {
    if (!courses || courses.length === 0) {
        els.list.innerHTML = '<div class="loading-state">Keine Kurse gefunden.</div>';
        return;
    }

    els.list.innerHTML = courses.map(c => {
        const isSelected = state.selected.has(c.lvnr);
        const allScraped = parseInt(c.scraped_count) >= parseInt(c.semester_count);
        const noneScraped = parseInt(c.scraped_count) === 0;
        const semesterList = (c.semesters || '').split(',');

        let statusClass = 'scrape-status-partial';
        let statusText = `${c.scraped_count}/${c.semester_count}`;
        if (allScraped) {
            statusClass = 'scrape-status-done';
            statusText = `✓ ${c.semester_count}/${c.semester_count}`;
        } else if (noneScraped) {
            statusClass = 'scrape-status-none';
            statusText = `0/${c.semester_count}`;
        }

        return `
        <div class="scrape-card ${isSelected ? 'scrape-card-selected' : ''}" data-lvnr="${esc(c.lvnr)}">
            <label class="scrape-card-check">
                <input type="checkbox" ${isSelected ? 'checked' : ''} data-lvnr="${esc(c.lvnr)}">
            </label>
            <div class="scrape-card-info">
                <div class="scrape-card-title">
                    <span class="scrape-lvnr">${esc(c.lvnr)}</span>
                    <span class="scrape-name">${esc(c.title)}</span>
                </div>
                <div class="scrape-card-meta">
                    ${c.typ ? `<span class="stat-typ">${esc(c.typ)}</span>` : ''}
                    ${c.professors ? `<span class="stat-prof">${esc(c.professors)}</span>` : ''}
                    <span class="scrape-semesters">${semesterList.map(s => `<span class="scrape-sem-tag">${esc(s)}</span>`).join('')}</span>
                </div>
            </div>
            <div class="scrape-card-status ${statusClass}">
                ${statusText}
            </div>
        </div>`;
    }).join('');

    // Update select-all checkbox
    const checkboxes = els.list.querySelectorAll('input[type="checkbox"]');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    els.selectAll.checked = allChecked && checkboxes.length > 0;
}

// Pagination (same pattern as stats page)
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

// Scrape selected courses
async function scrapeSelected() {
    if (state.selected.size === 0) return;

    const lvnrs = Array.from(state.selected);
    els.progressOverlay.style.display = 'flex';
    els.progressFill.style.width = '0%';
    els.progressText.textContent = `Scrape ${lvnrs.length} Kurse wird gestartet...`;
    els.progressLog.innerHTML = '';

    try {
        const res = await fetch('api/scrape.php?action=scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lvnrs })
        });
        const data = await res.json();

        if (data.error) {
            els.progressText.textContent = `Fehler: ${data.error}`;
            return;
        }

        els.progressFill.style.width = '100%';
        els.progressText.textContent = `Fertig! ${data.scraped} gescraped, ${data.errors} Fehler (${data.total} IDs total)`;

        // Show result log
        if (data.results) {
            const logHtml = data.results.map(r => {
                const icon = r.status === 'ok' ? '✓' : r.status === 'no_data' ? '–' : '✗';
                const cls = r.status === 'ok' ? 'log-ok' : r.status === 'no_data' ? 'log-nodata' : 'log-error';
                return `<div class="log-entry ${cls}">${icon} ${r.lvnr} (${r.semester}) — ${r.status}</div>`;
            }).join('');
            els.progressLog.innerHTML = logHtml;
        }

        // Clear selection and refresh
        state.selected.clear();
        updateSelectionUI();
        setTimeout(() => fetchCourses(), 1000);
    } catch (e) {
        els.progressText.textContent = `Netzwerkfehler: ${e.message}`;
    }
}

// Events
const debouncedFetch = debounce(() => fetchCourses(), 50);

els.search.addEventListener('input', e => {
    state.search = e.target.value;
    state.page = 1;
    debouncedFetch();
});

els.typ.addEventListener('change', e => {
    state.typ = e.target.value;
    state.page = 1;
    fetchCourses();
});

els.semester.addEventListener('change', e => {
    state.semester = e.target.value;
    state.page = 1;
    fetchCourses();
});

els.status.addEventListener('change', e => {
    state.status = e.target.value;
    state.page = 1;
    fetchCourses();
});

els.resetBtn.addEventListener('click', () => {
    state.search = '';
    state.typ = '';
    state.semester = '';
    state.status = '';
    state.page = 1;
    state.selected.clear();
    syncUI();
    updateSelectionUI();
    fetchCourses();
});

// Checkbox handling via event delegation
els.list.addEventListener('change', e => {
    if (e.target.type !== 'checkbox') return;
    const lvnr = e.target.dataset.lvnr;
    if (!lvnr) return;
    if (e.target.checked) {
        state.selected.add(lvnr);
        e.target.closest('.scrape-card')?.classList.add('scrape-card-selected');
    } else {
        state.selected.delete(lvnr);
        e.target.closest('.scrape-card')?.classList.remove('scrape-card-selected');
    }
    updateSelectionUI();
});

// Click entire card to toggle
els.list.addEventListener('click', e => {
    const card = e.target.closest('.scrape-card');
    if (!card || e.target.type === 'checkbox' || e.target.closest('label')) return;
    const cb = card.querySelector('input[type="checkbox"]');
    if (cb) {
        cb.checked = !cb.checked;
        cb.dispatchEvent(new Event('change', { bubbles: true }));
    }
});

els.selectAll.addEventListener('change', e => {
    const checkboxes = els.list.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = e.target.checked;
        const lvnr = cb.dataset.lvnr;
        if (lvnr) {
            if (e.target.checked) state.selected.add(lvnr);
            else state.selected.delete(lvnr);
        }
        cb.closest('.scrape-card')?.classList.toggle('scrape-card-selected', e.target.checked);
    });
    updateSelectionUI();
});

els.selectUnscraped.addEventListener('click', () => {
    const cards = els.list.querySelectorAll('.scrape-card');
    cards.forEach(card => {
        const statusEl = card.querySelector('.scrape-card-status');
        if (statusEl && !statusEl.classList.contains('scrape-status-done')) {
            const cb = card.querySelector('input[type="checkbox"]');
            if (cb && !cb.checked) {
                cb.checked = true;
                const lvnr = cb.dataset.lvnr;
                if (lvnr) state.selected.add(lvnr);
                card.classList.add('scrape-card-selected');
            }
        }
    });
    updateSelectionUI();
});

els.scrapeBtn.addEventListener('click', () => scrapeSelected());

els.pagination.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    state.page = parseInt(btn.dataset.page);
    fetchCourses();
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Close progress overlay on click outside card
els.progressOverlay.addEventListener('click', e => {
    if (e.target === els.progressOverlay) {
        els.progressOverlay.style.display = 'none';
    }
});

// Init
document.addEventListener('DOMContentLoaded', () => {
    loadURL();
    fetchCourses();
});
