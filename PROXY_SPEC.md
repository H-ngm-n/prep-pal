# Price/location proxy spec (`PRICE_API_URL`)

The app never calls the Kroger API directly, because client secrets can't live in a browser app.
Instead it calls a small proxy you run (Cloudflare Worker, Vercel function, etc.) that holds Kroger
API credentials (client_credentials OAuth, scope `product.compact`) and forwards requests to
`https://api.kroger.com/v1/locations` and `/v1/products`.
Set `PRICE_API_URL` in `storage.js` to the proxy base URL (blank by default = estimated `prices.json` only).

## GET {PRICE_API_URL}/locations?zip=48170&chain=Kroger
Maps to Kroger `GET /v1/locations?filter.zipCode.near={zip}&filter.chain={CHAIN}&filter.limit=10`.
Response (JSON array):
```json
[{"locationId":"01800123","name":"Kroger - Plymouth","address":"…, Plymouth, MI 48170","chain":"Kroger"}]
```
`chain` is one of: Kroger, Ralphs, Fred Meyer, King Soopers, Fry's, Smith's, QFC, Harris Teeter, Mariano's, Pick 'n Save, Dillons.

## GET {PRICE_API_URL}/products?locationId=01800123&items=chicken_breast,rice_white,…
For each app ingredient id, the proxy runs a Kroger product search (`filter.term`, `filter.locationId`). It picks the best
match (the proxy owns the id → search-term mapping, e.g. `rice_white` → "long grain white rice 5 lb") and returns:
```json
[{"item_id":"rice_white","product":"Kroger Long Grain White Rice","package_size":"5 lb","package_grams":2268,
  "price":5.49,"unit_price":1.10,"unit":"per lb","last_updated":"2026-10-18",
  "aisleLocations":[{"number":"12","description":"Rice & Beans"}],
  "source_url":"https://www.kroger.com/p/…"}]
```
- `price` = `items[0].price.promo || items[0].price.regular` from Kroger.
- `package_grams` comes from parsing `items[0].size`. Leave out any product whose size can't be parsed.
- `aisleLocations` is passed through from Kroger as is. The app shows "Aisle {number}" only when it's present and never makes one up.
- Items left out of the response fall back to the estimated `prices.json` row.

CORS: allow the app's origin. Cache responses for about 6 h to stay within Kroger rate limits.

## Adding another chain
Register a provider in `providers.js` with `searchLocations(zip, chain)` and `getProducts(itemIds, locationId, chain)`.
Both return the shapes above, with `aisle` already formatted or `null`. Then map the chain in `CHAIN_PROVIDER`.
Chains without real data (Aldi, Meijer, Trader Joe's today) use the `static` provider: estimated prices, no
location search, and section-based grouping only.
