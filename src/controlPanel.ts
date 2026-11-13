import type { AttributeDefinition, AttributeKey, RegionProperties } from "./bubbleMatrix";

export function createControlPanel(
    All_Regions: RegionProperties[],
    Attributes: AttributeDefinition[],
    On_Selection_Change: (Selected_Regions: RegionProperties[], Selected_Attributes: AttributeKey[]) => void
): void {
    const Search_Input = document.getElementById("regionSearch") as HTMLInputElement;
    const Region_List = document.getElementById("regionList")!;
    const Attribute_List = document.getElementById("attributeButtons")!;
    const Region_Count = document.getElementById("regionCount")!;
    const Attribute_Count = document.getElementById("attributeCount")!;
    const Selected_Regions = new Set(All_Regions.slice(0, 10).map(Region => Region.statcode));
    const Selected_Attributes = new Set(Attributes.slice(0, 5).map(Attribute => Attribute.Key));
    Region_List.replaceChildren();
    Attribute_List.replaceChildren();

    const Region_Buttons = All_Regions.map(Region => {
        const Button = document.createElement("button");
        Button.type = "button";
        Button.className = "region-option";
        Button.textContent = Region.statnaam;
        Button.addEventListener("click", () => {
            if (Selected_Regions.has(Region.statcode)) {
                Selected_Regions.delete(Region.statcode);
            } else if (Selected_Regions.size < 10) {
                Selected_Regions.add(Region.statcode);
            }
            updateSelection();
        });
        Region_List.append(Button);
        return Button;
    });

    const Attribute_Buttons = Attributes.map(Attribute => {
        const Button = document.createElement("button");
        Button.type = "button";
        Button.className = "attribute-option";
        Button.title = Attribute.Label;
        Button.style.setProperty("--attribute-color", Attribute.Color);
        const Swatch = document.createElement("span");
        Swatch.className = "attribute-swatch";
        Swatch.setAttribute("aria-hidden", "true");
        Button.append(Swatch, Attribute.Short_Label);
        Button.addEventListener("click", () => {
            if (Selected_Attributes.has(Attribute.Key)) {
                Selected_Attributes.delete(Attribute.Key);
            } else if (Selected_Attributes.size < 5) {
                Selected_Attributes.add(Attribute.Key);
            }
            updateSelection();
        });
        Attribute_List.append(Button);
        return Button;
    });

    // Search only changes visibility; selection remains in the sets above.
    function filterRegions(): void {
        const Search_Text = Search_Input.value.trim().toLocaleLowerCase();
        Region_Buttons.forEach((Button, Index) => {
            Button.hidden = !All_Regions[Index].statnaam.toLocaleLowerCase().includes(Search_Text);
        });
    }
    Search_Input.oninput = filterRegions;
    filterRegions();

    // Use the same state for button feedback, counts and the matrix.
    function updateSelection(): void {
        Region_Count.textContent = `${Selected_Regions.size}/10 selected`;
        Attribute_Count.textContent = `${Selected_Attributes.size}/5 selected`;
        Region_Buttons.forEach((Button, Index) => {
            const Is_Active = Selected_Regions.has(All_Regions[Index].statcode);
            Button.setAttribute("aria-pressed", String(Is_Active));
            Button.disabled = !Is_Active && Selected_Regions.size >= 10;
        });
        Attribute_Buttons.forEach((Button, Index) => {
            const Is_Active = Selected_Attributes.has(Attributes[Index].Key);
            Button.setAttribute("aria-pressed", String(Is_Active));
            Button.disabled = !Is_Active && Selected_Attributes.size >= 5;
        });
        On_Selection_Change(
            All_Regions.filter(Region => Selected_Regions.has(Region.statcode)),
            Attributes.filter(Attribute => Selected_Attributes.has(Attribute.Key)).map(Attribute => Attribute.Key)
        );
    }
    updateSelection();
}
