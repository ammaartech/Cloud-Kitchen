import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { revalidateStorefront } from '@/lib/data/catalog-cache';
import { requirePermission } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { serverClient } from '@/lib/supabase/server';
import { money } from '@/lib/format';
import { num, nullableNum, slugify, str } from '@/lib/admin/form';
import { ActionFeedback, done, fail, readable } from '@/lib/admin/feedback';
import { CatalogNav } from '@/components/admin/catalog-nav';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Field,
  Input,
  SectionHeading,
  Select,
} from '@/components/ui/primitives';

export const metadata = { title: 'Catalog' };
export const dynamic = 'force-dynamic';

const PATH = '/admin/catalog';

interface ProductRow {
  id: string;
  name: string;
  slug: string;
  base_price: string;
  credit_cost: number;
  estimated_cost: string | null;
  is_available: boolean;
  is_published: boolean;
  archived_at: string | null;
  unavailable_reason: string | null;
  calories: number | null;
  categories: { name: string } | null;
}

/**
 * Catalog: products (PRD 13).
 *
 * This screen is built around the controls that get used daily -- availability
 * first, then price. Marking a dish unavailable is the single most frequent
 * catalog action in a kitchen: something runs out and the storefront has to
 * stop offering it within seconds. So it is one click here, with the reason
 * shown to customers on the menu.
 *
 * Everything else about a dish -- images, variants, add-ons, collections,
 * nutrition -- lives in the editor, one dish at a time.
 */
