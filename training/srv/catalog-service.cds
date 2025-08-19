using { eagleburgmann.training as training } from '../db/schema';

service CatalogService {
  entity Categories as projection on training.Category;
  entity Products   as projection on training.Product;
  entity Catalogs   as projection on training.Catalog;
  entity Users      as projection on training.User;
  entity Addresses  as projection on training.Address;

  @odata.draft.enabled
  entity Orders as projection on training.Order;
}
