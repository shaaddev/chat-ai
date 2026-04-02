import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import React, { type ComponentPropsWithoutRef } from "react";

type AnchorProps = ComponentPropsWithoutRef<"a">;

const CustomLink = ({ href, children, ...otherProps }: AnchorProps) => {
  const className = "text-blue-500 hover:text-primary/80 hover:underline";
  if (href?.startsWith("/")) {
    return (
      <Link className={className} href={href} {...otherProps}>
        {children}
      </Link>
    );
  }
  if (href?.startsWith("#")) {
    return (
      <a className={className} href={href} {...otherProps}>
        {children}
      </a>
    );
  }
  return (
    <a
      href={href}
      rel="noopener noreferrer"
      target="_blank"
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
      <h1 className="mt-8 mb-4 font-bold text-4xl text-primary" {...props} />
    ),
    h2: (props) => (
      <h2 className="mt-6 mb-3 font-medium text-3xl text-primary" {...props} />
    ),
    h3: (props) => (
      <h3 className="mt-4 mb-2 font-medium text-2xl text-primary" {...props} />
    ),
    h4: (props) => <h4 className="font-medium text-lg" {...props} />,
    a: CustomLink,
    p: (props) => <p className="mt-6 leading-snug" {...props} />,
    ul: (props) => <ul className="my-6 list-disc space-y-1 pl-5" {...props} />,
    ol: (props) => (
      <ol
        className="my-6 list-decimal space-y-2 pl-5 font-bold text-xl"
        {...props}
      />
    ),
    li: (props) => <li className="mt-2 pl-1" {...props} />,
    strong: (props) => <strong className="font-medium" {...props} />,
    em: (props) => (
      <code
        className="rounded border border-black/20 bg-inherit px-1 py-0.5 font-mono text-primary text-sm dark:border-white/20"
        {...props}
      />
    ),
    blockquote: (props) => (
      <blockquote
        className="mt-6 border-primary border-l-2 pl-6 text-muted-foreground italic"
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
