<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');

// URL графаны
$grafana_url = 'http://89.110.65.155:8083/api/stats';

// Получаем данные
$context = stream_context_create([
    'http' => [
        'timeout' => 5,
        'method' => 'GET'
    ]
]);

$response = @file_get_contents($grafana_url, false, $context);

if ($response === false) {
    // Fallback к последним известным данным
    echo json_encode([
        'athletes' => 1056,
        'source' => 'fallback',
        'timestamp' => date('c')
    ]);
} else {
    echo $response;
}
?>