using CatalogService as service from '../../srv/catalog-service';
 
annotate service.Orders with @(
  UI.PresentationVariant: {
    Text          : 'Default',
    Visualizations: ['@UI.LineItem'],
    SortOrder     : [{
      $Type     : 'Common.SortOrderType',
      Property  : ID,
      Descending: false
    }]
  },
  UI.SelectionFields: [
    quantity,
    orderDate
  ],
  UI.LineItem: [
    {
      $Type : 'UI.DataField',
      Value : ID,
      Label : '{i18n>ID}'
    },
    {
      $Type : 'UI.DataField',
      Value: quantity,
      Label : '{i18n>quantity}'
    },
    {
      $Type : 'UI.DataField',
      Value : orderDate,
      Label : '{i18n>orderDate}'
    }
  ]
);