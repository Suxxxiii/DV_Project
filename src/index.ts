import { loadBubbleMatrix } from "./bubbleMatrix";

loadBubbleMatrix().catch(Error_Message => {
  console.error(Error_Message);
  document.getElementById("multivariateVis")!.textContent = "Could not load bubble matrix data.";
});
