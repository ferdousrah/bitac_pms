import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ApprovalNoteAI from './ApprovalNoteAI';
import { useAiEnabled } from '@/lib/useAiEnabled';

export type ApprovalAction = 'approve' | 'request_changes' | 'reject';
export type EntityType = 'cost_estimate' | 'quotation';

interface Props {
    open: boolean;
    action: ApprovalAction | null;
    entityType: EntityType;
    entityId: number;
    entityLabel: string;          // e.g. "EST-2026-0041" or "Quotation #12 v2"
    entityTitle?: string;         // e.g. "Custom Flange - ACI Motors"
    entityAmount?: number | string;
    onConfirm: (remarks: string) => Promise<void> | void;
    onClose: () => void;
}

const ACTION_CONFIG: Record<ApprovalAction, {
    title: string;
    icon: string;
    gradient: string;
    color: 'emerald' | 'amber' | 'red';
    confirmLabel: string;
    confirmBtn: string;
    badge: string;
    noteLabel: string;
    notePlaceholder: string;
    noteRequired: boolean;
    helpText?: string;
}> = {
    approve: {
        title: 'Approve This Item',
        icon: 'fi-rr-check',
        gradient: 'from-emerald-500 to-green-600',
        color: 'emerald',
        confirmLabel: 'Confirm Approval',
        confirmBtn: 'bg-emerald-600 hover:bg-emerald-500',
        badge: 'bg-emerald-100 text-emerald-700',
        noteLabel: 'Note / Comments',
        notePlaceholder: 'Any remarks, comments, or guidance for the team... (optional)',
        noteRequired: false,
    },
    request_changes: {
        title: 'Request Changes / Corrections',
        icon: 'fi-rr-edit',
        gradient: 'from-amber-500 to-orange-500',
        color: 'amber',
        confirmLabel: 'Send Back to Preparer',
        confirmBtn: 'bg-amber-600 hover:bg-amber-500',
        badge: 'bg-amber-100 text-amber-700',
        noteLabel: 'What corrections are needed?',
        notePlaceholder: 'Describe clearly what the preparer should check, verify, or change. Be specific — reference line items or numbers where possible.',
        noteRequired: true,
        helpText: 'The item will return to draft status. The preparer will be notified with your correction note and can edit & resubmit.',
    },
    reject: {
        title: 'Reject This Item',
        icon: 'fi-rr-cross',
        gradient: 'from-red-500 to-rose-600',
        color: 'red',
        confirmLabel: 'Confirm Rejection',
        confirmBtn: 'bg-red-600 hover:bg-red-500',
        badge: 'bg-red-100 text-red-700',
        noteLabel: 'Reason for rejection',
        notePlaceholder: 'Why is this being rejected? Provide a clear, professional reason the preparer can act on.',
        noteRequired: true,
        helpText: 'The item will be marked as rejected. The preparer will be notified with your reason.',
    },
};

const fmt = (v: any) => v != null ? Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : null;

