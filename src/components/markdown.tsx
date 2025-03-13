import { FC, ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = {
    children: string|null|undefined;
}

export const StyledMarkdown: FC<Props> = ({children}) => {
  return (
    <div className="prose prose-headings:font-bold prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-a:text-blue-600 max-w-none mb-6 text-inherit prose-headings:text-inherit marker:text-inherit">
      <Markdown>{children}</Markdown>
    </div>
  )
}

export const Markdown: FC<Props> = ({children}) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ node, ...props }) => (
          <a target="_blank" rel="noopener noreferrer" {...props} />
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  )
}
