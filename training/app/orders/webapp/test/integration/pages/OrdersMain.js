sap.ui.define(["sap/fe/test/TemplatePage"], function (TemplatePage) {
  "use strict";

  var CustomPageDefinitions = {
    actions: {},
    assertions: {},
  };

  return new TemplatePage(
    "eagleburgmann.training.orders::OrdersMain",
    CustomPageDefinitions,
  );
});
