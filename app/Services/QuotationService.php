<?php

namespace App\Services;

use App\Models\Quotation;
use App\Models\QuotationApproval;
use App\Models\QuotationApprovalSetting;
use App\Models\Rfq;
use App\Models\User;

class QuotationService
{
    public function calculateCosts(array $data): array
    {
        $material = (float) ($data['material_cost'] ?? 0);
        $labour   = (float) ($data['labour_cost'] ?? 0);
        $overhead = (float) ($data['overhead_cost'] ?? 0);
        $margin   = (float) ($data['profit_margin'] ?? 0);
        $discount = (float) ($data['discount'] ?? 0);
        $vatRate  = (float) ($data['vat_rate'] ?? config('app.vat_rate', 15));

        $subtotal       = $material + $labour + $overhead;
        $profitAmount   = $subtotal * ($margin / 100);
        $beforeDiscount = $subtotal + $profitAmount;
        $afterDiscount  = $beforeDiscount - $discount;
        $vatAmount      = $afterDiscount * ($vatRate / 100);
        $total          = $afterDiscount + $vatAmount;

        return [
            'subtotal'     => round($subtotal, 2),
            'profit_amount'=> round($profitAmount, 2),
            'vat_amount'   => round($vatAmount, 2),
            'total_amount' => round($total, 2),
        ];
    }

    public function getNextVersion(int $rfqId): int
    {
        return Quotation::where('rfq_id', $rfqId)->max('version') + 1;
    }

    public function createApprovalChain(Quotation $quotation): void
    {
        $settings = QuotationApprovalSetting::orderBy('level')->get();

        // Fallback: if no settings configured, use users with management role (up to 2)
        if ($settings->isEmpty()) {
            $managers = User::role('management')->take(2)->get();
            $level = 1;
            foreach ($managers as $manager) {
                QuotationApproval::create([
                    'quotation_id' => $quotation->id,
                    'approver_id'  => $manager->id,
                    'level'        => $level++,
                    'status'       => 'pending',
                ]);
            }
            return;
        }

        foreach ($settings as $setting) {
            QuotationApproval::create([
                'quotation_id' => $quotation->id,
                'approver_id'  => $setting->approver_id,
                'level'        => $setting->level,
                'status'       => 'pending',
            ]);
        }
    }

    public function checkApprovalChain(Quotation $quotation): bool
    {
        $pending = $quotation->approvals()->where('status', 'pending')->count();
        return $pending === 0;
    }
}
