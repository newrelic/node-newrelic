
export default function Layout({ children }) {
return (
    <html lang="en">
      <head />
      <body>
        <header>
          <h1>This is my header</h1>
        </header>
        <main>{children}</main>
        <footer>
          <p>This is my footer</p>
        </footer>
      </body>
    </html>
  )
}
