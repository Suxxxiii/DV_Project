import * as d3 from "d3";
import { DataInterface, LabeledValue } from "./types";
import { createBarChart } from "./barChart";

const featureHeight = 120; //height of each feature's chart
const padding = 5; //padding between the charts


export function createDistributionCharts(data: DataInterface[]) {
    //get the featurenames from the DataInterface
    const featureNames = Object.keys(data[0]) as (keyof DataInterface)[];

    //clear previous content
    let distributionVis = d3.select("#distributionVis")
    distributionVis.selectAll("*").remove(); 

    //set the width to the full width, and the height to the total height of all features to be visualized
    let targetSVG = distributionVis.append("svg")
        .attr("width", "100%")
        .attr("height", (featureHeight + padding) * featureNames.length);

    const width = targetSVG.node()!.getBoundingClientRect()!.width;

    let currentY = 0;

    // Loop over columns (features)
    for (const featureName of featureNames) {
        if (featureName === "postCode") {
            continue; //no need to visualize distribution of postcode
        }

        let labeledValues: LabeledValue[] = [];

        // Loop over rows to get each cell in the current column
        for (const row of data) {
            let labeledValue = { label: "" + row.postCode, value: row[featureName] };
            if (labeledValue.value < 0) {
                labeledValue.value = 0; // handling missing data by setting it to 0. NOTE: Not desired for every feature! Should be handled upon loading in per-column basis    
            }
            labeledValues.push(labeledValue);
        }
        
        const barChartSVG = createBarChart(width, featureHeight, currentY,false, labeledValues, featureName)
        targetSVG.node()!.append(barChartSVG);
        //Place the next feature further down.
        currentY += featureHeight + padding;
    }

}