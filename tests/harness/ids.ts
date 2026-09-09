/** Fixed identifiers from supabase/seed.sql, so tests read as intent. */

export const DEV_ADMIN = '11111111-1111-4111-8111-111111111111';
export const OWNER = '22222222-2222-4222-8222-222222222222';
export const MANAGER = '33333333-3333-4333-8333-333333333333';
export const KITCHEN = '44444444-4444-4444-8444-444444444441';

export const MEERA = 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
export const RAHUL = 'aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
export const SANA = 'aaaaaaa3-aaaa-4aaa-8aaa-aaaaaaaaaaa3';

export const CUSTOMER_MEERA = 'b0000001-0000-4000-8000-000000000001';
export const CUSTOMER_RAHUL = 'b0000001-0000-4000-8000-000000000002';
export const CUSTOMER_SANA = 'b0000001-0000-4000-8000-000000000003';

export const ADDRESS_MEERA_HOME = 'b1000001-0000-4000-8000-000000000001';
export const ADDRESS_SANA_HOME = 'b1000001-0000-4000-8000-000000000004';

export const PLAN_WEEKDAY_LUNCH = '70000001-0000-4000-8000-000000000001';
export const PLAN_FLEXI_CREDITS = '70000001-0000-4000-8000-000000000002';
export const PLAN_DINNER_CLUB = '70000001-0000-4000-8000-000000000003';
export const PLAN_BUILD_YOUR_OWN = '70000001-0000-4000-8000-000000000004';

/** The Weekday Lunch plan's fixed meal, and a published review. */
export const PRODUCT_THALI = '40000001-0000-4000-8000-000000000019';
/** A standard one-credit meal; carries the review left pending for moderation. */
export const PRODUCT_VEG_PULAO = '40000001-0000-4000-8000-000000000016';
/** Premium: costs two credits, not one. */
export const PRODUCT_PANEER_DOSA = '40000001-0000-4000-8000-000000000009';
/** Seeded as unavailable. */
export const PRODUCT_VANGI_BATH = '40000001-0000-4000-8000-000000000011';
/** Tiffin, and deliberately outside the Build Your Own lunch pool. */
export const PRODUCT_GHEE_PUDI_DOSA = '40000001-0000-4000-8000-000000000008';
