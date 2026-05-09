<?php

namespace App\Http\Controllers;

use App\Models\Ncr;
use App\Models\ReworkOrder;
use Illuminate\Http\Request;
use Inertia\Inertia;

class NcrController extends Controller
{
    public function index(Request $request)
    {
        $query = Ncr::with(['workOrder', 'responsibleUser']);

        // Search
        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('ncr_number', 'like', "%{$search}%")
                  ->orWhere('defect_type', 'like', "%{$search}%")
                  ->orWhereHas('workOrder', fn($w) => $w->where('wo_number', 'like', "%{$search}%"));
            });
        }

        // Filter by status
        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }

        // Sorting
        $sort = $request->input('sort', 'id');
        $dir  = $request->input('dir', 'desc');
        $allowed = ['id', 'status', 'created_at'];
        if (in_array($sort, $allowed)) {
            $query->orderBy($sort, $dir === 'asc' ? 'asc' : 'desc');
        } else {
            $query->latest();
        }

        $ncrs = $query->paginate(15)->withQueryString()
            ->through(fn($n) => [
                'id'                 => $n->id,
                'ncr_number'         => $n->ncr_number,
                'work_order_id'      => $n->work_order_id,
                'wo_number'          => $n->workOrder->wo_number ?? '',
                'defect_description' => $n->defect_type,
                'severity'           => null,
                'disposition'        => null,
                'status'             => $n->status,
                'created_at'         => $n->created_at->format('d/m/Y H:i'),
            ]);

        return Inertia::render('NCR/Index', [
            'ncrs' => $ncrs,
            'filters' => [
                'search' => $request->input('search', ''),
                'status' => $request->input('status', ''),
                'sort'   => $sort,
                'dir'    => $dir,
            ],
        ]);
    }

    public function show(Ncr $ncr)
    {
        $ncr->load(['workOrder', 'responsibleUser', 'reworkOrders']);
        $user = auth()->user();

        return Inertia::render('NCR/Show', [
            'ncr' => [
                'id'                 => $ncr->id,
                'ncr_number'         => $ncr->ncr_number,
                'work_order_id'      => $ncr->work_order_id,
                'wo_number'          => $ncr->workOrder->wo_number ?? '',
                'defect_description' => $ncr->defect_type,
                'severity'           => null,
                'disposition'        => null,
                'status'             => $ncr->status,
                'raised_by_name'     => $ncr->responsibleUser?->name ?? '',
                'root_cause'         => $ncr->root_cause,
                'corrective_action'  => $ncr->corrective_action,
                'created_at'         => $ncr->created_at->format('d M Y'),
                'rework_order'       => $ncr->reworkOrders->first() ? [
                    'rework_number' => $ncr->reworkOrders->first()->rework_wo_number,
                    'status'        => $ncr->reworkOrders->first()->status,
                ] : null,
            ],
            'canCreateRework' => $user->can('manage production'),
        ]);
    }

    public function createRework(Request $request, Ncr $ncr)
    {
        $validated = $request->validate([
            'notes' => 'nullable|string',
        ]);

        $year  = now()->year;
        $count = ReworkOrder::whereYear('created_at', $year)->count();
        $reworkWoNumber = 'RWK-' . $year . '-' . str_pad($count + 1, 4, '0', STR_PAD_LEFT);

        ReworkOrder::create([
            'ncr_id'                 => $ncr->id,
            'original_work_order_id' => $ncr->work_order_id,
            'rework_wo_number'       => $reworkWoNumber,
            'status'                 => 'open',
            'notes'                  => $validated['notes'],
            'created_by'             => auth()->id(),
        ]);

        $ncr->update(['status' => 'in_rework']);

        return redirect()->route('ncrs.show', $ncr)->with('success', "Rework order {$reworkWoNumber} created.");
    }
}
