/**
 * The delivery form's rules, defined once and run on both sides of the wire.
 *
 * The browser runs them while someone fills the form in, so an error is said
 * in the field it belongs to at the moment it can be fixed: checked when the
 * field is left rather than on the first keystroke, and cleared on the
 * keystroke that fixes it. The server action runs exactly the same functions
 * again, because the browser's opinion is not a check -- and one definition
 * means the two sides can never disagree about what a valid PIN code is.
 *
 * Every message names the actual problem ("PIN codes are 6 digits. This one
 * has 5.") rather than saying "invalid". An error that says what to change is
 * one somebody fixes; a generic one is one somebody gives up over.
 */

export type DeliveryField =
  | 'fullName'
  | 'phone'
  | 'line1'
  | 'line2'
  | 'landmark'
  | 'postalCode'
  | 'city'
  | 'state'
  | 'label'
  | 'instructions';

export type FieldErrors = Partial<Record<DeliveryField, string>>;

/** "Save as" choices. The database column is free text; these are the offer. */
export const ADDRESS_LABELS = ['Home', 'Work', 'Other'] as const;

/** States and union territories, as they are written on an address. */
export const INDIAN_STATES = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
] as const;

/**
 * The ten digits of an Indian mobile number, from however it was typed or
 * pasted: "+91 98100 00001", "098100 00001" and "9810000001" are one number.
 */
export function nationalMobile(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}

/** The stored form, which is what the seeded rows and the gateways both use. */
export function storedMobile(raw: string): string {
  return `+91${nationalMobile(raw)}`;
}

/** Fields the form cannot be sent without. Everything else is marked optional. */
export const REQUIRED_FIELDS: readonly DeliveryField[] = [
  'fullName',
  'phone',
  'line1',
  'postalCode',
  'city',
  'state',
];

const LIMITS: Partial<Record<DeliveryField, number>> = {
  fullName: 120,
  line1: 200,
  line2: 200,
  landmark: 200,
  city: 80,
  instructions: 500,
};

/** The problem with one field's value, or null when there is none. */
export function checkField(field: DeliveryField, raw: string): string | null {
  const value = raw.trim();
  const limit = LIMITS[field];

  if (limit && value.length > limit) {
    return `Keep this under ${limit} characters. It is ${value.length} now.`;
  }

  switch (field) {
    case 'fullName':
      if (!value) return 'Enter the name the rider should ask for.';
      if (value.replace(/[^\p{L}]/gu, '').length < 2) return 'Enter a full name, not an initial.';
      return null;

    case 'phone': {
      const digits = nationalMobile(value);
      if (!digits) return 'Enter a mobile number so the rider can reach you.';
      if (/[^\d\s+()-]/.test(value)) return 'Use digits only in the mobile number.';
      if (digits.length !== 10) {
        return `Mobile numbers are 10 digits. This one has ${digits.length}.`;
      }
      if (!/^[6-9]/.test(digits)) return 'Indian mobile numbers start with 6, 7, 8 or 9.';
      return null;
    }

    case 'line1':
      return value ? null : 'Enter the flat or house number and the building.';

    case 'postalCode': {
      const compact = value.replace(/\s/g, '');
      if (!compact) return 'Enter the 6-digit PIN code.';
      if (!/^\d+$/.test(compact)) return 'PIN codes are numbers only.';
      if (compact.length !== 6) return `PIN codes are 6 digits. This one has ${compact.length}.`;
      if (compact.startsWith('0')) return 'PIN codes never start with 0.';
      return null;
    }

    case 'city':
      return value ? null : 'Enter the city.';

    case 'state':
      if (!value) return 'Choose the state.';
      return (INDIAN_STATES as readonly string[]).includes(value)
        ? null
        : 'Choose a state from the list.';

    case 'label':
      return !value || (ADDRESS_LABELS as readonly string[]).includes(value)
        ? null
        : 'Choose Home, Work or Other.';

    default:
      return null;
  }
}

/** Every problem in a submission, keyed by field. Empty when it can be saved. */
export function checkDelivery(values: Partial<Record<DeliveryField, string>>): FieldErrors {
  const errors: FieldErrors = {};
  const fields: DeliveryField[] = [
    'fullName',
    'phone',
    'line1',
    'line2',
    'landmark',
    'postalCode',
    'city',
    'state',
    'label',
    'instructions',
  ];

  for (const field of fields) {
    const problem = checkField(field, values[field] ?? '');
    if (problem) errors[field] = problem;
  }

  return errors;
}
