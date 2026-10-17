import { HistoryView } from "@/ui/HistoryView";

export default async function HistoryPage({ params }: PageProps<"/tenants/[id]/history">) {
  const { id } = await params;
  return <HistoryView key={id} tenantId={id} />;
}
