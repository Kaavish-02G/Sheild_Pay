import { Suspense } from 'react';
import Link from 'next/link';
import DashboardHome from '../DashboardHome';
export default function Page() { return <><div className="mb-6 flex gap-3"><Link className="secondary-btn" href="/dashboard/operations">Dispute operations</Link><Link className="secondary-btn" href="/dashboard/operations?view=alerts">Pre-dispute alerts</Link></div><Suspense fallback={<p>Loading operations…</p>}><DashboardHome /></Suspense></>; }
