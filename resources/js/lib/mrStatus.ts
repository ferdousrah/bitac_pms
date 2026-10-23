/**
 * Material requisition statuses — the one map the list, the requisition page and
 * the PCD job page read. Mirrors MaterialRequisition::STATUSES on the server.
 * There is no IMS: these are moved along by hand.
 */
export const MR_STATUS_LABEL: Record<string, string> = {
    draft:            'Draft',
    pending_approval: 'Submitted',
    approved:         'Approved',
    partially_issued: 'Partially Issued',
    issued:           'Issued',
    received:         'Received',
    cancelled:        'Cancelled',
    sent_to_ims:      'Submitted',   // legacy rows, migrated — kept so nothing reads blank
};

export const MR_STATUS_BADGE: Record<string, string> = {
    draft:            'badge-slate',
    pending_approval: 'badge-amber',
    approved:         'badge-blue',
    partially_issued: 'badge-amber',
    issued:           'badge-green',
    received:         'badge-green',
    cancelled:        'badge-red',
    sent_to_ims:      'badge-amber',
};

/** The path a requisition takes, for the stepper. */
export const MR_STEPS: { key: string; label: string; covers: string[] }[] = [
    { key: 'draft',            label: 'Draft',     covers: ['draft'] },
    { key: 'pending_approval', label: 'Submitted', covers: ['pending_approval'] },
    { key: 'approved',         label: 'Approved',  covers: ['approved'] },
    { key: 'issued',           label: 'Issued',    covers: ['partially_issued', 'issued'] },
    { key: 'received',         label: 'Received',  covers: ['received'] },
];

export const mrLabel = (s: string) => MR_STATUS_LABEL[s] ?? s.replace(/_/g, ' ');
export const mrBadge = (s: string) => MR_STATUS_BADGE[s] ?? 'badge-slate';

/** A shop's material demand to PCD (MaterialDemand::STATUSES on the server). */
export const DEMAND_BADGE: Record<string, string> = {
    submitted: 'badge-amber',
    accepted:  'badge-blue',
    rejected:  'badge-red',
    cancelled: 'badge-slate',
};
