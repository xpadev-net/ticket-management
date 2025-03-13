export function Footer() {
  return (
    <footer className="border-t">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <p className="text-center text-sm">
          © {new Date().getFullYear()} イベントチケットシステム
        </p>
      </div>
    </footer>
  );
}