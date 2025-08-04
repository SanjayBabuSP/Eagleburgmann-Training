import cds from "@sap/cds";
const { SELECT, UPDATE, INSERT, DELETE } = cds.ql;
class CatalogService extends cds.ApplicationService {
  async filteredQueryOrders() {
    const { Orders } = this.entities;
    const filteredQuery = SELECT.from(Orders).where("quantity >", 90);
    const results = await cds.run(filteredQuery);
    return results;
  }

  async init() {
    const { Orders } = this.entities;
    //this.on("READ", Orders, this.filteredQueryOrders.bind(this));

    return super.init();
  }
}

module.exports = { CatalogService };
