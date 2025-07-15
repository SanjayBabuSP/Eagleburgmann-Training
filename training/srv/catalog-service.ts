import cds, { Service } from "@sap/cds";

export default class CatalogService extends cds.ApplicationService {
  async init() {
    const { Orders } = this.entities;
    this.on("READ", Orders, async () => {
      const filteredQuery = SELECT.from(Orders).where("quantity >", 90);
      await cds.run(filteredQuery);
      return super.init();
    });
  }
}
