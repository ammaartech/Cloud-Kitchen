import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { revalidateStorefront } from '@/lib/data/catalog-cache';
import { requirePermission } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { serverClient } from '@/lib/supabase/server';
import { money } from '@/lib/format';
import { bool, list, nullableNum, num, str } from '@/lib/admin/form';
import { ActionFeedback, done, fail, readable } from '@/lib/admin/feedback';
import { CatalogNav } from '@/components/admin/catalog-nav';

/**
 * These screens are per-user by definition -- a session decides not just what
 * they show but whether you may see them at all -- so there is no static shell
 * to prerender and no point pretending otherwise. `instant = false` says that
 * plainly: this segment is allowed to block.
 *
 * It is a statement about *this* route, not a global escape hatch. The public
 * storefront next door is held to the opposite standard.
 */
export const instant = false;
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmButton,
  Field,
  Input,
  SectionHeading,
  Select,
  Textarea,
} from '@/components/ui/primitives';


export async function generateMetadata({
  params,
}: PageProps<'/admin/catalog/products/[productId]'>) {
  const { productId } = await params;
  const supabase = await serverClient();
  const { data } = await supabase
    .from('products')
    .select('name')
    .eq('id', productId)
    .maybeSingle();

  return { title: data ? (data as { name: string }).name : 'Dish' };
}

interface Product {
  id: string;
  slug: string;
  name: string;
  short_description: string;
  description: string;
  category_id: string | null;
  base_price: string;
  calories: number | null;
  protein_grams: string | null;
  is_vegetarian: boolean;
  allergens: string[];
  credit_cost: number;
  estimated_cost: string | null;
  is_available: boolean;
  unavailable_reason: string | null;
  is_published: boolean;
  archived_at: string | null;
  allows_special_instructions: boolean;
  max_quantity_per_order: number | null;
  sort_order: number;
}

/**
 * One dish, end to end (PRD 13).
 *
 * Name, description, images, category, collection, price, variants, add-ons,
 * calories, availability and special instructions -- the full set the PRD asks
 * for, none of it hardcoded anywhere else.
 *
 * The three relationship forms (collections, variant groups, add-ons) each
 * submit their complete set and replace it. A partial update would leave a
 * dish attached to a collection the Owner had just unticked, which is exactly
 * the kind of quiet divergence a storefront then renders.
 */
