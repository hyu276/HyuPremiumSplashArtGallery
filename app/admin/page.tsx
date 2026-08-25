import type { Metadata } from 'next';
import GitHubAdminDashboard from '@/components/GitHubAdminDashboard';
import './admin.css';

export const metadata: Metadata = {
  title: { absolute: 'HYU PREMIUM — Dashboard quản trị' },
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } }
};

export default function AdminPage(){
  return <GitHubAdminDashboard/>;
}
