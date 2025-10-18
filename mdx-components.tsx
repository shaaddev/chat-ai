import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import React, { type ComponentPropsWithoutRef } from "react";

type AnchorProps = ComponentPropsWithoutRef<"a">;

const CustomLink = ({ href, children, ...otherProps }: AnchorProps) => {
  const className = "text-blue-500 hover:text-primary/80 hover:underline";
  if (href?.startsWith("/")) {
    return (
      <Link href={href} className={className} {...otherProps}>
        {children}
      </Link>
    );
  }
  if (href?.startsWith("#")) {
    return (
      <a href={href} className={className} {...otherProps}>
        {children}
      </a>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      {...otherProps}
      className={className}
    >
      {children}
    </a>
  );
};

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: (props) => (
      <h1 className="text-4xl font-bold mt-8 mb-4 text-primary" {...props} />
    ),
    h2: (props) => (
      <h2 className="text-3xl font-medium mt-6 mb-3 text-primary" {...props} />
    ),
    h3: (props) => (
      <h3 className="text-2xl font-medium mt-4 mb-2 text-primary" {...props} />
    ),
    h4: (props) => <h4 className="text-lg font-medium" {...props} />,
    a: CustomLink,
    p: (props) => <p className="leading-snug mt-6" {...props} />,
    ul: (props) => <ul className="my-6 list-disc space-y-1 pl-5" {...props} />,
    ol: (props) => (
      <ol
        className="my-6 text-xl font-bold list-decimal pl-5 space-y-2"
        {...props}
      />
    ),
    li: (props) => <li className="mt-2 pl-1" {...props} />,
    strong: (props) => <strong className="font-medium" {...props} />,
    em: (props) => (
      <code
        className="bg-inherit border border-black/20 dark:border-white/20 text-primary rounded px-1 py-0.5 font-mono text-sm"
        {...props}
      />
    ),
    blockquote: (props) => (
      <blockquote
        className="mt-6 border-l-2 border-primary pl-6 italic text-muted-foreground"
        {...props}
      />
    ),
    hr: (props) => <hr className="my-4 md:my-8" {...props} />,
    table: (props) => (
      <div className="my-6 w-full overflow-y-auto">
        <table className="w-full" {...props} />
      </div>
    ),
    tr: (props) => <tr className="m-0 border-t p-0 even:bg-muted" {...props} />,
    th: (props) => (
      <th
        className="border px-4 py-2 text-left font-bold [&[align=center]]:text-center [&[align=right]]:text-right"
        {...props}
      />
    ),
    td: (props) => (
      <td
        className="border px-4 py-2 text-left [&[align=center]]:text-center [&[align=right]]:text-right"
        {...props}
      />
    ),
    ...components,
  };
}
