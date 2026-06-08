import { WorkoutView } from '@/web/views/WorkoutView';

export default async function WorkoutPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return <WorkoutView sessionId={sessionId} />;
}
