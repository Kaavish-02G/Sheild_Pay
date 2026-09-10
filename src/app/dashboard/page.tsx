import { redirect } from 'next/navigation';
import Workspace from '@/components/Workspace';
export default async function Page({ searchParams }: { searchParams: Promise<{ view?: string }> }) { const p = await searchParams; if (p.view === 'alerts') redirect('/dashboard/operations?view=alerts'); return <Workspace />; }
