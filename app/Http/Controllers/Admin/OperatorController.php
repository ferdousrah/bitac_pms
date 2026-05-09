<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Operator;
use App\Models\Section;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;

class OperatorController extends Controller
{
    public function index()
    {
        $operators = Operator::with('section', 'user')
            ->orderBy('name')
            ->paginate(20)
            ->through(fn($o) => [
                'id'           => $o->id,
                'employee_id'  => $o->employee_id,
                'name'         => $o->name,
                'phone'        => $o->phone,
                'section'      => $o->section ? ['id' => $o->section->id, 'name' => $o->section->name, 'code' => $o->section->code] : null,
                'shift'        => $o->shift,
                'skills'       => $o->skills ?? [],
                'is_active'    => $o->is_active,
                'joined_on'    => $o->joined_on?->format('d M Y'),
                'user_email'   => $o->user?->email,
            ]);

        return Inertia::render('Admin/Operators/Index', [
            'operators' => $operators,
        ]);
    }

    public function create()
    {
        return Inertia::render('Admin/Operators/CreateEdit', [
            'sections' => Section::active()->shops()->orderBy('display_order')->get(['id', 'name', 'code']),
            'users'    => User::orderBy('name')->get(['id', 'name', 'email']),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'employee_id' => 'required|string|max:30|unique:operators,employee_id',
            'name'        => 'required|string|max:100',
            'section_id'  => 'required|exists:sections,id',
            'user_id'     => 'nullable|exists:users,id',
            'phone'       => 'nullable|string|max:30',
            'skills'      => 'nullable|array',
            'shift'       => 'required|in:day,night,general',
            'is_active'   => 'boolean',
            'joined_on'   => 'nullable|date',
        ]);

        Operator::create($validated);

        return redirect()->route('admin.operators.index')->with('success', 'Operator created successfully.');
    }

    public function edit(Operator $operator)
    {
        return Inertia::render('Admin/Operators/CreateEdit', [
            'operator' => [
                'id'          => $operator->id,
                'employee_id' => $operator->employee_id,
                'name'        => $operator->name,
                'section_id'  => $operator->section_id,
                'user_id'     => $operator->user_id,
                'phone'       => $operator->phone,
                'skills'      => $operator->skills ?? [],
                'shift'       => $operator->shift,
                'is_active'   => $operator->is_active,
                'joined_on'   => $operator->joined_on?->format('Y-m-d'),
            ],
            'sections' => Section::active()->shops()->orderBy('display_order')->get(['id', 'name', 'code']),
            'users'    => User::orderBy('name')->get(['id', 'name', 'email']),
        ]);
    }

    public function update(Request $request, Operator $operator)
    {
        $validated = $request->validate([
            'employee_id' => 'required|string|max:30|unique:operators,employee_id,' . $operator->id,
            'name'        => 'required|string|max:100',
            'section_id'  => 'required|exists:sections,id',
            'user_id'     => 'nullable|exists:users,id',
            'phone'       => 'nullable|string|max:30',
            'skills'      => 'nullable|array',
            'shift'       => 'required|in:day,night,general',
            'is_active'   => 'boolean',
            'joined_on'   => 'nullable|date',
        ]);

        $operator->update($validated);

        return redirect()->route('admin.operators.index')->with('success', 'Operator updated.');
    }

    public function destroy(Operator $operator)
    {
        $operator->delete();
        return redirect()->route('admin.operators.index')->with('success', 'Operator deleted.');
    }
}
