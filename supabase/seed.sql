-- =============================================================================
-- Seed: realistic demo data, created through the real schema and the real
-- workflows (PRD 20: "seed realistic dummy data using the real schema and
-- workflows", not frontend-only fake arrays).
-- =============================================================================
-- Subscriptions here are purchased by calling begin_subscription_checkout and
-- confirm_subscription_payment; tickets reach the board by calling
-- release_due_deliveries and ingest_marketplace_order. Nothing is inserted
-- straight into orders or kot_tickets, so if an invariant is broken the seed
-- itself fails.
--
-- Passwords for every demo account: ClaudeKitchen!2026
-- =============================================================================

-- Act as the Developer Admin so permission checks and the audit trail see a
-- real actor rather than an anonymous superuser.
select set_config('app.actor_id', '11111111-1111-4111-8111-111111111111', false);

-- -----------------------------------------------------------------------------
-- Staff and customer auth accounts
-- -----------------------------------------------------------------------------
-- The empty-string token columns are not decoration: Supabase Auth scans them
-- into non-nullable strings, and a NULL makes every login fail with
-- "Database error querying schema".
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data,
   confirmation_token, recovery_token, email_change_token_new, email_change,
   email_change_token_current, phone_change, phone_change_token,
   reauthentication_token,
   created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'dev@cloudkitchen.test',   crypt('ClaudeKitchen!2026', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Dev Admin"}', '', '', '', '', '', '', '', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'owner@cloudkitchen.test', crypt('ClaudeKitchen!2026', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Owner"}', '', '', '', '', '', '', '', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'manager@cloudkitchen.test',crypt('ClaudeKitchen!2026', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Branch Manager"}', '', '', '', '', '', '', '', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-8444-444444444441', 'authenticated', 'authenticated', 'kitchen1@cloudkitchen.test',crypt('ClaudeKitchen!2026', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Kitchen One"}', '', '', '', '', '', '', '', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-8444-444444444442', 'authenticated', 'authenticated', 'kitchen2@cloudkitchen.test',crypt('ClaudeKitchen!2026', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Kitchen Two"}', '', '', '', '', '', '', '', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-8444-444444444443', 'authenticated', 'authenticated', 'kitchen3@cloudkitchen.test',crypt('ClaudeKitchen!2026', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Kitchen Three"}', '', '', '', '', '', '', '', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'authenticated', 'authenticated', 'meera@example.test',      crypt('ClaudeKitchen!2026', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Meera Iyer"}', '', '', '', '', '', '', '', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'authenticated', 'authenticated', 'rahul@example.test',      crypt('ClaudeKitchen!2026', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Rahul Nair"}', '', '', '', '', '', '', '', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaa3-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'authenticated', 'authenticated', 'sana@example.test',       crypt('ClaudeKitchen!2026', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Sana Qureshi"}', '', '', '', '', '', '', '', '', now(), now())
on conflict (id) do nothing;

insert into auth.identities
  (user_id, provider_id, provider, identity_data, created_at, updated_at)
select u.id, u.id::text, 'email',
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       now(), now()
  from auth.users u
on conflict (provider, provider_id) do nothing;

