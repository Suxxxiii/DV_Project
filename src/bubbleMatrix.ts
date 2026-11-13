import * as d3 from "d3";
import { createControlPanel } from "./controlPanel";
import { hideTooltip, showTooltip } from "./tooltip";

export type AttributeKey = "GDPPerCapita_2" | "BirthsPer1000Residents" | "SolarHousingPct"
    | "gemiddelde_woningwaarde" | "HigherEducationStudentsWOHBO" | "GDPVolumeChanges_3";

export interface AttributeDefinition {
    Key: AttributeKey;
    Label: string;
    Short_Label: string;
    Color: string;
    Unit: string;
}

export interface RegionProperties extends Record<AttributeKey, number> {
    statcode: string;
    statnaam: string;
}

const Attributes: AttributeDefinition[] = [
    { Key: "GDPPerCapita_2", Label: "GDP per capita", Short_Label: "GDP per capita", Color: d3.schemeTableau10[0], Unit: "€/person" },
    { Key: "BirthsPer1000Residents", Label: "Births per 1,000 residents", Short_Label: "Births", Color: d3.schemeTableau10[1], Unit: "births/1,000 residents" },
    { Key: "SolarHousingPct", Label: "Solar housing (%)", Short_Label: "Solar housing", Color: d3.schemeTableau10[2], Unit: "%" },
    { Key: "gemiddelde_woningwaarde", Label: "Average housing value", Short_Label: "Housing value", Color: d3.schemeTableau10[3], Unit: "thousand €" },
    { Key: "HigherEducationStudentsWOHBO", Label: "Higher education students", Short_Label: "Higher education", Color: d3.schemeTableau10[4], Unit: "students" },
    { Key: "GDPVolumeChanges_3", Label: "GDP Growth", Short_Label: "GDP Growth", Color: d3.schemeTableau10[5], Unit: "%" }
];

let Cancel_Hover_Sort: (() => void) | undefined;
let Region_Order: string[] = [];
let Feature_Order: AttributeKey[] = [];

export async function loadBubbleMatrix(): Promise<void> {
    const Response = await fetch("/Dataset/COROPplus_52_enriched_2024.geojson");
    if (!Response.ok) throw new Error("Could not load COROPplus data.");
    const Geo_Data: { features: { properties: RegionProperties }[] } = await Response.json();
    const All_Regions = Geo_Data.features.map(Region => Region.properties);
    createControlPanel(All_Regions, Attributes, createBubbleMatrix);
}

