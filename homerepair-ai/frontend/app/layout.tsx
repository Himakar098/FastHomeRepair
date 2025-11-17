import './globals.css';
import Navigation from './components/Navigation';
import AuthProvider from '../src/auth/AuthProvider';

export const metadata = {
  title: 'Home Service Assistant',
  description: 'Commercial home services copilot for diagnostics, sourcing and professional routing',
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
            <div className="app-shell">
              <Navigation />
              <div className="app-content">
                <header className="app-header">
                  <p className="eyebrow">Live service copilot</p>
                  <h1>Home Service Assistant</h1>
                  <p>Diagnose issues, source materials and dispatch trusted professionals from one experience.</p>
                </header>
                <main>{children}</main>
              </div>
            </div>
          </div>
        </AuthProvider>
      </body>
    </html>
  )
}