export default async function CatalogPage({ searchParams }: PageProps<'/admin/catalog'>) {
  await requirePermission(PERMISSIONS.catalogManage);
  const params = await searchParams;
  const supabase = await serverClient();

  const showArchived = params.archived === 'true';

  const [productsResult, categoriesResult] = await Promise.all([
    supabase
      .from('products')
      .select(
        `id, name, slug, base_price, credit_cost, estimated_cost, is_available,
         is_published, archived_at, unavailable_reason, calories, categories ( name )`,
      )
      .order('sort_order'),
    supabase.from('categories').select('id, name').order('sort_order'),
  ]);

  const all = (productsResult.data ?? []) as unknown as ProductRow[];
  const products = all.filter((product) => (showArchived ? product.archived_at : !product.archived_at));
  const categories = (categoriesResult.data ?? []) as Array<{ id: string; name: string }>;
  const archivedCount = all.filter((product) => product.archived_at).length;

  async function createProduct(formData: FormData) {
    'use server';

    const name = str(formData, 'name');
    if (!name) fail(PATH, 'A dish needs a name.');

    const db = await serverClient();
    const { data, error } = await db
      .from('products')
      .insert({
        name,
        slug: str(formData, 'slug') || slugify(name),
        short_description: str(formData, 'shortDescription'),
        category_id: str(formData, 'categoryId') || null,
        base_price: num(formData, 'basePrice'),
        credit_cost: num(formData, 'creditCost', 1),
        // Hidden until the Owner has added a photo and a description. Hiding is
        // separate from availability: hidden disappears, unavailable is shown
        // greyed out with a reason.
        is_published: false,
      })
      .select('id')
      .single();

    if (error) fail(PATH, readable(error));

    revalidatePath(PATH);
    revalidateStorefront('/menu');
    done(`${PATH}/products/${data!.id}`, 'Dish created. Add a photo and a description, then publish it.');
  }

  async function toggleAvailability(formData: FormData) {
    'use server';

    const makeAvailable = str(formData, 'makeAvailable') === 'true';
    const reason = str(formData, 'reason');

    const db = await serverClient();
    const { error } = await db
      .from('products')
      .update({
        is_available: makeAvailable,
        // A reason is only meaningful while the item is off.
        unavailable_reason: makeAvailable ? null : reason || 'Unavailable today',
      })
      .eq('id', str(formData, 'productId'));

    if (error) fail(PATH, readable(error));

    revalidatePath(PATH);
    revalidateStorefront('/menu');
  }

  async function updatePricing(formData: FormData) {
    'use server';

    const db = await serverClient();
    const { error } = await db
      .from('products')
      .update({
        base_price: num(formData, 'basePrice'),
        credit_cost: num(formData, 'creditCost', 1),
        estimated_cost: nullableNum(formData, 'estimatedCost'),
      })
      .eq('id', str(formData, 'productId'));

    if (error) fail(PATH, readable(error));

    revalidatePath(PATH);
    revalidateStorefront('/menu');
  }

  const unavailableCount = products.filter((product) => !product.is_available).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <SectionHeading
        title="Catalog"
        description={`${products.length} dishes · ${unavailableCount} currently unavailable. Every change is audited.`}
        action={
          archivedCount > 0 ? (
            <ButtonLink href={showArchived ? PATH : `${PATH}?archived=true`} variant="ghost" size="sm">{showArchived ? 'Back to live dishes' : `Archived (${archivedCount})`}</ButtonLink>
          ) : null
        }
      />

      <CatalogNav />

      <ActionFeedback error={params.error as string} ok={params.ok as string} />

      {!showArchived ? (
        <Card className="mb-8 p-5">
          <h2 className="mb-4 font-semibold">New dish</h2>

          <form action={createProduct} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Field label="Name" required>
              <Input name="name" placeholder="Dal Tadka" required />
            </Field>

            <Field label="Category">
              <Select name="categoryId" defaultValue="">
                <option value="">Uncategorised</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Price" required>
              <Input name="basePrice" inputMode="decimal" defaultValue="0" required />
            </Field>

            <Field label="Credit cost" hint="What a plan meal costs in credits.">
              <Input name="creditCost" inputMode="numeric" defaultValue="1" />
            </Field>

            <div className="flex items-end">
              <Button type="submit">Create dish</Button>
            </div>

            <div className="sm:col-span-2 lg:col-span-5">
              <Field label="Short description">
                <Input name="shortDescription" placeholder="Slow-cooked yellow lentils, tempered." />
              </Field>
            </div>
          </form>
        </Card>
      ) : null}

      {products.length === 0 ? (
        <EmptyState
          title={showArchived ? 'Nothing archived' : 'No products yet'}
          description={showArchived ? undefined : 'Add the first dish above.'}
        />
      ) : (
        <div className="space-y-3">
          {products.map((product) => (
            <Card key={product.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/catalog/products/${product.id}`}
                      className="font-semibold hover:underline"
                    >
                      {product.name}
                    </Link>
                    {product.archived_at ? <Badge tone="danger">Archived</Badge> : null}
                    {!product.is_published ? <Badge tone="neutral">Hidden</Badge> : null}
                    {product.is_available ? (
                      <Badge tone="success">Available</Badge>
                    ) : (
                      <Badge tone="danger">Unavailable</Badge>
                    )}
                    {product.credit_cost !== 1 ? (
                      <Badge tone="accent">{product.credit_cost} credits</Badge>
                    ) : null}
                  </div>

                  <p className="mt-0.5 text-xs text-subtle">
                    {product.categories?.name ?? 'Uncategorised'} · {product.slug}
                    {product.calories ? ` · ${product.calories} kcal` : ''}
                  </p>

                  {!product.is_available && product.unavailable_reason ? (
                    <p className="mt-1 text-xs text-danger">
                      Shown to customers: “{product.unavailable_reason}”
                    </p>
                  ) : null}
                </div>

                <div className="flex items-end gap-2">
                  <ButtonLink href={`/admin/catalog/products/${product.id}`} variant="secondary" size="sm">Edit</ButtonLink>

                  {!product.archived_at ? (
                    <form action={toggleAvailability} className="flex items-end gap-2">
                      <input type="hidden" name="productId" value={product.id} />
                      <input
                        type="hidden"
                        name="makeAvailable"
                        value={product.is_available ? 'false' : 'true'}
                      />

                      {product.is_available ? (
                        <Input
                          name="reason"
                          placeholder="Reason customers will see"
                          className="w-56"
                        />
                      ) : null}

                      <Button
                        type="submit"
                        size="sm"
                        variant={product.is_available ? 'danger' : 'success'}
                      >
                        {product.is_available ? 'Mark unavailable' : 'Mark available'}
                      </Button>
                    </form>
                  ) : null}
                </div>
              </div>

              {!product.archived_at ? (
                <form
                  action={updatePricing}
                  className="mt-4 flex flex-wrap items-end gap-3 border-t border-line pt-4"
                >
                  <input type="hidden" name="productId" value={product.id} />

                  <label className="text-xs">
                    <span className="mb-1 block text-subtle">Price</span>
                    <Input
                      name="basePrice"
                      defaultValue={product.base_price}
                      className="w-28"
                      inputMode="decimal"
                    />
                  </label>

                  <label className="text-xs">
                    <span className="mb-1 block text-subtle">Credit cost</span>
                    <Input
                      name="creditCost"
                      defaultValue={product.credit_cost}
                      className="w-24"
                      inputMode="numeric"
                    />
                  </label>

                  <label className="text-xs">
                    <span className="mb-1 block text-subtle">Est. food cost</span>
                    <Input
                      name="estimatedCost"
                      defaultValue={product.estimated_cost ?? ''}
                      className="w-28"
                      inputMode="decimal"
                      placeholder="—"
                    />
                  </label>

                  <Button type="submit" variant="secondary" size="sm">
                    Save pricing
                  </Button>

                  <p className="ml-auto self-center text-xs text-subtle">
                    Menu price {money(product.base_price)}
                    {product.estimated_cost
                      ? ` · margin ${money(
                          Number(product.base_price) - Number(product.estimated_cost),
                        )}`
                      : ''}
                  </p>
                </form>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
