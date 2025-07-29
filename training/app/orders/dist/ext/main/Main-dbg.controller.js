sap.ui.define(["sap/fe/core/PageController", "sap/ui/model/odata/v4/ODataModel"], function (Controller, ODataModel) {
  "use strict";

  /**
   * @namespace eagleburgmann.training.orders.ext.main
   */
  const Main = Controller.extend("eagleburgmann.training.orders.ext.main.Main", {
    onInit: function _onInit() {
      const view = this.getView();
      const oDataModel = new ODataModel({
        serviceUrl: "/odata/v4/Orders/"
      });
      view.setModel(oDataModel);
    }
  });
  return Main;
});
//# sourceMappingURL=Main-dbg.controller.js.map
