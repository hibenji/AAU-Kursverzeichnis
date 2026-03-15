<?php
require_once __DIR__ . '/../auth_scrape.php';

header('Content-Type: application/json');

if (!checkScrapeAuth()) {
    http_response_code(401);
    echo json_encode(['error' => 'Nicht autorisiert']);
    exit;
}

$db = getDB();
$action = $_GET['action'] ?? $_POST['action'] ?? 'list';

if ($action === 'list') {
    // Parameters
    $search = trim($_GET['search'] ?? '');
    $semester = trim($_GET['semester'] ?? '');
    $typ = trim($_GET['typ'] ?? '');
    $status = trim($_GET['status'] ?? ''); // 'scraped', 'unscraped', ''
    $page = max(1, intval($_GET['page'] ?? 1));
    $limit = min(100, max(10, intval($_GET['limit'] ?? 25)));
    $offset = ($page - 1) * $limit;

    // Build WHERE
    $where = ['1=1'];
    $params = [];
    $havingClauses = [];

    if ($search !== '') {
        $where[] = '(cs.title LIKE ? OR cs.lvnr LIKE ? OR cs.professors LIKE ?)';
        $params[] = "%$search%";
        $params[] = "%$search%";
        $params[] = "%$search%";
    }

    if ($typ !== '') {
        $where[] = 'cs.typ = ?';
        $params[] = $typ;
    }

    // Semester filter: restrict which semesters are included in the group
    $semesterJoin = '';
    if ($semester !== '') {
        $where[] = 'cs.semester = ?';
        $params[] = $semester;
    }

    $whereSQL = implode(' AND ', $where);

    // We group by lvnr to show one row per course
    // Count total instances and how many already have kurse entries
    $baseSQL = "
        FROM courses_simple cs
        LEFT JOIN kurse k ON cs.id = k.nr
        WHERE $whereSQL
    ";

    $groupSQL = "
        SELECT 
            cs.lvnr,
            MAX(cs.title) as title,
            MAX(cs.typ) as typ,
            MAX(cs.professors) as professors,
            COUNT(DISTINCT cs.id) as semester_count,
            COUNT(DISTINCT k.nr) as scraped_count,
            GROUP_CONCAT(DISTINCT cs.semester ORDER BY cs.semester DESC) as semesters
        $baseSQL
        GROUP BY cs.lvnr
    ";

    // Status filter (applied after grouping)
    if ($status === 'scraped') {
        $groupSQL = "SELECT * FROM ($groupSQL) grouped WHERE scraped_count > 0";
    } elseif ($status === 'unscraped') {
        $groupSQL = "SELECT * FROM ($groupSQL) grouped WHERE scraped_count < semester_count";
    }

    // Count total groups
    $countSQL = "SELECT COUNT(*) as total FROM ($groupSQL) counted";
    $stmt = $db->prepare($countSQL);
    $stmt->execute($params);
    $total = $stmt->fetch()['total'];

    // Data with pagination
    $dataSQL = "$groupSQL ORDER BY title ASC LIMIT $limit OFFSET $offset";
    $stmt = $db->prepare($dataSQL);
    $stmt->execute($params);
    $courses = $stmt->fetchAll();

    // Get available semesters
    $semStmt = $db->query("SELECT DISTINCT semester FROM courses_simple ORDER BY semester DESC");
    $semesters = $semStmt->fetchAll(PDO::FETCH_COLUMN);

    // Get available types
    $typStmt = $db->query("SELECT DISTINCT typ FROM courses_simple WHERE typ IS NOT NULL AND typ != '' ORDER BY typ");
    $typen = $typStmt->fetchAll(PDO::FETCH_COLUMN);

    echo json_encode([
        'courses' => $courses,
        'total' => (int)$total,
        'page' => $page,
        'pages' => (int)ceil($total / $limit),
        'semesters' => $semesters,
        'typen' => $typen
    ]);

} elseif ($action === 'scrape') {
    // Read JSON body
    $input = json_decode(file_get_contents('php://input'), true);
    $lvnrs = $input['lvnrs'] ?? [];

    if (empty($lvnrs)) {
        echo json_encode(['error' => 'No courses selected']);
        exit;
    }

    $cookie = getenv('SCRAPE_COOKIE') ?: '';
    $epKey = getenv('SCRAPE_EP_KEY') ?: '';

    if (!$cookie || !$epKey) {
        echo json_encode(['error' => 'SCRAPE_COOKIE and SCRAPE_EP_KEY must be set in .env']);
        exit;
    }

    // Find all course IDs for selected lvnrs that don't yet exist in kurse
    $placeholders = implode(',', array_fill(0, count($lvnrs), '?'));
    $stmt = $db->prepare("
        SELECT cs.id, cs.lvnr, cs.link, cs.semester
        FROM courses_simple cs
        LEFT JOIN kurse k ON cs.id = k.nr
        WHERE cs.lvnr IN ($placeholders) AND k.nr IS NULL
        ORDER BY cs.semester DESC
    ");
    $stmt->execute($lvnrs);
    $toScrape = $stmt->fetchAll();

    if (empty($toScrape)) {
        echo json_encode(['success' => true, 'message' => 'All selected courses already scraped', 'scraped' => 0, 'total' => 0]);
        exit;
    }

    // Scrape each course
    $results = [];
    $scraped = 0;
    $errors = 0;

    // Increase time limit for large scrapes
    set_time_limit(count($toScrape) * 15);

    foreach ($toScrape as $course) {
        $url = "https://student-cockpit-backend.aau.at/achievements/statistics?rlvKey={$course['id']}&epKey=$epKey";

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_HTTPHEADER => [
                "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept: application/json",
                "Cookie: $cookie"
            ]
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode === 200 && $response) {
            $data = json_decode($response, true);
            if ($data && isset($data['numberOfGrades'])) {
                // Remove personal data fields
                unset($data['examiner'], $data['hkey'], $data['grade']);

                try {
                    $insert = $db->prepare("
                        INSERT INTO kurse (nr, lvnr, link, allGradesString, gradeDistributionString, averageGrade, numberOfGrades, semester, created)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
                        ON DUPLICATE KEY UPDATE
                            allGradesString = VALUES(allGradesString),
                            gradeDistributionString = VALUES(gradeDistributionString),
                            averageGrade = VALUES(averageGrade),
                            numberOfGrades = VALUES(numberOfGrades),
                            semester = VALUES(semester),
                            created = NOW()
                    ");
                    // Store as JSON string — match format from grade_scrape.py
                    // The API returns arrays after json_decode, so encode them once
                    $allGrades = $data['allGrades'] ?? $data['allGradesString'] ?? [];
                    $gradeDist = $data['gradeDistribution'] ?? $data['gradeDistributionString'] ?? [];
                    // If already a string, use as-is; if array, encode once
                    $allGradesStr = is_string($allGrades) ? $allGrades : json_encode($allGrades);
                    $gradeDistStr = is_string($gradeDist) ? $gradeDist : json_encode($gradeDist);

                    $insert->execute([
                        $course['id'],
                        $course['lvnr'],
                        '/studium/course/' . $course['id'],
                        $allGradesStr,
                        $gradeDistStr,
                        $data['averageGrade'] ?? null,
                        $data['numberOfGrades'] ?? 0,
                        $course['semester']
                    ]);
                    $scraped++;
                    $results[] = ['id' => $course['id'], 'lvnr' => $course['lvnr'], 'semester' => $course['semester'], 'status' => 'ok'];
                } catch (Exception $e) {
                    $errors++;
                    $results[] = ['id' => $course['id'], 'lvnr' => $course['lvnr'], 'semester' => $course['semester'], 'status' => 'db_error', 'error' => $e->getMessage()];
                }
            } else {
                $results[] = ['id' => $course['id'], 'lvnr' => $course['lvnr'], 'semester' => $course['semester'], 'status' => 'no_data'];
            }
        } else {
            $errors++;
            $results[] = ['id' => $course['id'], 'lvnr' => $course['lvnr'], 'semester' => $course['semester'], 'status' => 'http_error', 'code' => $httpCode];
        }

        usleep(100000); // 100ms delay between requests
    }

    echo json_encode([
        'success' => true,
        'scraped' => $scraped,
        'errors' => $errors,
        'total' => count($toScrape),
        'results' => $results
    ]);

} else {
    echo json_encode(['error' => 'Unknown action']);
}
