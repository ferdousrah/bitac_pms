<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\PaymentDeductionType;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

/**
 * Master data for what a client cuts out of a payment.
 *
 * ⚠️ **`is_recoverable` is not cosmetic — it changes the dues.** A recoverable
 * deduction (security, performance deposit) is BITAC's money being held, so
 * the bill stays partly unsettled until it is released. A non-recoverable one
 * (tax at source, a penalty, rounding) settles the bill, because the money has
 * gone to the treasury or been given up. Flipping it on a type that is already
 * in use moves every bill that used it, which is why the screen says so.
 *
 * The list is NATIONAL, like `sectors` — "how much security is held across
 * BITAC" has to be one comparable figure.
 */
class PaymentDeductionTypeController extends Controller
{
    public function index(Request $request)
    {
        $query = PaymentDeductionType::withCount('deductions');

        if ($search = trim((string) $request->input('search'))) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('name_bn', 'like', "%{$search}%")
                  ->orWhere('code', 'like', "%{$search}%");
            });
        }

        return Inertia::render('Admin/PaymentDeductionTypes/Index', [
            'types'   => $query->ordered()->get(),
            'filters' => $request->only(['search']),
        ]);
    }

    public function store(Request $request)
    {
        $data = $this->validateInput($request);
        $data['code'] ??= Str::slug($data['name'], '_');

        PaymentDeductionType::create($data);

        return back()->with('success', 'Deduction type added.');
    }

    public function update(Request $request, PaymentDeductionType $paymentDeductionType)
    {
        $data = $this->validateInput($request, $paymentDeductionType->id);
        $data['code'] ??= $paymentDeductionType->code;

        $wasRecoverable = $paymentDeductionType->is_recoverable;
        $paymentDeductionType->update($data);

        // Say it out loud rather than letting the dues move in silence.
        if ($wasRecoverable !== $paymentDeductionType->is_recoverable && $paymentDeductionType->isInUse()) {
            return back()->with('success', sprintf(
                '“%s” updated. ⚠️ It is used on %d deduction(s) — their bills’ dues have changed, because %s.',
                $paymentDeductionType->name,
                $paymentDeductionType->deductions()->count(),
                $paymentDeductionType->is_recoverable
                    ? 'recoverable money stays in the dues until released'
                    : 'non-recoverable money settles the bill',
            ));
        }

        return back()->with('success', 'Deduction type updated.');
    }

    public function destroy(PaymentDeductionType $paymentDeductionType)
    {
        // A type already on a receipt is deactivated, never deleted — a past
        // deduction would otherwise lose what it was, and the foreign key
        // refuses it anyway.
        if ($paymentDeductionType->isInUse()) {
            $paymentDeductionType->update(['is_active' => false]);

            return back()->with('success', sprintf(
                '“%s” is used on %d deduction(s) — deactivated instead of deleted.',
                $paymentDeductionType->name,
                $paymentDeductionType->deductions()->count(),
            ));
        }

        $paymentDeductionType->delete();

        return back()->with('success', 'Deduction type deleted.');
    }

    private function validateInput(Request $request, ?int $id = null): array
    {
        return $request->validate([
            'name'             => ['required', 'string', 'max:120', Rule::unique('payment_deduction_types', 'name')->ignore($id)],
            'name_bn'          => 'nullable|string|max:160',
            'code'             => ['nullable', 'string', 'max:40', Rule::unique('payment_deduction_types', 'code')->ignore($id)],
            'is_recoverable'   => 'boolean',
            'default_rate_pct' => 'nullable|numeric|min:0|max:100',
            'is_active'        => 'boolean',
            'sort_order'       => 'nullable|integer|min:0',
        ]);
    }
}
