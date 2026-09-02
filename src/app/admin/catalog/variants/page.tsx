import { revalidatePath } from 'next/cache';
import { revalidateStorefront } from '@/lib/data/catalog-cache';
import { requirePermission } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { serverClient } from '@/lib/supabase/server';
import { money } from '@/lib/format';
import { bool, codify, nullableNum, num, str } from '@/lib/admin/form';
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
  Select,
} from '@/components/ui/primitives';

export const metadata = { title: 'Variant groups' };

const PATH = '/admin/catalog/variants';

interface VariantGroupRow {
  id: string;
  code: string;
  name: string;
  selection_type: string;
  is_required: boolean;
  min_selections: number;
  max_selections: number | null;
  sort_order: number;
  is_active: boolean;
  variants: Array<{
    id: string;
    code: string;
    name: string;
    price_delta: string;
    credit_delta: number;
    calorie_delta: number;
    is_default: boolean;
    is_available: boolean;
    sort_order: number;
  }>;
}

/**
 * Variant groups and their options (PRD 13).
 *
 * A group is defined once and attached to many dishes, so "Portion" does not
 * have to be re-created per meal. Each option carries its own price, credit and
 * calorie delta -- a larger portion can legitimately cost an extra credit, and
 * that has to be data rather than an assumption in the checkout.
 */
