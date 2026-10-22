import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { roles, users } from "@/db/schema";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { DirectoryPanel, RolesPanel, SettingsPanel, UsersPanel } from "@/components/admin-panels";
import { MaintenancePanel } from "@/components/admin-maintenance-panel";
import { NomenclatureRowActions } from "@/components/nomenclature-admin";
import { NomenclatureStatusBadge } from "@/components/status";
import { loadDirectories, pageContext, readParam } from "@/lib/page";
import { getSettings } from "@/lib/settings";
import { searchNomenclature } from "@/lib/nomenclature-service";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "users", labelKey: "admin.users", permission: "admin.users" },
  { key: "roles", labelKey: "admin.roles", permission: "admin.roles" },
  { key: "workshops", labelKey: "admin.workshops", permission: "admin.directories" },
  { key: "departments", labelKey: "admin.departments", permission: "admin.directories" },
  { key: "units", labelKey: "admin.units", permission: "admin.directories" },
  { key: "pending", labelKey: "admin.pending", permission: "nomenclature.approve" },
  { key: "settings", labelKey: "admin.settings", permission: "admin.settings" },
  { key: "maintenance", labelKey: "admin.maintenance", permission: "admin.settings" },
] as const;

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, t } = await pageContext();
  const allowedTabs = TABS.filter((tab) => user.permissions.includes(tab.permission));
  if (!allowedTabs.length) redirect("/");

  const params = await searchParams;
  const requested = readParam(params, "tab");
  const tab = allowedTabs.find((item) => item.key === requested)?.key ?? allowedTabs[0].key;

  const { departments, workshops, units } = await loadDirectories(false);

  return (
    <>
      <PageHeader title={t("admin.title")} />

      <nav className="mb-4 flex flex-wrap gap-2">
        {allowedTabs.map((item) => (
          <Link
            key={item.key}
            href={`/admin?tab=${item.key}`}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ring-1 ring-slate-200 transition ${
              item.key === tab ? "bg-[#12325c] text-white" : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {t(item.labelKey)}
          </Link>
        ))}
      </nav>

      {tab === "users" ? <UsersTab workshops={workshops} departments={departments} currentUserId={user.id} /> : null}
      {tab === "roles" ? <RolesTab /> : null}
      {tab === "workshops" ? (
        <DirectoryPanel kind="workshops" title={t("admin.workshops")} items={workshops} />
      ) : null}
      {tab === "departments" ? (
        <DirectoryPanel kind="departments" title={t("admin.departments")} items={departments} />
      ) : null}
      {tab === "units" ? (
        <DirectoryPanel
          kind="units"
          title={t("admin.units")}
          items={units}
          codePlaceholder="pcs"
          namePlaceholder={t("admin.unitPlaceholder")}
          nameLabel={t("admin.unitAbbrLabel")}
          descriptionPlaceholder={t("admin.unitDescPlaceholder")}
        />
      ) : null}
      {tab === "pending" ? <PendingTab /> : null}
      {tab === "settings" ? <SettingsTab /> : null}
      {tab === "maintenance" ? <MaintenancePanel /> : null}
    </>
  );
}

async function UsersTab({
  workshops,
  departments,
  currentUserId,
}: {
  workshops: Awaited<ReturnType<typeof loadDirectories>>["workshops"];
  departments: Awaited<ReturnType<typeof loadDirectories>>["departments"];
  currentUserId: number;
}) {
  const userRows = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      roleId: users.roleId,
      isActive: users.isActive,
      workshopId: users.workshopId,
      departmentId: users.departmentId,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .orderBy(asc(users.fullName));
  const roleRows = await db.select().from(roles).orderBy(asc(roles.id));

  return (
    <UsersPanel
      users={userRows.map((row) => ({ ...row, lastLoginAt: row.lastLoginAt?.toISOString() ?? null }))}
      roles={roleRows}
      workshops={workshops}
      departments={departments}
      currentUserId={currentUserId}
    />
  );
}

async function RolesTab() {
  const roleRows = await db.select().from(roles).orderBy(asc(roles.id));
  return <RolesPanel roles={roleRows} />;
}

async function SettingsTab() {
  const settings = await getSettings();
  return <SettingsPanel settings={settings} />;
}

async function PendingTab() {
  const { t } = await pageContext();
  const pending = await searchNomenclature({ status: "pending", limit: 50, sort: "updated" });

  if (!pending.items.length) {
    return (
      <Card>
        <EmptyState title={t("nom.noneFound")} />
      </Card>
    );
  }

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
            <tr>
              <th className="px-4 py-2">{t("item.name")}</th>
              <th className="px-4 py-2">{t("item.partNumber")}</th>
              <th className="px-4 py-2">{t("common.status")}</th>
              <th className="px-4 py-2 text-right">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pending.items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-2">
                  <Link href={`/nomenclature/${item.id}`} className="font-medium text-[#12325c] hover:underline">
                    {item.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-slate-600">{item.partNumber ?? "—"}</td>
                <td className="px-4 py-2">
                  <NomenclatureStatusBadge status={item.status} />
                </td>
                <td className="px-4 py-2 text-right">
                  <NomenclatureRowActions id={item.id} status={item.status} canArchive canApprove />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
