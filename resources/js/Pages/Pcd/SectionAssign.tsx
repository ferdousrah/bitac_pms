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
}

interface WorkOrder {
    id: number;
    wo_number: string;
    job_number: string | number | null;
    customer: string;
    status: string;
}

interface Props {
    work_order: WorkOrder;
    assigned_sections: AssignedSection[];
    available_sections: SectionLite[];
}

interface SectionRow {
    section_id: number;
    notes: string;
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

function SortableSectionCard({
    row,
    index,
    onNotesChange,
    onRemove,
}: {
    row: SectionRow;
    index: number;
    onNotesChange: (value: string) => void;
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

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-surface-900 text-sm truncate">
                                {row.section.name}
                            </span>
                            <span className="font-mono text-[11px] text-surface-400">
                                {row.section.code}
                            </span>
                            <span className={`badge ${badgeClass} capitalize`}>
                                {statusKey.replace(/_/g, ' ')}
                            </span>
                        </div>
                        {row.section.name_bn && (
                            <div className="text-xs text-surface-500 mt-0.5">
                                {row.section.name_bn}
                            </div>
                        )}

                        <div className="form-group mt-3 mb-0">
                            <label className="form-label-optional text-[11px]">
                                Notes for this section
                            </label>
                            <input
                                type="text"
                                value={row.notes}
                                onChange={(e) => onNotesChange(e.target.value)}
                                className="form-input"
                                placeholder="Optional instructions or context..."
                            />
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onRemove}
                        className="btn-icon text-surface-400 hover:text-red-600 hover:bg-red-50"
                        aria-label="Remove section"
                    >
                        <i className="fi fi-rr-trash text-sm leading-none" />
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function SectionAssign({
    work_order,
    assigned_sections,
    available_sections,
}: Props) {
    const { data, setData, put, processing, errors } = useForm<{ sections: SectionRow[] }>({
        sections: assigned_sections.map((s) => ({
            section_id: s.section_id,
            notes: s.notes ?? '',
            section: s.section,
            status: s.status,
        })),
    });

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
            { section_id: section.id, notes: '', section, status: 'pending' },
        ]);
    };

    const removeSection = (sectionId: number) => {
        setData(
            'sections',
            data.sections.filter((s) => s.section_id !== sectionId),
        );
    };

    const updateNotes = (sectionId: number, notes: string) => {
        setData(
            'sections',
            data.sections.map((s) =>
                s.section_id === sectionId ? { ...s, notes } : s,
            ),
        );
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        put(`/pcd/work-orders/${work_order.id}/sections`);
    };

    return (
        <AppLayout header={`Assign Sections — ${work_order.wo_number}`}>
            <div className="space-y-6 animate-fade-in">
                {/* Header card */}
                <div className="card">
                    <div className="card-body">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div className="flex items-start gap-4">
                                <div className="w-14 h-14 shrink-0 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-white font-bold text-xl flex items-center justify-center">
                                    {work_order.job_number ?? '#'}
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-mono text-xs font-semibold text-surface-700">
                                            {work_order.wo_number}
                                        </span>
                                        <span className="badge badge-blue capitalize">
                                            {work_order.status?.replace(/_/g, ' ')}
                                        </span>
                                    </div>
                                    <h1 className="text-lg font-bold text-surface-900 mt-1">
                                        Section Sequence Assignment
                                    </h1>
                                    <p className="text-xs text-surface-500 mt-0.5">
                                        Customer: <span className="font-medium text-surface-700">{work_order.customer}</span>
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
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
                                    {processing ? 'Saving...' : 'Save Sequence'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Info alert */}
                <div className="alert alert-info">
                    <i className="fi fi-rr-info text-sm leading-none" />
                    <div>
                        <div className="font-semibold">How sequencing works</div>
                        <div className="text-xs opacity-80 mt-0.5">
                            Drag sections to reorder. The job moves through sections in the order shown. After the last section completes, the job is handed off to QC.
                        </div>
                    </div>
                </div>

                {errors.sections && (
                    <div className="alert alert-warning">
                        <i className="fi fi-rr-triangle-warning text-sm leading-none" />
                        <div className="text-xs">{errors.sections as any}</div>
                    </div>
                )}

                {/* Two-column layout */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: assigned sections (sortable) */}
                    <div className="lg:col-span-2 space-y-4">
                        <div className="card">
                            <div className="card-header flex items-center justify-between">
                                <div>
                                    <h2 className="text-base font-bold text-surface-900">
                                        Assigned Sections
                                    </h2>
                                    <p className="text-xs text-surface-400 mt-0.5">
                                        {data.sections.length} section{data.sections.length === 1 ? '' : 's'} in sequence
                                    </p>
                                </div>
                                <span className="badge badge-blue">
                                    {data.sections.length} total
                                </span>
                            </div>

                            <div className="card-body">
                                {data.sections.length === 0 ? (
                                    <div className="empty-state py-10">
                                        <div className="empty-state-icon">
                                            <i className="fi fi-rr-boxes" />
                                        </div>
                                        <div className="empty-state-title">
                                            No sections assigned yet
                                        </div>
                                        <div className="empty-state-text">
                                            Pick sections from the palette on the right to begin building the routing sequence.
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
                                            <div className="space-y-3">
                                                {data.sections.map((row, i) => (
                                                    <SortableSectionCard
                                                        key={row.section_id}
                                                        row={row}
                                                        index={i}
                                                        onNotesChange={(value) =>
                                                            updateNotes(row.section_id, value)
                                                        }
                                                        onRemove={() =>
                                                            removeSection(row.section_id)
                                                        }
                                                    />
                                                ))}
                                            </div>
                                        </SortableContext>
                                    </DndContext>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right: palette */}
                    <div className="space-y-4">
                        <div className="card sticky top-4">
                            <div className="card-header">
                                <h2 className="text-base font-bold text-surface-900">
                                    Available Sections
                                </h2>
                                <p className="text-xs text-surface-400 mt-0.5">
                                    Click to add to the sequence
                                </p>
                            </div>

                            <div className="card-body">
                                {palette.length === 0 ? (
                                    <div className="text-center py-8">
                                        <div className="w-12 h-12 mx-auto rounded-2xl bg-surface-50 flex items-center justify-center mb-2">
                                            <i className="fi fi-rr-check text-surface-400 text-lg" />
                                        </div>
                                        <div className="text-sm font-medium text-surface-700">
                                            All sections assigned
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
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
