export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-neutral-900 w-full flex flex-col items-start justify-start min-h-screen max-w-2xl mx-auto my-10 px-5 md:px-0">
      {children}
    </div>
  );
}
