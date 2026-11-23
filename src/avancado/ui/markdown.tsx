// Texto em markdown mostrado no visual do painel (links abrem em outra aba; HTML cru não é interpretado).
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "./kit.tsx";

export function Markdown({ texto, className }: { texto: string; className?: string }) {
  return (
    <div className={cn("texto", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer noopener">
              {children}
            </a>
          ),
        }}
      >
        {texto}
      </ReactMarkdown>
    </div>
  );
}
