import * as d3 from "d3";


const toolTip = d3.select<HTMLDivElement, unknown>("#tooltip").attr("role", "tooltip");

export function showTooltip(Page_X: number, Page_Y: number, Text: string) {
    toolTip
        .style("display", "block")
        .text(Text);

    // Use viewport coordinates and flip near the right or bottom edge.
    const Bounds = toolTip.node()!.getBoundingClientRect();
    const Pointer_X = Page_X - window.scrollX;
    const Pointer_Y = Page_Y - window.scrollY;
    const Gap = 16;
    const Margin = 8;
    let Left = Pointer_X + Gap;
    let Top = Pointer_Y + Gap;
    if (Left + Bounds.width > window.innerWidth - Margin) Left = Pointer_X - Gap - Bounds.width;
    if (Top + Bounds.height > window.innerHeight - Margin) Top = Pointer_Y - Gap - Bounds.height;
    Left = Math.max(Margin, Math.min(Left, window.innerWidth - Bounds.width - Margin));
    Top = Math.max(Margin, Math.min(Top, window.innerHeight - Bounds.height - Margin));
    toolTip.style("left", `${Left}px`).style("top", `${Top}px`);
}

window.addEventListener("resize", hideTooltip);
window.addEventListener("scroll", hideTooltip, true);

export function hideTooltip() {
    toolTip.style("display", "none");
}
