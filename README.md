# SilkEshop

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 20.3.40.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

The product list is loaded from the backend `GET /api/products` endpoint. The Angular
development server proxies `/api` to `http://localhost:8080`; start the Spring Boot backend
on that port while developing the frontend.

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



npx supabase secrets set RAZORPAY_KEY_ID="rzp_live_Trn0CrmXdsrxJD" RAZORPAY_KEY_SECRET="6XDrOp6FZ3W25XrSzBOz7UAY" --project-ref krrsrzekaxqfmxfbmlnd