<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AAU Kurse | Kursverzeichnis</title>
    <meta name="description" content="Durchsuche und filtere alle Kurse der Alpen-Adria-Universität Klagenfurt">
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <header class="header">
        <div class="header-content">
            <nav class="header-nav">
                <a href="/" class="nav-link nav-active">Kurse</a>
                <a href="/stats.php" class="nav-link">Notenstatistiken</a>
            </nav>
            <h1>AAU Kursverzeichnis</h1>
            <p class="subtitle">Alle Lehrveranstaltungen durchsuchen und filtern</p>
        </div>
    </header>

    <main class="container">
        <aside class="filters">
            <div class="filter-header">
                <h2>Filter</h2>
                <button id="reset-filters" class="btn-reset">Zurücksetzen</button>
            </div>

            <div class="filter-group">
                <label for="search">Suche</label>
                <input type="text" id="search" placeholder="Kursname, Code oder Dozent...">
            </div>

            <div class="filter-group">
                <label for="course_type">Kurstyp</label>
                <select id="course_type">
                    <option value="">Alle Typen</option>
                </select>
            </div>

            <div class="filter-group">
                <label for="schedule_day">Wochentag</label>
                <select id="schedule_day">
                    <option value="">Alle Tage</option>
                </select>
            </div>

            <div class="filter-group">
                <label for="lv_modell">LV-Modell</label>
                <select id="lv_modell">
                    <option value="">Alle Modelle</option>
                </select>
            </div>

            <div class="filter-group">
                <label for="unterrichtssprache">Sprache</label>
                <select id="unterrichtssprache">
                    <option value="">Alle Sprachen</option>
                </select>
            </div>

            <div class="filter-group">
                <label for="semester">Semester</label>
                <select id="semester">
                    <option value="">Alle Semester</option>
                </select>
            </div>

            <div class="filter-group">
                <label>ECTS</label>
                <div class="ects-inputs">
                    <input type="number" id="ects_min" placeholder="Min" min="0" step="0.5">
                    <span>–</span>
                    <input type="number" id="ects_max" placeholder="Max" min="0" step="0.5">
                </div>
            </div>
        </aside>

        <section class="results">
            <div class="results-header">
                <div class="results-count">
                    <span id="result-count">0</span> Kurse gefunden
                </div>
                <div class="results-per-page">
                    <label for="per-page">Anzeigen:</label>
                    <select id="per-page">
                        <option value="25">25</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                    </select>
                </div>
            </div>

            <div class="table-container">
                <table id="courses-table">
                    <thead>
                        <tr>
                            <th data-sort="course_code" class="sortable">Code</th>
                            <th data-sort="course_name" class="sortable">Kursname</th>
                            <th data-sort="course_type" class="sortable">Typ</th>
                            <th data-sort="instructors" class="sortable">Dozent</th>
                            <th data-sort="schedule_day" class="sortable">Zeit</th>
                            <th data-sort="ects" class="sortable">ECTS</th>
                        </tr>
                    </thead>
                    <tbody id="courses-body">
                        <tr class="loading-row">
                            <td colspan="6">
                                <div class="loading-spinner"></div>
                                Lade Kurse...
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div class="pagination" id="pagination"></div>
        </section>
    </main>

    <script src="script.js"></script>
</body>
</html>