insert into public.auth_profiles (id, full_name, email, phone, phone_verified, role) values
  ('11111111-1111-4111-8111-111111111111', 'Dev Admin',      'dev@cloudkitchen.test',     '+919000000001', true, 'developer_admin'),
  ('22222222-2222-4222-8222-222222222222', 'Owner',          'owner@cloudkitchen.test',   '+919000000002', true, 'owner'),
  ('33333333-3333-4333-8333-333333333333', 'Branch Manager', 'manager@cloudkitchen.test', '+919000000003', true, 'branch_manager'),
  ('44444444-4444-4444-8444-444444444441', 'Kitchen One',    'kitchen1@cloudkitchen.test','+919000000004', true, 'kitchen_staff'),
  ('44444444-4444-4444-8444-444444444442', 'Kitchen Two',    'kitchen2@cloudkitchen.test','+919000000005', true, 'kitchen_staff'),
  ('44444444-4444-4444-8444-444444444443', 'Kitchen Three',  'kitchen3@cloudkitchen.test','+919000000006', true, 'kitchen_staff'),
  ('aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'Meera Iyer',     'meera@example.test',        '+919810000001', true, 'customer'),
  ('aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'Rahul Nair',     'rahul@example.test',        '+919810000002', true, 'customer'),
  ('aaaaaaa3-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'Sana Qureshi',   'sana@example.test',         '+919810000003', true, 'customer')
-- The trigger from 0102 already created a 'customer' profile for each auth
-- user, so this upserts the staff roles onto those rows rather than colliding.
on conflict (id) do update
  set full_name      = excluded.full_name,
      email          = excluded.email,
      phone          = excluded.phone,
      phone_verified = excluded.phone_verified,
      role           = excluded.role;

-- Three kitchen accounts exist but share one physical display (PRD 5.4).
-- The count is data: a fourth hire is one more row.
insert into public.employees (profile_id, employee_code, display_name, role, hired_on) values
  ('11111111-1111-4111-8111-111111111111', 'EMP-DEV-001', 'Dev Admin',      'developer_admin', current_date - 400),
  ('22222222-2222-4222-8222-222222222222', 'EMP-OWN-001', 'Owner',          'owner',           current_date - 400),
  ('33333333-3333-4333-8333-333333333333', 'EMP-MGR-001', 'Branch Manager', 'branch_manager',  current_date - 120),
  ('44444444-4444-4444-8444-444444444441', 'EMP-KIT-001', 'Kitchen One',    'kitchen_staff',   current_date - 90),
  ('44444444-4444-4444-8444-444444444442', 'EMP-KIT-002', 'Kitchen Two',    'kitchen_staff',   current_date - 60),
  ('44444444-4444-4444-8444-444444444443', 'EMP-KIT-003', 'Kitchen Three',  'kitchen_staff',   current_date - 30);

-- -----------------------------------------------------------------------------
-- Catalog
-- -----------------------------------------------------------------------------
-- The kitchen cooks one cuisine: South Indian tiffin in the morning, a banana
-- leaf thali at midday. Every dish below is a row, so one added, renamed,
-- repriced or taken off the board never needs a deploy (PRD 13).
insert into public.categories (id, slug, name, description, sort_order) values
  ('c0000001-0000-4000-8000-000000000001', 'tiffin',      'Tiffin',      'Idlis, dosas and the morning griddle',    10),
  ('c0000001-0000-4000-8000-000000000002', 'rice-baths',  'Rice Baths',  'The bath and rice family, made to order', 20),
  ('c0000001-0000-4000-8000-000000000003', 'lunch-thali', 'Lunch Thali', 'The midday meal, on a banana leaf',       30);

insert into public.collections (id, slug, name, description, sort_order) values
  ('c0110001-0000-4000-8000-000000000001', 'ghee-specials', 'Ghee Specials', 'Everything the kitchen finishes with a spoon of ghee', 10),
  ('c0110001-0000-4000-8000-000000000002', 'chefs-picks',   'Chef''s Picks', 'What the kitchen is proudest of this month', 20),
  ('c0110001-0000-4000-8000-000000000003', 'light',         'Light & Fresh', 'Under 450 calories', 30);

-- Every dish here is vegetarian, and `is_vegetarian` stays a column rather than
-- becoming an assumption: the day that stops being true is a row change, not a
-- migration.
--
-- `credit_cost` is zero for the accompaniments -- bombay curry, chapati,
-- parotta. They ride along with a plan meal without spending entitlement,
-- which is exactly the case PRD 7 warns against assuming away.
insert into public.products
  (id, slug, name, short_description, description, category_id, base_price, calories,
   protein_grams, is_vegetarian, credit_cost, estimated_cost, is_available, unavailable_reason, sort_order)
values
  ('40000001-0000-4000-8000-000000000001', 'idli', 'Idli',
   'Steamed soft, three to a plate', 'Rice and urad batter ground on stone and left to ferment overnight. Three idlis, served with sambar, a vada and both chutneys.',
   'c0000001-0000-4000-8000-000000000001', 79.00, 310, 9.0, true, 1, 24.00, true, null, 10),

  ('40000001-0000-4000-8000-000000000002', 'ghee-pudi-idli', 'Ghee Pudi Idli',
   'Idli tossed in podi and ghee', 'Idlis quartered and tossed hot through molagapodi and a spoon of ghee until the cut edges catch. Served with sambar and chutney.',
   'c0000001-0000-4000-8000-000000000001', 99.00, 390, 10.0, true, 1, 31.00, true, null, 20),

  ('40000001-0000-4000-8000-000000000003', 'plain-dosa', 'Plain Dosa',
   'Thin, crisp, nothing hidden', 'One dosa off the griddle with no filling, which is the honest test of a batter. Served with sambar and chutney.',
   'c0000001-0000-4000-8000-000000000001', 79.00, 340, 8.0, true, 1, 24.00, true, null, 30),

  ('40000001-0000-4000-8000-000000000004', 'masala-dosa', 'Masala Dosa',
   'Crisp dosa folded over potato palya', 'Roasted until the edge lifts off the tawa on its own, then folded over potato palya. Served with sambar and chutney.',
   'c0000001-0000-4000-8000-000000000001', 109.00, 480, 10.0, true, 1, 34.00, true, null, 40),

  ('40000001-0000-4000-8000-000000000005', 'ghee-masala-dosa', 'Ghee Masala Dosa',
   'The masala dosa, roasted in ghee', 'Same batter and same palya, roasted in ghee rather than oil -- darker, heavier, and the reason most regulars stop ordering the other one.',
   'c0000001-0000-4000-8000-000000000001', 129.00, 560, 10.0, true, 1, 42.00, true, null, 50),

  ('40000001-0000-4000-8000-000000000006', 'set-dosa', 'Set Dosa',
   'Three soft ones, not crisp', 'A set of three thick, spongy dosas cooked slowly under a lid. Served with sagu and chutney.',
   'c0000001-0000-4000-8000-000000000001', 99.00, 420, 10.0, true, 1, 30.00, true, null, 60),

  ('40000001-0000-4000-8000-000000000007', 'ghee-set-dosa', 'Ghee Set Dosa',
   'The set, finished in ghee', 'Three soft dosas with ghee worked in as they cook. Served with sagu and chutney.',
   'c0000001-0000-4000-8000-000000000001', 119.00, 500, 10.0, true, 1, 38.00, true, null, 70),

  ('40000001-0000-4000-8000-000000000008', 'ghee-pudi-dosa', 'Ghee Pudi Dosa',
   'Podi and ghee, corner to corner', 'A dosa spread with molagapodi and ghee before it is folded, so the heat runs its whole length. Served with sambar and chutney.',
   'c0000001-0000-4000-8000-000000000001', 119.00, 470, 9.0, true, 1, 36.00, true, null, 80),

  ('40000001-0000-4000-8000-000000000009', 'paneer-butter-masala-dosa', 'Paneer Butter Masala Dosa',
   'A dosa built around paneer butter masala', 'Paneer simmered in a tomato and butter gravy, spooned into a dosa roasted long enough to hold it. The one thing on the tiffin counter that eats like a full meal.',
   'c0000001-0000-4000-8000-000000000001', 179.00, 690, 22.0, true, 2, 68.00, true, null, 90),

  ('40000001-0000-4000-8000-00000000000a', 'puri', 'Puri',
   'Two puris, puffed to order', 'Fried as the order comes in, because a puri that has been sitting is a different dish. Served with vegetable curry and chutney.',
   'c0000001-0000-4000-8000-000000000001', 99.00, 520, 11.0, true, 1, 32.00, true, null, 100),

  ('40000001-0000-4000-8000-00000000000b', 'bombay-curry', 'Bombay Curry',
   'The western-style curry, thin and tangy', 'Potato and onion in a thin, sharp gravy rather than a thick sagu -- the Bombay way of serving it. Ordered alongside puri or chapati, or on its own.',
   'c0000001-0000-4000-8000-000000000001', 69.00, 240, 6.0, true, 0, 22.00, true, null, 110),

  ('40000001-0000-4000-8000-00000000000c', 'chole-bhature', 'Chole Bhature',
   'Dark chole, two bhature', 'Also written chana bhature. Chickpeas cooked down until the gravy darkens on its own, with two fried bhature and sliced onion.',
   'c0000001-0000-4000-8000-000000000001', 149.00, 720, 19.0, true, 1, 52.00, true, null, 120),

  ('40000001-0000-4000-8000-00000000000d', 'khara-bath', 'Khara Bath',
   'Savoury upma, the Bangalore way', 'Coarse rava roasted dry, then cooked with vegetables, curry leaf and a little vangi bath powder. Served with chutney.',
   'c0000001-0000-4000-8000-000000000001', 89.00, 380, 8.0, true, 1, 27.00, true, null, 130),

  ('40000001-0000-4000-8000-00000000000e', 'kesari-bath', 'Kesari Bath',
   'Sweet rava, saffron and ghee', 'Fine rava cooked in ghee with sugar, saffron, cashew and raisin, and turned out while it is still soft.',
   'c0000001-0000-4000-8000-000000000001', 79.00, 420, 5.0, true, 1, 25.00, true, null, 140),

  ('40000001-0000-4000-8000-00000000000f', 'chow-chow-bath', 'Chow Chow Bath',
   'Khara bath and kesari bath, one plate', 'The Bangalore breakfast argument settled by having both: a scoop of the savoury beside a scoop of the sweet.',
   'c0000001-0000-4000-8000-000000000001', 119.00, 620, 9.0, true, 1, 38.00, true, null, 150),

  ('40000001-0000-4000-8000-000000000010', 'iyengar-puliyogare', 'Iyengar Puliyogare',
   'Temple-style tamarind rice', 'The dark kind: tamarind, jaggery and roasted spice cooked down into a gojju before it ever meets the rice. Served with chutney.',
   'c0000001-0000-4000-8000-000000000002', 109.00, 450, 8.0, true, 1, 33.00, true, null, 160),

  ('40000001-0000-4000-8000-000000000011', 'vangi-bath', 'Vangi Bath',
   'Brinjal rice, roasted masala', 'Small brinjal cooked into rice with a masala roasted for it that morning. Served with chutney.',
   'c0000001-0000-4000-8000-000000000002', 119.00, 470, 9.0, true, 1, 36.00, false,
   'The brinjal at market was not worth cooking today', 170),

  ('40000001-0000-4000-8000-000000000012', 'tamarind-rice', 'Tamarind Rice',
   'The everyday puliyogare', 'Lighter than the Iyengar version -- tamarind, peanut and curry leaf folded through hot rice rather than cooked down into it.',
   'c0000001-0000-4000-8000-000000000002', 99.00, 430, 7.0, true, 1, 29.00, true, null, 180),

  ('40000001-0000-4000-8000-000000000013', 'lemon-rice', 'Lemon Rice',
   'Chitranna, sharp and yellow', 'Rice turned through a tempering of mustard, chana dal and turmeric, with the lemon going in off the heat so it stays sharp.',
   'c0000001-0000-4000-8000-000000000002', 99.00, 410, 7.0, true, 1, 28.00, true, null, 190),

  ('40000001-0000-4000-8000-000000000014', 'pudina-rice', 'Pudina Rice',
   'Mint rice', 'Mint ground fresh with green chilli and coconut, then cooked through the rice rather than stirred in at the end. Served with chutney.',
   'c0000001-0000-4000-8000-000000000002', 109.00, 420, 8.0, true, 1, 32.00, true, null, 200),

  ('40000001-0000-4000-8000-000000000015', 'tomato-rice-bath', 'Tomato Rice Bath',
   'Thakkali sadam', 'Tomato cooked down to a paste before the rice goes in, which is what keeps it from turning into a pulao with tomato in it.',
   'c0000001-0000-4000-8000-000000000002', 109.00, 440, 8.0, true, 1, 32.00, true, null, 210),

  ('40000001-0000-4000-8000-000000000016', 'mixed-vegetable-rice-bath', 'Mixed Vegetable Rice Bath',
   'Veg pulao', 'Whatever the market was good for that morning, cooked into basmati with whole spice. The vegetables change; the method does not.',
   'c0000001-0000-4000-8000-000000000002', 129.00, 490, 11.0, true, 1, 41.00, true, null, 220),

  ('40000001-0000-4000-8000-000000000017', 'ghee-rice', 'Ghee Rice',
   'With vegetable curry or paneer butter masala', 'Basmati cooked in ghee with cashew, whole spice and browned onion. Comes with the vegetable curry or the paneer butter masala, whichever you say.',
   'c0000001-0000-4000-8000-000000000002', 139.00, 610, 13.0, true, 1, 46.00, true, null, 230),

  ('40000001-0000-4000-8000-000000000018', 'peas-pulao', 'Peas Pulao',
   'Matar pulao -- basmati and green peas', 'The classic pilaf: aged basmati, green peas and whole spice, cooked so the grains stay separate.',
   'c0000001-0000-4000-8000-000000000002', 129.00, 520, 12.0, true, 1, 40.00, true, null, 240),

  ('40000001-0000-4000-8000-000000000019', 'banana-leaf-thali', 'Banana Leaf Thali',
   'The full midday meal, on a leaf', 'Rice, sambar, rasam, a vegetable poriyal finished with grated coconut, pickle, papad, ghee, payasam or kesari, chapati or puri, and a sweet. Served on a banana leaf.',
   'c0000001-0000-4000-8000-000000000003', 199.00, 780, 18.0, true, 1, 68.00, true, null, 250),

  ('40000001-0000-4000-8000-00000000001a', 'chapati', 'Chapati',
   'Two, with vegetable curry', 'Rolled thin and cooked on the tawa to order, with the day''s vegetable curry.',
   'c0000001-0000-4000-8000-000000000003', 79.00, 340, 9.0, true, 0, 26.00, true, null, 260),

  ('40000001-0000-4000-8000-00000000001b', 'parotta', 'Parotta',
   'Two, with vegetable curry', 'Layered, slapped out and folded, with the day''s vegetable curry.',
   'c0000001-0000-4000-8000-000000000003', 89.00, 420, 8.0, true, 0, 30.00, true, null, 270);

-- One photograph per dish in `public/menu`, named for the slug -- which is why
-- the join below is the slug and the URL is built rather than listed. They are
-- stand-ins: the kitchen's own pictures replace them a row at a time from the
-- admin catalogue screen, and `public/menu/CREDITS.md` records where each came
-- from and under what licence until they do.
insert into public.product_images (product_id, url, alt_text, is_primary, sort_order)
select p.id, '/menu/' || p.slug || '.jpg', img.alt, true, 0
from public.products p
join (values
  ('idli',                      'Three idlis with sambar, a vada and coconut chutney'),
  ('ghee-pudi-idli',            'Idli pieces tossed in molagapodi and ghee, on a banana leaf'),
  ('plain-dosa',                'A plain dosa served with chutney'),
  ('masala-dosa',               'A folded masala dosa with sambar and two chutneys'),
  ('ghee-masala-dosa',          'A ghee-roasted masala dosa on a banana leaf'),
  ('set-dosa',                  'A set of soft dosas spread with podi'),
  ('ghee-set-dosa',             'Stacked soft ghee dosas with chutney'),
  ('ghee-pudi-dosa',            'A dosa folded over molagapodi and ghee'),
  ('paneer-butter-masala-dosa', 'A large dosa served with paneer butter masala'),
  ('puri',                      'Puffed puris with vegetable curry'),
  ('bombay-curry',              'A thin potato and onion curry'),
  ('chole-bhature',             'Chole with two bhature and sliced onion'),
  ('khara-bath',                'Savoury khara bath topped with tomato'),
  ('kesari-bath',               'Saffron kesari bath with cashew and raisin'),
  ('chow-chow-bath',            'Khara bath and kesari bath served side by side'),
  ('iyengar-puliyogare',        'Tamarind rice served with curd and papad'),
  ('vangi-bath',                'Brinjal rice bath'),
  ('tamarind-rice',             'Tamarind rice with peanuts and curry leaf'),
  ('lemon-rice',                'Lemon rice with curry leaf and a slice of lime'),
  ('pudina-rice',               'Mint rice with fried onion and cashew'),
  ('tomato-rice-bath',          'Tomato rice garnished with coriander'),
  ('mixed-vegetable-rice-bath', 'Vegetable pulao'),
  ('ghee-rice',                 'Ghee rice with whole spices'),
  ('peas-pulao',                'Basmati pulao with green peas'),
  ('banana-leaf-thali',         'A South Indian thali laid out on a banana leaf'),
  ('chapati',                   'Chapatis with potato curry'),
  ('parotta',                   'Layered parottas in a basket')
) as img(slug, alt) on img.slug = p.slug;

insert into public.collection_products (collection_id, product_id, sort_order) values
  ('c0110001-0000-4000-8000-000000000001', '40000001-0000-4000-8000-000000000002', 10),
  ('c0110001-0000-4000-8000-000000000001', '40000001-0000-4000-8000-000000000005', 20),
  ('c0110001-0000-4000-8000-000000000001', '40000001-0000-4000-8000-000000000007', 30),
  ('c0110001-0000-4000-8000-000000000001', '40000001-0000-4000-8000-000000000008', 40),
  ('c0110001-0000-4000-8000-000000000001', '40000001-0000-4000-8000-000000000017', 50),
  ('c0110001-0000-4000-8000-000000000002', '40000001-0000-4000-8000-000000000005', 10),
  ('c0110001-0000-4000-8000-000000000002', '40000001-0000-4000-8000-000000000010', 20),
  ('c0110001-0000-4000-8000-000000000002', '40000001-0000-4000-8000-000000000019', 30),
  ('c0110001-0000-4000-8000-000000000003', '40000001-0000-4000-8000-000000000013', 10),
  ('c0110001-0000-4000-8000-000000000003', '40000001-0000-4000-8000-000000000012', 20),
  ('c0110001-0000-4000-8000-000000000003', '40000001-0000-4000-8000-00000000000d', 30);

-- Variant groups are defined once and shared across products.
insert into public.variant_groups (id, code, name, selection_type, is_required, min_selections, max_selections, sort_order) values
  ('50000001-0000-4000-8000-000000000001', 'PORTION', 'Portion size', 'single', true,  1, 1, 10),
  ('50000001-0000-4000-8000-000000000002', 'SPICE',   'Spice level',  'single', false, 0, 1, 20);

insert into public.variants (variant_group_id, code, name, price_delta, credit_delta, calorie_delta, is_default, sort_order) values
  ('50000001-0000-4000-8000-000000000001', 'REGULAR', 'Regular', 0.00,  0,   0, true,  10),
  ('50000001-0000-4000-8000-000000000001', 'LARGE',   'Large',  50.00,  1, 180, false, 20),
  ('50000001-0000-4000-8000-000000000002', 'MILD',    'Mild',    0.00,  0,   0, true,  10),
  ('50000001-0000-4000-8000-000000000002', 'MEDIUM',  'Medium',  0.00,  0,   0, false, 20),
  ('50000001-0000-4000-8000-000000000002', 'HOT',     'Hot',     0.00,  0,   0, false, 30);

-- Only where the choice is real. A rice bath is served by the scoop and a thali
-- by the leaf, so both scale and both take heat. A dosa is one dosa: offering a
-- portion size on it would be a control that cannot change anything.
insert into public.product_variant_groups (product_id, variant_group_id, sort_order)
select p.id, g.id, 10
  from public.products p
 cross join public.variant_groups g
 where p.category_id in ('c0000001-0000-4000-8000-000000000002',
                         'c0000001-0000-4000-8000-000000000003')
   and p.credit_cost > 0;

insert into public.add_ons (id, code, name, description, price, credit_cost, calories, estimated_cost, sort_order) values
  ('60000001-0000-4000-8000-000000000001', 'EXTRA_CHAPATI', 'Extra chapati', 'One more, off the tawa',       35.00, 0, 170, 11.00, 10),
  ('60000001-0000-4000-8000-000000000002', 'VADA',          'Medu vada',     'One, fried when you order it', 45.00, 0, 190, 14.00, 20),
  ('60000001-0000-4000-8000-000000000003', 'PAYASAM',       'Payasam',       'Semiya payasam, served warm',  69.00, 0, 280, 21.00, 30);

-- Offered on the meals and not on the accompaniments: an extra chapati sold
-- alongside a plate of chapatis is a menu that has stopped reading itself.
-- `credit_cost > 0` is what separates the two, and it is the same line the
-- variant groups above are drawn on.
insert into public.product_add_ons (product_id, add_on_id, max_quantity, sort_order)
select p.id, a.id, 3, 10
  from public.products p cross join public.add_ons a
 where p.credit_cost > 0;

-- -----------------------------------------------------------------------------
-- Commercial plans -- one of each shape the PRD requires (PRD 7)
-- -----------------------------------------------------------------------------
insert into public.subscription_plans
  (id, slug, name, tagline, description, plan_type, price, payment_flow, billing_period_days,
   meals_per_cycle, credits_per_cycle, selectable_meal_count, is_published, sort_order)
values
  ('70000001-0000-4000-8000-000000000001', 'weekday-lunch', 'Weekday Lunch',
   '22 lunches a month, decided by our kitchen',
   'A fixed rotating menu, delivered every weekday lunch. No decisions required.',
   'fixed_meals', 4499.00, 'one_time', 30, 22, null, null, true, 10),

  ('70000001-0000-4000-8000-000000000002', 'flexi-credits', 'Flexi 20',
   '20 meal credits, used whenever you want',
   'Twenty credits, valid across the cycle. Standard meals cost one credit; premium meals cost more.',
   'meal_credits', 3999.00, 'one_time', 30, null, 20, null, true, 20),

  ('70000001-0000-4000-8000-000000000003', 'dinner-club', 'Dinner Club',
   'Dinner, every night of the month',
   'A scheduled dinner menu that changes by day of the week.',
   'scheduled_meals', 5299.00, 'recurring', 30, 30, null, null, true, 30),

  ('70000001-0000-4000-8000-000000000004', 'build-your-own', 'Build Your Own Lunch',
   'Pick your own rotation of 20 lunches',
   'Choose the meals you actually want from our lunch pool, and we will repeat them.',
   'customer_selected', 4699.00, 'one_time', 30, 20, null, 4, true, 40);

-- Lunch plans are offered at lunch, the dinner plan at dinner, and the flexible
-- credit plan in every window -- that flexibility is the point of it.
insert into public.subscription_plan_windows (plan_id, delivery_window_id)
select p.id, w.id
  from public.subscription_plans p
  join public.delivery_windows w
    on (p.slug = 'flexi-credits')
    or (p.slug = 'dinner-club' and w.code = 'DINNER')
    or (p.slug in ('weekday-lunch','build-your-own') and w.code = 'LUNCH');

-- Fixed and scheduled plans define their own meals.
insert into public.subscription_plan_meals (plan_id, product_id, day_of_week, quantity, is_selectable, sort_order)
values
  ('70000001-0000-4000-8000-000000000001', '40000001-0000-4000-8000-000000000019', null, 1, false, 10),
  ('70000001-0000-4000-8000-000000000003', '40000001-0000-4000-8000-000000000009', null, 1, false, 10);

-- The customer-selected plan defines a pool instead.
insert into public.subscription_plan_meals (plan_id, product_id, quantity, is_selectable, sort_order)
select '70000001-0000-4000-8000-000000000004', p.id, 1, true, p.sort_order
  from public.products p
 where p.slug in ('banana-leaf-thali','mixed-vegetable-rice-bath','iyengar-puliyogare',
                   'ghee-rice','paneer-butter-masala-dosa');

-- -----------------------------------------------------------------------------
-- Offers. FIRST5 is the 5% first-subscription offer the storefront shows as
-- already unlocked; the server still validates eligibility (PRD 6, PRD 14).
-- -----------------------------------------------------------------------------
insert into public.coupons
  (id, code, name, description, discount_type, discount_value, max_discount_amount,
   min_order_amount, applies_to, per_customer_limit, is_auto_visible)
values
  ('80000001-0000-4000-8000-000000000001', 'FIRST5', 'First subscription - 5% off',
   '5% off your first subscription. Applied automatically at checkout.',
   'percent', 5.00, 500.00, 0, 'subscription', 1, true),
  ('80000001-0000-4000-8000-000000000002', 'FLAT200', 'Flat Rs.200 off',
   'Rs.200 off subscriptions above Rs.3,000.',
   'fixed_amount', 200.00, null, 3000.00, 'subscription', 2, false);

insert into public.coupon_rules (coupon_id, rule_type)
values ('80000001-0000-4000-8000-000000000001', 'first_subscription');

-- -----------------------------------------------------------------------------
-- Customers and addresses
-- -----------------------------------------------------------------------------
insert into public.customers (id, profile_id, full_name, email, phone, phone_verified, marketing_consent, marketing_consent_updated_at) values
  ('b0000001-0000-4000-8000-000000000001', 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'Meera Iyer',   'meera@example.test', '+919810000001', true, true,  now()),
  ('b0000001-0000-4000-8000-000000000002', 'aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'Rahul Nair',   'rahul@example.test', '+919810000002', true, false, now()),
  ('b0000001-0000-4000-8000-000000000003', 'aaaaaaa3-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'Sana Qureshi', 'sana@example.test',  '+919810000003', true, true,  now());

insert into public.customer_addresses
  (id, customer_id, label, recipient_name, phone, line1, line2, landmark, city, state, postal_code, delivery_instructions, is_default)
values
  ('b1000001-0000-4000-8000-000000000001', 'b0000001-0000-4000-8000-000000000001', 'Home', 'Meera Iyer', '+919810000001',
   '402, Lotus Residency', 'Sector 21', 'Opposite the water tank', 'Navi Mumbai', 'Maharashtra', '400705',
   'Call from the gate, the lift is slow', true),
  ('b1000001-0000-4000-8000-000000000002', 'b0000001-0000-4000-8000-000000000001', 'Office', 'Meera Iyer', '+919810000001',
   'Floor 6, Sigma Tower', 'Turbhe MIDC', 'Next to the bus depot', 'Navi Mumbai', 'Maharashtra', '400703',
   'Reception will take it', false),
  ('b1000001-0000-4000-8000-000000000003', 'b0000001-0000-4000-8000-000000000002', 'Home', 'Rahul Nair', '+919810000002',
   'B-14, Green Meadows', 'Kharghar', '', 'Navi Mumbai', 'Maharashtra', '410210', 'Leave with the guard', true),
  ('b1000001-0000-4000-8000-000000000004', 'b0000001-0000-4000-8000-000000000003', 'Home', 'Sana Qureshi', '+919810000003',
   '17, Rose Villa', 'Vashi', 'Behind the market', 'Navi Mumbai', 'Maharashtra', '400703', '', true);

-- =============================================================================
-- Live workflows
-- =============================================================================
-- From here on the seed calls the same functions the application calls. If an
-- invariant regresses, the seed stops.
-- =============================================================================
do $seed$
declare
  v_checkout   jsonb;
  v_confirm    jsonb;
  v_today      date := app.business_date();
  v_lunch      uuid;
  v_dinner     uuid;
  v_sub_meera  uuid;
  v_sub_rahul  uuid;
  v_failed_pay uuid;
  v_release    jsonb;
begin
  select id into v_lunch  from public.delivery_windows where code = 'LUNCH';
  select id into v_dinner from public.delivery_windows where code = 'DINNER';

  -- ---------------------------------------------------------------------------
  -- Meera buys the fixed Weekday Lunch plan and applies the first-subscription
  -- offer. delivery_days is left empty (every day) so the demo board always has
  -- something on it, whichever day the seed is run.
  -- ---------------------------------------------------------------------------
  v_checkout := public.begin_subscription_checkout(
    p_customer_id        => 'b0000001-0000-4000-8000-000000000001',
    p_plan_id            => '70000001-0000-4000-8000-000000000001',
    p_address_id         => 'b1000001-0000-4000-8000-000000000001',
    p_delivery_window_id => v_lunch,
    p_provider           => 'razorpay',
    p_idempotency_key    => 'seed-checkout-meera-0001',
    p_coupon_code        => 'FIRST5',
    p_starts_on          => v_today);

  v_sub_meera := (v_checkout ->> 'subscription_id')::uuid;

  -- The gateway callback, already signature-verified by the server.
  v_confirm := public.confirm_subscription_payment(
    p_payment_id          => (v_checkout ->> 'payment_id')::uuid,
    p_provider_payment_id => 'pay_seed_meera_0001',
    p_signature_verified  => true,
    p_verified_via        => 'webhook',
    p_raw                 => '{"seeded": true}'::jsonb);

  raise notice 'Meera: % credits, % deliveries',
    v_confirm ->> 'credits_granted', v_confirm ->> 'deliveries_generated';

  -- ---------------------------------------------------------------------------
  -- Rahul buys the credit plan, then books a delivery against his balance.
  -- ---------------------------------------------------------------------------
  v_checkout := public.begin_subscription_checkout(
    p_customer_id        => 'b0000001-0000-4000-8000-000000000002',
    p_plan_id            => '70000001-0000-4000-8000-000000000002',
    p_address_id         => 'b1000001-0000-4000-8000-000000000003',
    p_delivery_window_id => v_dinner,
    p_provider           => 'cashfree',
    p_idempotency_key    => 'seed-checkout-rahul-0001',
    p_starts_on          => v_today);

  v_sub_rahul := (v_checkout ->> 'subscription_id')::uuid;

  perform public.confirm_subscription_payment(
    (v_checkout ->> 'payment_id')::uuid, 'pay_seed_rahul_0001', true, 'callback');

  -- A premium meal (the paneer butter masala dosa) costs two credits, a
  -- standard one costs one -- proving credit cost really does vary by product.
  perform public.schedule_credit_delivery(
    p_subscription_id    => v_sub_rahul,
    p_date               => v_today,
    p_delivery_window_id => v_dinner,
    p_items              => '[{"product_id":"40000001-0000-4000-8000-000000000009","quantity":1},
                              {"product_id":"40000001-0000-4000-8000-000000000016","quantity":1}]'::jsonb);

  -- ---------------------------------------------------------------------------
  -- Sana's payment fails. This must leave NO active subscription and NO KOT
  -- ticket -- the seed asserts it below.
  -- ---------------------------------------------------------------------------
  v_checkout := public.begin_subscription_checkout(
    p_customer_id        => 'b0000001-0000-4000-8000-000000000003',
    p_plan_id            => '70000001-0000-4000-8000-000000000003',
    p_address_id         => 'b1000001-0000-4000-8000-000000000004',
    p_delivery_window_id => v_dinner,
    p_provider           => 'razorpay',
    p_idempotency_key    => 'seed-checkout-sana-0001',
    p_starts_on          => v_today);

  v_failed_pay := (v_checkout ->> 'payment_id')::uuid;

  perform public.fail_subscription_payment(
    v_failed_pay, 'BAD_REQUEST', 'Card declined by issuer', false,
    '{"seeded": true}'::jsonb);

  if exists (select 1 from public.subscriptions
              where id = (v_checkout ->> 'subscription_id')::uuid and status = 'active') then
    raise exception 'INVARIANT BROKEN: a failed payment produced an active subscription';
  end if;

  -- ---------------------------------------------------------------------------
  -- Release today's scheduled deliveries into the live KOT. Passing an explicit
  -- "now" at the end of the business day makes the seed deterministic whatever
  -- time it is run; production passes the real clock.
  -- ---------------------------------------------------------------------------
  v_release := public.release_due_deliveries(
    ((v_today + time '23:59') at time zone app.business_timezone()));

  raise notice 'released % subscription deliveries to the KOT', v_release ->> 'released';
end
$seed$;

-- -----------------------------------------------------------------------------
-- Marketplace traffic. Ingested through the same function the (mock) Swiggy
-- and Zomato adapters call, so these tickets are indistinguishable from real
-- ones on the board.
-- -----------------------------------------------------------------------------
do $mkt$
declare
  v_day     integer;
  v_n       integer;
  v_at      timestamptz;
  v_provider public.integration_provider;
  v_res     jsonb;
  v_ticket  uuid;
  v_ext     text;
  v_price   numeric;
  v_qty     integer;
  v_prod    record;
  v_accept_delay  integer;
  v_prep_minutes  integer;
  v_pickup_wait   integer;
  v_delivery_mins integer;
begin
  -- Fourteen days of history, so the analytics screens have something honest
  -- to average over.
  for v_day in reverse 14 .. 0 loop
    for v_n in 1 .. (3 + (v_day % 3)) loop
      v_provider := case when (v_day + v_n) % 2 = 0 then 'swiggy' else 'zomato' end;
      v_at := (current_date - v_day) + time '11:00' + make_interval(mins => v_n * 37);
      v_ext := upper(left(v_provider::text, 2)) || '-EXT-' || v_day || '-' || v_n;

      select p.id, p.name, p.base_price into v_prod
        from public.products p
       where p.is_available and p.is_published
       order by md5(p.id::text || v_ext)
       limit 1;

      v_qty   := 1 + (v_n % 2);
      v_price := v_prod.base_price;

      v_res := public.ingest_marketplace_order(
        p_provider          => v_provider,
        p_external_order_id => v_ext,
        p_items             => jsonb_build_array(jsonb_build_object(
                                 'product_id', v_prod.id,
                                 'name',       v_prod.name,
                                 'quantity',   v_qty,
                                 'unit_price', v_price)),
        p_totals            => jsonb_build_object(
                                 'subtotal',    v_price * v_qty,
                                 'delivery_fee', 0,
                                 'tax_total',   round(v_price * v_qty * 0.05, 2),
                                 'grand_total', round(v_price * v_qty * 1.05, 2)),
        p_customer          => jsonb_build_object(
                                 'name',  'Marketplace Customer ' || v_n,
                                 'phone', '+9198200000' || lpad(v_n::text, 2, '0')),
        p_payload           => jsonb_build_object('status', 'placed', 'seeded', true),
        p_external_event_id => v_ext || '-EVT-1',
        p_placed_at         => v_at);

      v_ticket := (v_res ->> 'ticket_id')::uuid;

      -- Today's orders stay live on the board at various stages; older ones are
      -- walked all the way to COMPLETED so the metrics have real timestamps.
      if v_day = 0 and v_n > 2 then
        if v_n = 3 then
          perform public.transition_kot_ticket(v_ticket, 'ACCEPTED');
        else
          perform public.transition_kot_ticket(v_ticket, 'ACCEPTED');
          perform public.transition_kot_ticket(v_ticket, 'PREPARING');
        end if;
        continue;
      end if;

      -- One rejection in the history, so the reject path is represented.
      if v_day = 7 and v_n = 1 then
        perform public.transition_kot_ticket(
          v_ticket, 'REJECTED', 'Kitchen at capacity during peak');
        continue;
      end if;

      perform public.transition_kot_ticket(v_ticket, 'ACCEPTED');
      perform public.transition_kot_ticket(v_ticket, 'PREPARING');
      perform public.transition_kot_ticket(v_ticket, 'READY_FOR_PICKUP');
      perform public.transition_kot_ticket(v_ticket, 'PICKED_UP');
      -- Post-handoff transitions are aggregator-driven in the live system; seed
      -- history threads them through the webhook origin so metrics reflect a
      -- realistic full lifecycle.
      perform public.transition_kot_ticket(v_ticket, 'OUT_FOR_DELIVERY', null, null, 'webhook');
      perform public.transition_kot_ticket(v_ticket, 'DELIVERED', null, null, 'webhook');

      -- Backdate the lifecycle so prep time and delivery time are realistic
      -- spreads rather than the milliseconds the seed actually took.
      v_accept_delay  := 1 + (v_n % 3);
      v_prep_minutes  := 14 + ((v_day * 7 + v_n * 5) % 16);
      v_pickup_wait   := 2 + ((v_day + v_n) % 7);
      v_delivery_mins := 16 + ((v_day * 3 + v_n) % 18);

      update public.kot_tickets
         set accepted_at         = v_at + make_interval(mins => v_accept_delay),
             preparing_at        = v_at + make_interval(mins => v_accept_delay + 1),
             ready_at            = v_at + make_interval(mins => v_accept_delay + v_prep_minutes),
             picked_up_at        = v_at + make_interval(mins => v_accept_delay + v_prep_minutes + v_pickup_wait),
             out_for_delivery_at = v_at + make_interval(mins => v_accept_delay + v_prep_minutes + v_pickup_wait + 1),
             delivered_at        = v_at + make_interval(mins => v_accept_delay + v_prep_minutes + v_pickup_wait + v_delivery_mins),
             created_at          = v_at
       where id = v_ticket;

      update public.orders
         set created_at   = v_at,
             confirmed_at = v_at,
             completed_at = v_at + make_interval(
               mins => v_accept_delay + v_prep_minutes + v_pickup_wait + v_delivery_mins)
       where id = (v_res ->> 'order_id')::uuid;
    end loop;
  end loop;
end
$mkt$;

-- -----------------------------------------------------------------------------
-- Reviews, including one still awaiting moderation and one hidden.
-- -----------------------------------------------------------------------------
insert into public.reviews (customer_id, product_id, rating, title, body, status, is_verified_purchase) values
  ('b0000001-0000-4000-8000-000000000001', '40000001-0000-4000-8000-000000000019', 5,
   'A thali that is actually a meal', 'Two vegetables, rasam that tastes of pepper rather than of water, and the payasam is not an afterthought. The leaf turns up flat, which I did not expect from a delivery.',
   'published', true),
  ('b0000001-0000-4000-8000-000000000002', '40000001-0000-4000-8000-000000000009', 4,
   'Good dosa, heavy by the end', 'Crisp to the edge and the paneer is generous. A touch rich by the last quarter, which is a complaint about the second half of a very good dosa.',
   'published', true),
  ('b0000001-0000-4000-8000-000000000003', '40000001-0000-4000-8000-000000000016', 5,
   'Tastes like a Sunday at home', 'Ordered it on a bad day and it did the job.',
   'pending', false),
  ('b0000001-0000-4000-8000-000000000002', '40000001-0000-4000-8000-000000000013', 2,
   'Came lukewarm', 'Arrived at room temperature. Chitranna wants to be hot, or it is just rice with peanuts in it.',
   'hidden', true);

-- -----------------------------------------------------------------------------
-- Seed self-check: the PRD's core invariants, asserted rather than assumed.
-- -----------------------------------------------------------------------------
do $verify$
declare
  v_bad integer;
begin
  select count(*) into v_bad
    from public.kot_tickets t
    join public.orders o on o.id = t.order_id
   where o.status not in ('CONFIRMED','IN_PROGRESS','COMPLETED','CANCELLED','REJECTED');
  if v_bad > 0 then
    raise exception 'INVARIANT BROKEN: % ticket(s) exist for an unconfirmed order', v_bad;
  end if;

  select count(*) into v_bad
    from public.subscriptions s
   where s.status = 'active'
     and s.price_paid > 0
     and not exists (select 1 from public.payments p
                      where p.subscription_id = s.id
                        and p.status = 'success' and p.verified_at is not null);
  if v_bad > 0 then
    raise exception 'INVARIANT BROKEN: % active subscription(s) without a verified payment', v_bad;
  end if;

  select count(*) into v_bad
    from public.subscriptions s
   where public.subscription_credit_balance(s.id) < 0;
  if v_bad > 0 then
    raise exception 'INVARIANT BROKEN: % subscription(s) have a negative credit balance', v_bad;
  end if;

  raise notice 'Seed complete. Invariants hold.';
end
$verify$;

select set_config('app.actor_id', '', false);
