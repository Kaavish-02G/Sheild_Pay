import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'ShieldPay — Your revenue. Protected.', description: 'One connected workspace for your store, merchant disputes, evidence, and payment integrations.' };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
