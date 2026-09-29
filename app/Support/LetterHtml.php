<?php

namespace App\Support;

/**
 * Rich text from the editor, made safe to put in a PDF or an email.
 *
 * ⚠️ One implementation, deliberately: this was a private method on
 * `QuotationController` and the bill's forwarding letter needed exactly the
 * same rules. A second copy is how two documents end up with two different
 * ideas of what a safe letter is.
 */
class LetterHtml
{
    /**
     * Tags a letter body may keep. Everything else is dropped.
     *
     * ⚠️ **This is the other half of `RichTextEditor`.** Anything the toolbar
     * can insert has to be listed here, or it is stripped on save and simply
     * vanishes from the printed PDF with nothing to show for it. Tables,
     * headings, rules and links were added to both together.
     *
     * `strip_tags` keeps the attributes of the tags it keeps, so the inline
     * `style` the editor writes on table cells survives — which is what makes
     * a typed table print with its borders, since mPDF never sees the editor's
     * stylesheet. `javascript:` and event handlers are stripped first.
     */
    private const ALLOWED = '<p><br><b><strong><i><em><u><s><strike><ul><ol><li><div><span>'
        . '<table><thead><tbody><tfoot><tr><th><td>'
        . '<h1><h2><h3><h4><h5><h6><blockquote><hr><a><font><sub><sup><pre><code>';

    public static function sanitize(string $html): string
    {
        // Hard-strip script/style blocks and all event handlers / javascript: URLs.
        $html = preg_replace('#<\s*(script|style|iframe|object|embed)\b[^>]*>.*?<\s*/\s*\1\s*>#is', '', $html);
        $html = preg_replace('#\son[a-z]+\s*=\s*"[^"]*"#i', '', $html);
        $html = preg_replace("#\son[a-z]+\s*=\s*'[^']*'#i", '', $html);
        $html = preg_replace('#javascript\s*:#i', '', $html);

        return strip_tags($html, self::ALLOWED);
    }

    /**
     * A letter body as it should print.
     *
     * Rich text is sanitised; a plain-text letter (no tags at all) is escaped
     * and line-broken instead, so letters written before the editor existed
     * still print the way they were typed.
     */
    public static function toPrintable(string $body): string
    {
        $body = trim($body);

        return (str_contains($body, '<') && str_contains($body, '>'))
            ? self::sanitize($body)
            : nl2br(htmlspecialchars($body, ENT_QUOTES | ENT_HTML5, 'UTF-8'));
    }
}
