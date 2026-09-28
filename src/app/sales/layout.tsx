import LayoutWithSidebar from '@/app/layout-with-sidebar'

export default function SalesLayout({ children }: { children: React.ReactNode }) {
  return <LayoutWithSidebar>{children}</LayoutWithSidebar>
}
