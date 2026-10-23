
export const PERMISSIONS = [
  "requests.create",
  "requests.view_own",
  "requests.view_all",
  "requests.view_workshop",
  "requests.process",
  "requests.assign",
  "requests.edit_any",
  "nomenclature.view",
  "nomenclature.create",
  "nomenclature.edit",
  "nomenclature.archive",
  "nomenclature.merge",
  "nomenclature.approve",
  "admin.users",
  "admin.roles",
  "admin.directories",
  "admin.settings",
  "audit.view",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_GROUPS: { group: string; items: Permission[] }[] = [
  {
    group: "requests",
    items: [
      "requests.create",
      "requests.view_own",
      "requests.view_all",
      "requests.view_workshop",
      "requests.process",
      "requests.assign",
      "requests.edit_any",
    ],
  },
  {
    group: "nomenclature",
    items: [
      "nomenclature.view",
      "nomenclature.create",
      "nomenclature.edit",
      "nomenclature.archive",
      "nomenclature.merge",
      "nomenclature.approve",
    ],
  },
  {
    group: "admin",
    items: ["admin.users", "admin.roles", "admin.directories", "admin.settings", "audit.view"],
  },
];

export type RolePreset = {
  code: string;
  nameRu: string;
  nameUk: string;
  isSystem: boolean;
  permissions: Permission[];
};

export const ROLE_PRESETS: RolePreset[] = [
  {
    code: "admin",
    nameRu: "Адміністратор",
    nameUk: "Адміністратор",
    isSystem: true,
    permissions: [...PERMISSIONS],
  },
  {
    code: "purchasing_head",
    nameRu: "Керівник відділу закупівель",
    nameUk: "Керівник відділу закупівель",
    isSystem: false,
    permissions: [
      "requests.create",
      "requests.view_own",
      "requests.view_all",
      "requests.process",
      "requests.assign",
      "requests.edit_any",
      "nomenclature.view",
      "nomenclature.create",
      "nomenclature.edit",
      "nomenclature.archive",
      "nomenclature.merge",
      "nomenclature.approve",
      "audit.view",
    ],
  },
  {
    code: "purchaser",
    nameRu: "Співробітник відділу закупівель",
    nameUk: "Співробітник відділу закупівель",
    isSystem: false,
    permissions: [
      "requests.create",
      "requests.view_own",
      "requests.view_all",
      "requests.process",
      "nomenclature.view",
      "nomenclature.create",
      "nomenclature.edit",
    ],
  },
  {
    code: "workshop_lead",
    nameRu: "Відповідальний за цех",
    nameUk: "Відповідальний за цех",
    isSystem: false,
    permissions: [
      "requests.create",
      "requests.view_own",
      "requests.view_workshop",
      "nomenclature.view",
      "nomenclature.create",
    ],
  },
  {
    code: "user",
    nameRu: "Користувач",
    nameUk: "Користувач",
    isSystem: true,
    permissions: ["requests.create", "requests.view_own", "nomenclature.view", "nomenclature.create"],
  },
];

export function hasPermission(permissions: string[] | undefined | null, needed: Permission): boolean {
  if (!permissions) return false;
  return permissions.includes(needed);
}

export function hasAnyPermission(permissions: string[] | undefined | null, needed: Permission[]): boolean {
  if (!permissions) return false;
  return needed.some((item) => permissions.includes(item));
}

export function isValidPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}
