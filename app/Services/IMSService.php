<?php

namespace App\Services;

use App\Models\ImsIntegrationLog;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class IMSService
{
    private string $baseUrl;
    private string $apiKey;
    private int $timeout;

    public function __construct()
    {
        $this->baseUrl = config('ims.base_url', '');
        $this->apiKey  = config('ims.api_key', '');
        $this->timeout = (int) config('ims.timeout', 5);
    }

    public function checkProductAvailability(string $productCode, float $quantity): array
    {
        if (empty($this->baseUrl)) {
            return $this->unavailableResponse('Product availability check');
        }

        try {
            $payload = ['product_code' => $productCode, 'quantity' => $quantity];
            $response = Http::timeout($this->timeout)
                ->withHeaders(['Authorization' => 'Bearer ' . $this->apiKey])
                ->get($this->baseUrl . '/api/products/availability', $payload);

            $data = $response->json();
            $this->logRequest('product_availability', $payload, $data, 'success');

            return [
                'available'  => $data['available'] ?? false,
                'stock_qty'  => $data['stock_qty'] ?? 0,
                'ims_status' => 'connected',
            ];
        } catch (\Exception $e) {
            Log::warning('IMS unavailable: ' . $e->getMessage());
            $this->logRequest('product_availability', [], ['error' => $e->getMessage()], 'failed');
            return $this->unavailableResponse('Product availability check');
        }
    }

    public function checkRawMaterialStock(string $materialCode): array
    {
        if (empty($this->baseUrl)) {
            return $this->unavailableResponse('Raw material stock check');
        }

        try {
            $payload = ['material_code' => $materialCode];
            $response = Http::timeout($this->timeout)
                ->withHeaders(['Authorization' => 'Bearer ' . $this->apiKey])
                ->get($this->baseUrl . '/api/materials/stock', $payload);

            $data = $response->json();
            $this->logRequest('raw_material_stock', $payload, $data, 'success');

            return [
                'available_qty' => $data['available_qty'] ?? 0,
                'unit'          => $data['unit'] ?? 'kg',
                'ims_status'    => 'connected',
            ];
        } catch (\Exception $e) {
            Log::warning('IMS unavailable: ' . $e->getMessage());
            $this->logRequest('raw_material_stock', [], ['error' => $e->getMessage()], 'failed');
            return $this->unavailableResponse('Raw material stock check');
        }
    }

    /**
     * Push a Material Requisition to IMS for approval + issuance.
     * Returns ['ok' => bool, 'reference' => string|null, 'error' => string|null].
     *
     * The actual approval workflow happens inside IMS; PMS just records the
     * IMS reference + last-known status for traceability.
     */
    public function submitMaterialRequisition(\App\Models\MaterialRequisition $mr): array
    {
        if (empty($this->baseUrl)) {
            return ['ok' => false, 'reference' => null, 'error' => 'IMS base URL not configured (set IMS_BASE_URL in env).'];
        }

        $mr->loadMissing(['items.material', 'workOrder.customer']);

        $payload = [
            'source_system'    => 'BITAC_PMS',
            'pms_mrn_number'   => $mr->mrn_number,
            'pms_mrn_id'       => $mr->id,
            'request_date'     => $mr->request_date?->toDateString(),
            'work_order' => [
                'wo_number'    => $mr->workOrder?->wo_number,
                'job_number'   => $mr->workOrder?->job_number,
                'customer'     => $mr->workOrder?->customer?->name,
            ],
            'requested_by_user_id' => $mr->requested_by,
            'notes' => $mr->notes,
            'items' => $mr->items->map(fn($it) => [
                'item_no'        => $it->item_no,
                'description'    => $it->description,
                'material_id'    => $it->material_id,
                'material_code'  => $it->material?->code,
                'unit'           => $it->unit,
                'required_qty'   => (float) $it->required_qty,
            ])->values()->all(),
        ];

        try {
            $response = Http::timeout($this->timeout)
                ->withHeaders([
                    'Authorization' => 'Bearer ' . $this->apiKey,
                    'Accept'        => 'application/json',
                ])
                ->post($this->baseUrl . '/api/material-requisitions', $payload);

            $data = $response->json();
            $ok   = $response->successful() && !empty($data['reference']);

            $this->logRequest('mr_submit', $payload, $data ?? ['raw' => $response->body()], $ok ? 'success' : 'failed');

            if (!$ok) {
                return [
                    'ok'        => false,
                    'reference' => null,
                    'error'     => $data['error'] ?? ('IMS returned HTTP ' . $response->status()),
                    'response'  => $data,
                ];
            }

            return [
                'ok'        => true,
                'reference' => (string) $data['reference'],
                'status'    => $data['status'] ?? 'pending_approval',
                'response'  => $data,
            ];
        } catch (\Throwable $e) {
            Log::warning('IMS MR submit failed: ' . $e->getMessage());
            $this->logRequest('mr_submit', $payload, ['error' => $e->getMessage()], 'failed');
            return ['ok' => false, 'reference' => null, 'error' => $e->getMessage()];
        }
    }

    private function unavailableResponse(string $queryType): array
    {
        return [
            'ims_status' => 'unavailable',
            'message'    => 'IMS unavailable — verify manually',
        ];
    }

    private function logRequest(string $queryType, array $request, array $response, string $status): void
    {
        ImsIntegrationLog::create([
            'query_type'       => $queryType,
            'request_payload'  => $request,
            'response_payload' => $response,
            'status'           => $status,
        ]);
    }
}
