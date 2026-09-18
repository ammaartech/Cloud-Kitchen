# SEO: getting Infinity Kitchens to the top for its own name

Goal: a search for **infinity kitchens**, **infinity kitchens blr**, **infinity
kitchens bangalore** or **infinity kitchens bengaluru** returns this site first
on Google and Bing, with a Google Business Profile panel beside it.

The code side is done (see "What the site already does"). Everything below is
work outside the repository, in rough order of impact. Do the first three
sections in the first week; they account for most of the result.

## 1. Make the site reachable (deploy checklist)

A crawler cannot rank what it cannot fetch. Confirm each of these on the
production deployment, not a preview:

- [ ] A real domain is attached to the Vercel project. Pick one host as
      canonical (`www.` or the apex) and let Vercel redirect the other to it.
- [ ] `NEXT_PUBLIC_SITE_URL` is set on Vercel to that exact `https://` host, no
      trailing slash. Every canonical tag, sitemap URL and share image URL is
      built from it. If it still says `localhost`, redeploy after fixing it.
- [ ] Vercel **Deployment Protection** is off for the production environment
      (Settings > Deployment Protection). Password protection or Vercel
      Authentication on production returns a login page to Googlebot.
- [ ] `https://<domain>/robots.txt` loads and does **not** say `Disallow: /`.
- [ ] `https://<domain>/sitemap.xml` loads and lists the home, menu,
      subscriptions, about pages and one URL per plan.
- [ ] `http://<domain>/` redirects to `https://`.
- [ ] The placeholder email and Instagram handle in
      `src/components/site/contact.tsx` are replaced with real ones. They are
      live links in the footer.

## 2. Verify ownership in Google Search Console and Bing

**Google Search Console** (search.google.com/search-console):

1. Add a property. Choose **Domain** if you control the domain's DNS: it covers
   `www`, the apex, `http` and `https` in one property. Add the TXT record it
   gives you at your DNS provider, wait a few minutes, click Verify.
2. If DNS is not in reach, choose **URL prefix** with the full `https://` URL
   and the **HTML tag** method. Copy only the `content="..."` value into the
   Vercel environment variable `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`,
   redeploy, then click Verify. The site emits the tag on every page.
3. Sitemaps > add `sitemap.xml` > Submit.
4. URL Inspection > paste the home page URL > **Request indexing**. Repeat for
   `/menu` and `/subscriptions`. This is what gets a new site into the index in
   days rather than weeks.
5. After a week, check Pages (indexing) for anything "Excluded" that should
   not be, and Performance filtered by query containing "infinity".

**Bing Webmaster Tools** (bing.com/webmasters): choose "Import from Google
Search Console" and it copies the verified property and sitemap in one step.
If you prefer the tag method, the token goes in
`NEXT_PUBLIC_BING_SITE_VERIFICATION`. Bing also feeds DuckDuckGo and Yahoo.

## 3. Google Business Profile (the biggest single lever)

For a query with a place name in it, Google shows a business panel and a map
before the blue links. Without a profile the site can rank first and still
look second.

- Create the profile at business.google.com. Business name exactly
  **Infinity Kitchens**, nothing appended.
- Type: a **service-area business** with no storefront address shown. Set the
  service area to North Bengaluru neighbourhoods (Hebbal, Yelahanka, Sahakar
  Nagar, Manyata area, and so on, matching the delivery zone).
- Primary category **Meal delivery**; secondary **Food delivery service** and
  **South Indian restaurant**.
- Phone: the WhatsApp number on the site. Website: the domain. Menu link:
  `https://<domain>/menu`. Order link: `https://<domain>/subscriptions`.
- Upload the four hero dish photographs and the logo. Add the plan names as
  products with prices.
- Reviews: after a subscriber's first week, send the profile's review link
  over WhatsApp. Ten genuine reviews with the words "meal subscription" and
  "Bangalore" in them do more for the city query than any other single step.
- Post an update once a fortnight (a new dish, a plan). Profiles that are
  touched rank above ones that are not.

## 4. Backlink strategy

