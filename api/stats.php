<?php
require_once __DIR__ . '/../config.php';

header('Content-Type: application/json');

$db = getDB();

// Parameters
$search = trim($_GET['search'] ?? '');
$search_id = trim($_GET['search_id'] ?? '');
$semester = trim($_GET['semester'] ?? '');
$typ = trim($_GET['typ'] ?? '');
$org = trim($_GET['org'] ?? '');
$sort = $_GET['sort'] ?? 'averageGrade';
$dir = strtolower($_GET['dir'] ?? 'asc') === 'desc' ? 'DESC' : 'ASC';
$excludeNan = ($_GET['exclude_nan'] ?? '0') === '1';
$excludeParticipation = ($_GET['exclude_participation'] ?? '0') === '1';
$page = max(1, intval($_GET['page'] ?? 1));
$limit = min(100, max(10, intval($_GET['limit'] ?? 25)));
$offset = ($page - 1) * $limit;

// Allowed sort columns
$allowedSorts = [
    'averageGrade' => 'k.averageGrade',
    'numberOfGrades' => 'k.numberOfGrades',
    'title' => 'cs.title',
    'professors' => 'cs.professors',
    'semester' => 'cs.semester'
];
$sortCol = $allowedSorts[$sort] ?? 'k.averageGrade';

// Build WHERE clauses
$where = ['k.numberOfGrades > 0'];
$params = [];

if ($search !== '') {
    $where[] = '(cs.title LIKE ? OR cs.professors LIKE ?)';
    $params[] = "%$search%";
    $params[] = "%$search%";
}

if ($search_id !== '') {
    $where[] = 'cs.id = ?';
    $params[] = $search_id;
}

if ($semester !== '') {
    $where[] = 'cs.semester = ?';
    $params[] = $semester;
}

if ($typ !== '') {
    $where[] = 'cs.typ = ?';
    $params[] = $typ;
}

if ($excludeNan) {
    $where[] = 'k.averageGrade IS NOT NULL';
}

if ($excludeParticipation) {
    $where[] = 'k.allGradesString != ?';
    $params[] = '["mEt","oEt"]';
}

if ($org !== '') {
    $where[] = 'c.organisationseinheit LIKE ?';
    $params[] = "%$org%";
}

$whereSQL = implode(' AND ', $where);

// Count query
$joinSQL = "FROM kurse k JOIN courses_simple cs ON k.nr = cs.id LEFT JOIN courses c ON cs.lvnr = c.course_code";
$countSQL = "SELECT COUNT(*) as total $joinSQL WHERE $whereSQL";
$stmt = $db->prepare($countSQL);
$stmt->execute($params);
$total = $stmt->fetch()['total'];

// Data query
$dataSQL = "SELECT cs.title, cs.professors, cs.typ, cs.semester, cs.id,
                   k.averageGrade, k.numberOfGrades, k.gradeDistributionString,
                   c.organisationseinheit
            $joinSQL
            WHERE $whereSQL
            ORDER BY $sortCol $dir
            LIMIT $limit OFFSET $offset";
$stmt = $db->prepare($dataSQL);
$stmt->execute($params);
$courses = $stmt->fetchAll();

// Get available semesters for filter
$semStmt = $db->query("SELECT DISTINCT cs.semester FROM kurse k JOIN courses_simple cs ON k.nr = cs.id WHERE k.numberOfGrades > 0 ORDER BY cs.semester DESC");
$semesters = $semStmt->fetchAll(PDO::FETCH_COLUMN);

$typStmt = $db->query("SELECT DISTINCT cs.typ FROM kurse k JOIN courses_simple cs ON k.nr = cs.id WHERE k.numberOfGrades > 0 AND cs.typ IS NOT NULL AND cs.typ != '' ORDER BY cs.typ");
$typen = $typStmt->fetchAll(PDO::FETCH_COLUMN);

$orgStmt = $db->query("SELECT DISTINCT c.organisationseinheit FROM kurse k JOIN courses_simple cs ON k.nr = cs.id LEFT JOIN courses c ON cs.lvnr = c.course_code WHERE k.numberOfGrades > 0 AND c.organisationseinheit IS NOT NULL AND c.organisationseinheit != '' ORDER BY c.organisationseinheit");
$orgs = $orgStmt->fetchAll(PDO::FETCH_COLUMN);

echo json_encode([
    'courses' => $courses,
    'total' => (int)$total,
    'page' => $page,
    'pages' => (int)ceil($total / $limit),
    'semesters' => $semesters,
    'typen' => $typen,
    'orgs' => $orgs
]);
