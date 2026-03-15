<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AAU Kurse | Notenstatistiken</title>
    <meta name="description" content="Notenverteilung und Statistiken aller Kurse der Alpen-Adria-Universität Klagenfurt">
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <header class="header">
        <div class="header-content">
            <nav class="header-nav">
                <a href="/" class="nav-link">Kurse</a>
                <a href="/stats.php" class="nav-link nav-active">Notenstatistiken</a>
                <a href="/history.php" class="nav-link">Kursverlauf</a>
                <a href="/scrape.php" class="nav-link">Scrape Manager</a>
            </nav>
            <h1>Notenstatistiken</h1>
            <p class="subtitle">Notenverteilung und Durchschnittsnoten aller Lehrveranstaltungen</p>
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
                <input type="text" id="search" placeholder="Kursname oder Dozent...">
            </div>

            <div class="filter-group">
                <label for="search-id">Kurs-ID</label>
                <input type="text" id="search-id" placeholder="z.B. 124256">
            </div>

            <div class="filter-group">
                <label for="typ">Typ</label>
                <select id="typ">
                    <option value="">Alle Typen</option>
                    <option value="VO">VO</option>
                    <option value="UE">UE</option>
                    <option value="KS">KS</option>
                    <option value="VI">VI</option>
                </select>
            </div>

            <div class="filter-group">
                <label for="semester">Semester</label>
                <select id="semester">
                    <option value="">Alle Semester</option>
                </select>
            </div>

            <div class="filter-group">
                <label for="org">Organisationseinheit</label>
                <select id="org">
                    <option value="">Alle</option>
                </select>
            </div>

            <div class="filter-group">
                <label for="sort-select">Sortierung</label>
                <select id="sort-select">
                    <option value="averageGrade:asc">Beste Noten zuerst</option>
                    <option value="averageGrade:desc">Schlechteste Noten zuerst</option>
                    <option value="numberOfGrades:desc">Meiste Benotungen</option>
                    <option value="numberOfGrades:asc">Wenigste Benotungen</option>
                    <option value="title:asc">Titel A–Z</option>
                    <option value="title:desc">Titel Z–A</option>
                    <option value="semester:desc">Neuestes Semester zuerst</option>
                    <option value="semester:asc">Ältestes Semester zuerst</option>
                </select>
            </div>

            <div class="filter-group checkbox-group">
                <label class="checkbox-label">
                    <input type="checkbox" id="exclude-nan" checked>
                    <span class="toggle-dot"></span>
                    <span>NaN-Noten ausblenden</span>
                </label>
            </div>

            <div class="filter-group checkbox-group">
                <label class="checkbox-label">
                    <input type="checkbox" id="exclude-participation" checked>
                    <span class="toggle-dot"></span>
                    <span>Nur Teilnahme ausblenden</span>
                </label>
            </div>
        </aside>

        <section class="results">
            <div class="results-header">
                <div class="results-count">
                    <span id="result-count">0</span> Kurse mit Noten
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

            <div class="stats-list" id="stats-list">
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    Lade Statistiken...
                </div>
            </div>

            <div class="pagination" id="pagination"></div>
        </section>
    </main>

    <script src="stats.js"></script>
</body>
</html>
