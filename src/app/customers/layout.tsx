import LayoutWithSidebar from '@/app/layout-with-sidebar'

export default function CustomersLayout({ children }: { children: React.ReactNode }) {
  return <LayoutWithSidebar>{children}</LayoutWithSidebar>
}
