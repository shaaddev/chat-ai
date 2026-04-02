export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex h-screen w-full max-w-3xl flex-col items-center justify-center">
      {children}
    </div>
  );
}
