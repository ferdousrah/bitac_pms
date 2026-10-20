<?php

namespace App\Support;

use App\Models\Center;

/**
 * The BITAC identity the sign-in pages wear — the staff and stakeholder
 * sign-ins and their forgot-password pages. Read from the default centre's
 * letterhead, the same source the public website uses, so the emblem and the
 * Bangla name are kept in one place (Admin → Centres).
 */
class AuthBranding
{
    public static function bitac(): ?array
    {
        $center = Center::find(Center::defaultId());
        if (! $center) return null;

        return [
            'name_bn'       => $center->name_bn,
            'ministry_bn'   => $center->ministry_bn,
            'government_bn' => $center->government_bn,
            'phone_bn'      => $center->phone_bn,
            'email'         => $center->email,
            'logo_left'     => $center->logo_left_url,
        ];
    }
}
