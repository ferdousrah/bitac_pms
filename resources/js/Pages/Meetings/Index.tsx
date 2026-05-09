import AppLayout from '@/Layouts/AppLayout';
import { Link, useForm, router } from '@inertiajs/react';
import { motion, AnimatePresence } from 'motion/react';
import { useState } from 'react';
import {
    Plus, Search, Users, Clock, Video, VideoOff, ArrowRight,
    Copy, Bot, Hash, Calendar,
} from 'lucide-react';

interface Meeting {
    id: number;
    title: string;
    topic: string | null;
    meeting_code: string;
    status: 'waiting' | 'active' | 'ended';
    host: { id: number; name: string };
    participants_count: number;
    online_participants: { user: { id: number; name: string } }[];
    started_at: string | null;
    ended_at: string | null;
    created_at: string;
}

interface Props {
    meetings: { data: Meeting[]; links: any; meta?: any };
    filters: { search?: string; status?: string };
}

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string; label: string }> = {
    waiting: { bg: 'bg-yellow-500/10', text: 'text-yellow-500', dot: 'bg-yellow-500', label: 'Waiting' },
    active:  { bg: 'bg-emerald-500/10', text: 'text-emerald-500', dot: 'bg-emerald-500 animate-pulse', label: 'Live' },
    ended:   { bg: 'bg-surface-500/10', text: 'text-surface-400', dot: 'bg-surface-400', label: 'Ended' },
};

