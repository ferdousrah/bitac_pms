<?php

namespace Database\Seeders;

use App\Models\Bom;
use App\Models\BomItem;
use App\Models\Product;
use Illuminate\Database\Seeder;

class ProductSeeder extends Seeder
{
    public function run(): void
    {
        $products = [
            [
                'name'        => 'Gear Shaft (Standard)',
                'code'        => 'GS-001',
                'description' => 'Standard gear shaft for railway wagon application, Material: EN24 Steel',
                'unit'        => 'pcs',
                'bom_items'   => [
                    ['material_name' => 'EN24 Steel Bar (40mm dia)', 'material_code' => 'RM-EN24-40', 'quantity' => 1.5, 'unit' => 'kg', 'wastage_pct' => 8],
                    ['material_name' => 'Cutting Oil', 'material_code' => 'RM-CUT-OIL', 'quantity' => 0.2, 'unit' => 'ltr', 'wastage_pct' => 0],
                    ['material_name' => 'Grinding Wheel', 'material_code' => 'RM-GW-125', 'quantity' => 0.05, 'unit' => 'pcs', 'wastage_pct' => 0],
                ],
            ],
            [
                'name'        => 'Flange (Heavy Duty)',
                'code'        => 'FL-002',
                'description' => 'Heavy duty flange for pipeline connection, Material: Carbon Steel A105',
                'unit'        => 'pcs',
                'bom_items'   => [
                    ['material_name' => 'Carbon Steel A105 Plate', 'material_code' => 'RM-CS-A105', 'quantity' => 2.8, 'unit' => 'kg', 'wastage_pct' => 12],
                    ['material_name' => 'Cutting Disc', 'material_code' => 'RM-CD-230', 'quantity' => 0.1, 'unit' => 'pcs', 'wastage_pct' => 0],
                ],
            ],
            [
                'name'        => 'Bush (Phosphor Bronze)',
                'code'        => 'BS-003',
                'description' => 'Phosphor bronze bush for bearing application',
                'unit'        => 'pcs',
                'bom_items'   => [
                    ['material_name' => 'Phosphor Bronze Bar', 'material_code' => 'RM-PB-50', 'quantity' => 0.8, 'unit' => 'kg', 'wastage_pct' => 10],
                ],
            ],
            [
                'name'        => 'Bracket (Engine Mount)',
                'code'        => 'BK-004',
                'description' => 'Engine mounting bracket, Material: MS Plate',
                'unit'        => 'pcs',
                'bom_items'   => [
                    ['material_name' => 'MS Plate 10mm', 'material_code' => 'RM-MS-10', 'quantity' => 3.5, 'unit' => 'kg', 'wastage_pct' => 15],
                    ['material_name' => 'Welding Electrode E6013', 'material_code' => 'RM-WE-6013', 'quantity' => 0.15, 'unit' => 'kg', 'wastage_pct' => 5],
                    ['material_name' => 'Primer Paint', 'material_code' => 'RM-PP-GRY', 'quantity' => 0.1, 'unit' => 'ltr', 'wastage_pct' => 0],
                ],
            ],
            [
                'name'        => 'Pulley Wheel (V-Belt)',
                'code'        => 'PW-005',
                'description' => 'Cast iron V-belt pulley wheel, 200mm diameter',
                'unit'        => 'pcs',
                'bom_items'   => [
                    ['material_name' => 'Cast Iron Blank 200mm', 'material_code' => 'RM-CI-200', 'quantity' => 4.2, 'unit' => 'kg', 'wastage_pct' => 20],
                    ['material_name' => 'Cutting Tool Insert', 'material_code' => 'RM-CT-CNMG', 'quantity' => 0.02, 'unit' => 'pcs', 'wastage_pct' => 0],
                ],
            ],
        ];

        foreach ($products as $productData) {
            $product = Product::firstOrCreate(
                ['code' => $productData['code']],
                [
                    'name'        => $productData['name'],
                    'description' => $productData['description'],
                    'unit'        => $productData['unit'],
                ]
            );

            // Create BOM if not exists
            if ($product->boms()->count() === 0) {
                $bom = Bom::create([
                    'product_id' => $product->id,
                    'version'    => '1.0',
                    'is_active'  => true,
                    'notes'      => 'Initial BOM - Standard version',
                ]);

                foreach ($productData['bom_items'] as $item) {
                    BomItem::create(array_merge($item, ['bom_id' => $bom->id]));
                }
            }
        }
    }
}