Brand-name queries need surprisingly few links, but they need the *right*
ones: pages that confirm to search engines that "Infinity Kitchens" is a real
food business in Bengaluru. Consistency matters more than volume. On every
listing use the same name (**Infinity Kitchens**), the same phone number and
the same website URL, and describe it the same way: home-style South Indian
meal subscriptions, North Bangalore.

### Tier 1: foundational listings (week 1, an afternoon's work)

Each is free and each links, or at least cites, the site.

| Where | What to do |
| --- | --- |
| Google Business Profile | Section 3 above |
| Bing Places | Import from Google Business Profile |
| Apple Business Connect | Same details; feeds Apple Maps and Siri |
| Zomato and Swiggy | Where the kitchen is listed, put the website in the profile and use the identical name |
| Justdial, Sulekha | Free listing, category "Tiffin Services" or "Meal Delivery" |
| Instagram | Bio link to the site; handle matching `CONTACT.instagramHandle` |
| Facebook page | Website field, same phone, same description |
| LinkedIn company page | Website field. Also link from the founders' profiles |
| WhatsApp Business | Business profile with the website URL and address city |
| YouTube channel | Even empty, the About page can carry the link |

### Tier 2: local and niche (month 1 to 2)

- **Bengaluru food and lifestyle directories**: LBB Bangalore, Magicpin,
  EazyDiner, WhatsHot Bangalore. Submit a listing or pitch a short feature.
- **Where the customers already are**: tech parks and office complexes in
  North Bangalore often keep a vendor or food-options page on their intranet
  or resident portal. Apartment RWAs and PG operators maintain lists of
  tiffin services. Ask to be added; offer a resident code (the site's coupon
  system already supports it).
- **Community**: r/bangalore and local Facebook groups allow business
  introductions in their weekly threads. Follow each group's rules; one honest
  post with the link beats ten deleted ones.
- **Suppliers and partners**: a packaging supplier, a delivery partner, an
  accountant who lists clients. A "who we work with" link is a real
  endorsement.

### Tier 3: earned coverage (ongoing)

- **Local press**: Bangalore Mirror, Deccan Herald Metrolife, The Hindu
  MetroPlus, YourStory and Bangalore-focused newsletters run small-business
  and food pieces. The angle that works is the one the About page already
  makes: one kitchen, one small menu, and why the constraint is deliberate.
- **Micro-influencers**: Bengaluru food creators with 5k to 50k followers.
  A week's free plan for an honest post and a bio-link story is the standard
  trade. Ask for the website link, not just a tag.
- **Customer stories**: a subscriber with a blog, a newsletter or a company
  page who is happy to write a line and link.

### Rules

- Anchor text should be the brand name, the brand plus city, or the bare URL.
  Never buy links, join link exchanges, or use directories that exist only
  to sell links. One bad neighbourhood costs more than fifty good listings
  gain.
- Keep a sheet: target, contact, status, live URL, date. Check Search
  Console > Links monthly to see which are being counted.
- Every link should point at the canonical host from section 1. Links to a
  `.vercel.app` URL or the wrong `www` variant are diluted through a redirect.

## 5. What the site already does

Nothing here needs repeating, but everything here should be kept consistent
when copy changes:

- Home page title is brand-first with the city:
  "Infinity Kitchens · Home-style meal subscriptions in Bengaluru". Every other
  page ends in "· Infinity Kitchens".
- Structured data on the home page declares a `FoodEstablishment` named
  Infinity Kitchens with the alternate names "Infinity Kitchens Bengaluru",
  "Infinity Kitchens Bangalore" and "Infinity Kitchens BLR", the Bengaluru
  address locality, the WhatsApp number and the menu URL. Plan pages carry
  `Product` and `Offer` data with INR prices.
- Canonical URL on every page, `robots.txt`, `sitemap.xml`, an Open Graph
  share image, `noindex` on every private or transactional route, HSTS.
- URL slugs are lowercase and hyphenated, and the admin screens normalise
  whatever is typed into a slug field.

## 6. What to expect

A new domain typically appears for its own exact name within one to three
weeks of being indexed and listed on Google Business Profile. The city
variants follow once the profile has a few reviews and the Tier 1 listings
are live. If the exact brand query does not show the site after four weeks,
the cause is almost always one of the reachability items in section 1.