export default function MeetingsIndex({ meetings, filters }: Props) {
    const [showCreate, setShowCreate] = useState(false);
    const [showJoin, setShowJoin] = useState(false);
    const [joinCode, setJoinCode] = useState('');
    const [search, setSearch] = useState(filters.search || '');

    const createForm = useForm({ title: '', topic: '' });
    const joinForm = useForm({ code: '' });

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        createForm.post('/meetings', { onSuccess: () => setShowCreate(false) });
    };

    const handleJoin = (e: React.FormEvent) => {
        e.preventDefault();
        joinForm.setData('code', joinCode);
        joinForm.post('/meetings/join');
    };

    const handleSearch = () => {
        router.get('/meetings', { search }, { preserveState: true, preserveScroll: true });
    };

    const copyCode = (code: string) => {
        navigator.clipboard.writeText(code);
    };

    return (
        <AppLayout header="Meeting Room">
            <div className="max-w-6xl space-y-6 animate-fade-in">
                {/* Header Actions */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                placeholder="Search meetings..."
                                className="form-input pl-10 w-64"
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setShowJoin(true)} className="btn-outline">
                            <Hash className="w-4 h-4" />
                            Join with Code
                        </button>
                        <button onClick={() => setShowCreate(true)} className="btn-primary">
                            <Plus className="w-4 h-4" />
                            New Meeting
                        </button>
                    </div>
                </div>

                {/* Meeting Cards Grid */}
                {meetings.data.length === 0 ? (
                    <div className="card">
                        <div className="card-body text-center py-16">
                            <div className="w-16 h-16 rounded-2xl bg-surface-50 flex items-center justify-center mx-auto mb-4">
                                <Video className="w-8 h-8 text-surface-300" />
                            </div>
                            <h3 className="text-lg font-bold text-surface-900 mb-1">No meetings yet</h3>
                            <p className="text-sm text-surface-400 mb-4">Create a meeting room to collaborate with your team and Oli AI.</p>
                            <button onClick={() => setShowCreate(true)} className="btn-primary">
                                <Plus className="w-4 h-4" /> Create Your First Meeting
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {meetings.data.map((m) => {
                            const st = STATUS_COLORS[m.status] || STATUS_COLORS.ended;
                            return (
                                <motion.div
                                    key={m.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`card hover:shadow-lg transition-all hover:-translate-y-0.5 ${m.status === 'active' ? 'ring-2 ring-emerald-500/30' : ''}`}
                                >
                                    <div className="card-body space-y-3">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <h3 className="font-bold text-surface-900 text-sm">{m.title}</h3>
                                                {m.topic && <p className="text-xs text-surface-400 mt-0.5 line-clamp-1">{m.topic}</p>}
                                            </div>
                                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${st.bg} ${st.text}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                                                {st.label}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-4 text-xs text-surface-400">
                                            <div className="flex items-center gap-1">
                                                <Users className="w-3.5 h-3.5" />
                                                {m.participants_count} joined
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Calendar className="w-3.5 h-3.5" />
                                                {new Date(m.created_at).toLocaleDateString()}
                                            </div>
                                        </div>

                                        {/* Online participants */}
                                        {m.online_participants.length > 0 && (
                                            <div className="flex items-center gap-1">
                                                <div className="flex -space-x-1.5">
                                                    {m.online_participants.slice(0, 4).map((p, i) => (
                                                        <div key={i} className="w-6 h-6 rounded-full bg-brand-100 border-2 border-white flex items-center justify-center text-[8px] font-bold text-brand-600"
                                                            title={p.user.name}>
                                                            {p.user.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                                                        </div>
                                                    ))}
                                                    {/* Oli avatar */}
                                                    <div className="w-6 h-6 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center" title="Oli AI">
                                                        <Bot className="w-3 h-3 text-indigo-600" />
                                                    </div>
                                                </div>
                                                {m.online_participants.length > 4 && (
                                                    <span className="text-[10px] text-surface-400 ml-1">+{m.online_participants.length - 4} more</span>
                                                )}
                                            </div>
                                        )}

                                        {/* Meeting code + actions */}
                                        <div className="flex items-center justify-between pt-2 border-t border-surface-100">
                                            <button onClick={() => copyCode(m.meeting_code)}
                                                className="flex items-center gap-1 text-[10px] text-surface-400 hover:text-surface-600 font-mono transition-colors">
                                                <Copy className="w-3 h-3" />
                                                {m.meeting_code}
                                            </button>
                                            {m.status !== 'ended' ? (
                                                <Link href={`/meetings/${m.id}`}
                                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-500 text-white text-xs font-bold hover:bg-brand-600 transition-colors">
                                                    {m.status === 'active' ? 'Join Now' : 'Enter Room'}
                                                    <ArrowRight className="w-3 h-3" />
                                                </Link>
                                            ) : (
                                                <Link href={`/meetings/${m.id}`}
                                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-100 text-surface-600 text-xs font-bold hover:bg-surface-200 transition-colors">
                                                    View Notes
                                                    <ArrowRight className="w-3 h-3" />
                                                </Link>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}

                {/* Create Modal */}
                <AnimatePresence>
                    {showCreate && (
                        <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setShowCreate(false)}>
                            <motion.div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
                                initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
                                onClick={e => e.stopPropagation()}>
                                <h2 className="text-lg font-bold text-surface-900 mb-4 flex items-center gap-2">
                                    <Video className="w-5 h-5 text-brand-500" />
                                    Create New Meeting
                                </h2>
                                <form onSubmit={handleCreate} className="space-y-4">
                                    <div className="form-group">
                                        <label className="form-label">Meeting Title *</label>
                                        <input
                                            type="text"
                                            value={createForm.data.title}
                                            onChange={e => createForm.setData('title', e.target.value)}
                                            className="form-input"
                                            placeholder="e.g., Monthly Production Review"
                                            required autoFocus
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Topic (optional)</label>
                                        <textarea
                                            value={createForm.data.topic}
                                            onChange={e => createForm.setData('topic', e.target.value)}
                                            className="form-textarea"
                                            placeholder="What will be discussed?"
                                            rows={2}
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 pt-2">
                                        <button type="submit" disabled={createForm.processing} className="btn-primary flex-1">
                                            {createForm.processing ? 'Creating...' : 'Create & Enter Room'}
                                        </button>
                                        <button type="button" onClick={() => setShowCreate(false)} className="btn-ghost">Cancel</button>
                                    </div>
                                </form>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Join Modal */}
                <AnimatePresence>
                    {showJoin && (
                        <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setShowJoin(false)}>
                            <motion.div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6"
                                initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
                                onClick={e => e.stopPropagation()}>
                                <h2 className="text-lg font-bold text-surface-900 mb-4 flex items-center gap-2">
                                    <Hash className="w-5 h-5 text-brand-500" />
                                    Join Meeting
                                </h2>
                                <form onSubmit={handleJoin} className="space-y-4">
                                    <div className="form-group">
                                        <label className="form-label">Meeting Code</label>
                                        <input
                                            type="text"
                                            value={joinCode}
                                            onChange={e => setJoinCode(e.target.value.toUpperCase())}
                                            className="form-input text-center font-mono text-lg tracking-wider"
                                            placeholder="XXXX-XXXX"
                                            required autoFocus
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button type="submit" disabled={joinForm.processing} className="btn-primary flex-1">
                                            {joinForm.processing ? 'Joining...' : 'Join Meeting'}
                                        </button>
                                        <button type="button" onClick={() => setShowJoin(false)} className="btn-ghost">Cancel</button>
                                    </div>
                                </form>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </AppLayout>
    );
}
