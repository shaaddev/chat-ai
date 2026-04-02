import Link from "next/link";
import React, { memo } from "react";
import { Streamdown, type StreamdownProps } from "streamdown";

type Components = StreamdownProps["components"];

const components: Partial<Components> = {
  a: ({ children, ...props }) => {
    return (
      // @ts-expect-error - TODO: fix this
      <Link
        {...props}
        className="text-blue-500 hover:underline"
        rel="noreferrer"
        target="_blank"
      >
        {children}
      </Link>
    );
  },
};

const NonMemoizedMarkdown = ({ children }: { children: string }) => {
  return (
    <Streamdown
      className="prose dark:prose-invert py-1 leading-10 [&_code]:whitespace-pre-wrap [&_code]:break-words [&_pre]:max-w-full [&_pre]:overflow-x-auto"
      components={components}
      shikiTheme={["houston", "houston"]}
    >
      {children}
    </Streamdown>
  );
};

export const Markdown = memo(
  NonMemoizedMarkdown,
  (prevProps, nextProps) => prevProps.children === nextProps.children
);
