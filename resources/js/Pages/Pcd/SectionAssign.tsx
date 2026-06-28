import AppLayout from '@/Layouts/AppLayout';
import { Link, useForm } from '@inertiajs/react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SectionLite {
    id: number;
    name: string;
    code: string;
    name_bn?: string | null;
}

interface AssignedSection {
    id?: number;
    section_id: number;
    section: SectionLite;
    sequence?: number;
    status?: string;
    notes?: string | null;
    work_hours?: string | null;
    remarks?: string | null;
}

interface JobItem {
    id: number | null;
    sequence: number;
    description: string;
    part_no?: string | null;
    quantity: number;
    unit: string;
    pcd_note?: string | null;
}

interface WorkOrder {
    id: number;
    wo_number: string;
    job_number: string | number | null;
    suggested_job_number?: string | null;
    department?: string | null;
    customer: string;
    customer_po_no: string | null;
    status: string;
    created_at: string;
    due_date: string | null;
    prepared_by: string;
}

interface Props {
    work_order: WorkOrder;
    job_items: JobItem[];
    assigned_sections: AssignedSection[];
    available_sections: SectionLite[];
}

interface SectionRow {
    section_id: number;
    notes: string;
    work_hours: string;
    remarks: string;
    section: SectionLite;
    status?: string;
}

const STATUS_BADGE: Record<string, string> = {
    pending: 'badge-slate',
    waiting: 'badge-slate',
    in_progress: 'badge-amber',
    working: 'badge-amber',
    completed: 'badge-green',
    done: 'badge-green',
    blocked: 'badge-red',
};

/**
 * One row in the routing table. Bordered cells to mirror BITAC's paper form
 * (কার্যাদেশ পরিক্রমা / কার্যকাল / গ্রহণ / মন্তব্য). Drag handle on the left;
 * the operation/notes field is editable inline; remove button on the right.
 */
