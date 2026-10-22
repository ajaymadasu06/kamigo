KAMIGO — FINAL PROJECT (v4)
===========================
Static website + Firebase (Auth, Firestore, Storage, Hosting, optional Cloud Functions).

PAGES
  index.html      Public site (booking, profile, chat, reviews, EN/తెలుగు/हिन्दी)
  admin.html      Staff portal (roles: admin / support)
  provider.html   Technician page (sees only assigned jobs)
  privacy.html, terms.html   Legal pages (TEMPLATES - see "Before launch")

=== 1. DEPLOY (in this order) ==========================================
 a) Firestore rules : Console -> Firestore -> Rules -> paste firestore.rules -> Publish
 b) Storage         : Console -> Storage -> Get started, then Rules -> paste storage.rules -> Publish
                      (needed for booking photos; cross-service rules may ask you to grant an IAM role)
 c) Site files      : upload everything (or `firebase deploy --only hosting,firestore:rules,storage`)
 d) Hard refresh    : Ctrl+Shift+R. Add your domain to Authentication -> Settings -> Authorized domains.
 e) Staff access    : create Firestore docs  admins/{your-google-uid}  =>  { role: "admin" }
                      (use "support" for chat + read-only staff). UID is shown in Authentication -> Users.
 f) Technicians     : Admin -> Technicians -> add their Google email; they sign in at provider.html.

=== 2. REPLACE THESE PLACEHOLDERS ======================================
  - index.html / sitemap.xml / robots.txt : "https://kamigo-bb729.web.app" -> your real domain
  - privacy.html / terms.html : every [bracketed] item (business name, address, contact emails, retention, payment terms)
  - js/config.js : KAMIGO_WHATSAPP (e.g. '919876543210'), KAMIGO_APPCHECK_KEY (reCAPTCHA v3 site key)

=== 3. BEFORE LAUNCH ===================================================
  - Have a lawyer review privacy.html and terms.html (Digital Personal Data Protection Act, 2023). Users must be 18+.
  - Google Cloud Console -> APIs & Services -> Credentials: restrict the browser API key to your domain(s).
  - Optional App Check: register reCAPTCHA v3 in Console -> App Check, put the SITE key in js/config.js,
    watch metrics, then enforce for Firestore and Storage.
  - Run the rules tests:   npm install   then   npm run test:rules   (needs Java + Firebase CLI). NOT yet run by the author.
  - Customers with an older phone format or no consent record must open My profile and save once.

=== 4. OPTIONAL SERVER FEATURES (Blaze plan) ===========================
  Email alerts, account erasure and nightly backups live in functions/.
   1. Install the "Trigger Email from Firestore" extension (collection: mail) and set your SMTP details.
   2. cd functions && cp .env.example .env  and set ADMIN_EMAILS (comma separated) and BACKUP_BUCKET (bucket name).
   3. firebase deploy --only functions
   4. Backups: in Google Cloud IAM give the functions service account the roles
      "Cloud Datastore Import Export Admin" and "Storage Admin" on the backup bucket.
  What they do: new booking -> team email | status/assignment change -> customer/technician email |
  reschedule -> team email | customer chat message -> team email | deletion request -> erases that customer's
  profile, bookings, photos, chats, reviews, notes and sign-in | nightly Firestore export at 02:00 IST.

=== 5. FEATURE LIST ====================================================
 Customers : Google sign-in, profile (home + work address, +91 phone validation, 18+ consent), booking form with
             time slot / PIN-code area check / address / coupon / up to 3 photos, live order tracking
             (Received -> Confirmed -> On the way -> Completed), cancel, reschedule, book again, printable receipt,
             1-5 star reviews, unread chat badge, delete my account & data, installable app (PWA), WhatsApp button.
 Admin     : live bookings + alerts (sound/desktop), pending-over-15-minutes warning, filters, CSV export,
             technician assignment, final amount, photo viewer, insights + monthly report (CSV), customer history
             with private notes, canned chat replies, resolve/reopen chats, services/rates, coupons, service-area PINs,
             audit log, deletion requests, website error log.
 Security  : verified Google email, role-based rules, server timestamps, field validation, 30 s booking throttle,
             append-only audit log, size-limited photo uploads, security headers (Hosting).

=== 6. NOT INCLUDED ====================================================
  Online payments (Razorpay/UPI: needs your merchant keys + server verification), phone-number OTP (SMS billing + India DLT
  registration), push notifications (needs FCM setup + server), referral/wallet credits, subscriptions.

TROUBLESHOOTING
  "permission-denied" on screen  -> rules not published (step 1a/1b) or you are not signed in with Google.
  Photos fail to upload          -> Storage not enabled / storage.rules not published. The booking still goes through.
  Chat/booking worked before but fails now -> republish firestore.rules (new fields are validated).
