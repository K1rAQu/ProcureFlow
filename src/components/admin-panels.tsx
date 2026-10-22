"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, CardHeader, Field, Input, Select, Textarea } from "./ui";
import { IconTrash } from "./icons";
import { useT } from "./i18n-provider";
import { useConfirm } from "./confirm-provider";
import { PERMISSION_GROUPS } from "@/lib/permissions";
import { REQUEST_STATUSES } from "@/lib/workflow";

type RoleRow = { id: number; code: string; name?: string; nameRu?: string; nameUk?: string; permissions: string[]; isSystem: boolean };
type UserRow = {
  id: number;
  email: string;
  fullName: string;
  roleId: number;
  isActive: boolean;
  workshopId: number | null;
  departmentId: number | null;
  lastLoginAt: string | Date | null;
};
type DirectoryRow = {
  id: number;
  code: string;
  name?: string;
  nameRu?: string;
  nameUk?: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
};

function useApi() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(url: string, method: string, body?: unknown): Promise<boolean> {
    setBusy(true);
    setError(null);
    const response = await fetch(url, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    setBusy(false);
    if (response.ok) {
      router.refresh();
      return true;
    }
    const data = (await response.json().catch(() => ({ error: "error" }))) as { error: string };
    setError(data.error);
    return false;
  }

  return { busy, error, send, setError };
}

