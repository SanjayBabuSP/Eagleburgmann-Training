namespace eagleburgmann.training;
 
entity Category {
  key ID       : UUID;
      name     : String(100);
  parent       : Association to Category;
  subCategories: Association to many Category on subCategories.parent = $self;
  catalog      : Association to Catalog;
  products     : Association to many Product on products.category = $self;
}
 
entity Product {
  key ID         : UUID;
      name       : String(100);
      price      : Decimal(10,2);
      category   : Association to Category;
      catalog    : Association to Catalog;
}
 
entity Catalog {
  key ID         : UUID;
      name       : String(100);
  categories     : Association to many Category on categories.catalog = $self;
}
 
entity User {
  key ID         : UUID;
      username   : String(50);
      email      : String(100);
      address    : Association to Address;
  orders         : Association to many Order on orders.user = $self;
}
 
entity Address {
  key ID         : UUID;
      street     : String(100);
      city       : String(50);
      zip        : String(20);
      country    : String(50);
}
 
entity Order {
  key ID         : UUID;
      user       : Association to User;
      product    : Association to Product;
      quantity   : Integer;
      orderDate  : DateTime;
      shippingAddress : Association to Address;
}