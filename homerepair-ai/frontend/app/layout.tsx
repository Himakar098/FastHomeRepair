import './globals.css';
import Navigation from './components/Navigation';
import AuthProvider from '../src/auth/AuthProvider';

export const metadata = {
  title: 'HomeRepair AI',
  description: 'Live property diagnostics, product sourcing and pro routing',
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
          <div className="App">
            <header className="app-header">
              <p className="eyebrow">Investor preview · Internal</p>
              <h1>HomeRepair AI</h1>
              <p>Realtime property diagnostics, product sourcing and trusted professionals in one interface.</p>
            </header>
            <Navigation />
            <main>{children}</main>
          </div>
        </AuthProvider>
      </body>
    </html>
  )
}
