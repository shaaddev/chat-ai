export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-3xl mx-auto w-full flex flex-col items-center justify-center h-screen">
      {children}
    </div>
  );
}
