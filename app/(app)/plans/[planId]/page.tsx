import { PlanDetailView } from '@/web/views/PlanDetailView';

export default async function PlanDetailPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  return <PlanDetailView planId={planId} />;
}
