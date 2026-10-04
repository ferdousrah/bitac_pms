import { useState } from 'react';
import PdfPopupModal from '@/Components/PdfPopupModal';

/**
 * Print this report, exactly as it is on screen.
 *
 * ⚠️ The caller passes the SAME query string the page was loaded with. The
 * server builds the sheet from the same figures the page was built from, so
 * what comes out of the printer is what is being looked at — a printed total
 * that disagrees with the screen is the one failure nobody can explain away.
 */
export default function ReportPdfButton({
    url, title, subtitle, label = 'Print / PDF', className = 'btn-danger btn-sm',
}: {
    url: string;
    title: string;
    subtitle?: string;
    label?: string;
    className?: string;
}) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <button type="button" onClick={() => setOpen(true)} className={className}>
                <i className="fi fi-rr-file-pdf text-xs leading-none" /> {label}
            </button>

            <PdfPopupModal
                open={open}
                pdfUrl={open ? url : null}
                title={title}
                subtitle={subtitle ?? `As on ${new Date().toLocaleDateString('en-GB', {
                    day: '2-digit', month: 'short', year: 'numeric',
                })}`}
                onClose={() => setOpen(false)}
            />
        </>
    );
}
