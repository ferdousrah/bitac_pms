/**
 * A gear outline as one SVG path: `teeth` trapezoids on an outer radius, with
 * a centre bore cut out (even-odd fill).
 *
 * Drawn here rather than shipped as an asset so its colours come from the
 * brand variables and it is crisp at any size. Shared by the home page hero
 * and the public footer — one gear, not two copies of the geometry.
 */
export function gearPath(cx: number, cy: number, outer: number, inner: number, teeth: number): string {
    const step = (Math.PI * 2) / teeth;
    const pt = (r: number, a: number) => `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
    const parts: string[] = [];
    for (let i = 0; i < teeth; i++) {
        const a = i * step;
        parts.push(
            (i === 0 ? 'M' : 'L') + pt(inner, a),
            'L' + pt(outer, a + step * 0.18),
            'L' + pt(outer, a + step * 0.42),
            'L' + pt(inner, a + step * 0.6),
        );
    }
    const bore = inner * 0.42;
    return parts.join(' ') + ' Z '
        + `M${cx + bore},${cy} A${bore},${bore} 0 1,0 ${cx - bore},${cy} A${bore},${bore} 0 1,0 ${cx + bore},${cy} Z`;
}
