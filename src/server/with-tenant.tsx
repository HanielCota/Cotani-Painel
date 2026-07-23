import type { ReactElement } from "react";

import { EmptyBarbershopState } from "@/components/dashboard/empty-barbershop-state";
import { getSelectedOrgId, getTenantContext, TenantResolutionError, type TenantContext } from "@/server/tenant";

export function withTenant<TProps extends object = Record<string, never>>(
  handler: (ctx: TenantContext, props: TProps) => Promise<ReactElement> | ReactElement,
): (props: TProps) => Promise<ReactElement> {
  return async function TenantPage(props: TProps): Promise<ReactElement> {
    try {
      const ctx = await getTenantContext();
      return await handler(ctx, props);
    } catch (error) {
      if (error instanceof TenantResolutionError) {
        const selectedOrgId = await getSelectedOrgId();
        return <EmptyBarbershopState selectedOrgId={selectedOrgId} />;
      }

      throw error;
    }
  };
}
