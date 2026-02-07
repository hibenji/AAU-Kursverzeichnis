<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once '../config.php';

$db = getDB();

// Get filter parameters
$filters = [];
$params = [];
$where = [];

// Unified text search (OR across multiple fields)
if (!empty($_GET['search'])) {
    $searchTerm = '%' . $_GET['search'] . '%';
    $where[] = "(course_code LIKE ? OR course_name LIKE ? OR instructors LIKE ?)";
    $params[] = $searchTerm;
    $params[] = $searchTerm;
    $params[] = $searchTerm;
}

// Exact match filters (dropdowns)
$exactFilters = ['course_type', 'schedule_day', 'lv_modell', 'unterrichtssprache', 'semester'];
foreach ($exactFilters as $field) {
    if (!empty($_GET[$field])) {
        $where[] = "$field = ?";
        $params[] = $_GET[$field];
    }
}

// ECTS range filter
if (!empty($_GET['ects_min'])) {
    $where[] = "CAST(ects AS DECIMAL) >= ?";
    $params[] = floatval($_GET['ects_min']);
}
if (!empty($_GET['ects_max'])) {
    $where[] = "CAST(ects AS DECIMAL) <= ?";
    $params[] = floatval($_GET['ects_max']);
}

// Build WHERE clause
$whereClause = count($where) > 0 ? 'WHERE ' . implode(' AND ', $where) : '';

// Pagination
$page = max(1, intval($_GET['page'] ?? 1));
$limit = min(100, max(10, intval($_GET['limit'] ?? 25)));
$offset = ($page - 1) * $limit;

// Sorting
$allowedSort = ['course_code', 'course_name', 'course_type', 'instructors', 'schedule_day', 'ects'];
$sortField = in_array($_GET['sort'] ?? '', $allowedSort) ? $_GET['sort'] : 'course_code';
$sortDir = ($_GET['dir'] ?? 'asc') === 'desc' ? 'DESC' : 'ASC';

// Get total count
$countSql = "SELECT COUNT(*) FROM courses $whereClause";
$countStmt = $db->prepare($countSql);
$countStmt->execute($params);
$total = $countStmt->fetchColumn();

// Get courses
$sql = "SELECT id, course_code, course_type, course_name, instructors, 
               schedule_day, schedule_time, schedule_location, ects, unterrichtssprache, semester
        FROM courses 
        $whereClause 
        ORDER BY $sortField $sortDir 
        LIMIT $limit OFFSET $offset";

$stmt = $db->prepare($sql);
$stmt->execute($params);
$courses = $stmt->fetchAll();

// Return JSON
echo json_encode([
    'courses' => $courses,
    'total' => (int)$total,
    'page' => $page,
    'limit' => $limit,
    'pages' => ceil($total / $limit)
], JSON_UNESCAPED_UNICODE);
