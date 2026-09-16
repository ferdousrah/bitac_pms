# Document fonts

These are the faces every BITAC PDF is set in (registered in
`app/Services/BitacLetterhead.php`). Keep this directory in sync with the
`fontdata` block there — mPDF loads them by filename from here.

| File | Family | Used for | Licence |
|---|---|---|---|
| `Tinos-Regular/Bold/Italic/BoldItalic.ttf` | `tinos` | All English text | Apache 2.0 |
| `Nikosh.ttf` | `nikosh` | All Bangla text | Free for use (BCC / Bangladesh Computer Council) |
| `SiyamRupali.ttf` | — | Superseded by Nikosh; kept for the web `@font-face` | — |
| `SutonnyMJ.ttf` | — | Legacy ANSI Bangla, screen only | — |

**Tinos is Times New Roman.** It is Monotype's own metric-compatible libre
clone — identical advance widths, verified glyph for glyph against
`C:\Windows\Fonts\times.ttf`. We ship it *instead of* the real `times.ttf`
because Times New Roman is licensed with Windows/Office and may not be
redistributed in this repo or embedded in the PDFs we generate. Don't swap it
for `times.ttf`.

**Nikosh carries `'useOTL' => 0xFF`** in its `fontdata` entry. That flag is what
shapes Bangla — without it mPDF lays codepoints out in order and যুক্তাক্ষর /
matra placement come out wrong. Any Bangla font added here needs it.
