"use client";

import { Button } from "./ui";
import { IconPrinter } from "./icons";

export function PrintButton() {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => window.print()}
      className="no-print print:hidden flex items-center gap-1.5 border-slate-300 shadow-2xs hover:bg-slate-50"
      title="Роздрукувати офіційну заявку"
    >
      <IconPrinter className="h-4 w-4 text-slate-600" />
      <span>Друк заявки</span>
    </Button>
  );
}
