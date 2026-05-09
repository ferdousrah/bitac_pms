import AppLayout from '@/Layouts/AppLayout';
import { useForm, Link } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

const COMMON_SKILLS = ['Lathe', 'Milling', 'CNC', 'Drilling', 'Grinding', 'Welding', 'Casting', 'Heat Treatment', 'Fitting', 'EDM', 'Wire Cut', 'VMC'];

export default function OperatorCreateEdit({ operator, sections, users }: any) {
    const isEdit = !!operator;
    const { data, setData, post, put, processing, errors } = useForm({
        employee_id: operator?.employee_id ?? '',
        name:        operator?.name ?? '',
        section_id:  operator?.section_id ?? '',
        user_id:     operator?.user_id ?? '',
        phone:       operator?.phone ?? '',
        skills:      operator?.skills ?? [] as string[],
        shift:       operator?.shift ?? 'general',
        is_active:   operator?.is_active ?? true,
        joined_on:   operator?.joined_on ?? '',
    });

    const [newSkill, setNewSkill] = useState('');

    const toggleSkill = (s: string) => {
        const current = data.skills as string[];
        if (current.includes(s)) {
            setData('skills', current.filter(x => x !== s));
        } else {
            setData('skills', [...current, s]);
        }
    };

    const addCustomSkill = () => {
        if (!newSkill.trim()) return;
        if (!(data.skills as string[]).includes(newSkill.trim())) {
            setData('skills', [...(data.skills as string[]), newSkill.trim()]);
        }
        setNewSkill('');
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (isEdit) put(`/admin/operators/${operator.id}`);
        else post('/admin/operators');
    };

    return (
        <AppLayout header={isEdit ? 'Edit Operator' : 'New Operator'}>
            <div className="max-w-3xl animate-fade-in">
                <form onSubmit={submit} className="space-y-6">
                    <div className="card animate-slide-up">
                        <div className="card-header">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-brand-50 flex items-center justify-center">
                                    <i className="fi fi-rr-user text-brand-500 text-sm leading-none" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-surface-900">Operator Details</h3>
                                    <p className="text-xs text-surface-400">Personal info & section assignment</p>
                                </div>
                            </div>
                        </div>
                        <div className="card-body space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="form-group">
                                    <label className="form-label">Employee ID *</label>
                                    <input type="text" value={data.employee_id}
                                        onChange={e => setData('employee_id', e.target.value)}
                                        placeholder="e.g. EMP-001"
                                        className="form-input font-mono" required />
                                    {errors.employee_id && <p className="form-error">{errors.employee_id}</p>}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Full Name *</label>
                                    <input type="text" value={data.name}
                                        onChange={e => setData('name', e.target.value)}
                                        className="form-input" required />
                                    {errors.name && <p className="form-error">{errors.name}</p>}
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="form-group">
                                    <label className="form-label">Section *</label>
                                    <select value={data.section_id} onChange={e => setData('section_id', e.target.value)}
                                        className="form-select" required>
                                        <option value="">Select section...</option>
                                        {sections.map((s: any) => (
                                            <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                                        ))}
                                    </select>
                                    {errors.section_id && <p className="form-error">{errors.section_id}</p>}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Shift *</label>
                                    <select value={data.shift} onChange={e => setData('shift', e.target.value)}
                                        className="form-select" required>
                                        <option value="general">General (9-5)</option>
                                        <option value="day">Day Shift</option>
                                        <option value="night">Night Shift</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="form-group">
                                    <label className="form-label">Phone <span className="form-label-optional">optional</span></label>
                                    <input type="tel" value={data.phone}
                                        onChange={e => setData('phone', e.target.value)}
                                        placeholder="01XXXXXXXXX"
                                        className="form-input" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Joined On <span className="form-label-optional">optional</span></label>
                                    <input type="date" value={data.joined_on}
                                        onChange={e => setData('joined_on', e.target.value)}
                                        className="form-input" />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Linked User Account <span className="form-label-optional">optional, for login access</span></label>
                                <select value={data.user_id} onChange={e => setData('user_id', e.target.value)}
                                    className="form-select">
                                    <option value="">No linked account</option>
                                    {users.map((u: any) => (
                                        <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Skills */}
                    <div className="card animate-slide-up">
                        <div className="card-header">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                                    <i className="fi fi-rr-tools text-blue-500 text-sm leading-none" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-surface-900">Skills & Capabilities</h3>
                                    <p className="text-xs text-surface-400">What machines this operator can run</p>
                                </div>
                            </div>
                        </div>
                        <div className="card-body space-y-4">
                            <div className="flex flex-wrap gap-2">
                                {COMMON_SKILLS.map(s => {
                                    const selected = (data.skills as string[]).includes(s);
                                    return (
                                        <button key={s} type="button" onClick={() => toggleSkill(s)}
                                            className={`chip ${selected ? 'chip-active' : 'chip-default'}`}>
                                            {selected && <i className="fi fi-rr-check text-[10px] leading-none" />}
                                            {s}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Custom skills */}
                            {(data.skills as string[]).filter(s => !COMMON_SKILLS.includes(s)).length > 0 && (
                                <div className="flex flex-wrap gap-2 pt-2 border-t border-surface-100">
                                    {(data.skills as string[]).filter(s => !COMMON_SKILLS.includes(s)).map(s => (
                                        <span key={s} className="chip chip-active">
                                            {s}
                                            <button type="button" onClick={() => toggleSkill(s)} className="ml-1">
                                                <i className="fi fi-rr-cross-small text-[10px] leading-none" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}

                            <div className="flex gap-2">
                                <input type="text" value={newSkill}
                                    onChange={e => setNewSkill(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomSkill(); } }}
                                    placeholder="Add custom skill..."
                                    className="form-input flex-1" />
                                <button type="button" onClick={addCustomSkill} className="btn-outline btn-sm">
                                    <i className="fi fi-rr-plus text-xs leading-none" /> Add
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer mr-auto">
                            <input type="checkbox" checked={data.is_active}
                                onChange={e => setData('is_active', e.target.checked)}
                                className="w-4 h-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500" />
                            <span className="text-sm text-surface-700">Active</span>
                        </label>
                        <button type="submit" disabled={processing} className="btn-primary">
                            {processing ? (
                                <><i className="fi fi-rr-spinner animate-spin text-sm leading-none" /> Saving...</>
                            ) : (
                                <><i className="fi fi-rr-check text-sm leading-none" /> {isEdit ? 'Update' : 'Create'} Operator</>
                            )}
                        </button>
                        <Link href="/admin/operators" className="btn-outline">Cancel</Link>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
