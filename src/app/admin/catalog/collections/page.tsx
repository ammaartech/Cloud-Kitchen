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

export const metadata = { title: 'Collections' };

const PATH = '/admin/catalog/collections';

interface CollectionRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  image_url: string | null;
  sort_order: number;
  is_published: boolean;
}

/**
 * Collections (PRD 13).
 *
 * Merchandising groupings — "High Protein", "Chef's Picks". A dish can be in
 * many of these, unlike its single category. Which dishes belong to a
 * collection is set from the dish itself, so this screen is about the
 * collection's own identity and whether it is live.
 */
export default async function CollectionsPage({
  searchParams,
}: PageProps<'/admin/catalog/collections'>) {
  await requirePermission(PERMISSIONS.catalogManage);
  const params = await searchParams;
  const supabase = await serverClient();

  const [collectionsResult, linksResult] = await Promise.all([
    supabase
      .from('collections')
      .select('id, slug, name, description, image_url, sort_order, is_published')
      .order('sort_order'),
    supabase.from('collection_products').select('collection_id'),
  ]);

  const collections = (collectionsResult.data ?? []) as unknown as CollectionRow[];

  const counts = new Map<string, number>();
  for (const row of (linksResult.data ?? []) as Array<{ collection_id: string }>) {
    counts.set(row.collection_id, (counts.get(row.collection_id) ?? 0) + 1);
  }

  async function createCollection(formData: FormData) {
    'use server';

    const name = str(formData, 'name');
    if (!name) fail(PATH, 'A collection needs a name.');

    const db = await serverClient();
    const { error } = await db.from('collections').insert({
      name,
      slug: str(formData, 'slug') || slugify(name),
      description: str(formData, 'description'),
      image_url: str(formData, 'imageUrl') || null,
      sort_order: num(formData, 'sortOrder', collections.length),
      is_published: bool(formData, 'isPublished'),
    });

    if (error) fail(PATH, readable(error));

    revalidatePath(PATH);
    revalidateStorefront('/meal-plans');
    done(PATH, 'Collection created.');
  }

  async function updateCollection(formData: FormData) {
    'use server';

    const db = await serverClient();
    const { error } = await db
      .from('collections')
      .update({
        name: str(formData, 'name'),
        slug: str(formData, 'slug'),
        description: str(formData, 'description'),
        image_url: str(formData, 'imageUrl') || null,
        sort_order: num(formData, 'sortOrder'),
        is_published: bool(formData, 'isPublished'),
      })
      .eq('id', str(formData, 'collectionId'));

    if (error) fail(PATH, readable(error));

    revalidatePath(PATH);
    revalidateStorefront('/meal-plans');
    done(PATH, 'Collection saved.');
  }

  async function deleteCollection(formData: FormData) {
    'use server';

    const db = await serverClient();
    // collection_products cascades, so this unlinks the dishes without
    // touching the dishes themselves.
    const { error } = await db
      .from('collections')
      .delete()
      .eq('id', str(formData, 'collectionId'));

    if (error) fail(PATH, readable(error));

    revalidatePath(PATH);
    revalidateStorefront('/meal-plans');
    done(PATH, 'Collection deleted. The dishes in it are untouched.');
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <SectionHeading
        title="Collections"
        description="Merchandising groupings a dish can belong to several of. Add dishes from the dish editor."
      />

      <CatalogNav />

      <ActionFeedback error={params.error as string} ok={params.ok as string} />

      <Card className="mb-8 p-5">
        <h2 className="mb-4 font-semibold">New collection</h2>

        <form action={createCollection} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Name" required>
            <Input name="name" placeholder="High protein" required />
          </Field>

          <Field label="Slug" hint="Derived from the name if blank.">
            <Input name="slug" />
          </Field>

          <Field label="Image URL">
            <Input name="imageUrl" placeholder="https://…" />
          </Field>

          <Field label="Sort order">
            <Input name="sortOrder" inputMode="numeric" defaultValue={collections.length} />
          </Field>

          <div className="sm:col-span-2 lg:col-span-3">
            <Field label="Description">
              <Input name="description" />
            </Field>
          </div>

          <div className="flex flex-col justify-end gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isPublished" defaultChecked className="h-4 w-4" />
              Published
            </label>
            <Button type="submit">Create collection</Button>
          </div>
        </form>
      </Card>

      {collections.length === 0 ? (
        <EmptyState title="No collections yet" description="Add the first one above." />
      ) : (
        <div className="space-y-3">
          {collections.map((collection) => (
            <Card key={collection.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{collection.name}</span>
                {collection.is_published ? (
                  <Badge tone="success">Published</Badge>
                ) : (
                  <Badge tone="neutral">Hidden</Badge>
                )}
                <span className="text-xs text-subtle">
                  {collection.slug} · {counts.get(collection.id) ?? 0} dish(es)
                </span>
              </div>

              <form
                action={updateCollection}
                className="mt-3 grid gap-3 border-t border-line pt-3 sm:grid-cols-2 lg:grid-cols-5"
              >
                <input type="hidden" name="collectionId" value={collection.id} />

                <Field label="Name">
                  <Input name="name" defaultValue={collection.name} />
                </Field>

                <Field label="Slug">
                  <Input name="slug" defaultValue={collection.slug} />
                </Field>

                <Field label="Image URL">
                  <Input name="imageUrl" defaultValue={collection.image_url ?? ''} />
                </Field>

                <Field label="Sort order">
                  <Input
                    name="sortOrder"
                    defaultValue={collection.sort_order}
                    inputMode="numeric"
                  />
                </Field>

                <div className="flex flex-col justify-end gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="isPublished"
                      defaultChecked={collection.is_published}
                      className="h-4 w-4"
                    />
                    Published
                  </label>
                  <Button type="submit" size="sm" variant="secondary">
                    Save
                  </Button>
                </div>

                <div className="sm:col-span-2 lg:col-span-4">
                  <Field label="Description">
                    <Input name="description" defaultValue={collection.description} />
                  </Field>
                </div>
              </form>

              <form action={deleteCollection} className="mt-2">
                <input type="hidden" name="collectionId" value={collection.id} />
                <ConfirmButton confirmLabel="Really delete?">Delete collection</ConfirmButton>
              </form>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
