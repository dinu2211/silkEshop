# SilkEshop

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 20.3.40.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

The home page loads the catalog from the public Supabase `products` table. The Angular
`ProductService` also requests the backend `GET /api/products` endpoint; the development server
proxies `/api` to `http://localhost:8080`, so start the Spring Boot backend on that port while
developing the frontend.

## Product collections, variants, and inventory

Apply `supabase/migrations/20261103000000_add_product_collections_and_variant_prices.sql` to add
the product `collection`, `idealFor`, and `variantPrices` fields. Assign each product a collection
such as `Wedding` or `Silk Collection`; existing products are left unassigned until classified.
The home page filters by collection and displays `idealFor` as a product label. Apply
`supabase/migrations/20261103000001_add_admin_product_management.sql` and
`supabase/migrations/20261103000002_move_product_price_and_stock_to_variants.sql` after the product
collections migration and custom-admin-login migration. The `/manage-products` page uses the same
administrator sign-in as `/view-order` and supports adding and updating catalog details, collections,
and each variant's price and available quantity. The latter migration moves existing product prices
into option variants with zero stock; set quantities in product management to make products
available. Products appear on the home page only when at least one matching variant has stock.

Each `variantPrices` entry contains a price and available quantity for one exact option combination.
Include every option shown for the product category:

```json
[
  {
    "dhotiSize": "8 Mulam",
    "shirtSize": "Medium",
    "sleeveLength": "Full Sleeve",
    "dhotiType": "With Velcro Pocket",
    "price": 4299,
    "quantity": 5
  }
]
```

The selected variant determines the price and available stock.
`idealFor` is descriptive and is not a selectable option.

Apply `supabase/migrations/20261103000003_add_product_image_gallery.sql` after the product
management and variant inventory migrations. It migrates each current `imageUrl` to `imageUrls`,
creates the public `product-images` Storage bucket, and updates the product save RPC. Product images
can be JPEG, PNG, or WebP (up to 5 MB each, six per product). Deploy the protected image function
so only users with a valid `/manage-products` administrator session can upload or delete images:

```bash
npx supabase functions deploy manage-product-images --project-ref krrsrzekaxqfmxfbmlnd
```

The first image is used on the home page and as the product's cart image; product details provides
thumbnails and previous/next controls for the full gallery. Public bucket access is required for
customers to view catalog images.

## Razorpay payments

Checkout creates Razorpay orders and verifies payments through the Supabase Edge Functions;
the Razorpay secret and Supabase service-role key stay on the server. Apply the SQL migrations,
then configure the Razorpay credentials and deploy the functions:

```bash
npx supabase secrets set RAZORPAY_KEY_ID="your_key_id" RAZORPAY_KEY_SECRET="your_key_secret" --project-ref krrsrzekaxqfmxfbmlnd

npx supabase functions deploy create-razorpay-order --project-ref krrsrzekaxqfmxfbmlnd
npx supabase functions deploy verify-razorpay-payment --project-ref krrsrzekaxqfmxfbmlnd
npx supabase functions deploy get-order-payment-status --project-ref krrsrzekaxqfmxfbmlnd
```

The function configuration disables gateway JWT verification so the Supabase publishable key
and browser `OPTIONS` preflight can reach the functions; CORS is handled by the shared function
handler. Payment verification checks the Razorpay signature and captured payment against the
order amount before updating `orders.status` and `orders.payment_status`. The confirmation page
reads the status from the `orders` table through the status function.

## Order management

Apply the order-management and custom-admin-login migrations after the existing order and tracking
migrations. Create an administrator from the Supabase SQL Editor, replacing both placeholders with
new values:

```sql
insert into public.admin_users (user_id, password_hash)
values (
  'YOUR_ADMIN_ID',
  extensions.crypt('CHOOSE_A_NEW_PASSWORD_AT_LEAST_12_CHARACTERS', extensions.gen_salt('bf', 12))
);
```

Only the bcrypt password hash is stored. The `/view-order` page signs in with that admin ID and
password; database functions validate short-lived sessions for every order read and status update.
Use a new password with 12–72 bytes; five incorrect attempts lock that admin account for 15 minutes.
Do not put an unhashed password or Supabase service-role key in the application.

## WhatsApp order confirmations

Apply the WhatsApp consent migration after the existing order-management migrations. Customers can
optionally opt in at checkout; only opted-in customers receive a message when an order changes from
`pending` to `confirmed`, whether payment verification or an administrator performs the transition.
Create and approve a WhatsApp message template named
`order_confirmed` with the body `Your order is confirmed. Your order ID is {{1}}.`. Configure the
exact language code of the approved template translation (for example, `en_US` or `en_GB`); the
template name and language must both exist in the WhatsApp Business Account associated with the
sender's phone-number ID. The WhatsApp Business sender must be registered with Meta Cloud API. The
business phone number `8667218771` is the sender identity; Meta's phone-number ID and a permanent
access token are separate values and must be obtained from the WhatsApp business account.

For Meta's sample `hello_world` template, set `WHATSAPP_ORDER_CONFIRMED_TEMPLATE="hello_world"` and
`WHATSAPP_TEMPLATE_LANGUAGE="en_US"`. That sample has no parameters, so it sends its fixed greeting
without the order ID. The `order_confirmed` template above expects one body parameter for the order
ID.

Configure the Edge Function secrets on the server, using the API version currently supported by
your Meta app and the phone-number ID shown in WhatsApp Manager:

```bash
npx supabase secrets set WHATSAPP_PHONE_NUMBER_ID="your_phone_number_id" WHATSAPP_ACCESS_TOKEN="your_access_token" WHATSAPP_ORDER_CONFIRMED_TEMPLATE="order_confirmed" WHATSAPP_TEMPLATE_LANGUAGE="your_exact_template_language_code" WHATSAPP_API_VERSION="v25.0" --project-ref krrsrzekaxqfmxfbmlnd
npx supabase functions deploy update-admin-order-status --project-ref krrsrzekaxqfmxfbmlnd
npx supabase functions deploy verify-razorpay-payment --project-ref krrsrzekaxqfmxfbmlnd
```

For error `132001`, check that the template name is exactly `order_confirmed`, that its translation
is approved in the configured language, and that it belongs to the same WhatsApp Business Account
as `WHATSAPP_PHONE_NUMBER_ID`. Then set `WHATSAPP_TEMPLATE_LANGUAGE` to that translation's exact
language code and redeploy the function.

Delivery errors do not undo the order status update; the admin page reports when confirmation could
not be sent. Messages are sent through Meta's approved template API.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.



Firebase FE deploy
<!-- -------------------------------------- -->
ng build --configuration production    
 firebase deploy      


to delete function

npx supabase functions delete create-razorpay-order --project-ref krrsrzekaxqfmxfbmlnd
npx supabase functions delete verify-razorpay-payment --project-ref krrsrzekaxqfmxfbmlnd
npx supabase functions delete get-order-payment-status --project-ref krrsrzekaxqfmxfbmlnd



npx supabase secrets set RAZORPAY_KEY_ID="your_key_id" RAZORPAY_KEY_SECRET="your_key_secret" --project-ref krrsrzekaxqfmxfbmlnd