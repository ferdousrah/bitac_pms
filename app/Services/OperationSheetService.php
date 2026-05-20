<?php

namespace App\Services;

use App\Models\OperationSheet;
use App\Models\WorkOrder;
use Barryvdh\DomPDF\Facade\Pdf;
use SimpleSoftwareIO\QrCode\Facades\QrCode;

class OperationSheetService
{
    public function generateQrCode(OperationSheet $sheet): string
    {
        return $sheet->workOrder->wo_number . '-SHEET-' . $sheet->sheet_number;
    }

    public function generateSheetNumber(WorkOrder $workOrder): string
    {
        $count = $workOrder->operationSheets()->count();
        return str_pad($count + 1, 2, '0', STR_PAD_LEFT);
    }

    public function generatePdf(OperationSheet $sheet): mixed
    {
        $sheet->load(['workOrder.product', 'workOrder.customer', 'steps.machine.workCentre', 'approvedBy']);
        return Pdf::loadView('pdf.operation_sheet', ['sheet' => $sheet])
                  ->setPaper('a4', 'portrait');
    }

    public function generateQrImage(string $qrCode): string
    {
        // SVG backend — no imagick required, works on Windows/XAMPP
        return base64_encode(QrCode::format('svg')->size(150)->margin(1)->generate($qrCode));
    }
}
