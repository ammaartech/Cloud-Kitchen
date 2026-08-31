import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { serverClient } from '@/lib/supabase/server';
import { money } from '@/lib/format';
import { bool, codify, nullableNum, num, str } from '@/lib/admin/form';
import { ActionFeedback, done, fail, readable } from '@/lib/admin/feedback';
import { CatalogNav } from '@/components/admin/catalog-nav';
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

export const metadata = { title: 'Add-ons' };
export const dynamic = 'force-dynamic';

const PATH = '/admin/catalog/add-ons';

interface AddOnRow {
  id: string;
  code: string;
  name: string;
  description: string;
  price: string;
  credit_cost: number;
  calories: number | null;
  estimated_cost: string | null;
  image_url: string | null;
  is_available: boolean;
  is_active: boolean;
  sort_order: number;
}

/**
 * Add-ons (PRD 13).
 *
 * Priced extras attachable to any dish. Availability and activity are separate
 * on purpose, matching how products work: an inactive add-on disappears, an
 * unavailable one is a thing the kitchen normally offers but has run out of.
 */
export default async function AddOnsPage({ searchParams }: PageProps<'/admin/catalog/add-ons'>) {
  await requirePermission(PERMISSIONS.catalogManage);
  const params = await searchParams;
  const supabase = await serverClient();

  const [addOnsResult, linksResult] = await Promise.all([
    supabase
      .from('add_ons')
      .select(
        'id, code, name, description, price, credit_cost, calories, estimated_cost, image_url, is_available, is_active, sort_order',
      )
      .order('sort_order'),
    supabase.from('product_add_ons').select('add_on_id'),
  ]);

  const addOns = (addOnsResult.data ?? []) as unknown as AddOnRow[];

  const usage = new Map<string, number>();
  for (const row of (linksResult.data ?? []) as Array<{ add_on_id: string }>) {
    usage.set(row.add_on_id, (usage.get(row.add_on_id) ?? 0) + 1);
  }

  async function createAddOn(formData: FormData) {
    'use server';

    const name = str(formData, 'name');
    if (!name) fail(PATH, 'An add-on needs a name.');

    const db = await serverClient();
    const { error } = await db.from('add_ons').insert({
      name,
      code: codify(str(formData, 'code') || name),
      description: str(formData, 'description'),
      price: num(formData, 'price'),
      credit_cost: num(formData, 'creditCost'),
      calories: nullableNum(formData, 'calories'),
      estimated_cost: nullableNum(formData, 'estimatedCost'),
      image_url: str(formData, 'imageUrl') || null,
      sort_order: num(formData, 'sortOrder', addOns.length),
    });

    if (error) fail(PATH, readable(error));

    revalidatePath(PATH);
    done(PATH, 'Add-on created.');
  }

  async function updateAddOn(formData: FormData) {
    'use server';

    const db = await serverClient();
    const { error } = await db
      .from('add_ons')
      .update({
        name: str(formData, 'name'),
        code: codify(str(formData, 'code')),
        description: str(formData, 'description'),
        price: num(formData, 'price'),
        credit_cost: num(formData, 'creditCost'),
        calories: nullableNum(formData, 'calories'),
        estimated_cost: nullableNum(formData, 'estimatedCost'),
        image_url: str(formData, 'imageUrl') || null,
        sort_order: num(formData, 'sortOrder'),
        is_available: bool(formData, 'isAvailable'),
        is_active: bool(formData, 'isActive'),
      })
      .eq('id', str(formData, 'addOnId'));

    if (error) fail(PATH, readable(error));

    revalidatePath(PATH);
    revalidatePath('/menu');
    done(PATH, 'Add-on saved.');
  }

  async function deleteAddOn(formData: FormData) {
    'use server';

    const db = await serverClient();
    const { error } = await db.from('add_ons').delete().eq('id', str(formData, 'addOnId'));

    if (error) fail(PATH, readable(error));

    revalidatePath(PATH);
    done(PATH, 'Add-on deleted.');
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <SectionHeading
        title="Add-ons"
        description="Priced extras. Attach them to dishes from the dish editor."
      />

      <CatalogNav />

      <ActionFeedback error={params.error as string} ok={params.ok as string} />

      <Card className="mb-8 p-5">
        <h2 className="mb-4 font-semibold">New add-on</h2>

        <form action={createAddOn} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Name" required>
            <Input name="name" placeholder="Extra roti" required />
          </Field>

          <Field label="Code" hint="Derived from the name if blank.">
            <Input name="code" placeholder="EXTRA_ROTI" />
          </Field>

          <Field label="Price" required>
            <Input name="price" inputMode="decimal" defaultValue="0" required />
          </Field>

          <Field label="Credit cost" hint="0 means it rides along free on a plan.">
            <Input name="creditCost" inputMode="numeric" defaultValue="0" />
          </Field>

          <Field label="Calories">
            <Input name="calories" inputMode="numeric" />
          </Field>

          <Field label="Estimated food cost">
            <Input name="estimatedCost" inputMode="decimal" />
          </Field>

          <Field label="Image URL">
            <Input name="imageUrl" placeholder="https://…" />
          </Field>

          <Field label="Sort order">
            <Input name="sortOrder" inputMode="numeric" defaultValue={addOns.length} />
          </Field>

          <div className="sm:col-span-2 lg:col-span-3">
            <Field label="Description">
              <Input name="description" />
            </Field>
          </div>

          <div className="flex items-end">
            <Button type="submit">Create add-on</Button>
          </div>
        </form>
      </Card>

      {addOns.length === 0 ? (
        <EmptyState title="No add-ons yet" description="Create the first one above." />
      ) : (
        <div className="space-y-3">
          {addOns.map((addOn) => (
            <Card key={addOn.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{addOn.name}</span>
                <span className="font-mono text-xs text-subtle">{addOn.code}</span>
                <span className="tabular text-sm">{money(addOn.price)}</span>
                {addOn.credit_cost > 0 ? (
                  <Badge tone="accent">{addOn.credit_cost} credit(s)</Badge>
                ) : null}
                {addOn.is_available ? (
                  <Badge tone="success">Available</Badge>
                ) : (
                  <Badge tone="danger">Unavailable</Badge>
                )}
                {!addOn.is_active ? <Badge tone="neutral">Hidden</Badge> : null}
                <span className="text-xs text-subtle">on {usage.get(addOn.id) ?? 0} dish(es)</span>
              </div>

              <form
                action={updateAddOn}
                className="mt-3 grid gap-3 border-t border-line pt-3 sm:grid-cols-2 lg:grid-cols-4"
              >
                <input type="hidden" name="addOnId" value={addOn.id} />

                <Field label="Name">
                  <Input name="name" defaultValue={addOn.name} />
                </Field>

                <Field label="Code">
                  <Input name="code" defaultValue={addOn.code} />
                </Field>

                <Field label="Price">
                  <Input name="price" defaultValue={addOn.price} inputMode="decimal" />
                </Field>

                <Field label="Credit cost">
                  <Input name="creditCost" defaultValue={addOn.credit_cost} inputMode="numeric" />
                </Field>

                <Field label="Calories">
                  <Input name="calories" defaultValue={addOn.calories ?? ''} inputMode="numeric" />
                </Field>

                <Field label="Estimated food cost">
                  <Input
                    name="estimatedCost"
                    defaultValue={addOn.estimated_cost ?? ''}
                    inputMode="decimal"
                  />
                </Field>

                <Field label="Image URL">
                  <Input name="imageUrl" defaultValue={addOn.image_url ?? ''} />
                </Field>

                <Field label="Sort order">
                  <Input name="sortOrder" defaultValue={addOn.sort_order} inputMode="numeric" />
                </Field>

                <div className="sm:col-span-2 lg:col-span-2">
                  <Field label="Description">
                    <Input name="description" defaultValue={addOn.description} />
                  </Field>
                </div>

                <div className="space-y-2 self-end">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="isAvailable"
                      defaultChecked={addOn.is_available}
                      className="h-4 w-4"
                    />
                    Available today
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="isActive"
                      defaultChecked={addOn.is_active}
                      className="h-4 w-4"
                    />
                    Active
                  </label>
                </div>

                <div className="flex items-end">
                  <Button type="submit" size="sm" variant="secondary">
                    Save add-on
                  </Button>
                </div>
              </form>

              <form action={deleteAddOn} className="mt-2">
                <input type="hidden" name="addOnId" value={addOn.id} />
                <ConfirmButton confirmLabel="Really delete?">Delete add-on</ConfirmButton>
              </form>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