export function createBubbleMatrix(Selected_Regions: RegionProperties[], Selected_Attributes?: AttributeKey[]): void {
    hideTooltip();
    // Cancel old interactions before a Control Panel update replaces the matrix.
    Cancel_Hover_Sort?.();
    Cancel_Hover_Sort = undefined;
    Region_Order = Region_Order.filter(Code => Selected_Regions.some(Region => Region.statcode === Code));
    Selected_Regions.forEach(Region => {
        if (!Region_Order.includes(Region.statcode)) Region_Order.push(Region.statcode);
    });
    const Active_Attributes = Selected_Attributes ?? Attributes.slice(0, 5).map(Attribute => Attribute.Key);
    Feature_Order = Feature_Order.filter(Key => Active_Attributes.includes(Key));
    Active_Attributes.forEach(Key => {
        if (!Feature_Order.includes(Key)) Feature_Order.push(Key);
    });
    const Displayed_Attributes = Feature_Order.map(Key => Attributes.find(Attribute => Attribute.Key === Key)!);
    let Display_Region_Order = [...Region_Order];
    let Hover_Timer: number | undefined;
    let Is_Hover_Sorted = false;
    let Is_Current_Render = true;
    let Dragged_Region: string | null = null;
    let Drag_Y: number | undefined;
    let Dragged_Attribute: AttributeKey | null = null;
    let Drag_X: number | undefined;
    const Width = 1100;
    const Height = 650;
    const Left = 220;
    const Top = 130;
    const Row_Height = 48;
    const Column_Width = 170;
    const Container = d3.select("#multivariateVis");
    Container.selectAll("*").remove();
    const Svg = Container.append("svg")
        .attr("viewBox", `0 0 ${Width} ${Height}`).attr("width", Width).attr("height", Height)
        .attr("role", "img")
        .attr("aria-label", `Bubble matrix comparing ${Selected_Regions.length} regions and ${Displayed_Attributes.length} attributes`);
    Svg.append("text").attr("x", 20).attr("y", 30).attr("font-size", 20)
        .attr("font-weight", "bold").text("Bubble Matrix");
    Svg.append("text").attr("x", 20).attr("y", 55).attr("font-size", 13)
        .text("Sizes compare regions within each column: selected-region min–max, radius 4–18 px. Equal values: 4 px.");
    if (Active_Attributes.includes("GDPVolumeChanges_3")) {
        Svg.append("text").attr("x", 20).attr("y", 75).attr("font-size", 12)
            .text("GDP Growth instead uses absolute change magnitude; − means negative growth. Equal values use 4 px.");
    }
    if (Selected_Regions.length === 0 || Displayed_Attributes.length === 0) {
        Svg.append("text").attr("x", 20).attr("y", 100).attr("font-size", 16)
            .text("Select at least one region and one attribute.");
        return;
    }

    Selected_Regions.forEach((Region, Row_Index) => {
        const Center_Y = Top + Row_Index * Row_Height;
        Svg.append("line").attr("x1", Left - 20).attr("x2", Width - 45)
            .attr("y1", Center_Y).attr("y2", Center_Y).attr("stroke", "#e0e0e0");
        Svg.append("text").datum(Region).attr("class", "region-label")
            .attr("x", Left - 30).attr("y", Center_Y).attr("text-anchor", "end")
            .attr("dominant-baseline", "middle").attr("font-size", 13)
            .style("cursor", "grab").style("user-select", "none").text(Region.statnaam);
    });

    Displayed_Attributes.forEach(Attribute => {
        const Column = Svg.append("g").datum(Attribute.Key).attr("class", "attribute-column")
            .attr("transform", `translate(${getColumnX(Attribute.Key)},0)`);
        Column.append("line").attr("x1", 0).attr("x2", 0).attr("y1", Top - 25)
            .attr("y2", Top + (Selected_Regions.length - 1) * Row_Height + 25).attr("stroke", "#e0e0e0");
        Column.append("text").attr("class", "attribute-title").attr("x", 0).attr("y", 93)
            .attr("text-anchor", "middle").attr("font-size", 12).attr("fill", Attribute.Color)
            .attr("font-weight", "bold").text(Attribute.Label)
            .style("cursor", "grab").style("user-select", "none")
            .on("mouseenter", () => startHoverSort(Attribute.Key))
            .on("mouseleave", () => {
                if (Dragged_Attribute === null) stopHoverSort();
            });

        // Each column uses only the current region selection.
        const Min_Value = d3.min(Selected_Regions, Region => Region[Attribute.Key])!;
        const Max_Value = d3.max(Selected_Regions, Region => Region[Attribute.Key])!;
        Selected_Regions.forEach((Region, Row_Index) => {
            const Raw_Value = Region[Attribute.Key];
            const Normalized_Value = Attribute.Key === "GDPVolumeChanges_3"
                ? normalizeGrowthMagnitude(Raw_Value, Min_Value, Max_Value)
                : normalizeValue(Raw_Value, Min_Value, Max_Value);
            const Radius = getCircleRadius(Normalized_Value);
            const Cell = Column.append("g").datum(Region).attr("class", "region-cell")
                .attr("transform", `translate(0,${Top + Row_Index * Row_Height})`);
            Cell.append("circle").attr("cx", 0).attr("cy", 0).attr("r", Radius).attr("fill", Attribute.Color)
                .on("mouseenter mousemove", (Event: MouseEvent) => {
                    if (!Is_Current_Render || Dragged_Region !== null || Dragged_Attribute !== null) return;
                    const Tooltip_Text = Attribute.Key === "GDPVolumeChanges_3"
                        ? `${Raw_Value === 0 ? "0" : d3.format("+.2~f")(Raw_Value)}${Attribute.Unit}`
                        : `${d3.format(",.2f")(Raw_Value)} ${Attribute.Unit}`;
                    showTooltip(Event.pageX, Event.pageY, Tooltip_Text);
                })
                .on("mouseleave", hideTooltip);
            if (Attribute.Key === "GDPVolumeChanges_3" && Raw_Value < 0) {
                Cell.append("text").attr("class", "negative-sign").attr("x", -Radius - 7).attr("y", 0)
                    .attr("text-anchor", "end").attr("dominant-baseline", "middle")
                    .attr("font-size", 16).attr("font-weight", "bold").attr("fill", "#222")
                    .attr("pointer-events", "none").text("−");
            }
            Cell.append("text").datum(Attribute.Key).attr("class", "raw-value").attr("x", 26).attr("y", 0)
                .attr("dominant-baseline", "middle").attr("font-size", 11).attr("fill", "#222")
                .attr("pointer-events", "none").attr("display", "none").text(d3.format(",.2~f")(Raw_Value));
        });
    });

    updateRowPositions();
    Svg.selectAll<SVGTextElement, RegionProperties>(".region-label")
        .call(d3.drag<SVGTextElement, RegionProperties>()
            .container(() => Svg.node()!)
            .filter(Event => Is_Current_Render && !Is_Hover_Sorted && Dragged_Attribute === null
                && Selected_Regions.length > 1 && !Event.ctrlKey && !Event.button)
            .subject((Event, Region) => ({ x: Left - 30, y: getRowY(Region) }))
            .on("start", (Event, Region) => {
                stopHoverSort();
                Dragged_Region = Region.statcode;
                Drag_Y = getRowY(Region);
                Svg.selectAll<SVGTextElement, RegionProperties>(".region-label")
                    .attr("font-weight", Label_Region => Label_Region.statcode === Dragged_Region ? "bold" : null)
                    .style("cursor", Label_Region => Label_Region.statcode === Dragged_Region ? "grabbing" : "grab");
            })
            .on("drag", Event => {
                if (!Is_Current_Render) return;
                Drag_Y = Math.max(Top, Math.min(Top + (Region_Order.length - 1) * Row_Height, Event.y));
                updateRowPositions();
            })
            .on("end", (Event, Region) => {
                if (!Is_Current_Render) return;
                const Target_Index = Math.max(0, Math.min(Region_Order.length - 1, Math.round((Event.y - Top) / Row_Height)));
                const Source_Index = Region_Order.indexOf(Region.statcode);
                Region_Order[Source_Index] = Region_Order[Target_Index];
                Region_Order[Target_Index] = Region.statcode;
                Display_Region_Order = [...Region_Order];
                Dragged_Region = null;
                Drag_Y = undefined;
                Svg.selectAll(".region-label").attr("font-weight", null).style("cursor", "grab");
                updateRowPositions();
            }));

    Svg.selectAll<SVGTextElement, AttributeKey>(".attribute-title")
        .call(d3.drag<SVGTextElement, AttributeKey>()
            .container(() => Svg.node()!)
            .filter(Event => Is_Current_Render && Dragged_Region === null && Feature_Order.length > 1 && !Event.ctrlKey && !Event.button)
            .subject((Event, Attribute_Key) => ({ x: getColumnX(Attribute_Key), y: 93 }))
            .on("start", (Event, Attribute_Key) => {
                stopHoverSort();
                Dragged_Attribute = Attribute_Key;
                Drag_X = getColumnX(Attribute_Key);
                Svg.selectAll<SVGTextElement, AttributeKey>(".attribute-title")
                    .attr("text-decoration", Column_Key => Column_Key === Attribute_Key ? "underline" : null)
                    .style("cursor", Column_Key => Column_Key === Attribute_Key ? "grabbing" : "grab");
            })
            .on("drag", Event => {
                if (!Is_Current_Render) return;
                Drag_X = Math.max(Left + 65, Math.min(Left + 65 + (Feature_Order.length - 1) * Column_Width, Event.x));
                updateColumnPositions();
            })
            .on("end", (Event, Attribute_Key) => {
                if (!Is_Current_Render) return;
                const Target_Index = Math.max(0, Math.min(Feature_Order.length - 1, Math.round((Event.x - Left - 65) / Column_Width)));
                const Source_Index = Feature_Order.indexOf(Attribute_Key);
                Feature_Order[Source_Index] = Feature_Order[Target_Index];
                Feature_Order[Target_Index] = Attribute_Key;
                Dragged_Attribute = null;
                Drag_X = undefined;
                Svg.selectAll(".attribute-title").attr("text-decoration", null).style("cursor", "grab");
                updateColumnPositions();
            }));

    Cancel_Hover_Sort = () => {
        stopHoverSort();
        Is_Current_Render = false;
    };

    function getRowY(Region: RegionProperties): number {
        if (Region.statcode === Dragged_Region && Drag_Y !== undefined) return Drag_Y;
        return Top + Display_Region_Order.indexOf(Region.statcode) * Row_Height;
    }

    function getColumnX(Attribute_Key: AttributeKey): number {
        if (Attribute_Key === Dragged_Attribute && Drag_X !== undefined) return Drag_X;
        return Left + 65 + Feature_Order.indexOf(Attribute_Key) * Column_Width;
    }

    function updateColumnPositions(): void {
        hideTooltip();
        Svg.selectAll<SVGGElement, AttributeKey>(".attribute-column")
            .attr("transform", Column_Key => `translate(${getColumnX(Column_Key)},0)`);
    }

    function updateRowPositions(): void {
        hideTooltip();
        Svg.selectAll<SVGTextElement, RegionProperties>(".region-label").attr("y", getRowY);
        Svg.selectAll<SVGGElement, RegionProperties>(".region-cell")
            .attr("transform", Region => `translate(0,${getRowY(Region)})`);
    }

    function updateSortArrow(Attribute_Key: AttributeKey | null): void {
        Svg.selectAll<SVGTextElement, AttributeKey>(".attribute-title")
            .text(Column_Key => Attributes.find(Attribute => Attribute.Key === Column_Key)!.Label
                + (Column_Key === Attribute_Key ? " ↓" : ""));
    }

    function startHoverSort(Attribute_Key: AttributeKey): void {
        if (Dragged_Region !== null || Dragged_Attribute !== null) return;
        stopHoverSort();
        highlightAttribute(Attribute_Key);
        if (Selected_Regions.length < 2) return;
        Hover_Timer = window.setTimeout(() => {
            Hover_Timer = undefined;
            Is_Hover_Sorted = true;
            Display_Region_Order = [...Selected_Regions].sort((First_Region, Second_Region) =>
                Second_Region[Attribute_Key] - First_Region[Attribute_Key]
                || Region_Order.indexOf(First_Region.statcode) - Region_Order.indexOf(Second_Region.statcode)
            ).map(Region => Region.statcode);
            updateRowPositions();
            updateSortArrow(Attribute_Key);
            Svg.selectAll(".region-label").style("cursor", "not-allowed");
        }, 1000);
    }

    function stopHoverSort(): void {
        if (Hover_Timer !== undefined) window.clearTimeout(Hover_Timer);
        Hover_Timer = undefined;
        Is_Hover_Sorted = false;
        Display_Region_Order = [...Region_Order];
        Svg.selectAll(".region-label").style("cursor", "grab");
        updateRowPositions();
        updateSortArrow(null);
        highlightAttribute(null);
    }

    function highlightAttribute(Attribute_Key: AttributeKey | null): void {
        Svg.selectAll<SVGGElement, AttributeKey>(".attribute-column")
            .attr("opacity", Column_Key => Attribute_Key === null || Column_Key === Attribute_Key ? 1 : 0.2);
        Svg.selectAll<SVGTextElement, AttributeKey>(".raw-value")
            .attr("display", Column_Key => Column_Key === Attribute_Key ? null : "none");
    }
}

function normalizeValue(Raw_Value: number, Min_Value: number, Max_Value: number): number {
    return Max_Value === Min_Value ? 0 : (Raw_Value - Min_Value) / (Max_Value - Min_Value);
}

function normalizeGrowthMagnitude(Raw_Value: number, Min_Value: number, Max_Value: number): number {
    const Max_Absolute_Value = Math.max(Math.abs(Min_Value), Math.abs(Max_Value));
    if (Min_Value === Max_Value || Max_Absolute_Value === 0) return 0;
    return Math.abs(Raw_Value) / Max_Absolute_Value;
}

function getCircleRadius(Normalized_Value: number): number {
    const Min_Radius = 4;
    const Max_Radius = 18;
    // Interpolate squared radii so circle area changes linearly with the value.
    return Math.sqrt(Min_Radius ** 2 + Normalized_Value * (Max_Radius ** 2 - Min_Radius ** 2));
}
