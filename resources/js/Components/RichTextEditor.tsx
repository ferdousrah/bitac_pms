import { useEffect, useRef, useState } from 'react';

interface Props {
    value: string;
    onChange: (html: string) => void;
    placeholder?: string;
    minHeight?: string;
    className?: string;
    /** Hide the table controls where a table would make no sense (e.g. a short note). */
    tables?: boolean;
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
    { cmd: 'undo',                icon: 'fi-rr-undo',          title: 'Undo (Ctrl+Z)' },
    { cmd: 'redo',                icon: 'fi-rr-redo',          title: 'Redo (Ctrl+Y)' },
    { cmd: '__divider__', divider: true, title: '' },
    { cmd: 'bold',                label: 'B', labelClass: 'font-bold',         title: 'Bold (Ctrl+B)' },
    { cmd: 'italic',              label: 'I', labelClass: 'italic font-serif', title: 'Italic (Ctrl+I)' },
    { cmd: 'underline',           label: 'U', labelClass: 'underline',         title: 'Underline (Ctrl+U)' },
    { cmd: 'strikeThrough',       label: 'S', labelClass: 'line-through',      title: 'Strikethrough' },
    { cmd: 'superscript',         label: 'x²', labelClass: 'text-[10px]',      title: 'Superscript' },
    { cmd: 'subscript',           label: 'x₂', labelClass: 'text-[10px]',      title: 'Subscript' },
    { cmd: '__divider__', divider: true, title: '' },
    { cmd: 'insertUnorderedList', icon: 'fi-rr-list',          title: 'Bullet list' },
    { cmd: 'insertOrderedList',   icon: 'fi-rr-list-check',    title: 'Numbered list' },
    { cmd: 'outdent',             icon: 'fi-rr-indent',        title: 'Decrease indent' },
    { cmd: 'indent',              icon: 'fi-rr-indent',        title: 'Increase indent' },
    { cmd: '__divider__', divider: true, title: '' },
    { cmd: 'justifyLeft',         icon: 'fi-rr-align-left',    title: 'Align left' },
    { cmd: 'justifyCenter',       icon: 'fi-rr-align-center',  title: 'Align centre' },
    { cmd: 'justifyRight',        icon: 'fi-rr-align-right',   title: 'Align right' },
    { cmd: 'justifyFull',         icon: 'fi-rr-align-justify', title: 'Justify' },
];

const BLOCKS = [
    { value: 'p',  label: 'Normal' },
    { value: 'h1', label: 'Heading 1' },
    { value: 'h2', label: 'Heading 2' },
    { value: 'h3', label: 'Heading 3' },
    { value: 'h4', label: 'Heading 4' },
    { value: 'blockquote', label: 'Quote' },
];

/** execCommand sizes are 1–7; these are the point sizes they print at. */
const SIZES = [
    { value: '2', label: '9 pt' },
    { value: '3', label: '11 pt' },
    { value: '4', label: '13 pt' },
    { value: '5', label: '17 pt' },
];

const COLOURS = ['#000000', '#374151', '#b91c1c', '#a349a4', '#1d4ed8', '#047857', '#b45309'];

/**
 * Lightweight rich-text editor backed by `contentEditable` + the legacy
 * `document.execCommand` API. No external dependency. Emits HTML to the parent.
 *
 * ⚠️ **Whatever this can produce, the server's letter sanitiser must allow.**
 * `App\Support\LetterHtml::ALLOWED` is the other half of this component — a tag
 * the toolbar can insert but the allow-list drops simply vanishes from the
 * printed PDF, silently. Tables were added to both together.
 *
 * Tradeoffs vs. TipTap/Quill:
 * - Tiny, zero install footprint.
 * - `execCommand` is deprecated but still implemented across modern browsers.
 * - No collaborative editing, no schema validation — the server sanitises
 *   before persisting/rendering.
 */
