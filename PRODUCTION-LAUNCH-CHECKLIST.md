# Production launch checklist

## Already implemented in the site

- Server-side authoritative gate quote: the browser total is never trusted when a lead is stored.
- Lead validation, honeypot and rate limiting.
- Admin authentication with HttpOnly/Secure/SameSite cookie and PBKDF2 password verification.
- D1-backed catalog, price, settings and lead administration.
- Real per-color gate photos with a separate admin upload slot for each popular color.
- Full lead advertising context is captured in `configuration.tracking`: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `yclid`, `gclid`, referrer and landing page.
- Cloudflare production deploy is automatically verified after every push to `main`.

## Required before scaling Russian paid traffic

### 1. Move personal-data storage to Russian infrastructure

The current `/api/leads` endpoint stores customer name, phone, settlement and order details in Cloudflare D1. Before scaling paid traffic from Russia, review the personal-data architecture with a specialist and, if required, move the primary storage of Russian customer personal data to infrastructure physically located in Russia.

Recommended migration shape:

1. Keep the current public UI and calculator unchanged.
2. Replace the storage implementation behind `/api/leads` with a Russian-hosted backend/database.
3. Keep the same JSON contract so the front end does not need to change.
4. Move admin lead reading/updating to the same Russian backend.
5. Re-check consent text, privacy policy, retention period, cross-border transfers and analytics/cookie wording against the final architecture.
6. Test a real lead end-to-end before switching production traffic.

Do not delete the current D1 implementation until export/backup and migration verification are complete.

### 2. Connect the final branded domain

Recommended order:

1. Attach the final domain/subdomain to the Cloudflare Worker.
2. Verify HTTPS.
3. Replace the hard-coded `workers.dev` canonical/OG values in the source with the final domain.
4. Add a permanent redirect from the technical Worker URL if the platform setup allows it.
5. Add `robots.txt` and `sitemap.xml` only after the final domain is known, so search engines never receive a sitemap with a temporary hostname.
6. Register the final site in Yandex Webmaster and Google Search Console if required.

The public script already updates canonical/OG at runtime on a non-technical host as a safety net, but the final source HTML should still use the branded domain.

### 3. Configure instant lead notifications

The Worker supports:

- `LEAD_NOTIFY_WEBHOOK_URL`
- optional `LEAD_NOTIFY_WEBHOOK_TOKEN`

Configure a real notification endpoint so a new lead reaches the owner/manager immediately even when the admin page is closed. Keep the 1.5 second webhook timeout so lead saving never depends on the external notification service.

### 4. Add production proof content

Do not invent reviews. Add only real assets:

- workshop/production photos;
- powder coating / preparation photos;
- installation photos;
- completed objects with settlement + article + dimensions when known;
- verified customer reviews.

This is the highest-value content improvement after the calculator itself.

## Advertising analytics

The site now stores campaign attribution in every lead. Use consistent ad tags, for example:

- `utm_source=yandex`
- `utm_medium=cpc`
- `utm_campaign=<campaign>`
- `utm_content=<ad_or_creative>`
- `utm_term=<keyword>`

Yandex `yclid` is captured automatically when present.

After enough traffic, compare not only cost per click but:

- calculator starts;
- delivery calculations;
- lead submits;
- lead cost;
- lead-to-measurement conversion;
- measurement-to-contract conversion;
- revenue and margin by campaign/creative.
