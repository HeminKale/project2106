import type { Metadata } from 'next'
import './globals.css'
import AuthProvider from './components/AuthProvider'

export const metadata: Metadata = {
  title: 'Client Management App',
  description: 'Manage clients with Supabase integration',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}