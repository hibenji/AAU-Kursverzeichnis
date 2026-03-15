<?php
require_once __DIR__ . '/../config.php';

header('Content-Type: application/json');

$db = getDB();
$action = $_GET['action'] ?? 'search';

if ($action === 'search') {
    $q = trim($_GET['q'] ?? '');
    if ($q === '') {
        echo json_encode(['results' => []]);
        exit;
    }

    // Search for distinct lvnr+title combinations
    $stmt = $db->prepare("
        SELECT 
            cs.lvnr,
            MAX(cs.title) as title,
            MAX(cs.typ) as typ,
            MAX(cs.professors) as professors,
            COUNT(DISTINCT k.nr) as data_count
        FROM courses_simple cs
        LEFT JOIN kurse k ON cs.id = k.nr
        WHERE cs.title LIKE ? OR cs.lvnr LIKE ?
        GROUP BY cs.lvnr
        HAVING data_count > 0
        ORDER BY data_count DESC, title ASC
        LIMIT 20
    ");
    $stmt->execute(["%$q%", "%$q%"]);
    $results = $stmt->fetchAll();

    echo json_encode(['results' => $results]);

} elseif ($action === 'detail') {
    $lvnr = trim($_GET['lvnr'] ?? '');
    if ($lvnr === '') {
        echo json_encode(['error' => 'No lvnr provided']);
        exit;
    }

    // Get course info
    $infoStmt = $db->prepare("
        SELECT MAX(cs.title) as title, MAX(cs.typ) as typ, MAX(cs.professors) as professors
        FROM courses_simple cs
        WHERE cs.lvnr = ?
    ");
    $infoStmt->execute([$lvnr]);
    $info = $infoStmt->fetch();

    // Get all semester data from kurse joined with courses_simple for professor info
    $dataStmt = $db->prepare("
        SELECT k.nr, k.lvnr, k.averageGrade, k.numberOfGrades, 
               k.gradeDistributionString, k.allGradesString, k.semester,
               cs.professors
        FROM kurse k
        LEFT JOIN courses_simple cs ON k.nr = cs.id
        WHERE k.lvnr = ?
        ORDER BY k.semester ASC
    ");
    $dataStmt->execute([$lvnr]);
    $semesters = $dataStmt->fetchAll();

    echo json_encode([
        'info' => $info,
        'lvnr' => $lvnr,
        'semesters' => $semesters
    ]);

} else {
    echo json_encode(['error' => 'Unknown action']);
}
