import { Suspense } from 'react';
import { ShopRouter } from '@/components/Storefront';
export default function Page() { return <Suspense fallback={<div className='store-page'>Loading your adventure…</div>}><ShopRouter /></Suspense>; }
