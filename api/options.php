<?php
header('Content-Type: application/json');
require_once '../config.php';

$db = getDB();

// Get distinct values for filter dropdowns
$options = [];

$fields = [
    'course_type' => 'SELECT DISTINCT course_type FROM courses WHERE course_type IS NOT NULL ORDER BY course_type',
    'schedule_day' => 'SELECT DISTINCT schedule_day FROM courses WHERE schedule_day IS NOT NULL ORDER BY schedule_day',
    'lv_modell' => 'SELECT DISTINCT lv_modell FROM courses WHERE lv_modell IS NOT NULL ORDER BY lv_modell',
    'unterrichtssprache' => 'SELECT DISTINCT unterrichtssprache FROM courses WHERE unterrichtssprache IS NOT NULL ORDER BY unterrichtssprache',
    'semester' => 'SELECT DISTINCT semester FROM courses WHERE semester IS NOT NULL ORDER BY semester DESC'
];

foreach ($fields as $field => $sql) {
    $stmt = $db->query($sql);
    $options[$field] = $stmt->fetchAll(PDO::FETCH_COLUMN);
}

// Get ECTS range
$stmt = $db->query("SELECT MIN(CAST(ects AS DECIMAL)) as min_ects, MAX(CAST(ects AS DECIMAL)) as max_ects FROM courses WHERE ects IS NOT NULL AND ects != ''");
$ectsRange = $stmt->fetch();
$options['ects_range'] = $ectsRange;

echo json_encode($options, JSON_UNESCAPED_UNICODE);
