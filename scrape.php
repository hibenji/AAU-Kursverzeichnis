<?php
require_once __DIR__ . '/auth_scrape.php';
$loginError = handleScrapeLogin();
$isAuthed = checkScrapeAuth();
?>
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AAU Kurse | Scrape Manager</title>
    <meta name="description" content="Kurse zum Scrapen auswählen">
    <link rel="stylesheet" href="style.css">
</head>
<body>
<?php if (!$isAuthed): ?>
<div class="login-wrapper">
    <div class="login-card">
        <h2>🔒 Scrape Manager</h2>
        <p class="login-subtitle">Passwort eingeben um fortzufahren</p>
        <?php if ($loginError === 'wrong_password'): ?>
            <div class="login-error">Falsches Passwort.</div>
        <?php endif; ?>
        <form method="POST" class="login-form">
            <input type="password" name="scrape_password" placeholder="Passwort" autofocus required>
            <button type="submit" class="btn-primary">Anmelden</button>
        </form>
    </div>
</div>
<style>
.login-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 1.5rem;
}
.login-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 2.5rem;
    width: 100%;
    max-width: 380px;
    text-align: center;
    box-shadow: var(--shadow);
}
.login-card h2 {
    font-size: 1.4rem;
    margin-bottom: 0.5rem;
}
.login-subtitle {
    color: var(--text-secondary);
    font-size: 0.9rem;
    margin-bottom: 1.5rem;
}
.login-error {
    background: rgba(239, 68, 68, 0.15);
    color: var(--error);
    padding: 0.6rem 1rem;
    border-radius: var(--radius-sm);
    font-size: 0.85rem;
    margin-bottom: 1rem;
}
.login-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}
.login-form input {
    width: 100%;
    padding: 0.75rem 1rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-size: 0.95rem;
    transition: all var(--transition);
}
.login-form input:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-glow);
}
.login-form .btn-primary {
    margin-top: 0;
    cursor: pointer;
    border: none;
    font-size: 0.95rem;
}
</style>
</body>
</html>
<?php exit; endif; ?>
    <header class="header">
        <div class="header-content">
            <nav class="header-nav">
                <a href="/" class="nav-link">Kurse</a>
                <a href="/stats.php" class="nav-link">Notenstatistiken</a>
                <a href="/history.php" class="nav-link">Kursverlauf</a>
                <a href="/scrape.php" class="nav-link nav-active">Scrape Manager</a>
            </nav>
            <h1>Scrape Manager</h1>
            <p class="subtitle">Kurse auswählen und Notenstatistiken scrapen</p>
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
                <input type="text" id="search" placeholder="Kursname, LV-Nr oder Dozent...">
            </div>

            <div class="filter-group">
                <label for="typ">Typ</label>
                <select id="typ">
                    <option value="">Alle Typen</option>
                </select>
            </div>

            <div class="filter-group">
                <label for="semester">Semester</label>
                <select id="semester">
                    <option value="">Alle Semester</option>
                </select>
            </div>

            <div class="filter-group">
                <label for="status">Scrape-Status</label>
                <select id="status">
                    <option value="">Alle</option>
                    <option value="unscraped">Noch nicht vollständig</option>
                    <option value="scraped">Bereits gescraped</option>
                </select>
            </div>
        </aside>

        <section class="results">
            <div class="results-header">
                <div class="results-count">
                    <span id="result-count">0</span> Kurse
                </div>
                <div class="scrape-actions">
                    <label class="checkbox-label scrape-select-all">
                        <input type="checkbox" id="select-all">
                        <span>Alle auf Seite</span>
                    </label>
                    <button id="select-unscraped" class="btn-secondary">Fehlende auswählen</button>
                    <button id="scrape-btn" class="btn-primary" disabled>
                        <span class="scrape-btn-text">Ausgewählte scrapen</span>
                        <span class="scrape-btn-count">(0)</span>
                    </button>
                </div>
            </div>

            <div class="scrape-list" id="scrape-list">
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    Lade Kurse...
                </div>
            </div>

            <div class="pagination" id="pagination"></div>

            <!-- Scrape progress overlay -->
            <div class="scrape-progress-overlay" id="scrape-progress" style="display:none;">
                <div class="scrape-progress-card">
                    <h3>Scraping läuft...</h3>
                    <div class="scrape-progress-bar">
                        <div class="scrape-progress-fill" id="progress-fill"></div>
                    </div>
                    <p class="scrape-progress-text" id="progress-text">Wird vorbereitet...</p>
                    <div class="scrape-progress-log" id="progress-log"></div>
                </div>
            </div>
        </section>
    </main>

    <script src="scrape.js"></script>
</body>
</html>
