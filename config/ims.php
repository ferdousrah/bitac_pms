<?php

return [

    /*
    |--------------------------------------------------------------------------
    | IMS (Inventory Management System) Integration
    |--------------------------------------------------------------------------
    |
    | Configuration for integrating with BITAC's IMS system.
    | If IMS_BASE_URL is not set, the system will fall back to manual verification.
    |
    */

    'base_url' => env('IMS_BASE_URL', ''),
    'api_key'  => env('IMS_API_KEY', ''),
    'timeout'  => env('IMS_TIMEOUT', 5),

];
