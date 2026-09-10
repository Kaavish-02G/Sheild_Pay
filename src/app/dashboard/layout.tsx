import WorkspaceShell from '@/components/WorkspaceShell';
import './globals.css';
export default function Layout({ children }: { children: React.ReactNode }) { return <WorkspaceShell><div className='dash-root'>{children}</div></WorkspaceShell>; }
