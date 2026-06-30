import AppLayout from '@/Layouts/AppLayout';
import { Link, useForm } from '@inertiajs/react';
import { useMemo } from 'react';
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

interface AssignedSection {
    id: number;
    name: string;
    code: string;
    sequence: number;
}

interface WorkOrder {
    id: number;
    wo_number: string;
    job_number: string | number | null;
    product: string;
    customer: string;
    quantity: number;
    assigned_sections?: AssignedSection[];
}

interface Section {
    id: number;
    name: string;
    code: string;
}

interface Machine {
    id: number;
    name: string;
    code: string;
    section_id: number | null;
}

interface Operation {
    id: number;
    name: string;
    category: string;
    default_unit: string | null;
}

interface Step {
    _uid: string;
    operation_id: number | string | null;
    operation_name: string;
    section_id: number | string;
    sub_section_id: number | string;
    machine_id: number | string;
    weight_pct: string;
    target_qty: string;
    tooling_notes: string;
}

interface ExistingSheet {
    id: number;
    sheet_number: string;
    job_title?: string | null;
    job_description?: string | null;
    material?: string | null;
    steps: Array<Omit<Step, '_uid'> & { id?: number }>;
}

interface WorkOrderItemRef {
    id: number;
    description: string;
    quantity: number;
    unit: string;
    sequence: number;
}

interface Props {
    workOrder: WorkOrder;
    item?: WorkOrderItemRef | null;
    sections: Section[];
    machines: Machine[];
    operations: Operation[];
    sheet?: ExistingSheet;
}

