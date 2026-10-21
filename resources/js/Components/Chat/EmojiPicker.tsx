import { useEffect, useRef, useState } from 'react';

/**
 * A small emoji picker for the chat composer — a fixed set, no dependency.
 * Emoji 13+ (🪛 🪚 🫡 🫶 …) are left out: Windows 10's emoji font has none of them
 * and draws an empty box. "Recent" is kept per browser (localStorage, which can throw — wrapped).
 */
const GROUPS: { key: string; label: string; icon: string; emojis: string[] }[] = [
    {
        key: 'smileys', label: 'Smileys', icon: '😀', emojis: [
            '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😍', '🥰', '😘', '😋',
            '😎', '🤩', '🥳', '😏', '🤔', '🤨', '😐', '😑', '😶', '🙄', '😬', '😮', '😯', '😲', '😳', '🥺',
            '😢', '😭', '😤', '😠', '😡', '🤯', '😱', '😴', '🤒', '🤕', '😷', '🤗', '🤭', '🤝', '😌',
        ],
    },
    {
        key: 'hands', label: 'Hands', icon: '👍', emojis: [
            '👍', '👎', '👌', '✌️', '🤞', '🤟', '👏', '🙌', '👐', '🙏', '💪', '👋', '🤚', '✋', '🖐️', '👊',
            '✊', '👈', '👉', '👆', '👇', '☝️', '✍️', '🤲', '👀', '🧠',
        ],
    },
    {
        key: 'work', label: 'Work', icon: '🛠️', emojis: [
            '🛠️', '🔧', '🔩', '⚙️', '🔨', '⚒️', '🧰', '🏭', '🏗️', '🧱', '⛏️', '🔥', '⚡', '💡',
            '🔌', '🔋', '🧪', '📏', '📐', '🧲', '🦺', '⛑️', '🚚', '🚛', '📦', '🏷️', '🧾', '📋', '📝', '📄',
            '📑', '📊', '📈', '📉', '📅', '📆', '⏰', '⏱️', '⌛', '📌', '📍', '📎', '✂️', '🖊️', '💻', '🖨️',
            '📞', '📱', '✉️', '📧', '🗂️', '🔍', '🔒', '🔑', '💰', '💵',
        ],
    },
    {
        key: 'symbols', label: 'Symbols', icon: '✅', emojis: [
            '✅', '☑️', '✔️', '❌', '❎', '⚠️', '🚫', '⛔', '❗', '❓', '‼️', '⁉️', '💯', '🆗', '🆕', '🔝',
            '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '⭐', '🌟', '✨', '🎉', '🎊', '🏆', '🥇', '🎯',
            '❤️', '🧡', '💛', '💚', '💙', '💜', '🤍', '💔', '➡️', '⬅️', '⬆️', '⬇️', '🔄', '🔁', '➕', '➖',
        ],
    },
    {
        key: 'nature', label: 'Weather & food', icon: '☕', emojis: [
            '☀️', '🌤️', '⛅', '🌧️', '⛈️', '🌩️', '❄️', '🌈', '🌙', '🌱', '🌳', '🌸', '🌹', '🍀', '☕', '🍵',
            '🥤', '🍚', '🍛', '🍞', '🍌', '🍎', '🥭', '🍉', '🍰', '🎂', '🍬', '🇧🇩',
        ],
    },
];

const RECENT_KEY = 'bitac.chat.recentEmoji';
const readRecent = (): string[] => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; } };
const saveRecent = (list: string[]) => { try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch { /* ignore */ } };

export default function EmojiPicker({ onPick, onClose }: { onPick: (emoji: string) => void; onClose: () => void }) {
    const [recent, setRecent] = useState<string[]>(readRecent);
    const [tab, setTab] = useState(recent.length ? 'recent' : 'smileys');
    const box = useRef<HTMLDivElement>(null);

    // Close on a click outside (the toggle button is outside too, and handles itself) and on Escape.
    useEffect(() => {
        const down = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (box.current && !box.current.contains(target) && !target.closest('[data-emoji-toggle]')) onClose();
        };
        const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('mousedown', down);
        document.addEventListener('keydown', key);
        return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
    }, [onClose]);

    const pick = (e: string) => {
        const next = [e, ...recent.filter(x => x !== e)].slice(0, 24);
        setRecent(next); saveRecent(next);
        onPick(e);
    };

    const tabs = [
        ...(recent.length ? [{ key: 'recent', label: 'Recent', icon: '🕘', emojis: recent }] : []),
        ...GROUPS,
    ];
    const current = tabs.find(t => t.key === tab) ?? tabs[0];

    return (
        <div ref={box} className="absolute bottom-full left-3 sm:left-4 mb-2 z-30 w-[312px] max-w-[calc(100%-1.5rem)] rounded-2xl border border-surface-200 bg-white shadow-xl animate-fade-in overflow-hidden">
            <div className="flex items-center gap-0.5 px-2 pt-2 pb-1.5 border-b border-surface-100">
                {tabs.map(t => (
                    <button key={t.key} type="button" onClick={() => setTab(t.key)} title={t.label}
                        className={`w-9 h-8 rounded-lg text-lg leading-none grid place-items-center transition ${t.key === current.key ? 'bg-brand-50 ring-1 ring-brand-200' : 'hover:bg-surface-100 opacity-70 hover:opacity-100'}`}>
                        {t.icon}
                    </button>
                ))}
            </div>
            <p className="px-3 pt-2 text-[10px] font-bold uppercase tracking-wider text-surface-400">{current.label}</p>
            <div className="grid grid-cols-8 gap-0.5 p-2 max-h-52 overflow-y-auto">
                {current.emojis.map(e => (
                    <button key={e} type="button" onClick={() => pick(e)}
                        className="h-9 rounded-lg text-[22px] leading-none grid place-items-center hover:bg-surface-100 active:scale-90 transition">
                        {e}
                    </button>
                ))}
            </div>
        </div>
    );
}