export function UsersPanel({
  users,
  roles,
  workshops,
  departments,
}: {
  users: UserRow[];
  roles: RoleRow[];
  workshops: DirectoryRow[];
  departments: DirectoryRow[];
}) {
  const t = useT();
  const { busy, error, send } = useApi();
  const [userList, setUserList] = useState(users);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    roleId: roles[0]?.id ?? 0,
    workshopId: "",
    departmentId: "",
  });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [password, setPassword] = useState("");

  useEffect(() => {
    setUserList(users);
  }, [users]);

  return (
    <Card>
      <CardHeader
        title={t("admin.users")}
        actions={
          <Button type="button" size="sm" onClick={() => setOpen((value) => !value)}>
            + {t("admin.addUser")}
          </Button>
        }
      />
      {open ? (
        <div className="grid gap-3 border-b border-slate-200 bg-slate-50 p-4 sm:grid-cols-3">
          <Field label={t("auth.fullName")} required>
            <Input value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} />
          </Field>
          <Field label={t("auth.email")} required>
            <Input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </Field>
          <Field label={t("auth.password")} required hint="min. 8">
            <Input
              type="text"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
            />
          </Field>
          <Field label={t("admin.role")} required>
            <Select
              value={form.roleId}
              onChange={(event) => setForm({ ...form, roleId: Number(event.target.value) })}
            >
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.nameUk || role.nameRu}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("request.workshop")}>
            <Select value={form.workshopId} onChange={(event) => setForm({ ...form, workshopId: event.target.value })}>
              <option value="">—</option>
              {workshops.map((workshop) => (
                <option key={workshop.id} value={workshop.id}>
                  {workshop.nameUk || workshop.nameRu}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("request.department")}>
            <Select
              value={form.departmentId}
              onChange={(event) => setForm({ ...form, departmentId: event.target.value })}
            >
              <option value="">—</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.nameUk || department.nameRu}
                </option>
              ))}
            </Select>
          </Field>
          <div className="sm:col-span-3">
            <Button
              type="button"
              size="sm"
              disabled={busy || !form.fullName || !form.email || form.password.length < 8}
              onClick={async () => {
                const ok = await send("/api/admin/users", "POST", {
                  ...form,
                  workshopId: form.workshopId ? Number(form.workshopId) : null,
                  departmentId: form.departmentId ? Number(form.departmentId) : null,
                });
                if (ok) {
                  setForm({ fullName: "", email: "", password: "", roleId: roles[0]?.id ?? 0, workshopId: "", departmentId: "" });
                  setOpen(false);
                }
              }}
            >
              {t("common.create")}
            </Button>
            {error ? <span className="ml-3 text-xs text-rose-600">{error}</span> : null}
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
            <tr>
              <th className="px-4 py-2">{t("auth.fullName")}</th>
              <th className="px-4 py-2">{t("auth.email")}</th>
              <th className="px-4 py-2">{t("admin.role")}</th>
              <th className="px-4 py-2">{t("request.workshop")}</th>
              <th className="px-4 py-2">{t("admin.active")}</th>
              <th className="px-4 py-2 text-right">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {userList.map((user) => (
              <tr key={user.id}>
                <td className="px-4 py-2 font-medium text-slate-800">{user.fullName}</td>
                <td className="px-4 py-2 text-slate-600">{user.email}</td>
                <td className="px-4 py-2">
                  <Select
                    value={user.roleId}
                    className="min-w-36 py-1 text-xs"
                    onChange={(event) => {
                      const nextRole = Number(event.target.value);
                      setUserList((prev) => prev.map((u) => (u.id === user.id ? { ...u, roleId: nextRole } : u)));
                      void send(`/api/admin/users/${user.id}`, "PATCH", { roleId: nextRole });
                    }}
                  >
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.nameUk || role.nameRu}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="px-4 py-2">
                  <Select
                    value={user.workshopId ?? ""}
                    className="min-w-32 py-1 text-xs"
                    onChange={(event) => {
                      const nextWorkshop = event.target.value ? Number(event.target.value) : null;
                      setUserList((prev) => prev.map((u) => (u.id === user.id ? { ...u, workshopId: nextWorkshop } : u)));
                      void send(`/api/admin/users/${user.id}`, "PATCH", {
                        workshopId: nextWorkshop,
                      });
                    }}
                  >
                    <option value="">—</option>
                    {workshops.map((workshop) => (
                      <option key={workshop.id} value={workshop.id}>
                        {workshop.nameUk || workshop.nameRu}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="px-4 py-2">
                  <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={user.isActive}
                      onChange={(event) => {
                        const nextActive = event.target.checked;
                        setUserList((prev) => prev.map((u) => (u.id === user.id ? { ...u, isActive: nextActive } : u)));
                        void send(`/api/admin/users/${user.id}`, "PATCH", { isActive: nextActive });
                      }}
                    />
                    {user.isActive ? t("common.yes") : t("common.no")}
                  </label>
                </td>
                <td className="px-4 py-2 text-right">
                  {editing === user.id ? (
                    <span className="flex items-center justify-end gap-1">
                      <Input
                        className="w-40 py-1 text-xs"
                        placeholder={t("admin.newPassword")}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                      />
                      <Button
                        type="button"
                        size="sm"
                        disabled={password.length < 8}
                        onClick={async () => {
                          const ok = await send(`/api/admin/users/${user.id}`, "PATCH", { password });
                          if (ok) {
                            setPassword("");
                            setEditing(null);
                          }
                        }}
                      >
                        {t("common.save")}
                      </Button>
                    </span>
                  ) : (
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(user.id)}>
                      {t("admin.newPassword")}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error ? <p className="px-4 py-2 text-xs text-rose-600">{error}</p> : null}
    </Card>
  );
}

export function RolesPanel({ roles }: { roles: RoleRow[] }) {
  const t = useT();
  const { busy, error, send } = useApi();
  const [selected, setSelected] = useState<number>(roles[0]?.id ?? 0);
  const [newRole, setNewRole] = useState({ code: "", name: "" });
  const role = roles.find((item) => item.id === selected);
  const [permissions, setPermissions] = useState<string[]>(role?.permissions ?? []);
  const [touched, setTouched] = useState(false);

  function selectRole(id: number) {
    setSelected(id);
    setPermissions(roles.find((item) => item.id === id)?.permissions ?? []);
    setTouched(false);
  }

  return (
    <Card>
      <CardHeader title={t("admin.roles")} description={t("admin.permissions")} />
      <div className="grid gap-4 p-4 lg:grid-cols-3">
        <div className="space-y-2">
          {roles.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => selectRole(item.id)}
              className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                item.id === selected ? "border-[#12325c] bg-slate-50" : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              <span>
                <span className="block font-medium text-slate-800">{item.nameUk || item.nameRu}</span>
                <span className="block text-[11px] text-slate-400">{item.code}</span>
              </span>
              {item.isSystem ? <Badge tone="slate">system</Badge> : null}
            </button>
          ))}
          <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3">
            <Field label={t("admin.code")}>
              <Input
                value={newRole.code}
                placeholder="warehouse_lead"
                onChange={(event) => setNewRole({ ...newRole, code: event.target.value })}
              />
            </Field>
            <Field label={t("admin.name")}>
              <Input value={newRole.name} onChange={(event) => setNewRole({ ...newRole, name: event.target.value })} />
            </Field>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy || newRole.code.length < 2 || newRole.name.length < 2}
              onClick={async () => {
                const ok = await send("/api/admin/roles", "POST", {
                  code: newRole.code,
                  name: newRole.name,
                  nameRu: newRole.name,
                  nameUk: newRole.name,
                  permissions: [],
                });
                if (ok) setNewRole({ code: "", name: "" });
              }}
            >
              + {t("admin.addRole")}
            </Button>
          </div>
        </div>

        <div className="lg:col-span-2">
          {role ? (
            <>
              <div className="space-y-3">
                {PERMISSION_GROUPS.map((group) => (
                  <div key={group.group}>
                    <p className="mb-1 text-xs font-semibold uppercase text-slate-400">{group.group}</p>
                    <div className="grid gap-1 sm:grid-cols-2">
                      {group.items.map((permission) => (
                        <label key={permission} className="flex items-center gap-2 text-xs text-slate-700">
                          <input
                            type="checkbox"
                            disabled={role.code === "admin"}
                            checked={permissions.includes(permission)}
                            onChange={(event) => {
                              setTouched(true);
                              setPermissions((current) =>
                                event.target.checked
                                  ? [...current, permission]
                                  : current.filter((item) => item !== permission),
                              );
                            }}
                          />
                          {permission}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-3">
                <Button
                  type="button"
                  size="sm"
                  disabled={busy || !touched || role.code === "admin"}
                  onClick={() => send(`/api/admin/roles/${role.id}`, "PATCH", { permissions })}
                >
                  {t("common.save")}
                </Button>
                {error ? <span className="text-xs text-rose-600">{error}</span> : null}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

export function DirectoryPanel({
  kind,
  title,
  items,
  codePlaceholder = "code-1",
  namePlaceholder = "Назва",
  nameLabel,
  descriptionPlaceholder = "Опис",
}: {
  kind: "workshops" | "departments" | "units";
  title: string;
  items: DirectoryRow[];
  codePlaceholder?: string;
  namePlaceholder?: string;
  nameLabel?: string;
  descriptionPlaceholder?: string;
}) {
  const t = useT();
  const confirm = useConfirm();
  const { busy, error, send, setError } = useApi();
  const [rows, setRows] = useState(items);
  const [form, setForm] = useState({ code: "", name: "", description: "", sortOrder: 100 });
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    setRows(items);
  }, [items]);

  const handleDelete = async (item: DirectoryRow) => {
    const label = item.nameUk || item.nameRu || item.code;
    const ok = await confirm({
      title: t("admin.deleteConfirmTitle"),
      message: t("admin.deleteConfirmMsg", { label, code: item.code }),
      confirmText: t("common.delete"),
      cancelText: t("common.cancel"),
      tone: "danger",
    });
    if (!ok) return;
    setDeletingId(item.id);
    setRows((prev) => prev.filter((r) => r.id !== item.id));
    await send(`/api/admin/directories/${kind}/${item.id}`, "DELETE");
    setDeletingId(null);
  };

  return (
    <Card>
      <CardHeader title={title} description={items.length === 0 ? t("admin.emptyDirectory") : undefined} />
      <div className="grid gap-3 border-b border-slate-200 bg-slate-50 p-4 sm:grid-cols-5">
        <Field label={t("admin.code")} required>
          <Input
            value={form.code}
            placeholder={codePlaceholder}
            onChange={(event) => setForm({ ...form, code: event.target.value })}
          />
        </Field>
        <Field label={nameLabel ?? t("admin.name")} required>
          <Input
            value={form.name}
            placeholder={namePlaceholder}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </Field>
        <Field label={t("nom.description")}>
          <Input
            value={form.description}
            placeholder={descriptionPlaceholder}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
        </Field>
        <Field label={t("common.sort")}>
          <Input
            type="number"
            value={form.sortOrder}
            onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) || 0 })}
          />
        </Field>
        <div className="flex items-end">
          <Button
            type="button"
            size="sm"
            disabled={busy || form.code.trim().length < 1 || form.name.trim().length < 1}
            onClick={async () => {
              const ok = await send(`/api/admin/directories/${kind}`, "POST", {
                code: form.code.trim(),
                name: form.name.trim(),
                nameRu: form.name.trim(),
                nameUk: form.name.trim(),
                description: form.description.trim() || null,
                sortOrder: form.sortOrder,
                isActive: true,
              });
              if (ok) setForm({ code: "", name: "", description: "", sortOrder: 100 });
            }}
          >
            + {t("common.add")}
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-2.5">{t("admin.code")}</th>
              <th className="px-4 py-2.5">{nameLabel ?? t("admin.name")}</th>
              <th className="px-4 py-2.5">{t("nom.description")}</th>
              <th className="px-4 py-2.5 w-24">{t("common.sort")}</th>
              <th className="px-4 py-2.5">{t("admin.active")}</th>
              <th className="px-4 py-2.5 text-right">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map((item) => (
              <tr key={item.id} className="transition hover:bg-slate-50/60">
                <td className="px-4 py-2 font-mono text-xs text-slate-500">{item.code}</td>
                <td className="px-4 py-2">
                  <Input
                    className="py-1 text-xs"
                    defaultValue={item.nameUk || item.nameRu}
                    onBlur={(event) => {
                      const val = event.target.value.trim();
                      if (val && val !== (item.nameUk || item.nameRu)) {
                        setRows((prev) => prev.map((r) => (r.id === item.id ? { ...r, nameUk: val, nameRu: val } : r)));
                        void send(`/api/admin/directories/${kind}/${item.id}`, "PATCH", {
                          name: val,
                          nameRu: val,
                          nameUk: val,
                        });
                      }
                    }}
                  />
                </td>
                <td className="px-4 py-2">
                  <Input
                    className="py-1 text-xs"
                    defaultValue={item.description ?? ""}
                    placeholder="Опис"
                    onBlur={(event) => {
                      const val = event.target.value.trim();
                      if (val !== (item.description ?? "")) {
                        setRows((prev) => prev.map((r) => (r.id === item.id ? { ...r, description: val || null } : r)));
                        void send(`/api/admin/directories/${kind}/${item.id}`, "PATCH", {
                          description: val || null,
                        });
                      }
                    }}
                  />
                </td>
                <td className="px-4 py-2 w-24">
                  <Input
                    type="number"
                    className="py-1 text-xs w-20"
                    defaultValue={item.sortOrder}
                    onBlur={(event) => {
                      const val = Number(event.target.value);
                      if (!isNaN(val) && val !== item.sortOrder) {
                        setRows((prev) => prev.map((r) => (r.id === item.id ? { ...r, sortOrder: val } : r)));
                        void send(`/api/admin/directories/${kind}/${item.id}`, "PATCH", {
                          sortOrder: val,
                        });
                      }
                    }}
                  />
                </td>
                <td className="px-4 py-2">
                  <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.isActive}
                      onChange={(event) => {
                        const nextActive = event.target.checked;
                        setRows((prev) => prev.map((r) => (r.id === item.id ? { ...r, isActive: nextActive } : r)));
                        void send(`/api/admin/directories/${kind}/${item.id}`, "PATCH", { isActive: nextActive });
                      }}
                    />
                    {item.isActive ? t("common.yes") : t("common.no")}
                  </label>
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    title="Видалити"
                    disabled={busy || deletingId === item.id}
                    onClick={() => handleDelete(item)}
                    className="rounded p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                  >
                    <IconTrash className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error ? (
        <div className="flex items-center justify-between border-t border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-700">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="font-bold text-rose-500 hover:text-rose-700">
            ✕
          </button>
        </div>
      ) : null}
    </Card>
  );
}

export function SettingsPanel({
  settings,
}: {
  settings: {
    defaultLocale?: string;
    editableStatuses: string[];
    requiredItemFields: string[];
    autoApproveNomenclature: boolean;
    maxUploadMb: number;
    sessionTimeoutMinutes?: number;
  };
}) {
  const t = useT();
  const { busy, error, send } = useApi();
  const [state, setState] = useState({
    ...settings,
    defaultLocale: settings.defaultLocale ?? "en",
    sessionTimeoutMinutes: settings.sessionTimeoutMinutes ?? 30,
  });
  const [saved, setSaved] = useState(false);

  return (
    <Card>
      <CardHeader title={t("admin.settings")} />
      <div className="space-y-5 p-4">
        {/* Centralized System Language Setting */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
          <label className="mb-0.5 block text-xs font-semibold text-slate-800">
            {t("admin.settingLanguage")}
          </label>
          <p className="mb-3 text-[11px] text-slate-500">
            {t("admin.settingLanguageHint")}
          </p>
          <div className="flex flex-wrap gap-5">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="defaultLocale"
                value="en"
                checked={state.defaultLocale === "en"}
                onChange={() => setState((s) => ({ ...s, defaultLocale: "en" }))}
                className="text-[#12325c] focus:ring-[#12325c]"
              />
              🇬🇧 {t("admin.settingLangEn")}
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="defaultLocale"
                value="uk"
                checked={state.defaultLocale === "uk"}
                onChange={() => setState((s) => ({ ...s, defaultLocale: "uk" }))}
                className="text-[#12325c] focus:ring-[#12325c]"
              />
              🇺🇦 {t("admin.settingLangUk")}
            </label>
          </div>
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-slate-600">{t("admin.settingEditable")}</p>
          <div className="flex flex-wrap gap-2">
            {REQUEST_STATUSES.filter((status) => !["completed", "rejected", "cancelled"].includes(status)).map(
              (status) => (
                <label key={status} className="flex items-center gap-1 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    disabled={status === "draft"}
                    checked={state.editableStatuses.includes(status)}
                    onChange={(event) =>
                      setState((current) => ({
                        ...current,
                        editableStatuses: event.target.checked
                          ? [...current.editableStatuses, status]
                          : current.editableStatuses.filter((item) => item !== status),
                      }))
                    }
                  />
                  {t(`status.${status}`)}
                </label>
              ),
            )}
          </div>
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-slate-600">{t("admin.settingRequireFields")}</p>
          <div className="flex flex-wrap gap-2">
            {[
              { id: "partNumber", label: t("item.partNumber") },
              { id: "url", label: t("item.url") },
              { id: "photo", label: t("item.photo") },
            ].map(({ id, label }) => (
              <label key={id} className="flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={state.requiredItemFields.includes(id)}
                  onChange={(event) =>
                    setState((current) => ({
                      ...current,
                      requiredItemFields: event.target.checked
                        ? [...current.requiredItemFields, id]
                        : current.requiredItemFields.filter((item) => item !== id),
                    }))
                  }
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={state.autoApproveNomenclature}
            onChange={(event) => setState({ ...state, autoApproveNomenclature: event.target.checked })}
          />
          {t("admin.settingAutoApprove")}
        </label>

        <Field label={t("admin.settingMaxUpload")} className="max-w-32">
          <Input
            type="number"
            min={1}
            max={50}
            value={state.maxUploadMb}
            onChange={(event) => setState({ ...state, maxUploadMb: Number(event.target.value) })}
          />
        </Field>

        <Field label={t("admin.settingSessionTimeout")} className="max-w-64">
          <Input
            type="number"
            min={0}
            max={1440}
            value={state.sessionTimeoutMinutes}
            onChange={(event) => setState({ ...state, sessionTimeoutMinutes: Number(event.target.value) })}
          />
        </Field>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={async () => {
              const ok = await send("/api/admin/settings", "PATCH", state);
              setSaved(ok);
              if (ok && state.defaultLocale !== settings.defaultLocale) {
                setTimeout(() => {
                  window.location.reload();
                }, 300);
              }
            }}
          >
            {t("common.save")}
          </Button>
          {saved ? <span className="text-xs text-emerald-600">{t("common.saved")}</span> : null}
          {error ? <span className="text-xs text-rose-600">{error}</span> : null}
        </div>
      </div>
    </Card>
  );
}

export function NoteBlock({ text }: { text: string }) {
  return <Textarea readOnly value={text} className="bg-slate-50 text-xs" rows={3} />;
}
