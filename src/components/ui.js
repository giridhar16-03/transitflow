import { Link } from "react-router-dom";
import { cn } from "../lib/utils";

const buttonVariants = {
  default: "bg-primary text-primary-foreground shadow-soft hover:opacity-95",
  outline: "border border-border bg-card text-foreground shadow-soft hover:bg-secondary/60",
  ghost: "bg-transparent text-foreground hover:bg-secondary/80",
  subtle: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
};

const buttonSizes = {
  sm: "h-9 px-4 text-sm",
  md: "h-10 px-5 text-sm",
  lg: "h-12 px-6 text-base",
};

export function Button({ className, variant = "default", size = "md", href, to, children, ...props }) {
  const classes = cn(
    "inline-flex items-center justify-center gap-2 rounded-full font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-60",
    buttonVariants[variant],
    buttonSizes[size],
    className,
  );

  if (to) {
    return (
      <Link to={to} className={classes} {...props}>
        {children}
      </Link>
    );
  }

  if (href) {
    return (
      <a href={href} className={classes} {...props}>
        {children}
      </a>
    );
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}

export function Card({ className, children }) {
  return <div className={cn("rounded-3xl border border-border bg-card shadow-soft", className)}>{children}</div>;
}

export function Badge({ className, children }) {
  return <span className={cn("inline-flex items-center rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground", className)}>{children}</span>;
}

export function Input({ className, ...props }) {
  return (
    <input
      className={cn(
        "flex h-11 w-full rounded-2xl border border-border bg-card px-4 text-sm text-foreground shadow-soft outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }) {
  return (
    <textarea
      className={cn(
        "flex min-h-28 w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground shadow-soft outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, children, ...props }) {
  return (
    <label className={cn("mb-2 block text-sm font-medium text-foreground", className)} {...props}>
      {children}
    </label>
  );
}

export function SectionTitle({ eyebrow, title, body, align = "left" }) {
  return (
    <div className={cn(align === "center" && "mx-auto text-center", "max-w-3xl") }>
      {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">{eyebrow}</p> : null}
      <h2 className="mt-3 font-display text-4xl tracking-tight text-foreground md:text-5xl">{title}</h2>
      {body ? <p className="mt-4 text-base leading-7 text-muted-foreground md:text-lg">{body}</p> : null}
    </div>
  );
}

export function StatTile({ value, label }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-4 shadow-soft">
      <div className="font-display text-2xl text-foreground">{value}</div>
      <div className="mt-1 text-sm text-muted-foreground">{label}</div>
    </div>
  );
}
