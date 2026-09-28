import LayoutWithSidebar from '@/app/layout-with-sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <LayoutWithSidebar>{children}</LayoutWithSidebar>
}
