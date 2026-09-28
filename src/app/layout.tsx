import { ClerkProvider } from '@clerk/nextjs'
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import TopNav from '@/app/components/ui/TopNav'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Dealer Management System',
  description: 'Multi-tenant DMS for automotive dealers',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body className="h-screen flex flex-col overflow-hidden">
        <ClerkProvider>
          <TopNav />

          {/* Page content fills remaining height */}
          <div className="flex-1 overflow-hidden">
            {children}
          </div>
        </ClerkProvider>
      </body>
    </html>
  )
}
