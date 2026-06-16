import { useEffect, useRef } from 'react';

interface Props {
    value: string;
    onChange: (html: string) => void;
    placeholder?: string;
    minHeight?: string;
    className?: string;
}

type Tool = {
    cmd: string;
    arg?: string;
    title: string;
    /** Either an `fi-*` icon class, or a short text label. */
    icon?: string;
    label?: string;
    labelClass?: string;
    divider?: boolean;
};

const TOOLS: Tool[] = [
    { cmd: 'bold',                label: 'B', labelClass: 'font-bold',         title: 'Bold (Ctrl+B)' },
    { cmd: 'italic',              label: 'I', labelClass: 'italic font-serif', title: 'Italic (Ctrl+I)' },
    { cmd: 'underline',           label: 'U', labelClass: 'underline',         title: 'Underline (Ctrl+U)' },
    { cmd: '__divider__', divider: true, title: '' },
    { cmd: 'insertUnorderedList', icon: 'fi-rr-list',          title: 'Bullet list' },
    { cmd: 'insertOrderedList',   icon: 'fi-rr-list-check',    title: 'Numbered list' },
    { cmd: '__divider__', divider: true, title: '' },
    { cmd: 'justifyLeft',         icon: 'fi-rr-align-left',    title: 'Align left' },
    { cmd: 'justifyCenter',       icon: 'fi-rr-align-center',  title: 'Align centre' },
    { cmd: 'justifyRight',        icon: 'fi-rr-align-right',   title: 'Align right' },
    { cmd: 'justifyFull',         icon: 'fi-rr-align-justify', title: 'Justify' },
    { cmd: '__divider__', divider: true, title: '' },
    { cmd: 'removeFormat',        icon: 'fi-rr-eraser',        title: 'Clear formatting' },
];

/**
 * Lightweight rich-text editor backed by `contentEditable` + the legacy
 * `document.execCommand` API. No external dependency. Supports the common
 * formatting commands a forwarding-letter author would need; emits HTML
 * back to the parent.
 *
 * Tradeoffs vs. TipTap/Quill:
 * - Tiny, zero install footprint.
 * - `execCommand` is deprecated but still implemented across modern browsers.
 * - No collaborative editing, no schema validation — the parent should
 *   sanitise the HTML server-side before persisting/rendering.
 */
export default function RichTextEditor({
    value, onChange, placeholder = 'Start typing…',
    minHeight = '180px', className = '',
}: Props) {
    const ref = useRef<HTMLDivElement | null>(null);

    // Keep the editor's innerHTML in sync when the parent resets the value
    // externally (e.g. AI assist apply, clearing the form). We skip if the
    // value already matches to avoid clobbering the user's caret position.
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (el.innerHTML !== value) {
            el.innerHTML = value || '';
        }
    }, [value]);

    const exec = (cmd: string, arg?: string) => {
        // contentEditable focus must be inside the editor for execCommand to
        // target it. We refocus before issuing the command.
        ref.current?.focus();
        document.execCommand(cmd, false, arg);
        // Browsers don't always fire input after execCommand on some commands
        // (e.g. justify*). Manually push the new HTML up.
        if (ref.current) onChange(ref.current.innerHTML);
    };

    const onInput = () => {
        if (ref.current) onChange(ref.current.innerHTML);
    };

    return (
        <div className={`rounded-xl border border-surface-300 bg-white overflow-hidden focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100 transition-all ${className}`}>
            {/* Toolbar */}
            <div className="flex items-center flex-wrap gap-0.5 px-2 py-1.5 border-b border-surface-100 bg-surface-50/60">
                {TOOLS.map((t, idx) => {
                    if (t.divider) {
                        return <span key={idx} className="w-px h-5 bg-surface-200 mx-1" />;
                    }
                    return (
                        <button
                            key={idx}
                            type="button"
                            // onMouseDown (not onClick) so the editor doesn't lose focus + selection
                            onMouseDown={(e) => { e.preventDefault(); exec(t.cmd, t.arg); }}
                            title={t.title}
                            className="w-7 h-7 inline-flex items-center justify-center rounded-md text-surface-600 hover:bg-surface-200/80 hover:text-surface-900 transition-colors"
                        >
                            {t.label ? (
                                <span className={`text-[12px] leading-none ${t.labelClass ?? ''}`}>{t.label}</span>
                            ) : (
                                <i className={`fi ${t.icon} text-[12px] leading-none`} />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Editable surface */}
            <div
                ref={ref}
                contentEditable
                suppressContentEditableWarning
                onInput={onInput}
                onBlur={onInput}
                data-placeholder={placeholder}
                className="rt-editor px-3 py-2.5 text-sm text-surface-800 outline-none leading-relaxed"
                style={{ minHeight }}
            />

            {/* Editor styles for placeholder + list bullets */}
            <style>{`
                .rt-editor:empty::before {
                    content: attr(data-placeholder);
                    color: #9ca3af;
                }
                .rt-editor ul { list-style: disc; padding-left: 1.5rem; margin: 0.25rem 0; }
                .rt-editor ol { list-style: decimal; padding-left: 1.75rem; margin: 0.25rem 0; }
                .rt-editor p  { margin: 0 0 0.4rem 0; }
                .rt-editor b, .rt-editor strong { font-weight: 700; }
                .rt-editor u { text-decoration: underline; }
            `}</style>
        </div>
    );
}
