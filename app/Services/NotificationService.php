<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\CustomerNotification;
use App\Models\WorkOrder;

class NotificationService
{
    public function notifyCustomer(Customer $customer, WorkOrder $workOrder, string $type, string $message): CustomerNotification
    {
        return CustomerNotification::create([
            'customer_id'   => $customer->id,
            'work_order_id' => $workOrder->id,
            'type'          => $type,
            'message'       => $message,
            'is_read'       => false,
        ]);
    }

    public function workOrderStatusChanged(WorkOrder $workOrder): void
    {
        $this->notifyCustomer(
            $workOrder->customer,
            $workOrder,
            'status_update',
            "Your work order {$workOrder->wo_number} status has been updated to: {$workOrder->status_label}"
        );
    }
}
