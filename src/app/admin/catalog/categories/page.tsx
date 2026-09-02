import { revalidatePath } from 'next/cache';
import { revalidateStorefront } from '@/lib/data/catalog-cache';
import { requirePermission } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { serverClient } from '@/lib/supabase/server';
import { bool, num, slugify, str } from '@/lib/admin/form';
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
  Badge,
  Button,
  Card,
  ConfirmButton,
  EmptyState,
  Field,
  Input,
  SectionHeading,
} from '@/components/ui/primitives';

export const metadata = { title: 'Categories' };

const PATH = '/admin/catalog/categories';

interface CategoryRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
}

/**
 * Categories (PRD 13).
 *
 * The single taxonomy a dish belongs to — Mains, Breads, Sides. It is what the
 * menu groups by, so the order set here is the order customers read.
 */
export default async function CategoriesPage({
  searchParams,
}: PageProps<'/admin/catalog/categories'>) {
  await requirePermission(PERMISSIONS.catalogManage);
  const params = await searchParams;
  const supabase = await serverClient();

  const [categoriesResult, productsResult] = await Promise.all([
    supabase
      .from('categories')
      .select('id, slug, name, description, image_url, sort_order, is_active')
      .order('sort_order'),
    supabase.from('products').select('category_id').is('archived_at', null),
  ]);

  const categories = (categoriesResult.data ?? []) as unknown as CategoryRow[];

  const usage = new Map<string, number>();
  for (const row of (productsResult.data ?? []) as Array<{ category_id: string | null }>) {
    if (!row.category_id) continue;
    usage.set(row.category_id, (usage.get(row.category_id) ?? 0) + 1);
  }

  async function createCategory(formData: FormData) {
    'use server';

    const name = str(formData, 'name');
    if (!name) fail(PATH, 'A category needs a name.');

    const db = await serverClient();
    const { error } = await db.from('categories').insert({
      name,
      slug: str(formData, 'slug') || slugify(name),
      description: str(formData, 'description'),
      image_url: str(formData, 'imageUrl') || null,
      sort_order: num(formData, 'sortOrder', categories.length),
    });

    if (error) fail(PATH, readable(error));

    revalidatePath(PATH);
    revalidateStorefront('/menu');
    done(PATH, 'Category created.');
  }

  async function updateCategory(formData: FormData) {
    'use server';

    const db = await serverClient();
    const { error } = await db
      .from('categories')
      .update({
        name: str(formData, 'name'),
        slug: str(formData, 'slug'),
        description: str(formData, 'description'),
        image_url: str(formData, 'imageUrl') || null,
        sort_order: num(formData, 'sortOrder'),
        is_active: bool(formData, 'isActive'),
      })
      .eq('id', str(formData, 'categoryId'));

    if (error) fail(PATH, readable(error));

    revalidatePath(PATH);
    revalidateStorefront('/menu');
    done(PATH, 'Category saved.');
  }

  async function deleteCategory(formData: FormData) {
    'use server';

    const db = await serverClient();
    // Products reference a category with ON DELETE SET NULL, so the dishes
    // survive this and simply become uncategorised.
    const { error } = await db.from('categories').delete().eq('id', str(formData, 'categoryId'));

    if (error) fail(PATH, readable(error));

    revalidatePath(PATH);
    revalidateStorefront('/menu');
    done(PATH, 'Category deleted. Its dishes are now uncategorised.');
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <SectionHeading
        title="Categories"
        description="The one taxonomy a dish belongs to. The menu is grouped and ordered by this."
      />

      <CatalogNav />

      <ActionFeedback error={params.error as string} ok={params.ok as string} />

      <Card className="mb-8 p-5">
        <h2 className="mb-4 font-semibold">New category</h2>

        <form action={createCategory} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Name" required>
            <Input name="name" placeholder="Mains" required />
          </Field>

          <Field label="Slug" hint="Derived from the name if blank.">
            <Input name="slug" />
          </Field>

          <Field label="Image URL">
            <Input name="imageUrl" placeholder="https://…" />
          </Field>

          <Field label="Sort order">
            <Input name="sortOrder" inputMode="numeric" defaultValue={categories.length} />
          </Field>

          <div className="sm:col-span-2 lg:col-span-3">
            <Field label="Description">
              <Input name="description" />
            </Field>
          </div>

          <div className="flex items-end">
            <Button type="submit">Create category</Button>
          </div>
        </form>
      </Card>

      {categories.length === 0 ? (
        <EmptyState title="No categories yet" description="Add the first one above." />
      ) : (
        <div className="space-y-3">
          {categories.map((category) => (
            <Card key={category.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{category.name}</span>
                {!category.is_active ? <Badge tone="neutral">Hidden</Badge> : null}
                <span className="text-xs text-subtle">
                  {category.slug} · {usage.get(category.id) ?? 0} dish(es)
                </span>
              </div>

              <form
                action={updateCategory}
                className="mt-3 grid gap-3 border-t border-line pt-3 sm:grid-cols-2 lg:grid-cols-5"
              >
                <input type="hidden" name="categoryId" value={category.id} />

                <Field label="Name">
                  <Input name="name" defaultValue={category.name} />
                </Field>

                <Field label="Slug">
                  <Input name="slug" defaultValue={category.slug} />
                </Field>

                <Field label="Image URL">
                  <Input name="imageUrl" defaultValue={category.image_url ?? ''} />
                </Field>

                <Field label="Sort order">
                  <Input name="sortOrder" defaultValue={category.sort_order} inputMode="numeric" />
                </Field>

                <div className="flex flex-col justify-end gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="isActive"
                      defaultChecked={category.is_active}
                      className="h-4 w-4"
                    />
                    Visible
                  </label>
                  <Button type="submit" size="sm" variant="secondary">
                    Save
                  </Button>
                </div>

                <div className="sm:col-span-2 lg:col-span-4">
                  <Field label="Description">
                    <Input name="description" defaultValue={category.description} />
                  </Field>
                </div>
              </form>

              <form action={deleteCategory} className="mt-2">
                <input type="hidden" name="categoryId" value={category.id} />
                <ConfirmButton confirmLabel="Really delete?">Delete category</ConfirmButton>
              </form>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
