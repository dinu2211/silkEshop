# SilkEshop

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 20.3.40.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

The product catalog loads from the public Supabase `products` table. No separate Spring Boot
backend or Tomcat server is required; run the Angular development server with `ng serve`.

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
Apply `supabase/migrations/20261104000000_deduct_stock_on_order_confirmation.sql` after the product
inventory, image gallery, custom-admin-login, and WhatsApp order-confirmation migrations. It deducts
the ordered variant quantities atomically when an administrator confirms an order or Razorpay
payment is verified; orders that exceed available stock cannot be confirmed.

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
migrations. Apply `supabase/migrations/20261106000000_add_promotions_and_admin_screen_access.sql`
after the country-on-orders migration, then apply
`supabase/migrations/20261107000000_add_product_approval_workflow.sql` followed by
`supabase/migrations/20261108000000_stage_product_changes_for_approval.sql`. Product submissions
and edits are stored in `product_approval_queue`; the live `products` table changes only after an
administrator with `manage-promo` access approves the submission in the first tab of `/manage-promo`.
For an existing product, customers continue to see the last approved version until approval. The
second tab manages promo codes. Existing products are marked approved by the first approval
migration. Create an administrator from the Supabase SQL Editor,
replacing the placeholders with new values:

```sql
insert into public.admin_users (user_id, password_hash, screen_access)
values (
  'YOUR_ADMIN_ID',
  extensions.crypt('CHOOSE_A_NEW_PASSWORD_AT_LEAST_12_CHARACTERS', extensions.gen_salt('bf', 12)),
  array['manage-products', 'manage-orders', 'manage-promo']
);
```

Only the bcrypt password hash is stored. The `screen_access` column controls the `/manage-products`,
`/view-order`, and `/manage-promo` screens. Grant existing administrators promo access in the SQL
Editor with
`update public.admin_users set screen_access = array_append(screen_access, 'manage-promo') where user_id = 'YOUR_ADMIN_ID';`.
The promo page checks this permission in the database, and promo reads and writes enforce it
server-side. Admin sessions are short-lived and use the same credentials across management screens.
Use a new password with 12–72 bytes; five incorrect attempts lock that admin account for 15 minutes.
Do not put an unhashed password or Supabase service-role key in the application.

Promo codes can be percentage-based (up to 100%) or fixed INR amounts. Inactive promos cannot be
applied. Checkout validates codes through Supabase and the order-creation function independently
revalidates and stores the final discount, which is deducted from the Razorpay payment amount.

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