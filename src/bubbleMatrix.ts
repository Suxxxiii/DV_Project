import * as d3 from "d3";

type AttributeKey = "GDPPerCapita_2" | "BirthsPer1000Residents" | "SolarHousingPct"
    | "gemiddelde_woningwaarde" | "HigherEducationStudentsWOHBO";

interface RegionProperties extends Record<AttributeKey, number> {
    statcode: string;
    statnaam: string;
}

export async function loadBubbleMatrix(): Promise<void> {
    const Response = await fetch("/Dataset/COROPplus_52_enriched_2024.geojson");
    if (!Response.ok) throw new Error("Could not load COROPplus data.");
    const Geo_Data: { features: { properties: RegionProperties }[] } = await Response.json();
    createBubbleMatrix(Geo_Data.features.slice(0, 10).map(Region => Region.properties));
}

export function createBubbleMatrix(Selected_Regions: RegionProperties[], Selected_Attributes?: AttributeKey[]): void {
    const Attributes: { Key: AttributeKey; Label: string; Color: string }[] = [
        { Key: "GDPPerCapita_2", Label: "GDP per capita", Color: d3.schemeTableau10[0] },
        { Key: "BirthsPer1000Residents", Label: "Births per 1,000 residents", Color: d3.schemeTableau10[1] },
        { Key: "SolarHousingPct", Label: "Solar housing (%)", Color: d3.schemeTableau10[2] },
        { Key: "gemiddelde_woningwaarde", Label: "Average housing value", Color: d3.schemeTableau10[3] },
        { Key: "HigherEducationStudentsWOHBO", Label: "Higher education students", Color: d3.schemeTableau10[4] }
    ];
    const Displayed_Attributes = Selected_Attributes
        ? Selected_Attributes.map(Key => Attributes.find(Attribute => Attribute.Key === Key)!)
        : Attributes;
    const Width = 1100;
    const Height = 650;
    const Left = 220;
    const Top = 130;
    const Row_Height = 48;
    const Column_Width = 170;
    const Min_Radius = 4;
    const Max_Radius = 18;
    const Container = d3.select("#multivariateVis");
    Container.selectAll("*").remove();
    const Svg = Container.append("svg")
        .attr("viewBox", `0 0 ${Width} ${Height}`)
        .attr("width", Width).attr("height", Height)
        .attr("role", "img").attr("aria-label", `Bubble matrix comparing ${Selected_Regions.length} regions and ${Displayed_Attributes.length} attributes`);

    Svg.append("text").attr("x", 20).attr("y", 30)
        .attr("font-size", 20).attr("font-weight", "bold").text("Bubble Matrix");
    Svg.append("text").attr("x", 20).attr("y", 55).attr("font-size", 13)
        .text("Sizes compare regions within each column: selected-region min–max, radius 4–18 px. Equal values: 4 px.");

    Selected_Regions.forEach((Region, Row_Index) => {
        const Center_Y = Top + Row_Index * Row_Height;
        Svg.append("line").attr("x1", Left - 20).attr("x2", Width - 45)
            .attr("y1", Center_Y).attr("y2", Center_Y).attr("stroke", "#e0e0e0");
        Svg.append("text").attr("x", Left - 30).attr("y", Center_Y)
            .attr("text-anchor", "end").attr("dominant-baseline", "middle")
            .attr("font-size", 13).text(Region.statnaam);
    });

    Displayed_Attributes.forEach((Attribute, Column_Index) => {
        const Center_X = Left + 65 + Column_Index * Column_Width;
        Svg.append("line").attr("x1", Center_X).attr("x2", Center_X)
            .attr("y1", Top - 25).attr("y2", Top + Math.max(0, Selected_Regions.length - 1) * Row_Height + 25)
            .attr("stroke", "#e0e0e0");
        Svg.append("text").attr("x", Center_X).attr("y", 93)
            .attr("text-anchor", "middle").attr("font-size", 12)
            .attr("fill", Attribute.Color).attr("font-weight", "bold").text(Attribute.Label);

        // 先获取当前选中区域中，该属性的最小值和最大值，然后逐个区域归一化：
        const Min_Value = d3.min(Selected_Regions, Region => Region[Attribute.Key])!;
        const Max_Value = d3.max(Selected_Regions, Region => Region[Attribute.Key])!;
        Selected_Regions.forEach((Region, Row_Index) => {
            const Raw_Value = Region[Attribute.Key];
            const Normalized_Value = Max_Value === Min_Value ? 0 : (Raw_Value - Min_Value) / (Max_Value - Min_Value);
            // 最后将归一化值转换为圆半径：
            const Radius = Math.sqrt(Min_Radius ** 2 + Normalized_Value * (Max_Radius ** 2 - Min_Radius ** 2));
            Svg.append("circle").attr("cx", Center_X).attr("cy", Top + Row_Index * Row_Height)
                .attr("r", Radius).attr("fill", Attribute.Color);
        });
    });
}
