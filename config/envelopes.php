<?php

/*
|--------------------------------------------------------------------------
| Envelope sizes
|--------------------------------------------------------------------------
|
| The sizes offered on the envelope printing screen.
|
| ⚠️ These are PROVISIONAL. BITAC will confirm the envelopes they actually
| buy; correct the list here and nothing else needs to change — the screen
| and the PDF both read it.
|
| 'size'   — [width, height] in MILLIMETRES, as the sheet feeds into the
|            printer. The first entry is the default.
| 'to_pt'  — type size of the recipient block. A big document envelope
|            needs bigger writing than a letter envelope, or the address
|            floats in the middle of an empty sheet.
|
*/

return [

    'sizes' => [
        'letter-9x4' => [
            'label'  => 'Letter — 9″ × 4″',
            'size'   => [228.6, 101.6],
            'to_pt'  => 13,
            'from_pt' => 9,
        ],
        'letter-10x4.5' => [
            'label'  => 'Letter — 10″ × 4.5″',
            'size'   => [254.0, 114.3],
            'to_pt'  => 14,
            'from_pt' => 9.5,
        ],
        'document-10x12' => [
            'label'  => 'Document — 10″ × 12″',
            'size'   => [254.0, 304.8],
            'to_pt'  => 17,
            'from_pt' => 11,
        ],
        'document-12x16' => [
            'label'  => 'Document — 12″ × 16″',
            'size'   => [304.8, 406.4],
            'to_pt'  => 20,
            'from_pt' => 12,
        ],
    ],

];
