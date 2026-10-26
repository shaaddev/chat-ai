import { SidebarTrigger } from "@/components/ui/sidebar";

const LINE_WIDTHS = ["w-2/3", "w-full", "w-5/6", "w-3/4"];

export default function Loading() {
  return (
    <div aria-busy="true" className="flex h-dvh w-full flex-col bg-background">
      <span className="sr-only">Loading chat</span>
      <header className="flex h-14 shrink-0 items-center gap-3 px-4">
        <SidebarTrigger className="rounded-lg" />
        <span className="select-none font-serif text-[15px] text-foreground/75 italic tracking-tight">
          chat<span className="text-primary">.</span>
        </span>
      </header>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 overflow-hidden px-4 pt-6">
        <div className="ml-auto h-10 w-1/2 rounded-2xl bg-muted" />
        <div className="space-y-3">
          {LINE_WIDTHS.map((width) => (
            <div className={`h-3 rounded-full bg-muted ${width}`} key={width} />
          ))}
        </div>
      </div>
      <div className="mx-auto w-full max-w-3xl px-4 pt-2 pb-5">
        <div className="h-[106px] rounded-2xl border border-border bg-background" />
        <div className="mt-2 h-[15px]" />
      </div>
    </div>
  );
}
