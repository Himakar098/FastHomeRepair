import './globals.css';
import Navigation from './components/Navigation';
import AuthProvider from '../src/auth/AuthProvider';

export const metadata = {
  title: 'Home Services',
  description: 'Get instant expert advice for your house problems',
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
              <h1>Home Services</h1>
              <p>Get instant expert advice for your house problems</p>
            </header>
            <Navigation />
            <main>{children}</main>
          </div>
        </AuthProvider>
      </body>
    </html>
  )
}
