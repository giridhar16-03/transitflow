import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import App from "./App";
import "./styles.css";
import { supabase } from "./lib/supabase";

function loginRouteForPathname(pathname) {
  if (pathname.startsWith("/driver")) return "/auth?mode=login&role=public-driver";
  if (pathname.startsWith("/institution")) return "/auth?mode=login&role=private";
  return "/auth?mode=login&role=public-user";
}

// Handle OAuth callback tokens in URL (parse and then clean URL to remove tokens)
(async function handleAuthCallback() {
  try {
    const currentUrl = new URL(window.location.href);
    const searchParams = currentUrl.searchParams;
    const hashParams = new URLSearchParams(currentUrl.hash.startsWith("#") ? currentUrl.hash.slice(1) : currentUrl.hash);
    const callbackError = searchParams.get("error") || hashParams.get("error");

    if (callbackError) {
      const target = loginRouteForPathname(currentUrl.pathname);
      window.location.replace(target);
      return;
    }

    const hash = window.location.hash || '';
    if (hash.includes('access_token') || hash.includes('refresh_token') || hash.includes('provider_token')) {
      // parse session from URL so supabase client stores it
      if (supabase?.auth?.getSessionFromUrl) {
        try { await supabase.auth.getSessionFromUrl(); } catch (e) { /* ignore parse errors */ }
      }
      // remove hash to avoid showing tokens in address bar
      const cleanUrl = window.location.pathname + window.location.search;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  } catch (err) {
    console.error('Auth callback handling failed', err);
  }
})();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
      <Toaster richColors position="top-right" />
    </BrowserRouter>
  </React.StrictMode>,
);
