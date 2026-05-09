<?php

use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('management', function ($user) {
    return $user instanceof \App\Models\User
        && $user->hasRole(['management', 'super-admin', 'production-supervisor']);
});

Broadcast::channel('customer.{id}', function ($user, $id) {
    return $user instanceof \App\Models\Customer
        && (int) $user->id === (int) $id;
});
