<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AAU Kurse | Kursverlauf</title>
    <meta name="description" content="Notenentwicklung eines Kurses über mehrere Semester">
    <link rel="stylesheet" href="style.css">
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>
</head>
<body>
    <header class="header">
        <div class="header-content">
            <nav class="header-nav">
                <a href="/" class="nav-link">Kurse</a>
                <a href="/stats.php" class="nav-link">Notenstatistiken</a>
                <a href="/history.php" class="nav-link nav-active">Kursverlauf</a>
                <a href="/scrape.php" class="nav-link">Scrape Manager</a>
            </nav>
            <h1>Kursverlauf</h1>
            <p class="subtitle">Notenentwicklung eines Kurses über alle Semester</p>
        </div>
    </header>

    <main class="history-container">
        <!-- Search Section -->
        <div class="history-search-section">
            <div class="history-search-box">
                <label for="course-search">Kurs suchen</label>
                <input type="text" id="course-search" placeholder="Kursname oder LV-Nr eingeben..." autocomplete="off">
                <div class="search-results" id="search-results"></div>
            </div>
        </div>

        <!-- Course Detail Section (hidden until course selected) -->
        <div class="history-detail" id="history-detail" style="display:none;">
            <div class="history-course-header">
                <div class="history-course-info">
                    <span class="history-lvnr" id="detail-lvnr"></span>
                    <h2 id="detail-title"></h2>
                    <div class="history-meta">
                        <span class="stat-typ" id="detail-typ"></span>
                        <span class="stat-prof" id="detail-prof"></span>
                        <span class="history-semester-count" id="detail-count"></span>
                    </div>
                </div>
            </div>

            <!-- Charts -->
            <div class="history-charts">
                <div class="history-chart-card">
                    <h3>Notenverteilung pro Semester</h3>
                    <div class="chart-wrapper">
                        <canvas id="chart-bars"></canvas>
                    </div>
                </div>
                <div class="history-chart-card">
                    <h3>Durchschnittsnote im Verlauf</h3>
                    <div class="chart-wrapper">
                        <canvas id="chart-trend"></canvas>
                    </div>
                </div>
            </div>

            <!-- Professor Timeline -->
            <div class="history-chart-card" id="prof-timeline" style="display:none;"></div>

            <!-- Summary Stats -->
            <div class="history-summary" id="history-summary"></div>
        </div>
    </main>

    <script src="history.js"></script>
</body>
</html>