export default async function ProductEditorPage({
  params,
  searchParams,
}: PageProps<'/admin/catalog/products/[productId]'>) {
  await requirePermission(PERMISSIONS.catalogManage);

  const { productId } = await params;
  const query = await searchParams;
  const path = `/admin/catalog/products/${productId}`;
  const supabase = await serverClient();

  const [
    productResult,
    categoriesResult,
    imagesResult,
    collectionsResult,
    productCollectionsResult,
    variantGroupsResult,
    productVariantGroupsResult,
    addOnsResult,
    productAddOnsResult,
  ] = await Promise.all([
    supabase.from('products').select('*').eq('id', productId).maybeSingle(),
    supabase.from('categories').select('id, name').order('sort_order'),
    supabase
      .from('product_images')
      .select('id, url, alt_text, is_primary, sort_order')
      .eq('product_id', productId)
      .order('sort_order'),
    supabase.from('collections').select('id, name, is_published').order('sort_order'),
    supabase.from('collection_products').select('collection_id').eq('product_id', productId),
    supabase
      .from('variant_groups')
      .select('id, code, name, selection_type, is_required, is_active, variants ( id, name, price_delta )')
      .order('sort_order'),
    supabase
      .from('product_variant_groups')
      .select('variant_group_id, is_required_override')
      .eq('product_id', productId),
    supabase.from('add_ons').select('id, code, name, price, is_active').order('sort_order'),
    supabase.from('product_add_ons').select('add_on_id, max_quantity').eq('product_id', productId),
  ]);

  const product = productResult.data as Product | null;
  if (!product) notFound();

  const categories = (categoriesResult.data ?? []) as Array<{ id: string; name: string }>;

  const images = (imagesResult.data ?? []) as Array<{
    id: string;
    url: string;
    alt_text: string;
    is_primary: boolean;
    sort_order: number;
  }>;

  const collections = (collectionsResult.data ?? []) as Array<{
    id: string;
    name: string;
    is_published: boolean;
  }>;
  const inCollections = new Set(
    ((productCollectionsResult.data ?? []) as Array<{ collection_id: string }>).map(
      (row) => row.collection_id,
    ),
  );

  const variantGroups = (variantGroupsResult.data ?? []) as unknown as Array<{
    id: string;
    code: string;
    name: string;
    selection_type: string;
    is_required: boolean;
    is_active: boolean;
    variants: Array<{ id: string; name: string; price_delta: string }>;
  }>;
  const attachedGroups = new Map(
    (
      (productVariantGroupsResult.data ?? []) as Array<{
        variant_group_id: string;
        is_required_override: boolean | null;
      }>
    ).map((row) => [row.variant_group_id, row.is_required_override]),
  );

  const addOns = (addOnsResult.data ?? []) as Array<{
    id: string;
    code: string;
    name: string;
    price: string;
    is_active: boolean;
  }>;
  const attachedAddOns = new Map(
    ((productAddOnsResult.data ?? []) as Array<{ add_on_id: string; max_quantity: number }>).map(
      (row) => [row.add_on_id, row.max_quantity],
    ),
  );

  /* ------------------------------------------------------------------ */
  /* Actions                                                             */
  /* ------------------------------------------------------------------ */

  async function saveDetails(formData: FormData) {
    'use server';

    const name = str(formData, 'name');
    if (!name) fail(path, 'A dish needs a name.');

    const db = await serverClient();
    const { error } = await db
      .from('products')
      .update({
        name,
        slug: str(formData, 'slug'),
        short_description: str(formData, 'shortDescription'),
        description: str(formData, 'description'),
        category_id: str(formData, 'categoryId') || null,
        base_price: num(formData, 'basePrice'),
        credit_cost: num(formData, 'creditCost', 1),
        estimated_cost: nullableNum(formData, 'estimatedCost'),
        calories: nullableNum(formData, 'calories'),
        protein_grams: nullableNum(formData, 'proteinGrams'),
        is_vegetarian: bool(formData, 'isVegetarian'),
        allergens: str(formData, 'allergens')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        allows_special_instructions: bool(formData, 'allowsSpecialInstructions'),
        max_quantity_per_order: nullableNum(formData, 'maxQuantityPerOrder'),
        sort_order: num(formData, 'sortOrder'),
      })
      .eq('id', productId);

    if (error) fail(path, readable(error));

    revalidatePath(path);
    revalidatePath('/admin/catalog');
    revalidateStorefront('/menu');
    done(path, 'Dish saved.');
  }

  async function setAvailability(formData: FormData) {
    'use server';

    const available = str(formData, 'available') === 'true';

    const db = await serverClient();
    const { error } = await db
      .from('products')
      .update({
        is_available: available,
        unavailable_reason: available ? null : str(formData, 'reason') || 'Unavailable today',
      })
      .eq('id', productId);

    if (error) fail(path, readable(error));

    revalidatePath(path);
    revalidatePath('/admin/catalog');
    revalidateStorefront('/menu');
  }

  async function setVisibility(formData: FormData) {
    'use server';

    const publish = str(formData, 'publish') === 'true';

    const db = await serverClient();
    const { error } = await db
      .from('products')
      .update({ is_published: publish })
      .eq('id', productId);

    if (error) fail(path, readable(error));

    revalidatePath(path);
    revalidatePath('/admin/catalog');
    revalidateStorefront('/menu');
  }

  async function setArchived(formData: FormData) {
    'use server';

    const archive = str(formData, 'archive') === 'true';

    const db = await serverClient();
    const { error } = await db
      .from('products')
      .update({
        // Soft delete: order lines and plan menus still reference this dish,
        // and a past order has to stay readable.
        archived_at: archive ? new Date().toISOString() : null,
        ...(archive ? { is_published: false, is_available: false } : {}),
      })
      .eq('id', productId);

    if (error) fail(path, readable(error));

    revalidatePath(path);
    revalidatePath('/admin/catalog');
    revalidateStorefront('/menu');
    done(path, archive ? 'Dish archived.' : 'Dish restored.');
  }

  async function addImage(formData: FormData) {
    'use server';

    const url = str(formData, 'url');
    if (!url) fail(path, 'Paste an image URL.');

    const makePrimary = bool(formData, 'isPrimary');
    const db = await serverClient();

    if (makePrimary) {
      await db.from('product_images').update({ is_primary: false }).eq('product_id', productId);
    }

    const { error } = await db.from('product_images').insert({
      product_id: productId,
      url,
      alt_text: str(formData, 'altText'),
      is_primary: makePrimary,
      sort_order: num(formData, 'sortOrder'),
    });

    if (error) fail(path, readable(error));

    revalidatePath(path);
    revalidateStorefront('/menu');
    done(path, 'Image added.');
  }

  async function makePrimaryImage(formData: FormData) {
    'use server';

    const db = await serverClient();
    // A partial unique index allows exactly one primary per product, so the
    // old one has to stand down in the same breath.
    await db.from('product_images').update({ is_primary: false }).eq('product_id', productId);

    const { error } = await db
      .from('product_images')
      .update({ is_primary: true })
      .eq('id', str(formData, 'imageId'));

    if (error) fail(path, readable(error));

    revalidatePath(path);
    revalidateStorefront('/menu');
  }

  async function removeImage(formData: FormData) {
    'use server';

    const db = await serverClient();
    const { error } = await db
      .from('product_images')
      .delete()
      .eq('id', str(formData, 'imageId'));

    if (error) fail(path, readable(error));

    revalidatePath(path);
    revalidateStorefront('/menu');
  }

  async function saveCollections(formData: FormData) {
    'use server';

    const chosen = list(formData, 'collectionId');
    const db = await serverClient();

    const { error: clearError } = await db
      .from('collection_products')
      .delete()
      .eq('product_id', productId);

    if (clearError) fail(path, readable(clearError));

    if (chosen.length > 0) {
      const { error } = await db
        .from('collection_products')
        .insert(chosen.map((collectionId) => ({ collection_id: collectionId, product_id: productId })));

      if (error) fail(path, readable(error));
    }

    revalidatePath(path);
    revalidateStorefront('/menu');
    revalidateStorefront('/meal-plans');
    done(path, 'Collections saved.');
  }

  async function saveVariantGroups(formData: FormData) {
    'use server';

    const chosen = list(formData, 'variantGroupId');
    const db = await serverClient();

    const { error: clearError } = await db
      .from('product_variant_groups')
      .delete()
      .eq('product_id', productId);

    if (clearError) fail(path, readable(clearError));

    if (chosen.length > 0) {
      const rows = chosen.map((variantGroupId, index) => {
        const override = str(formData, `required-${variantGroupId}`);
        return {
          product_id: productId,
          variant_group_id: variantGroupId,
          sort_order: index,
          // Blank means "use the group's own rule", which is not the same as
          // forcing it optional.
          is_required_override: override === '' ? null : override === 'true',
        };
      });

      const { error } = await db.from('product_variant_groups').insert(rows);
      if (error) fail(path, readable(error));
    }

    revalidatePath(path);
    revalidateStorefront('/menu');
    done(path, 'Variant groups saved.');
  }

  async function saveAddOns(formData: FormData) {
    'use server';

    const chosen = list(formData, 'addOnId');
    const db = await serverClient();

    const { error: clearError } = await db
      .from('product_add_ons')
      .delete()
      .eq('product_id', productId);

    if (clearError) fail(path, readable(clearError));

    if (chosen.length > 0) {
      const rows = chosen.map((addOnId, index) => ({
        product_id: productId,
        add_on_id: addOnId,
        max_quantity: Math.max(1, num(formData, `max-${addOnId}`, 1)),
        sort_order: index,
      }));

      const { error } = await db.from('product_add_ons').insert(rows);
      if (error) fail(path, readable(error));
    }

    revalidatePath(path);
    revalidateStorefront('/menu');
    done(path, 'Add-ons saved.');
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/admin/catalog" className="text-sm text-muted hover:text-ink">
        ← All dishes
      </Link>

      <div className="mt-3">
        <SectionHeading
          title={product.name}
          description={
            <>
              {money(product.base_price)} · {product.credit_cost} credit(s)
              {product.calories ? ` · ${product.calories} kcal` : ''}
            </>
          }
          action={
            <div className="flex flex-wrap items-center gap-2">
              {product.archived_at ? <Badge tone="danger">Archived</Badge> : null}
              {product.is_published ? (
                <Badge tone="success">On the menu</Badge>
              ) : (
                <Badge tone="neutral">Hidden</Badge>
              )}

              <form action={setVisibility}>
                <input type="hidden" name="publish" value={product.is_published ? 'false' : 'true'} />
                <Button type="submit" size="sm" variant={product.is_published ? 'ghost' : 'primary'}>
                  {product.is_published ? 'Hide' : 'Show on menu'}
                </Button>
              </form>

              <form action={setArchived}>
                <input type="hidden" name="archive" value={product.archived_at ? 'false' : 'true'} />
                <Button
                  type="submit"
                  size="sm"
                  variant={product.archived_at ? 'secondary' : 'danger'}
                >
                  {product.archived_at ? 'Restore' : 'Delete'}
                </Button>
              </form>
            </div>
          }
        />
      </div>

      <CatalogNav />

      <ActionFeedback error={query.error as string} ok={query.ok as string} />

      <div className="mb-6">
        <Card className="flex flex-wrap items-end gap-4 p-4">
          <div>
            <p className="text-sm font-medium">
              {product.is_available ? 'Available today' : 'Unavailable today'}
            </p>
            <p className="text-xs text-subtle">
              {product.is_available
                ? 'Customers can order it now.'
                : `Shown greyed out with: “${product.unavailable_reason ?? 'Unavailable today'}”`}
            </p>
          </div>

          <form action={setAvailability} className="ml-auto flex items-end gap-2">
            <input type="hidden" name="available" value={product.is_available ? 'false' : 'true'} />
            {product.is_available ? (
              <Field label="Reason customers will see">
                <Input name="reason" className="w-64" placeholder="Sold out for today" />
              </Field>
            ) : null}
            <Button type="submit" variant={product.is_available ? 'danger' : 'success'}>
              {product.is_available ? 'Mark unavailable' : 'Mark available'}
            </Button>
          </form>
        </Card>
      </div>

      {product.archived_at ? (
        <div className="mb-6">
          <Alert tone="warning" title="This dish is archived">
            It has been removed from the storefront but kept so past orders and plan menus still
            read correctly. Restore it to bring it back.
          </Alert>
        </div>
      ) : null}

      <div className="space-y-8">
        {/* -------------------------------------------------------------- */}
        {/* Details                                                         */}
        {/* -------------------------------------------------------------- */}
        <section>
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-subtle uppercase">
            Details
          </h2>

          <Card className="p-5">
            <form action={saveDetails} className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" required>
                <Input name="name" defaultValue={product.name} required />
              </Field>

              <Field label="Slug" required>
                <Input name="slug" defaultValue={product.slug} required />
              </Field>

              <div className="sm:col-span-2">
                <Field label="Short description" hint="One line, shown on the menu card.">
                  <Input name="shortDescription" defaultValue={product.short_description} />
                </Field>
              </div>

              <div className="sm:col-span-2">
                <Field label="Description">
                  <Textarea name="description" defaultValue={product.description} />
                </Field>
              </div>

              <Field label="Category">
                <Select name="categoryId" defaultValue={product.category_id ?? ''}>
                  <option value="">Uncategorised</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Price" required>
                <Input name="basePrice" defaultValue={product.base_price} inputMode="decimal" required />
              </Field>

              <Field label="Credit cost" hint="A premium meal may consume more than one.">
                <Input name="creditCost" defaultValue={product.credit_cost} inputMode="numeric" />
              </Field>

              <Field label="Estimated food cost" hint="Feeds the profit estimate.">
                <Input
                  name="estimatedCost"
                  defaultValue={product.estimated_cost ?? ''}
                  inputMode="decimal"
                  placeholder="channel default"
                />
              </Field>

              <Field label="Calories">
                <Input name="calories" defaultValue={product.calories ?? ''} inputMode="numeric" />
              </Field>

              <Field label="Protein (g)">
                <Input
                  name="proteinGrams"
                  defaultValue={product.protein_grams ?? ''}
                  inputMode="decimal"
                />
              </Field>

              <Field label="Allergens" hint="Comma separated.">
                <Input name="allergens" defaultValue={product.allergens.join(', ')} />
              </Field>

              <Field label="Max per order" hint="Blank = no limit.">
                <Input
                  name="maxQuantityPerOrder"
                  defaultValue={product.max_quantity_per_order ?? ''}
                  inputMode="numeric"
                />
              </Field>

              <Field label="Sort order">
                <Input name="sortOrder" defaultValue={product.sort_order} inputMode="numeric" />
              </Field>

              <div className="space-y-2 self-end">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="isVegetarian"
                    defaultChecked={product.is_vegetarian}
                    className="h-4 w-4"
                  />
                  Vegetarian
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="allowsSpecialInstructions"
                    defaultChecked={product.allows_special_instructions}
                    className="h-4 w-4"
                  />
                  Accepts special instructions
                </label>
              </div>

              <div className="flex items-end sm:col-span-2">
                <Button type="submit">Save dish</Button>
              </div>
            </form>
          </Card>
        </section>

        {/* -------------------------------------------------------------- */}
        {/* Images                                                          */}
        {/* -------------------------------------------------------------- */}
        <section>
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-subtle uppercase">
            Images
          </h2>

          <Card className="p-5">
            {images.length === 0 ? (
              <p className="text-sm text-muted">No photo yet — the menu card shows a placeholder.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-3">
                {images.map((image) => (
                  <div key={image.id} className="rounded-ck border border-line p-2">
                    <div className="relative aspect-[4/3] overflow-hidden rounded-ck bg-sunken">
                      <Image
                        src={image.url}
                        alt={image.alt_text || product.name}
                        fill
                        sizes="200px"
                        className="object-cover"
                      />
                    </div>

                    <p className="mt-2 truncate text-xs text-subtle">
                      {image.alt_text || 'No alt text'}
                    </p>

                    <div className="mt-2 flex items-center gap-2">
                      {image.is_primary ? (
                        <Badge tone="brand">Primary</Badge>
                      ) : (
                        <form action={makePrimaryImage}>
                          <input type="hidden" name="imageId" value={image.id} />
                          <Button type="submit" size="sm" variant="ghost">
                            Make primary
                          </Button>
                        </form>
                      )}

                      <form action={removeImage} className="ml-auto">
                        <input type="hidden" name="imageId" value={image.id} />
                        <ConfirmButton confirmLabel="Really remove?">Remove</ConfirmButton>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <form
              action={addImage}
              className="mt-5 grid gap-3 border-t border-line pt-5 sm:grid-cols-4"
            >
              <div className="sm:col-span-2">
                <Field label="Image URL" required>
                  <Input name="url" placeholder="https://…" required />
                </Field>
              </div>

              <Field label="Alt text" hint="Describe the dish for screen readers.">
                <Input name="altText" placeholder="A bowl of dal tadka with a roti" />
              </Field>

              <div className="flex flex-col justify-end gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="isPrimary" className="h-4 w-4" defaultChecked={images.length === 0} />
                  Primary
                </label>
                <Button type="submit" size="sm" variant="secondary">
                  Add image
                </Button>
              </div>
            </form>

            <p className="mt-3 text-xs text-subtle">
              Images are loaded from an allowlisted host. If a URL does not render, add its
              hostname to the image config.
            </p>
          </Card>
        </section>

        {/* -------------------------------------------------------------- */}
        {/* Collections                                                     */}
        {/* -------------------------------------------------------------- */}
        <section>
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-subtle uppercase">
            Collections
          </h2>

          <Card className="p-5">
            {collections.length === 0 ? (
              <p className="text-sm text-muted">
                No collections yet. Create one on the Collections tab.
              </p>
            ) : (
              <form action={saveCollections}>
                <div className="grid gap-2 sm:grid-cols-3">
                  {collections.map((collection) => (
                    <label
                      key={collection.id}
                      className="flex items-center gap-2 rounded-ck border border-line px-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        name="collectionId"
                        value={collection.id}
                        defaultChecked={inCollections.has(collection.id)}
                        className="h-4 w-4"
                      />
                      {collection.name}
                      {!collection.is_published ? <Badge tone="neutral">Hidden</Badge> : null}
                    </label>
                  ))}
                </div>

                <Button type="submit" size="sm" variant="secondary" className="mt-4">
                  Save collections
                </Button>
              </form>
            )}
          </Card>
        </section>

        {/* -------------------------------------------------------------- */}
        {/* Variant groups                                                  */}
        {/* -------------------------------------------------------------- */}
        <section>
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-subtle uppercase">
            Variant groups
          </h2>

          <Card className="p-5">
            {variantGroups.length === 0 ? (
              <p className="text-sm text-muted">
                No variant groups yet. Create one on the Variant groups tab and it becomes
                attachable to any dish.
              </p>
            ) : (
              <form action={saveVariantGroups}>
                <div className="space-y-2">
                  {variantGroups.map((group) => {
                    const attached = attachedGroups.has(group.id);
                    const override = attachedGroups.get(group.id) ?? null;

                    return (
                      <div
                        key={group.id}
                        className="flex flex-wrap items-center gap-3 rounded-ck border border-line px-3 py-2 text-sm"
                      >
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            name="variantGroupId"
                            value={group.id}
                            defaultChecked={attached}
                            className="h-4 w-4"
                          />
                          <span className="font-medium">{group.name}</span>
                        </label>

                        <span className="text-xs text-subtle">
                          {group.selection_type === 'single' ? 'pick one' : 'pick several'} ·{' '}
                          {group.variants.length} option(s):{' '}
                          {group.variants.map((variant) => variant.name).join(', ') || 'none yet'}
                        </span>

                        {!group.is_active ? <Badge tone="warning">Inactive</Badge> : null}

                        <label className="ml-auto flex items-center gap-2 text-xs">
                          <span className="text-subtle">Required</span>
                          <Select
                            name={`required-${group.id}`}
                            defaultValue={override === null ? '' : String(override)}
                            className="w-40"
                          >
                            <option value="">
                              Group default ({group.is_required ? 'required' : 'optional'})
                            </option>
                            <option value="true">Required here</option>
                            <option value="false">Optional here</option>
                          </Select>
                        </label>
                      </div>
                    );
                  })}
                </div>

                <Button type="submit" size="sm" variant="secondary" className="mt-4">
                  Save variant groups
                </Button>
              </form>
            )}
          </Card>
        </section>

        {/* -------------------------------------------------------------- */}
        {/* Add-ons                                                         */}
        {/* -------------------------------------------------------------- */}
        <section>
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-subtle uppercase">
            Add-ons
          </h2>

          <Card className="p-5">
            {addOns.length === 0 ? (
              <p className="text-sm text-muted">
                No add-ons yet. Create one on the Add-ons tab.
              </p>
            ) : (
              <form action={saveAddOns}>
                <div className="space-y-2">
                  {addOns.map((addOn) => (
                    <div
                      key={addOn.id}
                      className="flex flex-wrap items-center gap-3 rounded-ck border border-line px-3 py-2 text-sm"
                    >
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          name="addOnId"
                          value={addOn.id}
                          defaultChecked={attachedAddOns.has(addOn.id)}
                          className="h-4 w-4"
                        />
                        <span className="font-medium">{addOn.name}</span>
                      </label>

                      <span className="text-xs text-subtle">{money(addOn.price)}</span>
                      {!addOn.is_active ? <Badge tone="warning">Inactive</Badge> : null}

                      <label className="ml-auto flex items-center gap-2 text-xs">
                        <span className="text-subtle">Max per order</span>
                        <Input
                          name={`max-${addOn.id}`}
                          defaultValue={attachedAddOns.get(addOn.id) ?? 1}
                          inputMode="numeric"
                          className="w-20"
                        />
                      </label>
                    </div>
                  ))}
                </div>

                <Button type="submit" size="sm" variant="secondary" className="mt-4">
                  Save add-ons
                </Button>
              </form>
            )}
          </Card>
        </section>
      </div>
    </div>
  );
}
