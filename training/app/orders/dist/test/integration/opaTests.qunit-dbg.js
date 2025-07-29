sap.ui.require(
  [
    "sap/fe/test/JourneyRunner",
    "com/coe/orders/test/integration/FirstJourney",
    "com/coe/orders/test/integration/pages/OrdersMain",
  ],
  function (JourneyRunner, opaJourney, OrdersMain) {
    "use strict";
    var JourneyRunner = new JourneyRunner({
      // start index.html in web folder
      launchUrl: sap.ui.require.toUrl("com/coe/orders") + "/index.html",
    });

    JourneyRunner.run(
      {
        pages: {
          onTheOrdersMain: OrdersMain,
        },
      },
      opaJourney.run,
    );
  },
);
