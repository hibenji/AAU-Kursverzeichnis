<?php
require_once __DIR__ . '/../auth_scrape.php';

// Check authentication
if (!checkScrapeAuth()) {
    http_response_code(401);
    die(json_encode(['error' => 'Unauthorized']));
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    die(json_encode(['error' => 'Method not allowed']));
}

$input = json_decode(file_get_contents('php://input'), true);
$newCookie = $input['cookie'] ?? '';

if (empty($newCookie)) {
    http_response_code(400);
    die(json_encode(['error' => 'Cookie is required']));
}

$envFile = __DIR__ . '/../.env';

if (!file_exists($envFile)) {
    http_response_code(500);
    die(json_encode(['error' => '.env file not found']));
}

$envContent = file_get_contents($envFile);
$newEnvContent = preg_replace('/^SCRAPE_COOKIE=.*$/m', 'SCRAPE_COOKIE=' . $newCookie, $envContent);

if ($newEnvContent === null) {
    http_response_code(500);
    die(json_encode(['error' => 'Failed to process .env file']));
}

if (file_put_contents($envFile, $newEnvContent) === false) {
    http_response_code(500);
    die(json_encode(['error' => 'Failed to write to .env file']));
}

header('Content-Type: application/json');
echo json_encode(['success' => true]);