function SortableSectionRow({
    row,
    index,
    onNotesChange,
    onWorkHoursChange,
    onRemarksChange,
    onRemove,
}: {
    row: SectionRow;
    index: number;
    onNotesChange: (value: string) => void;
    onWorkHoursChange: (value: string) => void;
    onRemarksChange: (value: string) => void;
    onRemove: () => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: row.section_id,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const statusKey = (row.status ?? 'pending').toLowerCase();
    const badgeClass = STATUS_BADGE[statusKey] ?? 'badge-slate';

    return (
        <tr ref={setNodeRef} style={style} className="bg-white align-middle">
            <td className="border border-surface-300 px-2 py-3 text-center align-middle">
                <button
                    type="button"
                    {...attributes}
                    {...listeners}
                    className="cursor-grab active:cursor-grabbing text-surface-300 hover:text-brand-500 select-none transition-colors"
                    aria-label="Drag to reorder"
                >
                    <i className="fi fi-rr-grip-dots-vertical text-base leading-none" />
                </button>
            </td>
            <td className="border border-surface-300 px-3 py-3 text-center font-bold text-surface-800 align-middle w-12">
                {index + 1}
            </td>
            <td className="border border-surface-300 px-3 py-3 align-middle">
                <div className="font-semibold text-surface-900 text-sm">{row.section.name}</div>
                <div className="text-[11px] text-surface-400 mt-0.5">
                    <span className="font-mono">{row.section.code}</span>
                    {row.section.name_bn && <> · <span>{row.section.name_bn}</span></>}
                </div>
            </td>
            <td className="border border-surface-300 px-2 py-1.5 align-top w-28">
                <input
                    type="text"
                    value={row.work_hours}
                    onChange={(e) => onWorkHoursChange(e.target.value)}
                    placeholder="e.g. 2.5"
                    className="w-full text-sm text-center text-surface-900 bg-transparent border border-transparent focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-100 rounded px-1.5 py-1"
                />
            </td>
            <td className="border border-surface-300 px-2 py-1.5 align-top">
                <textarea
                    value={row.notes}
                    onChange={(e) => onNotesChange(e.target.value)}
                    rows={2}
                    className="w-full text-sm text-surface-900 bg-transparent border border-transparent focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-100 rounded px-1.5 py-1 resize-y min-h-[3rem]"
                    placeholder="e.g. Pattern making, Casting, CNC turning…"
                />
            </td>
            <td className="border border-surface-300 px-2 py-1.5 align-top">
                <textarea
                    value={row.remarks}
                    onChange={(e) => onRemarksChange(e.target.value)}
                    rows={2}
                    className="w-full text-sm text-surface-900 bg-transparent border border-transparent focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-100 rounded px-1.5 py-1 resize-y min-h-[3rem]"
                    placeholder="Remarks…"
                />
            </td>
            <td className="border border-surface-300 px-3 py-3 text-center align-middle w-28">
                <span className={`badge ${badgeClass} capitalize`}>
                    {statusKey.replace(/_/g, ' ')}
                </span>
            </td>
            <td className="border border-surface-300 px-2 py-3 text-center align-middle w-12">
                <button
                    type="button"
                    onClick={onRemove}
                    className="btn-icon text-surface-400 hover:text-red-600 hover:bg-red-50"
                    aria-label="Remove section"
                >
                    <i className="fi fi-rr-trash text-sm leading-none" />
                </button>
            </td>
        </tr>
    );
}

export default function SectionAssign({
    work_order,
    job_items,
    assigned_sections,
    available_sections,
}: Props) {
    const { data, setData, put, processing, errors } = useForm<{
        sections: SectionRow[];
        job_number: string;
        department: string;
        due_date: string;
        items: Array<{ id: number | null; description: string; part_no: string; quantity: string; pcd_note: string }>;
    }>({
        sections: assigned_sections.map((s) => ({
            section_id: s.section_id,
            notes: s.notes ?? '',
            work_hours: s.work_hours ?? '',
            remarks: s.remarks ?? '',
            section: s.section,
            status: s.status,
        })),
        // Pre-fill with the saved job number when present, otherwise the
        // suggested next sequence from the server. The officer can edit
        // either before saving.
        job_number: String(work_order.job_number ?? work_order.suggested_job_number ?? ''),
        // কার্যবিন্যাস — PCD editable, defaults to PCD per BITAC convention.
        department: work_order.department ?? '',
        // Delivery date — PCD editable (Y-m-d).
        due_date: work_order.due_date ?? '',
        // PCD-editable copy of the job items (description, part no, qty, note).
        items: job_items.map((it) => ({
            id: it.id,
            description: it.description ?? '',
            part_no: it.part_no ?? '',
            quantity: String(it.quantity ?? ''),
            pcd_note: it.pcd_note ?? '',
        })),
    });

    const updateItemField = (idx: number, field: 'description' | 'part_no' | 'quantity' | 'pcd_note', value: string) => {
        const next = [...data.items];
        next[idx] = { ...next[idx], [field]: value };
        setData('items', next);
    };

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const assignedIds = new Set(data.sections.map((s) => s.section_id));
    const palette = available_sections.filter((s) => !assignedIds.has(s.id));

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = data.sections.findIndex((s) => s.section_id === active.id);
        const newIndex = data.sections.findIndex((s) => s.section_id === over.id);
        if (oldIndex === -1 || newIndex === -1) return;
        setData('sections', arrayMove(data.sections, oldIndex, newIndex));
    };

    const addSection = (section: SectionLite) => {
        setData('sections', [
            ...data.sections,
            { section_id: section.id, notes: '', work_hours: '', remarks: '', section, status: 'pending' },
        ]);
    };

    const removeSection = (sectionId: number) => {
        setData('sections', data.sections.filter((s) => s.section_id !== sectionId));
    };

    const updateNotes = (sectionId: number, notes: string) => {
        setData(
            'sections',
            data.sections.map((s) => s.section_id === sectionId ? { ...s, notes } : s),
        );
    };

    const updateWorkHours = (sectionId: number, work_hours: string) => {
        setData(
            'sections',
            data.sections.map((s) => s.section_id === sectionId ? { ...s, work_hours } : s),
        );
    };

    const updateRemarks = (sectionId: number, remarks: string) => {
        setData(
            'sections',
            data.sections.map((s) => s.section_id === sectionId ? { ...s, remarks } : s),
        );
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        put(`/pcd/work-orders/${work_order.id}/sections`);
    };

    return (
        <AppLayout header={`Work Order — ${work_order.wo_number}`}>
            <div className="space-y-6 animate-fade-in max-w-6xl">
                {/* ── BITAC Work Order paper-form layout ─────────────────── */}
                <div className="card">
                    {/* Title strip */}
                    <div className="px-6 py-3 border-b border-surface-200 text-center">
                        <div className="text-lg font-bold text-surface-900">Work Order</div>
                    </div>

                    {/* Top metadata row — mirrors the paper form's job# / date split */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 border-b border-surface-200">
                        <div className="px-6 py-3 border-r border-surface-200">
                            <div className="text-[11px] uppercase tracking-wider text-surface-500 font-semibold mb-1">Job Number <span className="text-rose-500">*</span></div>
                            <input
                                type="text"
                                value={data.job_number}
                                onChange={e => setData('job_number', e.target.value)}
                                placeholder="e.g. J-2026-0042"
                                required
                                className="w-full text-xl font-bold font-mono text-surface-900 bg-transparent border-b-2 border-dashed border-surface-300 focus:border-brand-500 focus:outline-none py-1 -mb-0.5"
                            />
                            {!work_order.job_number && work_order.suggested_job_number && data.job_number === String(work_order.suggested_job_number) && (
                                <p className="text-[10px] text-surface-400 mt-1">
                                    <i className="fi fi-rr-magic-wand text-[9px] leading-none mr-0.5" />
                                    Auto-suggested — edit if your sequence differs.
                                </p>
                            )}
                            {(errors as any).job_number && <p className="form-error">{(errors as any).job_number}</p>}
                            <div className="text-[11px] text-surface-500 mt-1 font-mono">{work_order.wo_number}</div>
                        </div>
                        <div className="px-6 py-3 sm:text-right">
                            <div className="text-[11px] uppercase tracking-wider text-surface-500 font-semibold">Date</div>
                            <div className="text-xl font-bold text-surface-900 mt-0.5">{work_order.created_at}</div>
                            <div className="mt-2 flex items-center gap-2 sm:justify-end">
                                <span className="text-[11px] uppercase tracking-wider text-surface-500 font-semibold">Delivery</span>
                                <input
                                    type="date"
                                    value={data.due_date}
                                    onChange={e => setData('due_date', e.target.value)}
                                    className="text-sm font-semibold text-surface-900 bg-transparent border-b border-dashed border-surface-300 focus:border-brand-500 focus:outline-none py-0.5"
                                />
                            </div>
                            {(errors as any).due_date && <p className="form-error">{(errors as any).due_date}</p>}
                        </div>
                    </div>

                    {/* Section / Customer / Status row */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 border-b border-surface-200">
                        <div className="px-6 py-3 border-r border-surface-200">
                            <div className="text-[11px] uppercase tracking-wider text-surface-500 font-semibold mb-1">Department</div>
                            <input
                                type="text"
                                value={data.department}
                                onChange={e => setData('department', e.target.value)}
                                placeholder="উৎপাদন নিয়ন্ত্রণ বিভাগ (PCD)"
                                className="w-full text-sm font-semibold text-surface-900 bg-transparent border-b border-dashed border-surface-300 focus:border-brand-500 focus:outline-none py-0.5"
                            />
                            {(errors as any).department && <p className="form-error">{(errors as any).department}</p>}
                        </div>
                        <div className="px-6 py-3 border-r border-surface-200">
                            <div className="text-[11px] uppercase tracking-wider text-surface-500 font-semibold">Party Name</div>
                            <div className="text-sm font-semibold text-surface-900 mt-0.5">{work_order.customer ?? '—'}</div>
                            {work_order.customer_po_no && (
                                <div className="text-[11px] text-surface-500 font-mono mt-0.5">PO: {work_order.customer_po_no}</div>
                            )}
                        </div>
                        <div className="px-6 py-3">
                            <div className="text-[11px] uppercase tracking-wider text-surface-500 font-semibold">Status</div>
                            <span className="badge badge-blue capitalize mt-1 inline-flex">
                                {work_order.status === 'released_to_shops' ? 'Released from PCD to shop' : work_order.status?.replace(/_/g, ' ')}
                            </span>
                        </div>
                    </div>

                    {/* Job Items table — কার্যের বিশদ বিবরণ */}
                    <div className="px-6 py-4">
                        <div className="text-[11px] uppercase tracking-wider text-surface-500 font-semibold mb-2">
                            Items
                        </div>
                        <table className="w-full text-sm border-collapse border border-surface-300">
                            <thead className="bg-surface-50">
                                <tr>
                                    <th className="border border-surface-300 px-3 py-2 text-center w-16 font-semibold text-surface-700 text-xs">SL No.</th>
                                    <th className="border border-surface-300 px-3 py-2 text-left font-semibold text-surface-700 text-xs">Job Description</th>
                                    <th className="border border-surface-300 px-3 py-2 text-center w-24 font-semibold text-surface-700 text-xs">Qty</th>
                                    <th className="border border-surface-300 px-3 py-2 text-center w-20 font-semibold text-surface-700 text-xs">Unit</th>
                                    <th className="border border-surface-300 px-3 py-2 text-left w-32 font-semibold text-surface-700 text-xs">Part No.</th>
                                    <th className="border border-surface-300 px-3 py-2 text-left font-semibold text-surface-700 text-xs">Note</th>
                                </tr>
                            </thead>
                            <tbody>
                                {job_items.length > 0 ? job_items.map((it, idx) => (
                                    <tr key={it.id ?? it.sequence} className="align-top">
                                        <td className="border border-surface-300 px-3 py-2 text-center font-semibold text-surface-700">
                                            {String(it.sequence).padStart(2, '0')}
                                        </td>
                                        <td className="border border-surface-300 px-2 py-1.5">
                                            <textarea
                                                value={data.items[idx]?.description ?? ''}
                                                onChange={e => updateItemField(idx, 'description', e.target.value)}
                                                rows={2}
                                                className="w-full text-sm text-surface-900 bg-transparent border border-transparent focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-100 rounded px-1.5 py-1 resize-none"
                                            />
                                        </td>
                                        <td className="border border-surface-300 px-2 py-1.5 text-right">
                                            <input
                                                type="number"
                                                min={0}
                                                step="any"
                                                value={data.items[idx]?.quantity ?? ''}
                                                onChange={e => updateItemField(idx, 'quantity', e.target.value)}
                                                className="w-full text-sm text-right font-semibold text-surface-900 font-mono bg-transparent border border-transparent focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-100 rounded px-1.5 py-1"
                                            />
                                        </td>
                                        <td className="border border-surface-300 px-3 py-2 text-center text-surface-700">{it.unit}</td>
                                        <td className="border border-surface-300 px-2 py-1.5">
                                            <input
                                                type="text"
                                                value={data.items[idx]?.part_no ?? ''}
                                                onChange={e => updateItemField(idx, 'part_no', e.target.value)}
                                                placeholder="Part no.…"
                                                className="w-full text-sm text-surface-900 font-mono bg-transparent border border-transparent focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-100 rounded px-1.5 py-1"
                                            />
                                        </td>
                                        <td className="border border-surface-300 px-2 py-1.5">
                                            <textarea
                                                value={data.items[idx]?.pcd_note ?? ''}
                                                onChange={e => updateItemField(idx, 'pcd_note', e.target.value)}
                                                rows={2}
                                                placeholder="PCD note…"
                                                className="w-full text-xs text-surface-700 bg-transparent border border-transparent focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-100 rounded px-1.5 py-1 resize-none"
                                            />
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={6} className="border border-surface-300 px-3 py-4 text-center text-surface-400 italic text-xs">
                                            No items linked to this job
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* ── Routing instructions ───────────────────────────────── */}
                <div className="alert alert-info">
                    <i className="fi fi-rr-info text-sm leading-none" />
                    <div>
                        <div className="font-semibold">How routing works</div>
                        <div className="text-xs opacity-80 mt-0.5">
                            Drag rows to reorder. The job moves through these production shops in the sequence shown. After the last shop completes, the job is handed off to QC.
                        </div>
                    </div>
                </div>

                {errors.sections && (
                    <div className="alert alert-warning">
                        <i className="fi fi-rr-triangle-warning text-sm leading-none" />
                        <div className="text-xs">{errors.sections as any}</div>
                    </div>
                )}

                {/* ── কার্যাদেশ পরিক্রমা — Routing table + Available palette */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Routing table */}
                    <div className="lg:col-span-2">
                        <div className="card">
                            <div className="card-header flex items-center justify-between">
                                <div>
                                    <h2 className="text-base font-bold text-surface-900">
                                        Section
                                    </h2>
                                    <p className="text-xs text-surface-400 mt-0.5">
                                        {data.sections.length} shop{data.sections.length === 1 ? '' : 's'} in sequence
                                    </p>
                                </div>
                                <span className="badge badge-blue">
                                    {data.sections.length} total
                                </span>
                            </div>

                            <div className="card-body p-0">
                                {data.sections.length === 0 ? (
                                    <div className="empty-state py-10">
                                        <div className="empty-state-icon">
                                            <i className="fi fi-rr-boxes" />
                                        </div>
                                        <div className="empty-state-title">
                                            No shops assigned yet
                                        </div>
                                        <div className="empty-state-text">
                                            Pick shops from the palette on the right to begin building the routing sequence.
                                        </div>
                                    </div>
                                ) : (
                                    <DndContext
                                        sensors={sensors}
                                        collisionDetection={closestCenter}
                                        onDragEnd={handleDragEnd}
                                    >
                                        <SortableContext
                                            items={data.sections.map((s) => s.section_id)}
                                            strategy={verticalListSortingStrategy}
                                        >
                                            <div className="overflow-x-auto px-6 py-4">
                                                <table className="w-full text-sm border-collapse border border-surface-300">
                                                    <thead className="bg-surface-50">
                                                        <tr>
                                                            <th className="border border-surface-300 px-2 py-2 w-10 text-xs font-semibold text-surface-700"></th>
                                                            <th className="border border-surface-300 px-3 py-2 w-16 text-xs font-semibold text-surface-700">SL No.</th>
                                                            <th className="border border-surface-300 px-3 py-2 text-left text-xs font-semibold text-surface-700">
                                                                Section
                                                            </th>
                                                            <th className="border border-surface-300 px-3 py-2 text-center w-28 text-xs font-semibold text-surface-700">
                                                                Working Time / Hour
                                                            </th>
                                                            <th className="border border-surface-300 px-3 py-2 text-left text-xs font-semibold text-surface-700">
                                                                Operation / Task
                                                            </th>
                                                            <th className="border border-surface-300 px-3 py-2 text-left text-xs font-semibold text-surface-700">
                                                                Remarks
                                                            </th>
                                                            <th className="border border-surface-300 px-3 py-2 text-center w-28 text-xs font-semibold text-surface-700">Status</th>
                                                            <th className="border border-surface-300 px-2 py-2 w-12 text-xs font-semibold text-surface-700"></th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {data.sections.map((row, i) => (
                                                            <SortableSectionRow
                                                                key={row.section_id}
                                                                row={row}
                                                                index={i}
                                                                onNotesChange={(value) =>
                                                                    updateNotes(row.section_id, value)
                                                                }
                                                                onWorkHoursChange={(value) =>
                                                                    updateWorkHours(row.section_id, value)
                                                                }
                                                                onRemarksChange={(value) =>
                                                                    updateRemarks(row.section_id, value)
                                                                }
                                                                onRemove={() =>
                                                                    removeSection(row.section_id)
                                                                }
                                                            />
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </SortableContext>
                                    </DndContext>
                                )}
                            </div>
                        </div>

                        {/* Signature footer — mirrors paper form's three signature blocks */}
                        <div className="card mt-6">
                            <div className="card-body">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                    <div className="text-center">
                                        <div className="h-12" />
                                        <div className="border-t border-surface-400 pt-2 text-xs font-semibold text-surface-700">Prepared by</div>
                                        <div className="text-[11px] text-surface-700 mt-1 font-medium">{work_order.prepared_by}</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="h-12" />
                                        <div className="border-t border-surface-400 pt-2 text-xs font-semibold text-surface-700">Verified by</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="h-12" />
                                        <div className="border-t border-surface-400 pt-2 text-xs font-semibold text-surface-700">Approved by</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Palette + actions sidebar */}
                    <div className="space-y-4">
                        <div className="card sticky top-4">
                            <div className="card-header">
                                <h2 className="text-base font-bold text-surface-900">
                                    Available Shops
                                </h2>
                                <p className="text-xs text-surface-400 mt-0.5">
                                    Click to add to the routing sequence
                                </p>
                            </div>

                            <div className="card-body">
                                {palette.length === 0 ? (
                                    <div className="text-center py-8">
                                        <div className="w-12 h-12 mx-auto rounded-2xl bg-surface-50 flex items-center justify-center mb-2">
                                            <i className="fi fi-rr-check text-surface-400 text-lg" />
                                        </div>
                                        <div className="text-sm font-medium text-surface-700">
                                            All shops assigned
                                        </div>
                                        <div className="text-xs text-surface-400 mt-0.5">
                                            Nothing left in the palette
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {palette.map((section) => (
                                            <button
                                                key={section.id}
                                                type="button"
                                                onClick={() => addSection(section)}
                                                className="w-full text-left px-3 py-2.5 rounded-xl border border-surface-100 hover:border-brand-300 hover:bg-brand-50/30 transition-colors group"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-lg bg-surface-50 group-hover:bg-white flex items-center justify-center text-surface-500 group-hover:text-brand-600 transition-colors">
                                                        <i className="fi fi-rr-plus text-xs leading-none" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-semibold text-surface-900 truncate">
                                                                {section.name}
                                                            </span>
                                                            <span className="font-mono text-[10px] text-surface-400">
                                                                {section.code}
                                                            </span>
                                                        </div>
                                                        {section.name_bn && (
                                                            <div className="text-xs text-surface-500 truncate">
                                                                {section.name_bn}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Bottom action bar — sticky so Save is always reachable */}
                        <div className="card sticky bottom-4 z-10 shadow-premium-lg">
                            <div className="card-body flex items-center justify-between gap-2">
                                <Link
                                    href={`/pcd/inbox/${work_order.id}`}
                                    className="btn-outline"
                                >
                                    <i className="fi fi-rr-arrow-left text-xs leading-none" />
                                    Back
                                </Link>
                                <button
                                    type="button"
                                    onClick={submit}
                                    disabled={processing || data.sections.length === 0}
                                    className="btn-primary"
                                >
                                    <i className="fi fi-rr-disk text-xs leading-none" />
                                    {processing ? 'Saving...' : 'Save Work Order'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
