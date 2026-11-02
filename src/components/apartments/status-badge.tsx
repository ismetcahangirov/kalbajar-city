import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui";
import type { PublicApartmentStatus } from "@/shared/apartments";

/** An apartment's status: dot and word, so colour never carries it alone. */
export function StatusBadge({
  status,
  className,
}: {
  status: PublicApartmentStatus;
  className?: string;
}) {
  const t = useTranslations("Status");
  return (
    <Badge variant={status} className={className}>
      {t(status)}
    </Badge>
  );
}