export default async function VariantsPage({
  searchParams,
}: PageProps<'/admin/catalog/variants'>) {
  await requirePermission(PERMISSIONS.catalogManage);
  const params = await searchParams;
  const supabase = await serverClient();

  const [groupsResult, linksResult] = await Promise.all([
    supabase
      .from('variant_groups')
      .select(
        `id, code, name, selection_type, is_required, min_selections, max_selections,
         sort_order, is_active,
         variants ( id, code, name, price_delta, credit_delta, calorie_delta, is_default, is_available, sort_order )`,
      )
      .order('sort_order'),
    supabase.from('product_variant_groups').select('variant_group_id'),
  ]);

  const groups = (groupsResult.data ?? []) as unknown as VariantGroupRow[];

  const usage = new Map<string, number>();
  for (const row of (linksResult.data ?? []) as Array<{ variant_group_id: string }>) {
    usage.set(row.variant_group_id, (usage.get(row.variant_group_id) ?? 0) + 1);
  }

  async function createGroup(formData: FormData) {
    'use server';

    const name = str(formData, 'name');
    if (!name) fail(PATH, 'A variant group needs a name.');

    const db = await serverClient();
    const { error } = await db.from('variant_groups').insert({
      name,
      code: codify(str(formData, 'code') || name),
      selection_type: str(formData, 'selectionType'),
      is_required: bool(formData, 'isRequired'),
      min_selections: num(formData, 'minSelections'),
      max_selections: nullableNum(formData, 'maxSelections'),
      sort_order: num(formData, 'sortOrder', groups.length),
    });

    if (error) fail(PATH, readable(error));

    revalidatePath(PATH);
    done(PATH, 'Variant group created.');
  }

  async function updateGroup(formData: FormData) {
    'use server';

    const db = await serverClient();
    const { error } = await db
      .from('variant_groups')
      .update({
        name: str(formData, 'name'),
        code: codify(str(formData, 'code')),
        selection_type: str(formData, 'selectionType'),
        is_required: bool(formData, 'isRequired'),
        min_selections: num(formData, 'minSelections'),
        max_selections: nullableNum(formData, 'maxSelections'),
        sort_order: num(formData, 'sortOrder'),
        is_active: bool(formData, 'isActive'),
      })
      .eq('id', str(formData, 'groupId'));

    if (error) fail(PATH, readable(error));

    revalidatePath(PATH);
    revalidateStorefront('/menu');
    done(PATH, 'Variant group saved.');
  }

  async function deleteGroup(formData: FormData) {
    'use server';

    const db = await serverClient();
    const { error } = await db.from('variant_groups').delete().eq('id', str(formData, 'groupId'));

    if (error) fail(PATH, readable(error));

    revalidatePath(PATH);
    done(PATH, 'Variant group deleted.');
  }

  async function addVariant(formData: FormData) {
    'use server';

    const name = str(formData, 'name');
    if (!name) fail(PATH, 'An option needs a name.');

    const db = await serverClient();
    const { error } = await db.from('variants').insert({
      variant_group_id: str(formData, 'groupId'),
      name,
      code: codify(str(formData, 'code') || name),
      price_delta: num(formData, 'priceDelta'),
      credit_delta: num(formData, 'creditDelta'),
      calorie_delta: num(formData, 'calorieDelta'),
      is_default: bool(formData, 'isDefault'),
      sort_order: num(formData, 'sortOrder'),
    });

    if (error) fail(PATH, readable(error));

    revalidatePath(PATH);
    revalidateStorefront('/menu');
    done(PATH, 'Option added.');
  }

  async function updateVariant(formData: FormData) {
    'use server';

    const db = await serverClient();
    const { error } = await db
      .from('variants')
      .update({
        name: str(formData, 'name'),
        price_delta: num(formData, 'priceDelta'),
        credit_delta: num(formData, 'creditDelta'),
        calorie_delta: num(formData, 'calorieDelta'),
        is_default: bool(formData, 'isDefault'),
        is_available: bool(formData, 'isAvailable'),
      })
      .eq('id', str(formData, 'variantId'));

    if (error) fail(PATH, readable(error));

    revalidatePath(PATH);
    revalidateStorefront('/menu');
    done(PATH, 'Option saved.');
  }

  async function deleteVariant(formData: FormData) {
    'use server';

    const db = await serverClient();
    const { error } = await db.from('variants').delete().eq('id', str(formData, 'variantId'));

    if (error) fail(PATH, readable(error));

    revalidatePath(PATH);
    revalidateStorefront('/menu');
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <SectionHeading
        title="Variant groups"
        description="Defined once, attached to any dish. Each option carries its own price, credit and calorie delta."
      />

      <CatalogNav />

      <ActionFeedback error={params.error as string} ok={params.ok as string} />

      <Card className="mb-8 p-5">
        <h2 className="mb-4 font-semibold">New variant group</h2>

        <form action={createGroup} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Name" required>
            <Input name="name" placeholder="Portion" required />
          </Field>

          <Field label="Code" hint="Derived from the name if blank.">
            <Input name="code" placeholder="PORTION" />
          </Field>

          <Field label="Selection">
            <Select name="selectionType" defaultValue="single">
              <option value="single">Pick one</option>
              <option value="multiple">Pick several</option>
            </Select>
          </Field>

          <Field label="Sort order">
            <Input name="sortOrder" inputMode="numeric" defaultValue={groups.length} />
          </Field>

          <Field label="Minimum selections">
            <Input name="minSelections" inputMode="numeric" defaultValue="1" />
          </Field>

          <Field label="Maximum selections" hint="Blank = unbounded.">
            <Input name="maxSelections" inputMode="numeric" />
          </Field>

          <label className="flex items-center gap-2 self-end text-sm">
            <input type="checkbox" name="isRequired" defaultChecked className="h-4 w-4" />
            Required
          </label>

          <div className="flex items-end">
            <Button type="submit">Create group</Button>
          </div>
        </form>
      </Card>

      {groups.length === 0 ? (
        <EmptyState
          title="No variant groups yet"
          description="Create one above, then attach it to dishes from the dish editor."
        />
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <Card key={group.id} className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{group.name}</span>
                <span className="font-mono text-xs text-subtle">{group.code}</span>
                <Badge tone="neutral">
                  {group.selection_type === 'single' ? 'pick one' : 'pick several'}
                </Badge>
                {group.is_required ? <Badge tone="accent">Required</Badge> : null}
                {!group.is_active ? <Badge tone="warning">Inactive</Badge> : null}
                <span className="text-xs text-subtle">
                  on {usage.get(group.id) ?? 0} dish(es)
                </span>
              </div>

              {/* -------------------------------------------------------- */}
              {/* Group settings                                            */}
              {/* -------------------------------------------------------- */}
              <form
                action={updateGroup}
                className="mt-3 grid gap-3 border-t border-line pt-3 sm:grid-cols-2 lg:grid-cols-4"
              >
                <input type="hidden" name="groupId" value={group.id} />

                <Field label="Name">
                  <Input name="name" defaultValue={group.name} />
                </Field>

                <Field label="Code">
                  <Input name="code" defaultValue={group.code} />
                </Field>

                <Field label="Selection">
                  <Select name="selectionType" defaultValue={group.selection_type}>
                    <option value="single">Pick one</option>
                    <option value="multiple">Pick several</option>
                  </Select>
                </Field>

                <Field label="Sort order">
                  <Input name="sortOrder" defaultValue={group.sort_order} inputMode="numeric" />
                </Field>

                <Field label="Minimum selections">
                  <Input
                    name="minSelections"
                    defaultValue={group.min_selections}
                    inputMode="numeric"
                  />
                </Field>

                <Field label="Maximum selections">
                  <Input
                    name="maxSelections"
                    defaultValue={group.max_selections ?? ''}
                    inputMode="numeric"
                    placeholder="unbounded"
                  />
                </Field>

                <div className="space-y-2 self-end">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="isRequired"
                      defaultChecked={group.is_required}
                      className="h-4 w-4"
                    />
                    Required
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="isActive"
                      defaultChecked={group.is_active}
                      className="h-4 w-4"
                    />
                    Active
                  </label>
                </div>

                <div className="flex items-end gap-2">
                  <Button type="submit" size="sm" variant="secondary">
                    Save group
                  </Button>
                </div>
              </form>

              {/* -------------------------------------------------------- */}
              {/* Options                                                   */}
              {/* -------------------------------------------------------- */}
              <div className="mt-5 border-t border-line pt-4">
                <p className="mb-2 text-xs font-medium text-subtle">Options</p>

                {group.variants.length === 0 ? (
                  <p className="text-sm text-muted">
                    No options yet — a group with none is not offerable.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {[...group.variants]
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .map((variant) => (
                        <li key={variant.id}>
                          <form
                            action={updateVariant}
                            className="flex flex-wrap items-end gap-2 rounded-ck border border-line px-3 py-2"
                          >
                            <input type="hidden" name="variantId" value={variant.id} />

                            <label className="text-xs">
                              <span className="mb-1 block text-subtle">Name</span>
                              <Input name="name" defaultValue={variant.name} className="w-40" />
                            </label>

                            <label className="text-xs">
                              <span className="mb-1 block text-subtle">Price delta</span>
                              <Input
                                name="priceDelta"
                                defaultValue={variant.price_delta}
                                className="w-28"
                                inputMode="decimal"
                              />
                            </label>

                            <label className="text-xs">
                              <span className="mb-1 block text-subtle">Credit delta</span>
                              <Input
                                name="creditDelta"
                                defaultValue={variant.credit_delta}
                                className="w-24"
                                inputMode="numeric"
                              />
                            </label>

                            <label className="text-xs">
                              <span className="mb-1 block text-subtle">Calorie delta</span>
                              <Input
                                name="calorieDelta"
                                defaultValue={variant.calorie_delta}
                                className="w-24"
                                inputMode="numeric"
                              />
                            </label>

                            <label className="flex items-center gap-1.5 self-center text-xs">
                              <input
                                type="checkbox"
                                name="isDefault"
                                defaultChecked={variant.is_default}
                                className="h-4 w-4"
                              />
                              Default
                            </label>

                            <label className="flex items-center gap-1.5 self-center text-xs">
                              <input
                                type="checkbox"
                                name="isAvailable"
                                defaultChecked={variant.is_available}
                                className="h-4 w-4"
                              />
                              Available
                            </label>

                            <span className="self-center text-xs text-subtle">
                              {Number(variant.price_delta) === 0
                                ? 'no extra charge'
                                : `${money(variant.price_delta)}`}
                            </span>

                            <Button type="submit" size="sm" variant="secondary" className="ml-auto">
                              Save
                            </Button>
                          </form>

                          <form action={deleteVariant} className="mt-1">
                            <input type="hidden" name="variantId" value={variant.id} />
                            <ConfirmButton confirmLabel="Really remove?">Remove option</ConfirmButton>
                          </form>
                        </li>
                      ))}
                  </ul>
                )}

                <form
                  action={addVariant}
                  className="mt-4 flex flex-wrap items-end gap-2 border-t border-line pt-4"
                >
                  <input type="hidden" name="groupId" value={group.id} />

                  <label className="text-xs">
                    <span className="mb-1 block text-subtle">New option</span>
                    <Input name="name" placeholder="Large" className="w-40" />
                  </label>

                  <label className="text-xs">
                    <span className="mb-1 block text-subtle">Price delta</span>
                    <Input name="priceDelta" defaultValue="0" className="w-28" inputMode="decimal" />
                  </label>

                  <label className="text-xs">
                    <span className="mb-1 block text-subtle">Credit delta</span>
                    <Input name="creditDelta" defaultValue="0" className="w-24" inputMode="numeric" />
                  </label>

                  <label className="text-xs">
                    <span className="mb-1 block text-subtle">Calorie delta</span>
                    <Input name="calorieDelta" defaultValue="0" className="w-24" inputMode="numeric" />
                  </label>

                  <label className="flex items-center gap-1.5 self-center text-xs">
                    <input type="checkbox" name="isDefault" className="h-4 w-4" />
                    Default
                  </label>

                  <Button type="submit" size="sm">
                    Add option
                  </Button>
                </form>
              </div>

              <form action={deleteGroup} className="mt-4">
                <input type="hidden" name="groupId" value={group.id} />
                <ConfirmButton confirmLabel="Really delete?">Delete group</ConfirmButton>
              </form>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
