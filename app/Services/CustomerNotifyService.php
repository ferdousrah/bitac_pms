<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\CustomerNotification;
use App\Models\Invoice;
use App\Models\Quotation;
use App\Models\Rfq;
use App\Models\WorkOrder;

/**
 * Customer-facing notification helper. Each method maps to a customer-visible
 * state transition. All methods are best-effort — they swallow exceptions so
 * the originating workflow (saving a quotation, completing a WO, etc.) never
 * fails because of a notification problem.
 */
class CustomerNotifyService
{
    public static function send(
        Customer $customer,
        string $type,
        string $title,
        string $message,
        ?string $link = null,
        string $icon = 'fi-rr-bell',
        string $color = 'blue',
        ?WorkOrder $workOrder = null,
        ?array $data = null,
    ): ?CustomerNotification {
        try {
            return CustomerNotification::create([
                'customer_id'   => $customer->id,
                'work_order_id' => $workOrder?->id,
                'type'          => $type,
                'title'         => $title,
                'message'       => $message,
                'link'          => $link,
                'icon'          => $icon,
                'color'         => $color,
                'data'          => $data,
                'is_read'       => false,
            ]);
        } catch (\Throwable $e) {
            \Log::warning('CustomerNotifyService::send failed', ['error' => $e->getMessage()]);
            return null;
        }
    }

    // ── RFQ ────────────────────────────────────────────────────────

    public static function rfqQuoted(Rfq $rfq, Quotation $quotation): void
    {
        if (! $rfq->customer) return;
        self::send(
            $rfq->customer,
            'rfq_quoted',
            'Quotation ready for your RFQ',
            "BITAC has prepared a quotation for RFQ #{$rfq->id}. Total: BDT " . number_format((float) $quotation->total_amount, 2),
            "/customer/rfqs/{$rfq->id}",
            'fi-rr-receipt', 'emerald',
        );
    }

    // ── Quotation ──────────────────────────────────────────────────

    public static function quotationSent(Quotation $quotation): void
    {
        $customer = $quotation->customer ?? $quotation->rfq?->customer;
        if (! $customer) return;
        self::send(
            $customer,
            'quotation_sent',
            'New quotation from BITAC',
            "Quotation v{$quotation->version} for BDT " . number_format((float) $quotation->total_amount, 2) . " is ready for your review.",
            $quotation->rfq_id ? "/customer/rfqs/{$quotation->rfq_id}" : "/customer/documents",
            'fi-rr-file-invoice-dollar', 'emerald',
        );
    }

    // ── Work Order Lifecycle ───────────────────────────────────────

    public static function workOrderStateChanged(WorkOrder $wo, string $previousStatus): void
    {
        if (! $wo->customer) return;

        // Map customer-meaningful transitions only — skip internal noise like
        // pcd_pending or qc_hold (those are upstream-internal).
        $milestone = match ($wo->status) {
            'in_production'      => ['title' => 'Production started',     'msg' => 'Production has started on your order. We\'ll keep you posted on milestones.', 'icon' => 'fi-rr-settings', 'color' => 'blue'],
            'qc_passed'          => ['title' => 'QC passed',              'msg' => 'Your order has passed quality inspection.',                                  'icon' => 'fi-rr-shield-check', 'color' => 'teal'],
            'ready_for_delivery' => ['title' => 'Ready for delivery',     'msg' => 'Your order is ready and will be delivered shortly.',                          'icon' => 'fi-rr-box-check', 'color' => 'purple'],
            'delivered'          => ['title' => 'Delivered',              'msg' => 'Your order has been delivered. Thank you for choosing BITAC.',                'icon' => 'fi-rr-truck-side', 'color' => 'green'],
            'cancelled'          => ['title' => 'Order cancelled',        'msg' => 'Your order has been cancelled.' . ($wo->cancellation_reason ? ' Reason: ' . $wo->cancellation_reason : ''), 'icon' => 'fi-rr-cross-circle', 'color' => 'red'],
            default              => null,
        };
        if (! $milestone) return;

        self::send(
            $wo->customer,
            'work_order_milestone',
            $milestone['title'],
            "Order {$wo->wo_number}: {$milestone['msg']}",
            "/customer/work-orders/{$wo->id}",
            $milestone['icon'],
            $milestone['color'],
            $wo,
        );
    }

    // ── Invoice ────────────────────────────────────────────────────

    public static function invoiceIssued(Invoice $invoice): void
    {
        if (! $invoice->customer) return;
        self::send(
            $invoice->customer,
            'invoice_issued',
            'New invoice issued',
            "Invoice {$invoice->invoice_number} for BDT " . number_format((float) $invoice->total_amount, 2) . " is ready.",
            "/customer/invoices/{$invoice->id}",
            'fi-rr-receipt', 'amber',
            $invoice->workOrder,
        );
    }

    public static function invoicePaid(Invoice $invoice): void
    {
        if (! $invoice->customer) return;
        self::send(
            $invoice->customer,
            'invoice_paid',
            'Payment received',
            "Your payment for invoice {$invoice->invoice_number} has been recorded. Thank you.",
            "/customer/invoices/{$invoice->id}",
            'fi-rr-check-circle', 'green',
            $invoice->workOrder,
        );
    }

    // ── Gate Pass ──────────────────────────────────────────────────

    public static function gatePassCompleted($gatePass): void
    {
        $customer = $gatePass->customer ?? $gatePass->rfq?->customer;
        if (! $customer) return;
        $isIn = $gatePass->direction === 'in';
        $title = $isIn ? 'Item received at BITAC' : 'Item dispatched from BITAC';
        $msg   = $isIn
            ? "We've received the item against Pass #{$gatePass->pass_no}. Production / inspection will follow."
            : "Your item has left BITAC under Pass #{$gatePass->pass_no}.";
        self::send(
            $customer,
            'gate_pass_completed',
            $title,
            $msg,
            '/customer/documents',
            $isIn ? 'fi-rr-sign-in-alt' : 'fi-rr-sign-out-alt',
            'green',
        );
    }

    public static function gatePassIssued($gatePass): void
    {
        // Prefer the direct customer link (from the gate pass form's customer
        // picker). Fall back to the linked RFQ's customer for legacy passes.
        $customer = $gatePass->customer ?? $gatePass->rfq?->customer;
        if (! $customer) return;
        $direction = $gatePass->direction === 'in' ? 'Gate Pass In' : 'Gate Pass Out';
        self::send(
            $customer,
            'gate_pass_issued',
            "{$direction} issued",
            "Pass #{$gatePass->pass_no} has been issued. You can print it from the documents page.",
            "/customer/documents",
            'fi-rr-shield', 'indigo',
        );
    }
}
