import type { ReactElement } from "react";
import { redirect } from "next/navigation";
import type { ClinicRole } from "@/generated/prisma/enums";

import { EmptyClinicState } from "@/components/dashboard/empty-clinic-state";
import { getTenantContext, TenantResolutionError, type TenantContext } from "@/server/tenant";

export function withTenant<TProps extends object = Record<string, never>>(
  handler: (ctx: TenantContext, props: TProps) => Promise<ReactElement> | ReactElement,
  roles?: readonly ClinicRole[],
): (props: TProps) => Promise<ReactElement> {
  return async function TenantPage(props: TProps): Promise<ReactElement> {
    try {
      const ctx = await getTenantContext();
      if (roles && !roles.includes(ctx.role)) {
        redirect("/acesso-negado");
      }
      return await handler(ctx, props);
    } catch (error) {
      if (error instanceof TenantResolutionError) {
        return <EmptyClinicState />;
      }

      throw error;
    }
  };
}
