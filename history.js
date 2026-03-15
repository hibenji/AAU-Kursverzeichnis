// DOM
const els = {
    searchInput: document.getElementById('course-search'),
    searchResults: document.getElementById('search-results'),
    detail: document.getElementById('history-detail'),
    detailLvnr: document.getElementById('detail-lvnr'),
    detailTitle: document.getElementById('detail-title'),
    detailTyp: document.getElementById('detail-typ'),
    detailProf: document.getElementById('detail-prof'),
    detailCount: document.getElementById('detail-count'),
    summary: document.getElementById('history-summary'),
    chartBars: document.getElementById('chart-bars'),
    chartTrend: document.getElementById('chart-trend')
};

let barChart = null;
let trendChart = null;

const gradeColors = ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444'];
const gradeLabels = ['Sehr Gut (1)', 'Gut (2)', 'Befriedigend (3)', 'Genügend (4)', 'Nicht Genügend (5)'];

function debounce(fn, delay) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), delay); };
}

function esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
}

// Format semester code for display: "23W" -> "WS 23/24", "24S" -> "SS 24"
function formatSemester(code) {
    if (!code || code.length < 3) return code;
    const year = code.slice(0, 2);
    const season = code.slice(2);
    if (season === 'W') {
        const nextYear = String(parseInt(year) + 1).padStart(2, '0');
        return `WS ${year}/${nextYear}`;
    }
    return `SS ${year}`;
}

// Search
const doSearch = debounce(async (query) => {
    if (query.length < 2) {
        els.searchResults.innerHTML = '';
        els.searchResults.classList.remove('visible');
        return;
    }

    try {
        const res = await fetch(`api/history.php?action=search&q=${encodeURIComponent(query)}`);
        const data = await res.json();
        renderSearchResults(data.results);
    } catch (e) {
        console.error('Search error:', e);
    }
}, 50);

function renderSearchResults(results) {
    if (!results || results.length === 0) {
        els.searchResults.innerHTML = '<div class="search-no-results">Keine Kurse mit Notendaten gefunden.</div>';
        els.searchResults.classList.add('visible');
        return;
    }

    els.searchResults.innerHTML = results.map(r => `
        <div class="search-result-item" data-lvnr="${esc(r.lvnr)}">
            <span class="search-result-lvnr">${esc(r.lvnr)}</span>
            <span class="search-result-title">${esc(r.title)}</span>
            <span class="search-result-meta">
                ${r.typ ? `<span class="stat-typ">${esc(r.typ)}</span>` : ''}
                <span class="search-result-count">${r.data_count} Semester</span>
            </span>
        </div>
    `).join('');
    els.searchResults.classList.add('visible');
}

// Click result to load course
els.searchResults.addEventListener('click', e => {
    const item = e.target.closest('.search-result-item');
    if (!item) return;
    const lvnr = item.dataset.lvnr;
    els.searchInput.value = item.querySelector('.search-result-title').textContent;
    els.searchResults.classList.remove('visible');
    loadCourse(lvnr);
});

els.searchInput.addEventListener('input', e => doSearch(e.target.value));

// Close search on outside click
document.addEventListener('click', e => {
    if (!e.target.closest('.history-search-box')) {
        els.searchResults.classList.remove('visible');
    }
});

// Reopen on focus
els.searchInput.addEventListener('focus', () => {
    if (els.searchResults.innerHTML && els.searchInput.value.length >= 2) {
        els.searchResults.classList.add('visible');
    }
});

// Load course detail
async function loadCourse(lvnr) {
    // Update URL
    history.replaceState(null, '', `?lvnr=${encodeURIComponent(lvnr)}`);

    try {
        const res = await fetch(`api/history.php?action=detail&lvnr=${encodeURIComponent(lvnr)}`);
        const data = await res.json();

        if (data.error) {
            console.error(data.error);
            return;
        }

        renderDetail(data);
    } catch (e) {
        console.error('Load error:', e);
    }
}

