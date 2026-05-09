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
