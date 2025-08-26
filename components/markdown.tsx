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
        target="_blank"
        rel="noreferrer"
      >
        {children}
      </Link>
    );
  },
};

const NonMemoizedMarkdown = ({ children }: { children: string }) => {
  return (
    <Streamdown
      components={components}
      className="prose dark:prose-invert py-1 leading-10"
      shikiTheme={["github-dark", "github-light"]}
    >
      {children}
    </Streamdown>
  );
};

export const Markdown = memo(
  NonMemoizedMarkdown,
  (prevProps, nextProps) => prevProps.children === nextProps.children,
);
