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

interface Operator {
    id: number;
    name: string;
    employee_id: string | number | null;
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
    machine_id: number | string;
    operator_id: number | string;
    estimated_hours: string;
    weight_pct: string;
    tooling_notes: string;
}

interface Props {
    workOrder: WorkOrder;
    sections: Section[];
    machines: Machine[];
    operators: Operator[];
    operations: Operation[];
}

function makeEmptyStep(): Step {
    return {
        _uid:
            typeof crypto !== 'undefined' && 'randomUUID' in crypto
                ? crypto.randomUUID()
                : `s_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        operation_id: null,
        operation_name: '',
        section_id: '',
        machine_id: '',
        operator_id: '',
        estimated_hours: '',
        weight_pct: '',
        tooling_notes: '',
    };
}

function SortableStepCard({
    step,
    index,
    sections,
    orderedSections,
    groupedOperations,
    operationsById,
    machinesBySection,
    operatorsBySection,
    onChange,
    onRemove,
}: {
    step: Step;
    index: number;
    sections: Section[];
    orderedSections: Section[];
    groupedOperations: Record<string, Operation[]>;
    operationsById: Record<string, Operation>;
    machinesBySection: Record<string, Machine[]>;
    operatorsBySection: Record<string, Operator[]>;
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

    const sectionKey = String(step.section_id || '');
    const availableMachines = sectionKey ? machinesBySection[sectionKey] ?? [] : [];
    const availableOperators = sectionKey ? operatorsBySection[sectionKey] ?? [] : [];

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

    const handleSectionChange = (value: string) => {
        // Changing section invalidates machine and operator
        onChange({ section_id: value, machine_id: '', operator_id: '' });
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

                        {/* Section */}
                        <div className="form-group sm:col-span-1 lg:col-span-2 mb-0">
                            <label className="form-label">Section *</label>
                            <select
                                value={step.section_id}
                                onChange={(e) => handleSectionChange(e.target.value)}
                                className="form-select"
                                required
                            >
                                <option value="">Select section...</option>
                                {orderedSections.length > 0 && (
                                    <optgroup label="Assigned to this job">
                                        {orderedSections.map((s) => (
                                            <option key={`a-${s.id}`} value={s.id}>
                                                {s.name} ({s.code})
                                            </option>
                                        ))}
                                    </optgroup>
                                )}
                                <optgroup label="All sections">
                                    {sections
                                        .filter(
                                            (s) =>
                                                !orderedSections.some(
                                                    (o) => o.id === s.id,
                                                ),
                                        )
                                        .map((s) => (
                                            <option key={s.id} value={s.id}>
                                                {s.name} ({s.code})
                                            </option>
                                        ))}
                                </optgroup>
                            </select>
                        </div>

                        {/* Machine */}
                        <div className="form-group sm:col-span-1 lg:col-span-2 mb-0">
                            <label className="form-label">Machine *</label>
                            <select
                                value={step.machine_id}
                                onChange={(e) =>
                                    onChange({ machine_id: e.target.value })
                                }
                                className="form-select"
                                disabled={!sectionKey}
                                required
                            >
                                <option value="">
                                    {sectionKey
                                        ? 'Select machine...'
                                        : 'Pick a section first'}
                                </option>
                                {availableMachines.map((m) => (
                                    <option key={m.id} value={m.id}>
                                        {m.name} ({m.code})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Operator */}
                        <div className="form-group sm:col-span-1 lg:col-span-2 mb-0">
                            <label className="form-label">Operator *</label>
                            <select
                                value={step.operator_id}
                                onChange={(e) =>
                                    onChange({ operator_id: e.target.value })
                                }
                                className="form-select"
                                disabled={!sectionKey}
                                required
                            >
                                <option value="">
                                    {sectionKey
                                        ? 'Select operator...'
                                        : 'Pick a section first'}
                                </option>
                                {availableOperators.map((o) => (
                                    <option key={o.id} value={o.id}>
                                        {o.name}
                                        {o.employee_id ? ` — ${o.employee_id}` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Estimated hours */}
                        <div className="form-group sm:col-span-1 lg:col-span-1 mb-0">
                            <label className="form-label-optional">Est. Hours</label>
                            <input
                                type="number"
                                min="0"
                                step="0.1"
                                value={step.estimated_hours}
                                onChange={(e) =>
                                    onChange({ estimated_hours: e.target.value })
                                }
                                className="form-input"
                                placeholder="0.0"
                            />
                        </div>

                        {/* Weight % — contribution to overall job progress */}
                        <div className="form-group sm:col-span-1 lg:col-span-1 mb-0">
                            <label className="form-label-optional">Weight %</label>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                value={step.weight_pct}
                                onChange={(e) =>
                                    onChange({ weight_pct: e.target.value })
                                }
                                className="form-input"
                                placeholder="0.0"
                                title="This step's contribution to overall job progress. All step weights should sum to 100."
                            />
                        </div>

                        {/* Tooling notes */}
                        <div className="form-group sm:col-span-2 lg:col-span-2 mb-0">
                            <label className="form-label-optional">Tooling Notes</label>
                            <input
                                type="text"
                                value={step.tooling_notes}
                                onChange={(e) =>
                                    onChange({ tooling_notes: e.target.value })
                                }
                                className="form-input"
                                placeholder="Jigs, fixtures, tools..."
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
    sections,
    machines,
    operators,
    operations,
}: Props) {
    const { data, setData, post, processing, errors } = useForm<{
        work_order_id: number;
        steps: Step[];
    }>({
        work_order_id: workOrder.id,
        steps: [makeEmptyStep()],
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

    const operatorsBySection = useMemo(() => {
        const map: Record<string, Operator[]> = {};
        for (const o of operators) {
            if (o.section_id == null) continue;
            const key = String(o.section_id);
            if (!map[key]) map[key] = [];
            map[key].push(o);
        }
        return map;
    }, [operators]);

    const orderedSections = useMemo<Section[]>(() => {
        const assigned = workOrder.assigned_sections ?? [];
        if (assigned.length === 0) return [];
        const sorted = [...assigned].sort((a, b) => a.sequence - b.sequence);
        return sorted.map((s) => ({ id: s.id, name: s.name, code: s.code }));
    }, [workOrder.assigned_sections]);

    // Sum of all step weights. PCD officer aims for 100%. Color in the footer
    // turns green at 100, amber while in flux, red if overshot.
    const totalWeight = useMemo(() => {
        return data.steps.reduce((acc, s) => acc + (parseFloat(s.weight_pct) || 0), 0);
    }, [data.steps]);

    // Distribute 100% equally across all steps. Quick way to balance a fresh sheet.
    const equalBalance = () => {
        const n = data.steps.length;
        if (n === 0) return;
        const each = Math.floor((100 / n) * 100) / 100; // 2 decimals
        const remainder = +(100 - each * n).toFixed(2); // pad the first row so total == exactly 100
        setData('steps', data.steps.map((s, i) => ({
            ...s,
            weight_pct: i === 0 ? (each + remainder).toFixed(2) : each.toFixed(2),
        })));
    };

    // Distribute 100% proportional to each step's estimated_hours. Falls back
    // to equal distribution when hours aren't filled in.
    const hoursBalance = () => {
        const totalHours = data.steps.reduce((acc, s) => acc + (parseFloat(s.estimated_hours) || 0), 0);
        if (totalHours <= 0) { equalBalance(); return; }
        let allocated = 0;
        const next = data.steps.map((s, i) => {
            const h = parseFloat(s.estimated_hours) || 0;
            const pct = i === data.steps.length - 1
                ? +(100 - allocated).toFixed(2) // last step absorbs rounding
                : +((h / totalHours) * 100).toFixed(2);
            allocated += pct;
            return { ...s, weight_pct: pct.toFixed(2) };
        });
        setData('steps', next);
    };

    const addStep = () => setData('steps', [...data.steps, makeEmptyStep()]);

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

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = data.steps.findIndex((s) => s._uid === active.id);
        const newIndex = data.steps.findIndex((s) => s._uid === over.id);
        if (oldIndex === -1 || newIndex === -1) return;
        setData('steps', arrayMove(data.steps, oldIndex, newIndex));
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/operation-sheets');
    };

    return (
        <AppLayout header={`Operation Sheet — ${workOrder.wo_number}`}>
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
                                            {workOrder.wo_number}
                                        </span>
                                        <span className="badge badge-blue">
                                            Qty {workOrder.quantity}
                                        </span>
                                    </div>
                                    <h1 className="text-lg font-bold text-surface-900 mt-1 truncate">
                                        {workOrder.product}
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
                                    {processing ? 'Saving...' : 'Save Operation Sheet'}
                                </button>
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
                            Add operation steps in the order they should be performed. Each step needs a section, machine, and operator assigned. Use the drag handle to reorder steps.
                        </div>
                    </div>
                </div>

                {typeof errors.steps === 'string' && (
                    <div className="alert alert-warning">
                        <i className="fi fi-rr-triangle-warning text-sm leading-none" />
                        <div className="text-xs">{errors.steps}</div>
                    </div>
                )}

                {/* Steps */}
                <form onSubmit={submit} className="space-y-4">
                    <div className="card">
                        <div className="card-header flex items-center justify-between">
                            <div>
                                <h2 className="text-base font-bold text-surface-900">
                                    Operation Steps
                                </h2>
                                <p className="text-xs text-surface-400 mt-0.5">
                                    {data.steps.length} step{data.steps.length === 1 ? '' : 's'} defined
                                </p>
                            </div>
                            <span className="badge badge-blue">
                                {data.steps.length} total
                            </span>
                        </div>

                        <div className="card-body space-y-4">
                            {data.steps.length === 0 ? (
                                <div className="empty-state py-10">
                                    <div className="empty-state-icon">
                                        <i className="fi fi-rr-list-check" />
                                    </div>
                                    <div className="empty-state-title">
                                        No operation steps yet
                                    </div>
                                    <div className="empty-state-text">
                                        Click the add button below to start building the sheet.
                                    </div>
                                </div>
                            ) : (
                                <DndContext
                                    sensors={sensors}
                                    collisionDetection={closestCenter}
                                    onDragEnd={handleDragEnd}
                                >
                                    <SortableContext
                                        items={data.steps.map((s) => s._uid)}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        <div className="space-y-3">
                                            {data.steps.map((step, i) => (
                                                <SortableStepCard
                                                    key={step._uid}
                                                    step={step}
                                                    index={i}
                                                    sections={sections}
                                                    orderedSections={orderedSections}
                                                    groupedOperations={groupedOperations}
                                                    operationsById={operationsById}
                                                    machinesBySection={machinesBySection}
                                                    operatorsBySection={operatorsBySection}
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
                                onClick={addStep}
                                className="w-full py-4 border-2 border-dashed border-surface-200 rounded-2xl text-surface-500 hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50/30 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                            >
                                <i className="fi fi-rr-plus text-xs leading-none" />
                                Add Step
                            </button>
                        </div>
                    </div>

                    {/* Weight summary — sum should be 100 for accurate job progress tracking */}
                    {data.steps.length > 0 && (
                        <div className={`card border-2 ${
                            Math.abs(totalWeight - 100) < 0.01
                                ? 'border-emerald-200 bg-emerald-50/40'
                                : totalWeight > 100
                                    ? 'border-red-200 bg-red-50/40'
                                    : 'border-amber-200 bg-amber-50/40'
                        }`}>
                            <div className="card-body flex items-center justify-between gap-3 flex-wrap">
                                <div className="flex items-center gap-3">
                                    <i className={`fi ${
                                        Math.abs(totalWeight - 100) < 0.01
                                            ? 'fi-sr-check-circle text-emerald-500'
                                            : totalWeight > 100
                                                ? 'fi-sr-cross-circle text-red-500'
                                                : 'fi-sr-info text-amber-500'
                                    } text-lg leading-none`} />
                                    <div>
                                        <div className="text-sm font-bold text-surface-900">
                                            Total Weight: <span className="font-mono">{totalWeight.toFixed(2)}%</span>
                                            <span className="text-surface-400 font-normal"> / 100%</span>
                                        </div>
                                        <div className="text-[11px] text-surface-500 mt-0.5">
                                            {Math.abs(totalWeight - 100) < 0.01
                                                ? '✓ Balanced — each step contributes to overall job progress.'
                                                : totalWeight > 100
                                                    ? 'Total exceeds 100%. Adjust step weights or use auto-balance.'
                                                    : 'Weights should sum to 100% for accurate progress tracking.'}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={equalBalance}
                                        className="btn-outline btn-sm"
                                        title="Distribute 100% equally across all steps"
                                    >
                                        <i className="fi fi-rr-equality text-xs leading-none" />
                                        Equal Split
                                    </button>
                                    <button
                                        type="button"
                                        onClick={hoursBalance}
                                        className="btn-outline btn-sm"
                                        title="Distribute 100% proportional to estimated hours"
                                    >
                                        <i className="fi fi-rr-time-quarter-past text-xs leading-none" />
                                        By Hours
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

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
                            {processing ? 'Saving...' : 'Save Operation Sheet'}
                        </button>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
