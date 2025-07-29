import Controller from "sap/fe/core/PageController";
import ODataModel from "sap/ui/model/odata/v4/ODataModel";
import View from "sap/ui/core/mvc/View";
/**
 * @namespace eagleburgmann.training.orders.ext.main
 */
export default class Main extends Controller {
  public onInit(): void {
    const view = this.getView() as View;
    const oDataModel = new ODataModel({
      serviceUrl: "/odata/v4/Orders/",
    });
    view.setModel(oDataModel);
  }
  /**
   * Called when a controller is instantiated and its View controls (if available) are already created.
   * Can be used to modify the View before it is displayed, to bind event handlers and do other one-time initialization.
   * @memberOf eagleburgmann.training.orders.ext.main.Main
   */
  // public onInit(): void {
  //     super.onInit(); // needs to be called to properly initialize the page controller
  //}
  /**
   * Similar to onAfterRendering, but this hook is invoked before the controller's View is re-rendered
   * (NOT before the first rendering! onInit() is used for that one!).
   * @memberOf eagleburgmann.training.orders.ext.main.Main
   */
  // public  onBeforeRendering(): void {
  //
  //  }
  /**
   * Called when the View has been rendered (so its HTML is part of the document). Post-rendering manipulations of the HTML could be done here.
   * This hook is the same one that SAPUI5 controls get after being rendered.
   * @memberOf eagleburgmann.training.orders.ext.main.Main
   */
  // public  onAfterRendering(): void {
  //
  //  }
  /**
   * Called when the Controller is destroyed. Use this one to free resources and finalize activities.
   * @memberOf eagleburgmann.training.orders.ext.main.Main
   */
  // public onExit(): void {
  //
  //  }
}
