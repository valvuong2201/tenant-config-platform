import { HistoryView } from "@/ui/HistoryView";

export default async function HistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <HistoryView key={id} tenantId={id} />;
}