export default function RichTextEditor({
    value, onChange, placeholder = 'Start typing…',
    minHeight = '180px', className = '', tables = true,
}: Props) {
    const ref = useRef<HTMLDivElement | null>(null);
    const [tableMenu, setTableMenu] = useState(false);

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

    const push = () => {
        if (ref.current) onChange(ref.current.innerHTML);
    };

    const exec = (cmd: string, arg?: string) => {
        // contentEditable focus must be inside the editor for execCommand to
        // target it. We refocus before issuing the command.
        ref.current?.focus();
        document.execCommand(cmd, false, arg);
        // Browsers don't always fire input after execCommand on some commands
        // (e.g. justify*). Manually push the new HTML up.
        push();
    };

    /** The cell the caret is in, or null when the caret is outside any table. */
    const currentCell = (): HTMLTableCellElement | null => {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return null;
        let node: Node | null = sel.getRangeAt(0).startContainer;
        while (node && node !== ref.current) {
            if (node instanceof HTMLTableCellElement) return node;
            node = node.parentNode;
        }
        return null;
    };

    const insertTable = (rows: number, cols: number, header: boolean) => {
        // Borders are written inline, not left to a stylesheet: this HTML is
        // stored and later rendered by mPDF, which never sees the editor's CSS.
        const cell = (tag: string, i: number) =>
            `<${tag} style="border: 1px solid #000; padding: 4px 6px;${
                tag === 'th' ? ' background: #f3f4f6;' : ''
            }">${tag === 'th' ? `Heading ${i + 1}` : '&nbsp;'}</${tag}>`;

        const head = header
            ? `<tr>${Array.from({ length: cols }, (_, i) => cell('th', i)).join('')}</tr>`
            : '';
        const bodyRows = Array.from({ length: header ? rows - 1 : rows }, () =>
            `<tr>${Array.from({ length: cols }, (_, i) => cell('td', i)).join('')}</tr>`).join('');

        exec('insertHTML',
            `<table style="border-collapse: collapse; width: 100%;">${head}${bodyRows}</table><p><br></p>`);
        setTableMenu(false);
    };

    const addRow = (after: boolean) => {
        const cell = currentCell();
        const row = cell?.parentElement as HTMLTableRowElement | undefined;
        if (!row) return;
        const clone = row.cloneNode(true) as HTMLTableRowElement;
        Array.from(clone.cells).forEach((c) => {
            // A cloned header row would give the table a second set of headings.
            if (c.tagName === 'TH') {
                const td = document.createElement('td');
                td.setAttribute('style', 'border: 1px solid #000; padding: 4px 6px;');
                td.innerHTML = '&nbsp;';
                c.replaceWith(td);
            } else {
                c.innerHTML = '&nbsp;';
            }
        });
        row.parentElement?.insertBefore(clone, after ? row.nextSibling : row);
        push();
    };

    const addColumn = (after: boolean) => {
        const cell = currentCell();
        const table = cell?.closest('table');
        if (!cell || !table) return;
        const index = (cell.parentElement as HTMLTableRowElement).cells.length
            ? Array.from((cell.parentElement as HTMLTableRowElement).cells).indexOf(cell)
            : 0;
        Array.from(table.rows).forEach((row) => {
            const ref = row.cells[index];
            const isHeader = ref?.tagName === 'TH';
            const fresh = document.createElement(isHeader ? 'th' : 'td');
            fresh.setAttribute('style',
                `border: 1px solid #000; padding: 4px 6px;${isHeader ? ' background: #f3f4f6;' : ''}`);
            fresh.innerHTML = '&nbsp;';
            row.insertBefore(fresh, after ? ref?.nextSibling ?? null : ref ?? null);
        });
        push();
    };

    const removeRow = () => {
        const row = currentCell()?.parentElement as HTMLTableRowElement | undefined;
        const table = row?.closest('table');
        if (!row || !table) return;
        if (table.rows.length === 1) { table.remove(); } else { row.remove(); }
        push();
    };

    const removeColumn = () => {
        const cell = currentCell();
        const table = cell?.closest('table');
        if (!cell || !table) return;
        const index = Array.from((cell.parentElement as HTMLTableRowElement).cells).indexOf(cell);
        if ((table.rows[0]?.cells.length ?? 0) <= 1) {
            table.remove();
        } else {
            Array.from(table.rows).forEach((row) => row.cells[index]?.remove());
        }
        push();
    };

    const removeTable = () => {
        currentCell()?.closest('table')?.remove();
        push();
    };

    const addLink = () => {
        const url = prompt('Link to:');
        if (url) exec('createLink', url);
    };

    const button = (key: string, title: string, onDown: () => void, content: JSX.Element) => (
        <button key={key} type="button" title={title}
            // onMouseDown (not onClick) so the editor doesn't lose focus + selection
            onMouseDown={(e) => { e.preventDefault(); onDown(); }}
            className="w-7 h-7 inline-flex items-center justify-center rounded-md text-surface-600 hover:bg-surface-200/80 hover:text-surface-900 transition-colors">
            {content}
        </button>
    );

    return (
        <div className={`rounded-xl border border-surface-300 bg-white overflow-hidden focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100 transition-all ${className}`}>
            {/* Toolbar */}
            <div className="relative flex items-center flex-wrap gap-0.5 px-2 py-1.5 border-b border-surface-100 bg-surface-50/60">
                <select
                    onMouseDown={(e) => e.stopPropagation()}
                    onChange={(e) => { exec('formatBlock', `<${e.target.value}>`); e.target.selectedIndex = 0; }}
                    title="Paragraph style"
                    className="h-7 text-[11px] rounded-md border border-surface-200 bg-white px-1.5 text-surface-600">
                    {BLOCKS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                </select>
                <select
                    onChange={(e) => { exec('fontSize', e.target.value); e.target.selectedIndex = 0; }}
                    title="Text size"
                    className="h-7 text-[11px] rounded-md border border-surface-200 bg-white px-1.5 text-surface-600 ml-0.5">
                    <option value="">Size</option>
                    {SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <span className="w-px h-5 bg-surface-200 mx-1" />

                {TOOLS.map((t, idx) => t.divider
                    ? <span key={idx} className="w-px h-5 bg-surface-200 mx-1" />
                    : button(String(idx), t.title, () => exec(t.cmd, t.arg),
                        t.label
                            ? <span className={`text-[12px] leading-none ${t.labelClass ?? ''}`}>{t.label}</span>
                            : <i className={`fi ${t.icon} text-[12px] leading-none ${t.cmd === 'outdent' ? 'rotate-180' : ''}`} />))}

                <span className="w-px h-5 bg-surface-200 mx-1" />
                {COLOURS.map((c) => (
                    <button key={c} type="button" title={`Text colour ${c}`}
                        onMouseDown={(e) => { e.preventDefault(); exec('foreColor', c); }}
                        className="w-5 h-5 rounded border border-surface-300 hover:scale-110 transition-transform"
                        style={{ background: c }} />
                ))}

                <span className="w-px h-5 bg-surface-200 mx-1" />
                {button('link', 'Insert link', addLink, <i className="fi fi-rr-link-alt text-[12px] leading-none" />)}
                {button('rule', 'Horizontal line', () => exec('insertHorizontalRule'),
                    <i className="fi fi-rr-minus text-[12px] leading-none" />)}

                {tables && (
                    <>
                        <span className="w-px h-5 bg-surface-200 mx-1" />
                        {button('table', 'Table', () => setTableMenu((v) => !v),
                            <i className="fi fi-rr-table-layout text-[12px] leading-none" />)}
                    </>
                )}

                <span className="w-px h-5 bg-surface-200 mx-1" />
                {button('clear', 'Clear formatting', () => exec('removeFormat'),
                    <i className="fi fi-rr-eraser text-[12px] leading-none" />)}

                {tableMenu && (
                    <div className="absolute z-20 top-full left-0 mt-1 w-60 rounded-xl border border-surface-200 bg-white shadow-xl p-2 space-y-1">
                        <p className="text-[10px] uppercase tracking-wider font-bold text-surface-400 px-1">Insert</p>
                        <div className="grid grid-cols-2 gap-1">
                            <button type="button" onMouseDown={(e) => { e.preventDefault(); insertTable(3, 3, true); }}
                                className="btn-outline btn-xs justify-center">3 × 3 + head</button>
                            <button type="button" onMouseDown={(e) => { e.preventDefault(); insertTable(2, 2, false); }}
                                className="btn-outline btn-xs justify-center">2 × 2 plain</button>
                        </div>
                        <button type="button"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                const r = parseInt(prompt('Rows?', '4') ?? '', 10);
                                const c = parseInt(prompt('Columns?', '3') ?? '', 10);
                                if (r > 0 && c > 0) insertTable(r, c, true);
                            }}
                            className="btn-ghost btn-xs w-full justify-center">Custom size…</button>

                        <p className="text-[10px] uppercase tracking-wider font-bold text-surface-400 px-1 pt-1">In this table</p>
                        <div className="grid grid-cols-2 gap-1">
                            <button type="button" onMouseDown={(e) => { e.preventDefault(); addRow(true); }}
                                className="btn-ghost btn-xs justify-center">+ Row below</button>
                            <button type="button" onMouseDown={(e) => { e.preventDefault(); addRow(false); }}
                                className="btn-ghost btn-xs justify-center">+ Row above</button>
                            <button type="button" onMouseDown={(e) => { e.preventDefault(); addColumn(true); }}
                                className="btn-ghost btn-xs justify-center">+ Col right</button>
                            <button type="button" onMouseDown={(e) => { e.preventDefault(); addColumn(false); }}
                                className="btn-ghost btn-xs justify-center">+ Col left</button>
                            <button type="button" onMouseDown={(e) => { e.preventDefault(); removeRow(); }}
                                className="btn-ghost btn-xs justify-center text-red-600">− Row</button>
                            <button type="button" onMouseDown={(e) => { e.preventDefault(); removeColumn(); }}
                                className="btn-ghost btn-xs justify-center text-red-600">− Column</button>
                        </div>
                        <button type="button" onMouseDown={(e) => { e.preventDefault(); removeTable(); }}
                            className="btn-ghost btn-xs w-full justify-center text-red-600">Delete table</button>
                        <button type="button" onMouseDown={(e) => { e.preventDefault(); setTableMenu(false); }}
                            className="btn-ghost btn-xs w-full justify-center">Close</button>
                    </div>
                )}
            </div>

            {/* Editable surface */}
            <div
                ref={ref}
                contentEditable
                suppressContentEditableWarning
                onInput={push}
                onBlur={push}
                data-placeholder={placeholder}
                className="rt-editor px-3 py-2.5 text-sm text-surface-800 outline-none leading-relaxed overflow-x-auto"
                style={{ minHeight }}
            />

            {/* On-screen styles. The PDF gets its own from BitacLetterhead —
                table borders are written inline above so both agree. */}
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
                .rt-editor h1 { font-size: 1.4rem; font-weight: 700; margin: 0.5rem 0 0.3rem; }
                .rt-editor h2 { font-size: 1.2rem; font-weight: 700; margin: 0.5rem 0 0.3rem; }
                .rt-editor h3 { font-size: 1.05rem; font-weight: 700; margin: 0.5rem 0 0.3rem; }
                .rt-editor h4 { font-size: 0.95rem; font-weight: 700; margin: 0.5rem 0 0.3rem; }
                .rt-editor blockquote {
                    border-left: 3px solid #d1d5db; padding-left: 0.75rem;
                    margin: 0.4rem 0; color: #4b5563;
                }
                .rt-editor table { border-collapse: collapse; margin: 0.5rem 0; }
                .rt-editor td, .rt-editor th { border: 1px solid #9ca3af; padding: 4px 6px; min-width: 3rem; }
                .rt-editor th { background: #f3f4f6; font-weight: 700; }
                .rt-editor hr { border: 0; border-top: 1px solid #d1d5db; margin: 0.6rem 0; }
                .rt-editor a { color: #1d4ed8; text-decoration: underline; }
            `}</style>
        </div>
    );
}
