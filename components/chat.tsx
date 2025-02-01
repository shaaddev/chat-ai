"use client";
import { useChat } from "ai/react";
import { Menu, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Paperclip } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Link } from "next-view-transitions";
import { ModelsPopover } from "./models-popover";

export function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat();

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-neutral-900 text-gray-100">
        <Sidebar className="w-64 border-r border-neutral-800">
          <SidebarHeader className="p-4">
            <h2 className="text-lg font-semibold">Chat History</h2>
          </SidebarHeader>
          <SidebarContent>
            {/* Add chat history items here */}
            <div className="p-4">
              <p className="text-gray-400">No chat history yet</p>
            </div>
          </SidebarContent>
        </Sidebar>

        <div className="flex flex-col flex-1 w-full">
          <header className="flex items-center p-4 border-b border-neutral-800">
            <SidebarTrigger>
              <Button variant="ghost" size="icon" className="mr-2">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle sidebar</span>
              </Button>
            </SidebarTrigger>
            <h1 className="text-xl font-bold">Chatbot</h1>
          </header>

          <ScrollArea className="flex-1 p-4 w-full">
            <div className="max-w-3xl mx-auto">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`mb-4 ${
                    message.role === "user" ? "text-right" : "text-left"
                  }`}
                >
                  <div
                    className={`inline-block p-2 rounded-xl ${
                      message.role === "user"
                        ? "bg-neutral-700 text-neutral-100"
                        : "bg-neutral-800 text-neutral-100"
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="max-w-3xl mx-auto space-y-4 w-full">
            <p className="text-center text-sm text-gray-400">
              Make sure you agree to our{" "}
              <Link href="/terms" className="underline">
                Terms
              </Link>{" "}
              and our{" "}
              <Link href="/policy" className="underline">
                Privacy Policy
              </Link>
            </p>
            <div className="relative ">
              <form
                onSubmit={handleSubmit}
                className="relative sm:max-w-3xl px-5 lg:px-0"
              >
                <div className="relative rounded-t-2xl shadow-lg bg-neutral-800/50 backdrop-blur-sm">
                  <div className="absolute bottom-3 left-3 flex items-center gap-2">
                    <ModelsPopover />
                    <button
                      type="button"
                      className="text-neutral-300 hover:text-neutral-100"
                    >
                      <Paperclip className="h-5 w-5" />
                    </button>
                  </div>
                  <textarea
                    value={input}
                    onChange={handleInputChange}
                    placeholder="Type your message here..."
                    className="w-full bg-transparent border-0 focus:ring-0 text-base text-neutral-100 placeholder-neutral-400 p-6 pt-4 resize-none outline-none disabled:opacity-0"
                    rows={3}
                    style={{ minHeight: "100px" }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                      }
                    }}
                  />
                  <Button
                    type="submit"
                    className="absolute bottom-3 right-3 bg-transparent hover:bg-neutral-700"
                    disabled={!input.trim()}
                  >
                    <Send className="h-5 w-5" />
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
