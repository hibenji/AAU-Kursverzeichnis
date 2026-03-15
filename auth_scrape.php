<?php
require_once __DIR__ . '/config.php';

define('SCRAPE_AUTH_COOKIE', 'scrape_auth');
define('SCRAPE_AUTH_SALT', 'aau-scrape-k9x2');

function getScrapeAuthHash() {
    $pass = getenv('SCRAPE_ADMIN_PASS');
    if (!$pass) return null;
    return hash('sha256', $pass . SCRAPE_AUTH_SALT);
}

function checkScrapeAuth() {
    $expected = getScrapeAuthHash();
    if (!$expected) return false;
    return isset($_COOKIE[SCRAPE_AUTH_COOKIE]) && hash_equals($expected, $_COOKIE[SCRAPE_AUTH_COOKIE]);
}

function handleScrapeLogin() {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !isset($_POST['scrape_password'])) {
        return false;
    }

    $pass = getenv('SCRAPE_ADMIN_PASS');
    if (!$pass) return false;

    if ($_POST['scrape_password'] === $pass) {
        $hash = getScrapeAuthHash();
        setcookie(SCRAPE_AUTH_COOKIE, $hash, [
            'expires' => time() + 60 * 60 * 24 * 30, // 30 days
            'path' => '/',
            'httponly' => true,
            'samesite' => 'Strict'
        ]);
        // Redirect to avoid form resubmission
        header('Location: ' . $_SERVER['REQUEST_URI']);
        exit;
    }

    return 'wrong_password';
}
