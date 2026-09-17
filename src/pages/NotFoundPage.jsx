import { Compass, ArrowLeft, MapPinned } from "lucide-react";
import { Button } from "../components/ui.jsx";

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-background bg-grain flex items-center justify-center px-4">
      {/* Ambient orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-20 top-20 h-64 w-64 rounded-full bg-[rgba(200,200,192,0.03)] blur-[100px] animate-glow-pulse" />
        <div className="absolute right-[-3rem] bottom-1/4 h-72 w-72 rounded-full bg-[rgba(232,232,227,0.02)] blur-[100px] animate-drift-slow" />
      </div>

      <div className="relative text-center max-w-md animate-rise-in">
        {/* Large 404 */}
        <div className="relative inline-flex items-center justify-center mb-8">
          <div className="absolute h-32 w-32 rounded-full bg-[rgba(232,232,227,0.04)] blur-[60px]" />
          <div className="relative grid h-24 w-24 place-items-center rounded-3xl border border-[rgba(232,232,227,0.1)] bg-card">
            <MapPinned className="h-10 w-10 text-muted-foreground" />
          </div>
        </div>

        <h1 className="font-display text-6xl tracking-tight text-gradient-warm sm:text-8xl">
          404
        </h1>
        <p className="mt-4 font-display text-xl text-foreground sm:text-2xl">
          Route not found
        </p>
        <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">
          The page you&rsquo;re looking for doesn&rsquo;t exist or has been moved.
          Let&rsquo;s get you back on track.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button to="/" size="lg" className="w-full sm:w-auto">
            <Compass className="h-4 w-4" />
            Back to TransitFlow
          </Button>
          <Button variant="outline" size="lg" to="/public" className="w-full sm:w-auto">
            Explore live tracking
          </Button>
        </div>

        <div className="mt-10 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ArrowLeft className="h-3 w-3" />
          <span>Or use the browser&rsquo;s back button</span>
        </div>
      </div>
    </div>
  );
}
