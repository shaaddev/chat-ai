import { SidebarTrigger } from "@/components/ui/sidebar";

const LINE_WIDTHS = ["w-2/3", "w-full", "w-5/6", "w-3/4"];

export function ChatSkeleton() {
  return (
    <div aria-busy="true" className="flex h-full w-full flex-col">
      <span className="sr-only">Loading chat</span>
      <header className="flex h-[50px] shrink-0 items-center gap-1.5 px-2 md:h-12 md:px-3.5">
        <SidebarTrigger className="size-9 rounded-[10px] text-muted-foreground" />
      </header>
      <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-8 overflow-hidden px-4 pt-6">
        <div className="ml-auto h-10 w-1/2 rounded-[18px] bg-secondary" />
        <div className="space-y-3">
          {LINE_WIDTHS.map((width) => (
            <div className={`h-3 rounded-full bg-muted ${width}`} key={width} />
          ))}
        </div>
      </div>
      <div className="mx-auto w-full max-w-[720px] px-4 pb-[18px]">
        <div className="h-[100px] rounded-[20px] bg-secondary/85" />
      </div>
    </div>
  );
}
