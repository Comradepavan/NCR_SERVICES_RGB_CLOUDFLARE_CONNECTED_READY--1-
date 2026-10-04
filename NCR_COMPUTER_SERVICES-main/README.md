# NCR SERVICES — Premium E-commerce + Service Website

## Login reliability update (v7.1)
- Admin login clears stale browser sessions before a new sign-in.
- Login warms the backend with `/api/health` and automatically retries transient 502/503/504 or network failures.
- Customer pages now include a visible **Admin Login** entry in the main navigation and mobile navigation.

This package contains the NCR SERVICES customer frontend, Node.js backend and admin control panel.

## Important workflow

1. Open the extracted project folder in VS Code.
2. Run `npm install`.
3. Run `npm start` to test the real backend.
4. Do **not** use VS Code Live Server for the final website.
5. For Render, use a Node Web Service with build command `npm install` and start command `npm start`.
6. The customer frontend and `/api` backend are served from the same domain on Render.
7. When the frontend is opened from GitHub Pages (or directly as a file), the frontend automatically uses the default Render API URL `https://ncr-services.onrender.com/api`. To use a different Render/custom API URL, define `window.NCR_API_BASE` before loading `app.js`.

## Admin

Open `/admin/login.html` after the server is running.

Default login: `admin@ncrservices.local` / `7730` (change from Admin → Settings).

Admin features include:
- Add/edit/delete products
- Multiple product photo upload from one file picker, with customer product gallery
- Coupon management (percentage or fixed discount, minimum order, max discount, usage limit, start/expiry, active/disable)
- Automatic SKU generation
- Stock + / − controls
- Duplicate-submission protection for product creation
- Orders with status changes
- Individual order deletion and Clear All Orders
- Bill / Invoice and WhatsApp PDF-link action
- Service requests with status, reply, WhatsApp reply, delete and Clear All
- Admin email/password change
- Business settings

## Customer

- Products, Add to Cart and Buy Now
- Stock-aware cart and checkout
- Customer coupon code entry and server-side coupon validation at checkout/order placement
- Server-side stock validation and stock decrement after a successful order
- A4 quotation with aligned customer information and visible barcode
- A4 invoice/bill with aligned information and visible barcode
- Quotation WhatsApp PDF link
- Invoice WhatsApp PDF link
- No GST/tax calculation
- 2-year warranty wording

## Duplicate protection

Customer orders, quotations and service requests, and admin product creation use a request ID plus server-side idempotency storage. A double-click or retry with the same request ID returns the original record instead of creating a second record.
