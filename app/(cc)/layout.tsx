export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto my-10 flex min-h-screen w-full max-w-2xl flex-col items-start justify-start bg-background px-5 md:px-0">
      {children}
    </div>
  );
}
