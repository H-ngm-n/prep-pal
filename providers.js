/* Pluggable store providers. Every provider implements:
     searchLocations(zip, chain) -> Promise<[{locationId, name, address, chain}]>   (or [] if unsupported)
     getProducts(itemIds, locationId, chain) -> Promise<[{item_id, product, package_size, package_grams,
                     price, unit_price?, aisle|null, last_updated, source_url}]>
   and the flags `live` (has real data now) and `hasAisles`.
   Add a chain by registering a provider in PROVIDERS and mapping it in CHAIN_PROVIDER. */
const KROGER_FAMILY = ['Kroger','Ralphs','Fred Meyer','King Soopers',"Fry's","Smith's",'QFC','Harris Teeter',"Mariano's","Pick 'n Save",'Dillons'];
const ALL_CHAINS = ['Aldi','Meijer',"Trader Joe's",...KROGER_FAMILY];

const PROVIDERS = {
  kroger: {
    name:'Kroger Locations/Products API (via your proxy)',
    get live(){ return !!PRICE_API_URL; }, hasAisles:true,
    async searchLocations(zip, chain){
      if (!PRICE_API_URL) return [];
      const r = await fetch(`${PRICE_API_URL.replace(/\/$/,'')}/locations?zip=${encodeURIComponent(zip)}&chain=${encodeURIComponent(chain)}`);
      if (!r.ok) throw new Error('Location lookup failed: '+r.status);
      return (await r.json()).map(l=>({locationId:l.locationId, name:l.name, address:l.address, chain:l.chain||chain}));
    },
    async getProducts(itemIds, locationId, chain){
      if (!PRICE_API_URL || !locationId) return [];
      const r = await fetch(`${PRICE_API_URL.replace(/\/$/,'')}/products?locationId=${encodeURIComponent(locationId)}&items=${itemIds.join(',')}`);
      if (!r.ok) throw new Error('Product lookup failed: '+r.status);
      return (await r.json()).map(p=>{
        const a = p.aisleLocations && p.aisleLocations[0];
        return {item_id:p.item_id, store:chain, product:p.product, package_size:p.package_size, package_grams:+p.package_grams,
          price:+p.price, unit_price:p.unit_price??null, unit:p.unit||'', aisle: a && a.number ? 'Aisle '+a.number : null,
          last_updated:p.last_updated || new Date().toISOString().slice(0,10), estimated:false, live:true, source_url:p.source_url||'https://www.kroger.com/'};
      });
    }
  },
  // Chains with no public price/aisle API: estimated prices.json only, no location search, section grouping.
  static: { name:'Estimated prices (prices.json)', live:false, hasAisles:false,
    async searchLocations(){ return []; }, async getProducts(){ return []; } }
};
const CHAIN_PROVIDER = chain => KROGER_FAMILY.includes(chain) ? PROVIDERS.kroger : PROVIDERS.static;
