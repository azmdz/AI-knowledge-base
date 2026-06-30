import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import Link from 'next/link'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import SearchIcon from '@mui/icons-material/Search'
import AddIcon from '@mui/icons-material/Add'
import DraftsIcon from '@mui/icons-material/Drafts'
import { UserProvider } from '@/lib/user-context'
import { UserSelector } from '@/components/UserSelector'
import { Toaster } from 'sonner'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: '社内ナレッジベース',
  description: 'AIで検索・整形する社内ナレッジ共有サービス',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-gray-50 text-gray-900">
        <UserProvider>
          <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
            <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
              <Link
                href="/"
                className="font-bold text-lg tracking-tight text-indigo-600 hover:text-indigo-700 flex items-center gap-1.5"
              >
                <MenuBookIcon style={{ fontSize: 20 }} />
                ナレッジベース
              </Link>
              <nav className="flex items-center gap-4 text-sm font-medium">
                <UserSelector />
                <Link
                  href="/search"
                  className="text-gray-600 hover:text-indigo-600 transition-colors flex items-center gap-1"
                >
                  <SearchIcon style={{ fontSize: 16 }} />
                  AI検索
                </Link>
                <Link
                  href="/drafts"
                  className="text-gray-600 hover:text-indigo-600 transition-colors flex items-center gap-1"
                >
                  <DraftsIcon style={{ fontSize: 16 }} />
                  下書き
                </Link>
                <Link
                  href="/new"
                  className="bg-indigo-600 text-white px-4 py-1.5 rounded-full hover:bg-indigo-700 transition-colors flex items-center gap-1"
                >
                  <AddIcon style={{ fontSize: 16 }} />
                  記事を書く
                </Link>
              </nav>
            </div>
          </header>
          <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">{children}</main>
          <Toaster position="bottom-right" richColors />
          <footer className="border-t border-gray-200 text-center text-xs text-gray-400 py-4">
            社内ナレッジベース — AIQ コーディング試験
          </footer>
        </UserProvider>
      </body>
    </html>
  )
}
