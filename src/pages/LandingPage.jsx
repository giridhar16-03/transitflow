import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BusFront,
  Building2,
  CheckCircle2,
  Compass,
  Globe,
  KeyRound,
  MapPinned,
  PhoneCall,
  Route,
  SatelliteDish,
  Menu,
  ShieldCheck,
  Sparkles,
  TimerReset,
  Users2,
} from "lucide-react";
import { Badge, Button, Card, SectionTitle, StatTile } from "../components/ui.jsx";
import { benefits, contactMethods, heroStats, howItWorks, landingFeatures, publicBuses, routeCards } from "../data/mock";
import { useLiveFleet } from "../hooks/useLiveFleet";

function mapPosition(vehicle, fleet) {
  const latitudes = fleet.map((item) => item.latitude);
  const longitudes = fleet.map((item) => item.longitude);
  const minLat = Math.min(...latitudes) - 0.0015;
  const maxLat = Math.max(...latitudes) + 0.0015;
  const minLng = Math.min(...longitudes) - 0.0015;
  const maxLng = Math.max(...longitudes) + 0.0015;
  const top = ((maxLat - vehicle.latitude) / (maxLat - minLat)) * 100;
  const left = ((vehicle.longitude - minLng) / (maxLng - minLng)) * 100;
  return { top: `${Math.max(10, Math.min(88, top))}%`, left: `${Math.max(8, Math.min(90, left))}%` };
}

