import type { ReactNode } from "react";

export function Container({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto max-w-7xl px-4 sm:px-6 ${className}`}>{children}</div>
  );
}

export function Section({
  children,
  className = "",
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`py-14 sm:py-20 ${className}`}>
      <Container>{children}</Container>
    </section>
  );
}

type ButtonVariant = "primary" | "gold" | "outline" | "ghost";

export function Button({
  href,
  children,
  variant = "primary",
  className = "",
  ...rest
}: {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  className?: string;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const styles: Record<ButtonVariant, string> = {
    primary:
      "bg-navy-700 text-white hover:bg-navy-800 shadow-soft",
    gold: "bg-gold-500 text-navy-900 hover:bg-gold-400",
    outline:
      "border border-navy-200 text-navy-700 bg-white hover:bg-navy-50",
    ghost: "text-navy-700 hover:bg-navy-50",
  };
  return (
    <a
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-sm px-5 py-3 text-sm font-semibold transition-colors ${styles[variant]} ${className}`}
      {...rest}
    >
      {children}
    </a>
  );
}

export function Breadcrumbs({ items }: { items: { name: string; href: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="border-b border-ink-200 bg-white">
      <Container>
        <ol className="flex flex-wrap items-center gap-1.5 py-3 text-sm text-ink-500">
          {items.map((item, i) => (
            <li key={item.href} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden className="text-ink-300">/</span>}
              {i === items.length - 1 ? (
                <span aria-current="page" className="font-medium text-ink-700">
                  {item.name}
                </span>
              ) : (
                <a href={item.href} className="hover:text-navy-700">
                  {item.name}
                </a>
              )}
            </li>
          ))}
        </ol>
      </Container>
    </nav>
  );
}

export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="border-b border-ink-200 bg-gradient-to-b from-navy-50 to-white">
      <Container>
        <div className="py-12 sm:py-16">
          {eyebrow && (
            <p className="text-sm font-bold uppercase tracking-wider text-gold-600">
              {eyebrow}
            </p>
          )}
          <h1 className="mt-2 font-display text-3xl font-extrabold text-navy-900 sm:text-4xl lg:text-5xl">
            {title}
          </h1>
          {description && (
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-600">
              {description}
            </p>
          )}
          {children}
        </div>
      </Container>
    </div>
  );
}