export default function ApprovalActionModal({
    open, action, entityType, entityId, entityLabel, entityTitle, entityAmount,
    onConfirm, onClose,
}: Props) {
    const aiEnabled = useAiEnabled();
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Reset when modal opens
    useEffect(() => {
        if (open) {
            setNote('');
            setError(null);
            setSubmitting(false);
        }
    }, [open, action]);

    // Keyboard shortcuts
    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !submitting) onClose();
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleConfirm();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [open, submitting, note]);

    if (!open || !action) return null;
    const config = ACTION_CONFIG[action];

    const handleConfirm = async () => {
        if (config.noteRequired && !note.trim()) {
            setError(`Please provide a ${action === 'reject' ? 'reason' : 'description of changes needed'}.`);
            return;
        }
        setSubmitting(true);
        setError(null);
        try {
            await onConfirm(note.trim());
        } catch (err: any) {
            setError(err?.message || 'Something went wrong.');
            setSubmitting(false);
        }
    };

    return (
        <AnimatePresence>
            <motion.div
                className="fixed inset-0 z-[200] flex items-center justify-center p-4"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            >
                {/* Backdrop */}
                <div
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                    onClick={() => !submitting && onClose()}
                />

                {/* Modal */}
                <motion.div
                    className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
                    initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                >
                    {/* Header */}
                    <div className={`relative px-6 py-4 bg-gradient-to-r ${config.gradient} text-white shrink-0`}>
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                                <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                                    <i className={`fi ${config.icon} text-xl leading-none`} />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-base font-bold leading-tight">{config.title}</h3>
                                    <p className="text-xs text-white/80 mt-0.5">
                                        <span className="font-mono font-semibold">{entityLabel}</span>
                                        {entityTitle && <> · {entityTitle}</>}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => !submitting && onClose()}
                                disabled={submitting}
                                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors shrink-0 disabled:opacity-50"
                                aria-label="Close"
                            >
                                <i className="fi fi-rr-cross text-sm leading-none" />
                            </button>
                        </div>

                        {entityAmount != null && (
                            <div className="mt-3 flex items-center gap-2 text-xs">
                                <span className="text-white/70">Grand Total:</span>
                                <span className="font-mono font-bold text-sm">{fmt(entityAmount)}</span>
                                <span className="text-white/50">BDT</span>
                            </div>
                        )}
                    </div>

                    {/* Body — scrollable */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        {/* Help text */}
                        {config.helpText && (
                            <div className={`p-3 rounded-xl border text-xs ${
                                action === 'request_changes' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                                'bg-red-50 border-red-200 text-red-800'
                            }`}>
                                <div className="flex items-start gap-2">
                                    <i className="fi fi-rr-info text-sm leading-none mt-0.5 shrink-0" />
                                    <div>{config.helpText}</div>
                                </div>
                            </div>
                        )}

                        {/* Note textarea */}
                        <div>
                            <label className="block text-xs font-bold text-surface-700 mb-1.5">
                                {config.noteLabel}
                                {config.noteRequired && <span className="text-red-500"> *</span>}
                                {!config.noteRequired && <span className="text-surface-400 font-normal"> (optional)</span>}
                            </label>
                            <textarea
                                value={note}
                                onChange={e => { setNote(e.target.value); setError(null); }}
                                rows={5}
                                autoFocus
                                placeholder={config.notePlaceholder}
                                className="form-textarea w-full text-sm"
                                disabled={submitting}
                            />
                            <div className="flex items-center justify-between text-[10px] text-surface-400 mt-1">
                                <span>
                                    {note.length > 0 && `${note.length} character${note.length === 1 ? '' : 's'}`}
                                </span>
                                <span>Ctrl+Enter to confirm · Esc to cancel</span>
                            </div>
                        </div>

                        {/* AI Assist — only when the master AI switch is on */}
                        {aiEnabled && (
                            <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-100">
                                <div className="flex items-center gap-1.5 mb-2">
                                    <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
                                        ✨ Oli AI Assist
                                    </span>
                                    <span className="text-[10px] text-indigo-500">— let AI help write the perfect note</span>
                                </div>
                                <ApprovalNoteAI
                                    action={action}
                                    entityType={entityType}
                                    entityId={entityId}
                                    currentText={note}
                                    onApplyText={setNote}
                                    color={config.color}
                                />
                            </div>
                        )}

                        {/* Error */}
                        <AnimatePresence>
                            {error && (
                                <motion.div
                                    className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2"
                                    initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                >
                                    <i className="fi fi-rr-exclamation text-sm leading-none shrink-0" />
                                    {error}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 bg-surface-50 border-t border-surface-100 flex items-center justify-between gap-2 shrink-0">
                        <button
                            onClick={onClose}
                            disabled={submitting}
                            className="btn-ghost"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={submitting}
                            className={`px-5 py-2 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-60 ${config.confirmBtn} shadow-md hover:shadow-lg`}
                        >
                            {submitting ? (
                                <span className="inline-flex items-center gap-2">
                                    <i className="fi fi-rr-spinner animate-spin text-xs leading-none" />
                                    Processing...
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-2">
                                    <i className={`fi ${config.icon} text-xs leading-none`} />
                                    {config.confirmLabel}
                                </span>
                            )}
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
