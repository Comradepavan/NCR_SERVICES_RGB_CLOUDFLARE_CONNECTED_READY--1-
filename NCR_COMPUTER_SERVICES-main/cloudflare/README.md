# NCR SERVICES — Cloudflare Pro Architecture

This folder is the migration layer for the advanced Cloudflare build.

Target architecture:
- Cloudflare Workers: API/backend
- D1: products, stock, orders and persistent business data
- R2: product photos and uploaded media
- Cloudflare edge network: low-latency delivery and caching

## First deployment
1. Create a D1 database named `ncr-services-db`.
2. Create an R2 bucket named `ncr-services-products`.
3. Put the D1 database ID into `wrangler.jsonc`.
4. Run the migration SQL in `migrations/0001_initial.sql`.
5. Deploy the Worker with Wrangler.

This migration layer does NOT replace the working Render backend automatically. Keep Render running until the Cloudflare API passes product, admin, order, payment and upload tests.
