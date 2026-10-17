import { TenantEditor } from "@/ui/TenantEditor";

export default async function TenantPage({ params }: PageProps<"/tenants/[id]">) {
  const { id } = await params;
  return <TenantEditor key={id} tenantId={id} />;
}
