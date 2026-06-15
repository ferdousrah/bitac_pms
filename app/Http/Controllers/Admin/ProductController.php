<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ProductController extends Controller
{
    public function index(Request $request)
    {
        $query = Product::query();
        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('code', 'like', "%{$search}%");
            });
        }
        $products = $query->orderBy('name')->paginate(30)->withQueryString();

        return Inertia::render('Admin/Products/Index', [
            'products' => $products,
            'filters'  => $request->only(['search']),
        ]);
    }

    public function create()
    {
        return Inertia::render('Admin/Products/CreateEdit');
    }

    public function store(Request $request)
    {
        $validated = $this->validateInput($request);
        Product::create($validated);
        return redirect()->route('admin.products.index')->with('success', 'Product created.');
    }

    public function edit(Product $product)
    {
        return Inertia::render('Admin/Products/CreateEdit', [
            'product' => $product->only(['id', 'name', 'code', 'description', 'unit']),
        ]);
    }

    public function update(Request $request, Product $product)
    {
        $validated = $this->validateInput($request, $product->id);
        $product->update($validated);
        return redirect()->route('admin.products.index')->with('success', 'Product updated.');
    }

    public function destroy(Product $product)
    {
        $product->delete();
        return back()->with('success', 'Product deleted.');
    }

    private function validateInput(Request $request, ?int $id = null): array
    {
        $centerId = app()->bound('current_center_id') ? app('current_center_id') : null;

        return $request->validate([
            'name'        => [
                'required', 'string', 'max:200',
                \Illuminate\Validation\Rule::unique('products', 'name')
                    ->where(fn ($q) => $centerId ? $q->where('center_id', $centerId) : $q)
                    ->ignore($id),
            ],
            'code'        => 'nullable|string|max:50',
            'unit'        => 'nullable|string|max:20',
            'description' => 'nullable|string|max:500',
        ]);
    }
}
