import type { Metadata } from 'next';
import AdminDashboard from '@/components/AdminDashboard';
import './admin.css';

export const metadata: Metadata = {
  title: { absolute: 'HYU PREMIUM Owner Dashboard' },
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } }
};

export default function AdminPage(){
  return <AdminDashboard/>;
}
