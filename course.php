<?php
require_once 'config.php';

$id = intval($_GET['id'] ?? 0);
if ($id <= 0) {
    header('Location: /');
    exit;
}

$db = getDB();
$stmt = $db->prepare("SELECT * FROM courses WHERE id = ?");
$stmt->execute([$id]);
$course = $stmt->fetch();

if (!$course) {
    header('Location: /');
    exit;
}

// Helper function
function e($str) {
    return htmlspecialchars($str ?? '', ENT_QUOTES, 'UTF-8');
}

function formatDate($date) {
    if (!$date) return '–';
    return date('d.m.Y', strtotime($date));
}

function formatDateTime($datetime) {
    if (!$datetime) return '–';
    return date('d.m.Y H:i', strtotime($datetime));
}
?>
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= e($course['course_name']) ?> | AAU Kurse</title>
    <meta name="description" content="<?= e(substr($course['lv_beschreibung'] ?? $course['course_name'], 0, 160)) ?>">
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <header class="header">
        <div class="header-content">
            <a href="/" class="back-link">← Zurück zur Übersicht</a>
            <h1><?= e($course['course_name']) ?></h1>
            <div class="course-meta">
                <span class="badge badge-type"><?= e($course['course_type']) ?></span>
                <span class="badge badge-code"><?= e($course['course_code']) ?></span>
                <?php if ($course['ects']): ?>
                <span class="badge badge-ects"><?= e($course['ects']) ?> ECTS</span>
                <?php endif; ?>
                <?php if ($course['unterrichtssprache']): ?>
                <span class="badge badge-lang"><?= e($course['unterrichtssprache']) ?></span>
                <?php endif; ?>
            </div>
        </div>
    </header>

    <main class="container detail-container">
        <div class="detail-grid">
            <section class="detail-card">
                <h2>Allgemeine Informationen</h2>
                <dl class="detail-list">
                    <dt>LV-Nummer</dt>
                    <dd><?= e($course['course_code']) ?></dd>
                    
                    <dt>LV-Typ</dt>
                    <dd><?= e($course['course_type']) ?: '–' ?></dd>
                    
                    <dt>LV-Modell</dt>
                    <dd><?= e($course['lv_modell']) ?: '–' ?></dd>
                    
                    <dt>Semesterstunden</dt>
                    <dd><?= e($course['semesterstunden']) ?: '–' ?></dd>
                    
                    <dt>ECTS</dt>
                    <dd><?= e($course['ects']) ?: '–' ?></dd>
                    
                    <dt>Unterrichtssprache</dt>
                    <dd><?= e($course['unterrichtssprache']) ?: '–' ?></dd>
                    
                    <dt>Semester</dt>
                    <dd><?= e($course['semester']) ?: '–' ?></dd>
                </dl>
            </section>

            <section class="detail-card">
                <h2>Termine & Ort</h2>
                <dl class="detail-list">
                    <dt>Dozent(en)</dt>
                    <dd><?= e($course['instructors']) ?: '–' ?></dd>
                    
                    <dt>Wochentag</dt>
                    <dd><?= e($course['schedule_day']) ?: '–' ?></dd>
                    
                    <dt>Zeit</dt>
                    <dd><?= e($course['schedule_time']) ?: '–' ?></dd>
                    
                    <dt>Ort</dt>
                    <dd><?= e($course['schedule_location']) ?: '–' ?></dd>
                    
                    <dt>LV-Beginn</dt>
                    <dd><?= formatDate($course['lv_beginn']) ?></dd>
                </dl>
            </section>

            <section class="detail-card">
                <h2>Anmeldung</h2>
                <dl class="detail-list">
                    <dt>Anmeldefrist Beginn</dt>
                    <dd><?= formatDateTime($course['anmeldefrist_beginn']) ?></dd>
                    
                    <dt>Anmeldefrist Ende</dt>
                    <dd><?= formatDateTime($course['anmeldefrist_ende']) ?></dd>
                    
                    <dt>Organisationseinheit</dt>
                    <dd><?= e($course['organisationseinheit']) ?: '–' ?></dd>
                </dl>
                
                <?php if ($course['course_url']): ?>
                <a href="<?= e($course['course_url']) ?>" target="_blank" rel="noopener" class="btn-primary">
                    Im Campus-System öffnen →
                </a>
                <?php endif; ?>
            </section>
        </div>

        <?php if ($course['lv_beschreibung']): ?>
        <section class="detail-card full-width">
            <h2>Beschreibung</h2>
            <div class="description-text">
                <?= nl2br(e($course['lv_beschreibung'])) ?>
            </div>
        </section>
        <?php endif; ?>

        <?php if ($course['pruefungsinformationen']): ?>
        <section class="detail-card full-width">
            <h2>Prüfungsinformationen</h2>
            <div class="description-text">
                <?= nl2br(e($course['pruefungsinformationen'])) ?>
            </div>
        </section>
        <?php endif; ?>
    </main>

    <footer class="footer">
        <p>Daten vom AAU Campus-System. Zuletzt aktualisiert: <?= formatDateTime($course['scraped_at']) ?></p>
    </footer>
</body>
</html>