function useScrollReveal() {
  useEffect(() => {
    const items = Array.from(document.querySelectorAll(".scroll-reveal"));
    if (items.length === 0) return undefined;

    let frameId = 0;

    const update = () => {
      const viewportHeight = window.innerHeight;

      items.forEach((item) => {
        const rect = item.getBoundingClientRect();
        const revealStart = viewportHeight * 0.88;
        const revealEnd = viewportHeight * 0.22;
        const rawProgress = (revealStart - rect.top) / (revealStart - revealEnd);
        const progress = Math.max(0, Math.min(1, rawProgress));

        item.style.setProperty("--reveal-progress", progress.toFixed(3));
        item.classList.toggle("is-visible", progress > 0.02);
      });

      frameId = 0;
    };

    const scheduleUpdate = () => {
      if (frameId !== 0) return;
      frameId = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, []);
}

export function LandingPage() {
  const liveBuses = useLiveFleet(publicBuses);
  useScrollReveal();

  return (
    <div className="min-h-screen bg-background bg-grain">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-24 top-12 h-72 w-72 rounded-full bg-accent/12 blur-3xl animate-glow-pulse" />
        <div className="absolute right-[-4rem] top-1/3 h-96 w-96 rounded-full bg-primary/6 blur-3xl animate-drift-slow" />
        <div className="absolute bottom-[-6rem] left-1/3 h-80 w-80 rounded-full bg-secondary/35 blur-3xl animate-drift" />
      </div>

      <header className="sticky top-0 z-40 border-b border-transparent px-3 pt-3 sm:px-6">
        <div className="mx-auto max-w-7xl rounded-[1.75rem] border border-border/70 bg-background/80 px-4 py-3 shadow-soft backdrop-blur-xl md:px-5">
          <div className="flex items-center justify-between gap-3">
            <Link to="/" className="flex shrink-0 items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-soft">
                <Compass className="h-4 w-4" />
              </div>
              <div className="leading-tight">
                <div className="font-display text-lg tracking-tight sm:text-xl">TransitFlow</div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground sm:text-[11px]">Transport intelligence</div>
              </div>
            </Link>

            <nav className="hidden items-center gap-1 rounded-full border border-border bg-secondary/55 p-1 text-sm lg:flex">
              <a href="#features" className="rounded-full px-4 py-2 text-muted-foreground transition hover:bg-background hover:text-foreground">Features</a>
              <a href="#how-it-works" className="rounded-full px-4 py-2 text-muted-foreground transition hover:bg-background hover:text-foreground">How it works</a>
              <a href="#preview" className="rounded-full px-4 py-2 text-muted-foreground transition hover:bg-background hover:text-foreground">Live tracking</a>
              <a href="#contact" className="rounded-full px-4 py-2 text-muted-foreground transition hover:bg-background hover:text-foreground">Contact</a>
            </nav>

            <div className="hidden items-center gap-2 lg:flex">
              
              <Button variant="ghost" size="sm" to="/auth?mode=login">Login</Button>
              <Button size="sm" to="/auth?mode=register&role=public">Register</Button>
            </div>

            <details className="relative ml-auto lg:hidden">
              <summary className="flex list-none items-center justify-center rounded-full border border-border bg-secondary/60 p-3 text-foreground shadow-soft transition hover:bg-background">
                <span className="sr-only">Open menu</span>
                <Menu className="h-5 w-5" />
              </summary>
              <div className="absolute right-0 top-[calc(100%+0.75rem)] z-50 min-w-56 rounded-3xl border border-border bg-background p-3 shadow-lifted">
                <div className="grid gap-1 text-sm">
                  <a href="#features" className="rounded-2xl px-4 py-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground">Features</a>
                  <a href="#how-it-works" className="rounded-2xl px-4 py-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground">How it works</a>
                  <a href="#preview" className="rounded-2xl px-4 py-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground">Live tracking</a>
                  <a href="#contact" className="rounded-2xl px-4 py-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground">Contact</a>
                </div>
                <div className="mt-3 grid gap-2 border-t border-border pt-3">
                  <Button variant="ghost" size="sm" to="/auth?mode=login" className="w-full justify-center">Login</Button>
                  <Button size="sm" to="/auth?mode=register&role=public" className="w-full justify-center">Register</Button>
                </div>
              </div>
            </details>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-7xl px-4 pb-14 pt-8 sm:px-6 md:pb-16 md:pt-14">
          <div className="grid items-center gap-8 md:grid-cols-12 lg:gap-10">
            <div className="md:col-span-7 animate-rise-in">
              <Badge className="mb-5 gap-2 px-4 py-2 text-[11px] uppercase tracking-[0.22em]">
                <SatelliteDish className="h-3 w-3" /> realtime transport intelligence
              </Badge>
              <h1 className="font-display text-4xl leading-[1.04] tracking-tight text-gradient-warm sm:text-5xl lg:text-7xl">
                Track every bus.<br />
                Protect every fleet.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8 md:text-xl">
                TransitFlow brings public bus tracking, private institution control, live GPS updates, and OpenStreetMap/Leaflet dashboards into one secure platform.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button size="lg" to="/auth?mode=register&role=public" className="w-full sm:w-auto">
                  Get started <ArrowRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="lg" to="/public" className="w-full sm:w-auto">
                  Explore live tracking
                </Button>
              </div>

              <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {heroStats.map((stat, index) => <div key={stat.label} className="animate-rise-in" style={{ animationDelay: `${index * 90}ms` }}><StatTile value={stat.value} label={stat.label} /></div>)}
              </div>
            </div>

            <div className="md:col-span-5 animate-rise-in" style={{ animationDelay: "120ms" }}>
              <Card className="relative overflow-hidden p-4 sm:p-5 md:p-6">
                <div className="absolute -left-12 -top-12 h-32 w-32 rounded-full bg-accent/10 blur-3xl animate-glow-pulse" />
                <div className="absolute -bottom-14 -right-10 h-36 w-36 rounded-full bg-primary/5 blur-3xl animate-drift" />

                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1">
                    <Globe className="h-3.5 w-3.5" /> live city feed
                  </span>
                  <span className="whitespace-nowrap">{liveBuses.length} active vehicles</span>
                </div>

                <div className="relative mt-4 aspect-[3/4] overflow-hidden rounded-[2rem] border border-border bg-sage p-3 sm:aspect-[4/5] sm:p-4">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.28),transparent_24%),radial-gradient(circle_at_80%_25%,rgba(255,255,255,0.16),transparent_22%),radial-gradient(circle_at_40%_80%,rgba(255,255,255,0.1),transparent_24%)]" />
                  <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.1)_50%,transparent_100%)] bg-[length:200%_100%] animate-shimmer-sweep opacity-40" />
                  <svg viewBox="0 0 300 380" className="absolute inset-0 h-full w-full opacity-70">
                    <path d="M16 70 Q 90 32 150 88 T 284 110" stroke="oklch(0.35 0.04 50)" strokeWidth="1.4" fill="none" />
                    <path d="M34 210 Q 120 150 180 230 T 290 272" stroke="oklch(0.35 0.04 50)" strokeWidth="1.2" fill="none" opacity="0.6" />
                    <path d="M18 310 Q 128 250 214 324 T 286 344" stroke="oklch(0.35 0.04 50)" strokeWidth="1.1" fill="none" opacity="0.48" />
                  </svg>

                  {liveBuses.map((vehicle, index) => (
                    <div key={vehicle.id} className="absolute -translate-x-1/2 -translate-y-1/2 animate-float-slow" style={{ ...mapPosition(vehicle, liveBuses), animationDelay: `${index * 0.8}s` }}>
                      <div className="relative grid h-4 w-4 place-items-center rounded-full bg-foreground text-card shadow-soft">
                        <span className="absolute -inset-3 animate-pulse-ring rounded-full bg-foreground/30" />
                        <BusFront className="h-2.5 w-2.5" />
                      </div>
                      <div className="mt-2 whitespace-nowrap rounded-full bg-card px-2.5 py-1 text-[10px] font-medium shadow-soft">
                        {vehicle.busNumber} · {vehicle.eta}
                      </div>
                    </div>
                  ))}

                  <div className="absolute left-3 top-3 rounded-2xl bg-card/90 px-3 py-2 shadow-soft backdrop-blur-md sm:left-4 sm:top-4">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">current position</div>
                    <div className="mt-1 text-sm font-medium">OpenStreetMap (Leaflet) ready</div>
                  </div>
                </div>

                <div className="mt-4 rounded-[1.5rem] bg-secondary/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs text-muted-foreground">Public route insight</div>
                      <div className="font-display text-xl">25P live fleet overview</div>
                    </div>
                    <KeyRound className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <Badge>Realtime updates</Badge>
                    <Badge>ETA calculation</Badge>
                    <Badge>Route drawing</Badge>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </section>

        <section id="features" className="scroll-reveal mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-14">
          <div className="rounded-[2rem] border border-border/60 bg-background/55 p-4 shadow-soft backdrop-blur-sm sm:p-5 md:p-6">
            <SectionTitle
              eyebrow="Platform capabilities"
              title="A transport control center for public fleets and private institutions."
              body="The layout mirrors the same warm, premium feel as the source project while shifting the product focus to live transport operations."
            />

            <div className="mt-8 grid gap-4 sm:mt-10 md:grid-cols-2 xl:grid-cols-3">
              {landingFeatures.map((feature, index) => (
                <Card key={feature.title} className="reveal-child p-4 transition duration-300 hover:-translate-y-1 hover:shadow-lifted sm:p-5" style={{ ["--reveal-delay"]: `${index * 70}ms` }}>
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary text-foreground">
                    {index === 0 ? <BusFront className="h-5 w-5" /> : null}
                    {index === 1 ? <ShieldCheck className="h-5 w-5" /> : null}
                    {index === 2 ? <TimerReset className="h-5 w-5" /> : null}
                    {index === 3 ? <Sparkles className="h-5 w-5" /> : null}
                    {index === 4 ? <MapPinned className="h-5 w-5" /> : null}
                    {index === 5 ? <Users2 className="h-5 w-5" /> : null}
                  </div>
                  <h3 className="mt-4 font-display text-2xl">{feature.title}</h3>
                  <p className="mt-2.5 text-sm leading-7 text-muted-foreground">{feature.body}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="scroll-reveal mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-14">
          <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:gap-10">
            <SectionTitle
              eyebrow="How it works"
              title="A simple flow that keeps every bus and every user in sync."
              body="Drivers send GPS updates, Supabase stores the events, Realtime pushes them outward, and the dashboards render the current fleet state without refresh."
            />

            <div className="space-y-4">
              {howItWorks.map((step, index) => (
                <Card key={step} className="reveal-child flex gap-4 p-4 sm:p-5" style={{ ["--reveal-delay"]: `${index * 80}ms` }}>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-medium">
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium text-foreground">Step {index + 1}</div>
                    <p className="mt-1 text-sm leading-7 text-muted-foreground">{step}</p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="preview" className="scroll-reveal border-y border-border bg-secondary/30">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-14">
            <SectionTitle
              eyebrow="Live tracking preview"
              title="Designed to surface active vehicles, ETA, and route context at a glance."
              body="Public users see buses sharing a code, while private institutions see only their own fleet."
            />

            <div className="mt-8 grid gap-4 lg:grid-cols-[1.1fr_0.9fr] lg:gap-5">
              <Card className="reveal-child relative overflow-hidden p-4 sm:p-5">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.16),transparent_22%),radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.1),transparent_22%)]" />
                <div className="relative aspect-[4/3] rounded-[1.8rem] border border-border bg-sage p-3 sm:aspect-[16/11] sm:p-4">
                  <svg viewBox="0 0 800 520" className="absolute inset-0 h-full w-full opacity-60">
                    <path d="M0 250 Q 220 150 420 240 T 800 210" stroke="oklch(0.35 0.04 50)" strokeWidth="2" fill="none" />
                    <path d="M0 360 Q 260 320 420 370 T 800 340" stroke="oklch(0.35 0.04 50)" strokeWidth="2" fill="none" />
                    <path d="M60 0 Q 150 180 190 520" stroke="oklch(0.35 0.04 50 / 0.28)" strokeWidth="1.2" fill="none" />
                    <path d="M280 0 Q 350 220 400 520" stroke="oklch(0.35 0.04 50 / 0.28)" strokeWidth="1.2" fill="none" />
                    <path d="M530 0 Q 580 210 640 520" stroke="oklch(0.35 0.04 50 / 0.28)" strokeWidth="1.2" fill="none" />
                  </svg>

                  {liveBuses.map((vehicle, index) => (
                    <div key={vehicle.id} className="absolute -translate-x-1/2 -translate-y-1/2 animate-float-slow" style={{ left: `${18 + index * 21}%`, top: `${24 + index * 19}%`, animationDelay: `${index * 0.9}s` }}>
                      <div className="relative grid h-4 w-4 place-items-center rounded-full bg-foreground text-card shadow-soft">
                        <span className="absolute -inset-3 animate-pulse-ring rounded-full bg-foreground/30" />
                        <BusFront className="h-2.5 w-2.5" />
                      </div>
                      <div className="mt-2 rounded-full bg-card px-2.5 py-1 text-[10px] font-medium shadow-soft">{vehicle.label}</div>
                    </div>
                  ))}
                </div>
              </Card>

              <div className="space-y-4">
                {publicBuses.map((vehicle, index) => (
                  <Card key={vehicle.id} className="reveal-child p-4 transition duration-300 hover:-translate-y-1 hover:shadow-lifted sm:p-5" style={{ ["--reveal-delay"]: `${index * 90}ms` }}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-display text-2xl">{vehicle.busNumber}</div>
                        <div className="text-sm text-muted-foreground">{vehicle.route}</div>
                      </div>
                      <Badge>{vehicle.status}</Badge>
                    </div>
                    <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                      <div className="rounded-2xl bg-secondary p-3">
                        <div className="text-xs text-muted-foreground">ETA</div>
                        <div className="mt-1 font-medium">{vehicle.eta}</div>
                      </div>
                      <div className="rounded-2xl bg-secondary p-3">
                        <div className="text-xs text-muted-foreground">Speed</div>
                        <div className="mt-1 font-medium">{vehicle.speed} km/h</div>
                      </div>
                      <div className="rounded-2xl bg-secondary p-3">
                        <div className="text-xs text-muted-foreground">Driver</div>
                        <div className="mt-1 font-medium">{vehicle.driver}</div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="scroll-reveal mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-14">
          <div className="grid gap-4 md:grid-cols-3">
            {routeCards.map((route) => (
              <Card key={route.routeName} className="reveal-child p-4 transition duration-300 hover:-translate-y-1 hover:shadow-lifted sm:p-5" style={{ ["--reveal-delay"]: `${route.travelTime * 4}ms` }}>
                <Route className="h-5 w-5 text-muted-foreground" />
                <h3 className="mt-3 font-display text-2xl">{route.routeName}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{route.startLocation} → {route.endLocation}</p>
                <div className="mt-4 flex gap-2 text-xs">
                  <Badge>{route.travelTime} min</Badge>
                  <Badge>Scenic {route.scenicScore}</Badge>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section className="scroll-reveal border-y border-border bg-secondary/25">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-14">
            <SectionTitle
              eyebrow="Benefits"
              title="One platform for public transit teams and private fleet owners."
              body="The same design language carries across the public dashboard, driver console, and institution admin area."
            />
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {benefits.map((item, index) => (
                <Card key={item} className="reveal-child flex items-start gap-3 p-4 transition duration-300 hover:-translate-y-1 hover:shadow-lifted sm:p-5" style={{ ["--reveal-delay"]: `${index * 70}ms` }}>
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent-foreground" />
                  <p className="text-sm leading-7 text-muted-foreground">{item}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="contact" className="scroll-reveal mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-14">
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <SectionTitle
                eyebrow="Contact"
                title="Let’s talk about routes, institutions, and deployment."
                body="Wire this scaffold to Supabase, Render, and Vercel when you are ready to turn it into a live service."
              />
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {contactMethods.map((contact, index) => (
                  <Card key={contact.title} className="reveal-child p-4 transition duration-300 hover:-translate-y-1 hover:shadow-lifted" style={{ ["--reveal-delay"]: `${index * 80}ms` }}>
                    <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{contact.title}</div>
                    <div className="mt-2 text-sm font-medium text-foreground">{contact.value}</div>
                  </Card>
                ))}
              </div>
            </div>

            <Card className="reveal-child p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-secondary">
                  <PhoneCall className="h-5 w-5 text-foreground" />
                </div>
                <div>
                  <div className="font-display text-2xl">Request a rollout</div>
                  <div className="text-sm text-muted-foreground">Public agencies or private institutions</div>
                </div>
              </div>
              <form className="mt-6 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium">Name</label>
                  <input className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm shadow-soft outline-none" placeholder="Your name" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">Email</label>
                  <input className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm shadow-soft outline-none" placeholder="you@company.com" />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium">Message</label>
                  <textarea className="min-h-32 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm shadow-soft outline-none" placeholder="Tell us about your fleet, institution, or route needs." />
                </div>
                <div className="md:col-span-2 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Button type="button">Send inquiry</Button>
                  <Button type="button" variant="outline" to="/auth?mode=register&role=private-admin" className="w-full sm:w-auto">
                    Open admin demo
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-8 text-sm text-muted-foreground sm:px-6 md:flex-row md:items-center md:justify-between">
          <span className="font-display text-foreground">TransitFlow</span>
          <span>Live transport tracking for public fleets and private institutions.</span>
        </div>
      </footer>
    </div>
  );
}
