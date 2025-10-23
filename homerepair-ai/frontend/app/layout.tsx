import './globals.css'
import Navigation from './components/Navigation'

export const metadata = {
  title: 'Home Repair AI',
  description: 'Get instant expert advice for your home repairs',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <div className="App">
          <header className="app-header">
            <h1>Home Repair AI</h1>
            <p>Get instant expert advice for your home repairs</p>
          </header>
          <Navigation />
          <main>{children}</main>
        </div>
      </body>
    </html>
  )
}
