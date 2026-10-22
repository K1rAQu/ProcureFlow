"use client";

import { useRouter } from "next/navigation";

export function CategoryFilterSelect({
  departments,
  activeDepartmentId,
  allLabel,
  ariaLabel,
}: {
  departments: { id: number; name: string }[];
  activeDepartmentId?: string;
  allLabel: string;
  ariaLabel?: string;
}) {
  const router = useRouter();

  function onChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const val = event.target.value;
    const url = new URL(window.location.href);
    if (val) {
      url.searchParams.set("departmentId", val);
    } else {
      url.searchParams.delete("departmentId");
    }
    url.searchParams.set("page", "1");
    router.push(url.pathname + url.search);
  }

  return (
    <div className="relative inline-flex items-center">
      <select
        value={activeDepartmentId ?? ""}
        onChange={onChange}
        aria-label={ariaLabel ?? allLabel}
        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-2xs transition focus:outline-none cursor-pointer ${
          activeDepartmentId
            ? "border-[#12325c] bg-[#12325c] text-white"
            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        }`}
      >
        <option value="" className="bg-white text-slate-900">
          {allLabel}
        </option>
        {departments.map((dep) => (
          <option key={dep.id} value={String(dep.id)} className="bg-white text-slate-900">
            {dep.name}
          </option>
        ))}
      </select>
    </div>
  );
}
