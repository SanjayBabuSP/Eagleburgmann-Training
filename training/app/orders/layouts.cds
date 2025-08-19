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
    orderDate,
    user.username,
    product.name,
    shippingAddress.city
  ],
  UI.LineItem: [
    {
      $Type : 'UI.DataField',
      Value : ID,
      Label : '{i18n>ID}'
    },
    {
      $Type : 'UI.DataField',
      Value : quantity,
      Label : '{i18n>quantity}'
    },
    {
      $Type : 'UI.DataField',
      Value : orderDate,
      Label : '{i18n>orderDate}'
    },
    {
      $Type : 'UI.DataField',
      Value : user_ID,
      Label : '{i18n>userName}'
    },
    {
      $Type : 'UI.DataField',
      Value : product.name,
      Label : '{i18n>productName}'
    },
    {
      $Type : 'UI.DataField',
      Value : shippingAddress.city,
      Label : '{i18n>shippingCity}'
    }
  ]
);