function renderDetail(data) {
    const { info, lvnr, semesters } = data;

    // Update header
    els.detailLvnr.textContent = lvnr;
    els.detailTitle.textContent = info.title || lvnr;
    els.detailTyp.textContent = info.typ || '';
    els.detailProf.textContent = info.professors || '';
    els.detailCount.textContent = `${semesters.length} Semester mit Daten`;

    // Filter semesters with actual grade data
    const validSemesters = semesters.filter(s => s.numberOfGrades > 0);

    if (validSemesters.length === 0) {
        els.detail.style.display = 'block';
        els.summary.innerHTML = '<div class="loading-state">Keine Notendaten verfügbar.</div>';
        return;
    }

    // Parse grade distributions
    const labels = validSemesters.map(s => formatSemester(s.semester));
    const rawLabels = validSemesters.map(s => s.semester);

    // Build datasets for stacked bar chart (5 grades)
    const gradeData = [[], [], [], [], []];
    validSemesters.forEach(s => {
        let dist = [];
        try {
            dist = JSON.parse(s.gradeDistributionString || '[]');
        } catch { dist = []; }
        for (let i = 0; i < 5; i++) {
            gradeData[i].push(dist[i] || 0);
        }
    });

    const avgData = validSemesters.map(s => s.averageGrade ? parseFloat(s.averageGrade) : null);
    const totalStudents = validSemesters.map(s => parseInt(s.numberOfGrades) || 0);
    const professors = validSemesters.map(s => s.professors || '—');

    // Render charts
    renderBarChart(labels, gradeData, totalStudents, professors);
    renderTrendChart(labels, avgData, professors);
    renderProfessors(validSemesters);
    renderSummary(validSemesters, avgData, totalStudents);

    els.detail.style.display = 'block';

    // Scroll to detail
    els.detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderBarChart(labels, gradeData, totalStudents, professors) {
    if (barChart) barChart.destroy();

    const datasets = gradeData.map((data, i) => ({
        label: gradeLabels[i],
        data: data,
        backgroundColor: gradeColors[i],
        borderRadius: i === 4 ? { topLeft: 4, topRight: 4 } : 0,
        borderSkipped: false
    }));

    barChart = new Chart(els.chartBars, {
        type: 'bar',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#a0a0b0',
                        padding: 16,
                        usePointStyle: true,
                        pointStyle: 'rectRounded',
                        font: { size: 12 }
                    }
                },
                tooltip: {
                    backgroundColor: '#1c1c26',
                    borderColor: '#2a2a3a',
                    borderWidth: 1,
                    titleColor: '#f0f0f5',
                    bodyColor: '#a0a0b0',
                    padding: 12,
                    callbacks: {
                        afterBody: function(context) {
                            const idx = context[0].dataIndex;
                            return `\nGesamt: ${totalStudents[idx]} Studierende\nDozent: ${professors[idx]}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: true,
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#a0a0b0', font: { size: 11 } }
                },
                y: {
                    stacked: true,
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#a0a0b0', font: { size: 11 } },
                    title: {
                        display: true,
                        text: 'Anzahl Studierende',
                        color: '#606070',
                        font: { size: 12 }
                    }
                }
            }
        }
    });
}

function renderTrendChart(labels, avgData, professors) {
    if (trendChart) trendChart.destroy();

    trendChart = new Chart(els.chartTrend, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Durchschnittsnote',
                data: avgData,
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                fill: true,
                tension: 0.3,
                pointRadius: 6,
                pointHoverRadius: 9,
                pointBackgroundColor: avgData.map(v => {
                    if (v === null) return '#606070';
                    if (v <= 1.5) return '#22c55e';
                    if (v <= 2.5) return '#84cc16';
                    if (v <= 3.5) return '#eab308';
                    if (v <= 4.5) return '#f97316';
                    return '#ef4444';
                }),
                pointBorderColor: 'transparent',
                borderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1c1c26',
                    borderColor: '#2a2a3a',
                    borderWidth: 1,
                    titleColor: '#f0f0f5',
                    bodyColor: '#a0a0b0',
                    padding: 12,
                    callbacks: {
                        label: ctx => `Ø ${ctx.parsed.y?.toFixed(2) ?? '—'}`,
                        afterLabel: ctx => `Dozent: ${professors[ctx.dataIndex]}`
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#a0a0b0', font: { size: 11 } }
                },
                y: {
                    reverse: true,
                    min: 1,
                    max: 5,
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: {
                        color: '#a0a0b0',
                        font: { size: 11 },
                        stepSize: 1,
                        callback: v => `${v}.0`
                    },
                    title: {
                        display: true,
                        text: 'Durchschnittsnote',
                        color: '#606070',
                        font: { size: 12 }
                    }
                }
            }
        }
    });
}

const profColors = ['#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#06b6d4', '#f97316', '#84cc16', '#ef4444', '#10b981'];
let profChart = null;

function renderProfessors(semesters) {
    const labels = semesters.map(s => formatSemester(s.semester));
    const uniqueProfs = [...new Set(semesters.map(s => s.professors || '—'))];
    const profColorMap = {};
    uniqueProfs.forEach((p, i) => profColorMap[p] = profColors[i % profColors.length]);

    const bgColors = semesters.map(s => profColorMap[s.professors || '—']);
    const profNames = semesters.map(s => s.professors || '—');

    const el = document.getElementById('prof-timeline');
    // Ensure canvas exists
    if (!el.querySelector('canvas')) {
        el.innerHTML = `
            <h3>Dozent:innen im Verlauf</h3>
            <div class="chart-wrapper chart-wrapper-slim"><canvas id="chart-profs"></canvas></div>
            <div class="prof-legend" id="prof-legend"></div>
        `;
    }
    el.style.display = 'block';

    const legendHtml = uniqueProfs.map(p =>
        `<span class="prof-legend-item"><span class="prof-dot" style="background:${profColorMap[p]}"></span>${esc(p)}</span>`
    ).join('');
    document.getElementById('prof-legend').innerHTML = legendHtml;

    if (profChart) profChart.destroy();
    profChart = new Chart(document.getElementById('chart-profs'), {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                data: semesters.map(() => 1),
                backgroundColor: bgColors,
                borderRadius: 4,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1c1c26',
                    borderColor: '#2a2a3a',
                    borderWidth: 1,
                    titleColor: '#f0f0f5',
                    bodyColor: '#a0a0b0',
                    padding: 12,
                    callbacks: {
                        label: ctx => profNames[ctx.dataIndex]
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#a0a0b0', font: { size: 11 } }
                },
                y: {
                    max: 1,
                    grid: { display: false },
                    ticks: { display: false },
                    border: { display: false },
                    title: {
                        display: true,
                        text: 'Durchschnittsnote',
                        color: 'transparent',
                        font: { size: 12 }
                    }
                }
            }
        }
    });
}

function renderSummary(semesters, avgData, totalStudents) {
    const validAvgs = avgData.filter(v => v !== null);
    const overallAvg = validAvgs.length > 0 ? (validAvgs.reduce((a, b) => a + b, 0) / validAvgs.length) : null;
    const bestAvg = validAvgs.length > 0 ? Math.min(...validAvgs) : null;
    const worstAvg = validAvgs.length > 0 ? Math.max(...validAvgs) : null;
    const totalAll = totalStudents.reduce((a, b) => a + b, 0);

    function getGradeColor(v) {
        if (v === null) return '#606070';
        if (v <= 1.5) return '#22c55e';
        if (v <= 2.5) return '#84cc16';
        if (v <= 3.5) return '#eab308';
        if (v <= 4.5) return '#f97316';
        return '#ef4444';
    }

    els.summary.innerHTML = `
        <div class="summary-grid">
            <div class="summary-stat">
                <span class="summary-label">Gesamt-Durchschnitt</span>
                <span class="summary-value" style="color:${getGradeColor(overallAvg)}">
                    ${overallAvg !== null ? `Ø ${overallAvg.toFixed(2)}` : '—'}
                </span>
            </div>
            <div class="summary-stat">
                <span class="summary-label">Bestes Semester</span>
                <span class="summary-value" style="color:${getGradeColor(bestAvg)}">
                    ${bestAvg !== null ? `Ø ${bestAvg.toFixed(2)}` : '—'}
                </span>
            </div>
            <div class="summary-stat">
                <span class="summary-label">Schlechtestes Semester</span>
                <span class="summary-value" style="color:${getGradeColor(worstAvg)}">
                    ${worstAvg !== null ? `Ø ${worstAvg.toFixed(2)}` : '—'}
                </span>
            </div>
            <div class="summary-stat">
                <span class="summary-label">Benotungen gesamt</span>
                <span class="summary-value">${totalAll}</span>
            </div>
            <div class="summary-stat">
                <span class="summary-label">Semester mit Daten</span>
                <span class="summary-value">${semesters.length}</span>
            </div>
            <div class="summary-stat">
                <span class="summary-label">Ø pro Semester</span>
                <span class="summary-value">${semesters.length > 0 ? Math.round(totalAll / semesters.length) : 0} Stud.</span>
            </div>
        </div>
    `;
}

// Init: check URL for lvnr param
document.addEventListener('DOMContentLoaded', () => {
    const p = new URLSearchParams(window.location.search);
    if (p.has('lvnr')) {
        const lvnr = p.get('lvnr');
        els.searchInput.value = lvnr;
        loadCourse(lvnr);
    }
});