function makeEmptyStep(sectionId: number | string = '', targetQty: string = ''): Step {
    return {
        _uid:
            typeof crypto !== 'undefined' && 'randomUUID' in crypto
                ? crypto.randomUUID()
                : `s_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        operation_id: null,
        operation_name: '',
        section_id: sectionId,
        sub_section_id: '',
        machine_id: '',
        weight_pct: '',
        target_qty: targetQty,
        tooling_notes: '',
    };
}

function SortableStepCard({
    step,
    index,
    groupedOperations,
    operationsById,
    machinesBySection,
    subSectionsBySection,
    onChange,
    onRemove,
}: {
    step: Step;
    index: number;
    groupedOperations: Record<string, Operation[]>;
    operationsById: Record<string, Operation>;
    machinesBySection: Record<string, Machine[]>;
    subSectionsBySection: Record<string, Section[]>;
    onChange: (patch: Partial<Step>) => void;
    onRemove: () => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: step._uid,
    });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    // Section is now implicit from the group — machine list is scoped to it.
    // Sub-section is decided later by the shop in-charge, NOT here.
    const sectionKey = String(step.section_id || '');
    const availableMachines = sectionKey ? machinesBySection[sectionKey] ?? [] : [];

    const handleOperationChange = (value: string) => {
        if (!value) {
            onChange({ operation_id: null, operation_name: '' });
            return;
        }
        const op = operationsById[value];
        onChange({
            operation_id: Number(value),
            operation_name: op ? op.name : '',
        });
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="card animate-slide-up border border-surface-100 hover:border-brand-200 transition-colors"
        >
            <div className="card-body">
                <div className="flex items-start gap-3">
                    <button
                        type="button"
                        {...attributes}
                        {...listeners}
                        className="mt-1 cursor-grab active:cursor-grabbing text-surface-300 hover:text-brand-500 select-none transition-colors"
                        aria-label="Drag to reorder"
                    >
                        <i className="fi fi-rr-grip-dots-vertical text-lg leading-none" />
                    </button>

                    <div className="shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white font-bold text-sm flex items-center justify-center">
                        {index + 1}
                    </div>

                    <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                        {/* Operation */}
                        <div className="form-group sm:col-span-2 lg:col-span-2 mb-0">
                            <label className="form-label">Operation *</label>
                            <select
                                value={step.operation_id ?? ''}
                                onChange={(e) => handleOperationChange(e.target.value)}
                                className="form-select"
                                required
                            >
                                <option value="">Select operation...</option>
                                {Object.entries(groupedOperations).map(([category, ops]) => (
                                    <optgroup
                                        key={category}
                                        label={category || 'Uncategorized'}
                                    >
                                        {ops.map((op) => (
                                            <option key={op.id} value={op.id}>
                                                {op.name}
                                            </option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                        </div>

                        {/* Machine */}
                        <div className="form-group sm:col-span-2 lg:col-span-2 mb-0">
                            <label className="form-label">Machine <span className="form-label-optional">optional</span></label>
                            <select
                                value={step.machine_id}
                                onChange={(e) =>
                                    onChange({ machine_id: e.target.value })
                                }
                                className="form-select"
                            >
                                <option value="">Select machine...</option>
                                {availableMachines.map((m) => (
                                    <option key={m.id} value={m.id}>
                                        {m.name} ({m.code})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Target Qty — pieces to produce at this step (defaults to item qty) */}
                        <div className="form-group sm:col-span-2 lg:col-span-4 mb-0">
                            <label className="form-label-optional">Target Qty</label>
                            <input
                                type="number"
                                min="0"
                                step="any"
                                value={step.target_qty}
                                onChange={(e) => onChange({ target_qty: e.target.value })}
                                className="form-input"
                                placeholder="item qty"
                                title="How many pieces this step must produce. Defaults to the item quantity."
                            />
                        </div>

                        {/* Notes */}
                        <div className="form-group sm:col-span-2 lg:col-span-6 mb-0">
                            <label className="form-label-optional">Notes</label>
                            <input
                                type="text"
                                value={step.tooling_notes}
                                onChange={(e) =>
                                    onChange({ tooling_notes: e.target.value })
                                }
                                className="form-input"
                                placeholder="Jigs, fixtures, tools, remarks..."
                            />
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onRemove}
                        className="btn-icon text-surface-400 hover:text-red-600 hover:bg-red-50"
                        aria-label="Remove step"
                    >
                        <i className="fi fi-rr-trash text-sm leading-none" />
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function OperationSheetBuilder({
    workOrder,
    item,
    sections,
    machines,
    operations,
    sheet,
    defaultInstruction = '',
    sub_sections = {},
}: Props & { defaultInstruction?: string; sub_sections?: Record<string, Section[]> }) {
    const isEdit = !!sheet;

    const initialSteps: Step[] = sheet && sheet.steps.length > 0
        ? sheet.steps.map((s) => ({
            _uid:
                typeof crypto !== 'undefined' && 'randomUUID' in crypto
                    ? crypto.randomUUID()
                    : `s_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            operation_id: s.operation_id ?? null,
            operation_name: s.operation_name ?? '',
            section_id: s.section_id ?? '',
            sub_section_id: (s as any).sub_section_id ?? '',
            machine_id: s.machine_id ?? '',
            weight_pct: String(s.weight_pct ?? ''),
            target_qty: (s as any).target_qty != null ? String((s as any).target_qty) : '',
            tooling_notes: s.tooling_notes ?? '',
        }))
        : [];

    const { data, setData, post, put, processing, errors } = useForm<{
        work_order_id: number;
        work_order_item_id: number | null;
        job_title: string;
        job_description: string;
        material: string;
        steps: Step[];
    }>({
        work_order_id: workOrder.id,
        work_order_item_id: item ? item.id : null,
        // Job Title inherits from item description on create; PCD can edit before saving.
        job_title: sheet?.job_title ?? item?.description ?? '',
        job_description: sheet?.job_description ?? defaultInstruction ?? '',
        material: sheet?.material ?? '',
        steps: initialSteps,
    });

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const groupedOperations = useMemo(() => {
        const map: Record<string, Operation[]> = {};
        for (const op of operations) {
            const key = op.category || 'Uncategorized';
            if (!map[key]) map[key] = [];
            map[key].push(op);
        }
        return map;
    }, [operations]);

    const operationsById = useMemo(() => {
        const map: Record<string, Operation> = {};
        for (const op of operations) map[String(op.id)] = op;
        return map;
    }, [operations]);

    const machinesBySection = useMemo(() => {
        const map: Record<string, Machine[]> = {};
        for (const m of machines) {
            if (m.section_id == null) continue;
            const key = String(m.section_id);
            if (!map[key]) map[key] = [];
            map[key].push(m);
        }
        return map;
    }, [machines]);

    const orderedSections = useMemo<Section[]>(() => {
        const assigned = workOrder.assigned_sections ?? [];
        if (assigned.length === 0) return [];
        const sorted = [...assigned].sort((a, b) => a.sequence - b.sequence);
        return sorted.map((s) => ({ id: s.id, name: s.name, code: s.code }));
    }, [workOrder.assigned_sections]);

    // Add a row to a specific section group. Section is implicit — the new row
    // inherits the group's section_id so the user never picks it.
    const addStep = (sectionId: number | string = '') => setData('steps', [...data.steps, makeEmptyStep(sectionId, item ? String(item.quantity) : '')]);

    const removeStep = (uid: string) =>
        setData(
            'steps',
            data.steps.filter((s) => s._uid !== uid),
        );

    const updateStep = (uid: string, patch: Partial<Step>) =>
        setData(
            'steps',
            data.steps.map((s) => (s._uid === uid ? { ...s, ...patch } : s)),
        );

    // Reorder within a single section group. We map the section's local indices
    // back to absolute indices in data.steps so the global array stays consistent.
    const handleSectionDragEnd = (sectionId: number | string) => (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const groupUids = data.steps
            .filter((s) => String(s.section_id) === String(sectionId))
            .map((s) => s._uid);
        const oldGroupIdx = groupUids.indexOf(String(active.id));
        const newGroupIdx = groupUids.indexOf(String(over.id));
        if (oldGroupIdx === -1 || newGroupIdx === -1) return;
        const reorderedUids = arrayMove(groupUids, oldGroupIdx, newGroupIdx);

        // Rebuild the absolute steps list: keep non-group rows in place, replace
        // group rows in their original positions with the reordered ones.
        let cursor = 0;
        const next = data.steps.map((s) => {
            if (String(s.section_id) !== String(sectionId)) return s;
            const uid = reorderedUids[cursor++];
            return data.steps.find((x) => x._uid === uid)!;
        });
        setData('steps', next);
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isEdit && sheet) {
            put(`/operation-sheets/${sheet.id}`);
        } else {
            post(`/operation-sheets/${workOrder.id}`);
        }
    };

    return (
        <AppLayout header={`${isEdit ? 'Edit' : 'New'} Operation Sheet — Job# ${workOrder.job_number ?? '—'}`}>
            <div className="space-y-6 animate-fade-in">
                {/* Header card */}
                <div className="card">
                    <div className="card-body">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div className="flex items-start gap-4 min-w-0">
                                <div className="w-14 h-14 shrink-0 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-white font-bold text-xl flex items-center justify-center">
                                    {workOrder.job_number ?? '#'}
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-mono text-xs font-semibold text-surface-700">
                                            Job# {workOrder.job_number ?? '—'}
                                        </span>
                                        {item && (
                                            <span className="badge badge-amber">
                                                Item {item.sequence}
                                            </span>
                                        )}
                                        <span className="badge badge-blue">
                                            Qty {item ? item.quantity : workOrder.quantity}
                                            {item ? ` ${item.unit}` : ''}
                                        </span>
                                    </div>
                                    <h1 className="text-lg font-bold text-surface-900 mt-1 truncate">
                                        {item ? item.description : workOrder.product}
                                    </h1>
                                    <p className="text-xs text-surface-500 mt-0.5 truncate">
                                        Customer:{' '}
                                        <span className="font-medium text-surface-700">
                                            {workOrder.customer}
                                        </span>
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <Link
                                    href={`/work-orders/${workOrder.id}`}
                                    className="btn-outline"
                                >
                                    <i className="fi fi-rr-cross-small text-xs leading-none" />
                                    Cancel
                                </Link>
                                <button
                                    type="button"
                                    onClick={submit}
                                    disabled={processing || data.steps.length === 0}
                                    className="btn-primary"
                                >
                                    <i className="fi fi-rr-disk text-xs leading-none" />
                                    {processing ? 'Saving...' : (isEdit ? 'Update Operation Sheet' : 'Save Operation Sheet')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* BITAC header fields — Job Title (defaults from item, editable),
                    Job Description, Material. These print on the Operation Sheet PDF. */}
                <div className="card">
                    <div className="card-header">
                        <h2 className="text-base font-bold text-surface-900">
                            <i className="fi fi-rr-file-edit mr-2 text-brand-600" />
                            Sheet Header
                        </h2>
                        <p className="text-xs text-surface-500 mt-0.5">
                            These fields print at the top of the Operation Sheet PDF, matching the BITAC paper format.
                        </p>
                    </div>
                    <div className="card-body">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div className="form-group mb-0 lg:col-span-2">
                                <label className="form-label">
                                    Item Name
                                </label>
                                <input
                                    type="text"
                                    value={data.job_title}
                                    onChange={(e) => setData('job_title', e.target.value)}
                                    className="form-input"
                                    placeholder="e.g. Mfg. of Spur Gear, NT-21 & 16"
                                />
                                <p className="text-[11px] text-surface-400 mt-1">
                                    Inherits from the item description. Edit if you want a different title on the printed sheet.
                                </p>
                                {errors.job_title && <div className="form-error">{errors.job_title}</div>}
                            </div>

                            <div className="form-group mb-0">
                                <label className="form-label">
                                    Instruction
                                </label>
                                <input
                                    type="text"
                                    value={data.job_description}
                                    onChange={(e) => setData('job_description', e.target.value)}
                                    className="form-input"
                                    placeholder="e.g. As per Sample"
                                />
                                {errors.job_description && <div className="form-error">{errors.job_description}</div>}
                            </div>

                            <div className="form-group mb-0">
                                <label className="form-label">
                                    Material
                                </label>
                                <input
                                    type="text"
                                    value={data.material}
                                    onChange={(e) => setData('material', e.target.value)}
                                    className="form-input"
                                    placeholder="e.g. EN-24"
                                />
                                {errors.material && <div className="form-error">{errors.material}</div>}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Info alert */}
                <div className="alert alert-info">
                    <i className="fi fi-rr-info text-sm leading-none" />
                    <div>
                        <div className="font-semibold">Building the operation sheet</div>
                        <div className="text-xs opacity-80 mt-0.5">
                            Sections come from the Work Order's Shop Routing. Inside each section, add the operations to perform — pick the operation, machine, est. hours, weight, and any notes. Drag to reorder within a section.
                        </div>
                    </div>
                </div>

                {orderedSections.length === 0 && (
                    <div className="alert alert-warning">
                        <i className="fi fi-rr-triangle-warning text-sm leading-none" />
                        <div>
                            <div className="font-semibold">No sections in the Work Order's Shop Routing</div>
                            <div className="text-xs opacity-80 mt-0.5">
                                Add sections in the Work Order's Routing step before building this operation sheet.
                            </div>
                        </div>
                    </div>
                )}

                {typeof errors.steps === 'string' && (
                    <div className="alert alert-warning">
                        <i className="fi fi-rr-triangle-warning text-sm leading-none" />
                        <div className="text-xs">{errors.steps}</div>
                    </div>
                )}

                {/* Section-grouped steps. Each routing section from the WO becomes
                    its own group; operations within a section can be reordered. */}
                <form onSubmit={submit} className="space-y-4">
                    {orderedSections.map((section, sectionIdx) => {
                        const sectionSteps = data.steps.filter(
                            (s) => String(s.section_id) === String(section.id),
                        );
                        return (
                            <div key={section.id} className="card">
                                <div className="card-header flex items-center justify-between">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white font-bold text-sm flex items-center justify-center shrink-0">
                                            {sectionIdx + 1}
                                        </div>
                                        <div className="min-w-0">
                                            <h2 className="text-base font-bold text-surface-900 truncate">
                                                {section.name}
                                            </h2>
                                            <p className="text-[11px] text-surface-500 font-mono mt-0.5">
                                                {section.code}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="badge badge-blue shrink-0">
                                        {sectionSteps.length} operation{sectionSteps.length === 1 ? '' : 's'}
                                    </span>
                                </div>

                                <div className="card-body space-y-3">
                                    {sectionSteps.length === 0 ? (
                                        <div className="text-center py-6 text-surface-400 text-xs">
                                            No operations added for this section yet.
                                        </div>
                                    ) : (
                                        <DndContext
                                            sensors={sensors}
                                            collisionDetection={closestCenter}
                                            onDragEnd={handleSectionDragEnd(section.id)}
                                        >
                                            <SortableContext
                                                items={sectionSteps.map((s) => s._uid)}
                                                strategy={verticalListSortingStrategy}
                                            >
                                                <div className="space-y-3">
                                                    {sectionSteps.map((step, i) => (
                                                        <SortableStepCard
                                                            key={step._uid}
                                                            step={step}
                                                            index={i}
                                                            groupedOperations={groupedOperations}
                                                            operationsById={operationsById}
                                                            machinesBySection={machinesBySection}
                                                            subSectionsBySection={sub_sections}
                                                            onChange={(patch) =>
                                                                updateStep(step._uid, patch)
                                                            }
                                                            onRemove={() => removeStep(step._uid)}
                                                        />
                                                    ))}
                                                </div>
                                            </SortableContext>
                                        </DndContext>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => addStep(section.id)}
                                        className="w-full py-3 border-2 border-dashed border-surface-200 rounded-2xl text-surface-500 hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50/30 text-xs font-medium transition-colors flex items-center justify-center gap-2"
                                    >
                                        <i className="fi fi-rr-plus text-[10px] leading-none" />
                                        Add Operation in {section.name}
                                    </button>
                                </div>
                            </div>
                        );
                    })}

                    {/* Orphan rows whose section is no longer in the WO routing — render
                        as a fallback group so the data isn't lost during editing. */}
                    {(() => {
                        const orphans = data.steps.filter(
                            (s) => !orderedSections.some((sec) => String(sec.id) === String(s.section_id)),
                        );
                        if (orphans.length === 0) return null;
                        return (
                            <div className="card border-amber-200">
                                <div className="card-header flex items-center justify-between">
                                    <div>
                                        <h2 className="text-base font-bold text-amber-900">
                                            Unassigned operations
                                        </h2>
                                        <p className="text-[11px] text-amber-700 mt-0.5">
                                            These rows don't match any section in the current WO routing.
                                        </p>
                                    </div>
                                    <span className="badge badge-amber">{orphans.length}</span>
                                </div>
                                <div className="card-body space-y-3">
                                    <DndContext sensors={sensors} collisionDetection={closestCenter}>
                                        <SortableContext
                                            items={orphans.map((s) => s._uid)}
                                            strategy={verticalListSortingStrategy}
                                        >
                                            {orphans.map((step, i) => (
                                                <SortableStepCard
                                                    key={step._uid}
                                                    step={step}
                                                    index={i}
                                                    groupedOperations={groupedOperations}
                                                    operationsById={operationsById}
                                                    machinesBySection={machinesBySection}
                                                    subSectionsBySection={sub_sections}
                                                    onChange={(patch) => updateStep(step._uid, patch)}
                                                    onRemove={() => removeStep(step._uid)}
                                                />
                                            ))}
                                        </SortableContext>
                                    </DndContext>
                                </div>
                            </div>
                        );
                    })()}

                    {/* Section weightage (each shop's share of the job) is set on the
                        Work Order routing page by PCD — not per operation here. Operations
                        are tracked by quantity (Target Qty above). */}

                    <div className="flex items-center justify-end gap-3">
                        <Link href={`/work-orders/${workOrder.id}`} className="btn-outline">
                            Cancel
                        </Link>
                        <button
                            type="submit"
                            disabled={processing || data.steps.length === 0}
                            className="btn-primary"
                        >
                            <i className="fi fi-rr-disk text-xs leading-none" />
                            {processing ? 'Saving...' : (isEdit ? 'Update Operation Sheet' : 'Save Operation Sheet')}
                        </button>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
