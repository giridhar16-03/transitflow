import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Compass, Globe, Loader2, ShieldCheck, UserRound } from "lucide-react";
import { Badge, Button, Card, Input, Label, SectionTitle } from "../components/ui.jsx";
import Icons from "../components/SiteIcons";
import { hasSupabase, resolveAuthAccountByEmail, signInWithGoogle, supabase, signInWithPassword, signUpWithPassword } from "../lib/supabase";
import { getDashboardPath, getUserRole, normalizeAuthRole, persistAuthAccess } from "../lib/authAccess";
import VIZAG_ROUTES from "../data/vizagRoutes.js";

/* ─── Static data ─────────────────────────────────────────────────────────── */

const roleCopy = {
  "public-user": {
    title: "Public User",
    description: "Browse routes, track live buses, and find nearest stops.",
    path: "/public",
  },
  "public-driver": {
    title: "Public Driver",
    description: "Start and end trips, push live GPS updates, and manage bus status.",
    path: "/driver",
  },
  private: {
    title: "Private Registration",
    description: "Under production. Please wait.",
    path: "/institution",
  },
};

const audienceOptions = [
  { key: "public", title: "Public", body: "City buses and shared transportation." },
  { key: "private", title: "Private", body: "Schools, colleges, companies, and private fleets." },
];

const publicRoleOptions = [
  { key: "public-user", title: "User", icon: Globe },
  { key: "public-driver", title: "Driver", icon: UserRound },
];

const profileFieldSets = {
  "public-user": [
    { name: "name", label: "Full Name", placeholder: "Aarav Sharma" },
    { name: "age", label: "Age", type: "number", placeholder: "22" },
  ],
  "public-driver": [
    { name: "name", label: "Full Name", placeholder: "Ravi Kumar" },
    { name: "age", label: "Age", type: "number", placeholder: "31" },
    { name: "drivingLicenseNumber", label: "Driving License Number", placeholder: "DL-0420250012345" },
    { name: "busCode", label: "Bus Code", placeholder: "25P" },
    { name: "busNumber", label: "Bus Number", placeholder: "25P-001" },
  ],
};

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function normalizeRole(roleParam) {
  if (roleParam === "driver" || roleParam === "public-driver") return "public-driver";
  return "public-user";
}

function LinkBack() {
  return (
    <Button variant="ghost" to="/" className="w-fit">
      <ArrowLeft className="h-4 w-4" />
      Back
    </Button>
  );
}

function buildAuthPath(mode, role) {
  const params = new URLSearchParams({ mode, role });
  return `/auth?${params.toString()}`;
}

function roleLabel(role) {
  return normalizeAuthRole(role) === "public-driver" ? "Driver" : "User";
}

function isMissingProfilesTableError(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("could not find the table 'public.profiles' in the schema cache") ||
    message.includes("relation \"public.profiles\" does not exist")
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  AuthPage                                                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */

export function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const oauthHandledRef = useRef(false);

  const initialMode = searchParams.get("mode") === "register" ? "register" : "login";
  const roleParam = searchParams.get("role") || "public-user";
  const initialAudience = roleParam.startsWith("private") ? "private" : "public";

  const [authMode, setAuthMode] = useState(initialMode);
  const [audience, setAudience] = useState(initialAudience);
  const [publicRole, setPublicRole] = useState(normalizeRole(roleParam));
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({});
  const [profileForm, setProfileForm] = useState({});
  const [currentUser, setCurrentUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileSetupState, setProfileSetupState] = useState(null);
  const isLoginMode = authMode === "login";

  /* Sync URL params → state */
  useEffect(() => {
    setAuthMode(searchParams.get("mode") === "register" ? "register" : "login");
    const nextRole = searchParams.get("role") || "public-user";
    setPublicRole(normalizeRole(nextRole));
    setAudience(nextRole.startsWith("private") ? "private" : "public");
    setForm({});
    setProfileForm({});
    setProfileSetupState(null);
  }, [searchParams]);

  const currentRoleKey = audience === "private" ? "private" : publicRole;
  const activeRoleCopy = roleCopy[currentRoleKey] ?? roleCopy["public-user"];
  const activeProfileFields = useMemo(() => {
    if (!profileSetupState) return [];
    return profileFieldSets[profileSetupState.role] ?? profileFieldSets["public-user"];
  }, [profileSetupState]);

  /* ─── Check existing auth session on mount ─── */
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!hasSupabase || !supabase) {
        setAuthReady(true);
        return;
      }
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setCurrentUser(data?.user || null);
      setAuthReady(true);
    })();
    return () => { mounted = false; };
  }, []);

  /* ─── DB helpers ─── */

  const loadAccountRecordByEmail = async (email) => {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from("auth_accounts")
      .select("user_id, email, role, provider, has_password, display_name, bus_code")
      .eq("email", String(email || "").trim())
      .maybeSingle();
    if (error) { console.error(error); return null; }
    return data || null;
  };

  const loadAccountRecordByUserId = async (userId) => {
    if (!supabase || !userId) return null;
    const { data, error } = await supabase
      .from("auth_accounts")
      .select("user_id, email, role, provider, has_password, display_name, bus_code")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) { console.error(error); return null; }
    return data || null;
  };

  const saveAccountRecord = async ({ userId, email, role, provider, displayName, busCode = "", hasPassword = false }) => {
    if (!supabase || !userId || !email) return;
    const { error } = await supabase.from("auth_accounts").upsert(
      {
        user_id: userId,
        email,
        role,
        provider,
        has_password: hasPassword,
        display_name: displayName,
        bus_code: busCode,
      },
      { onConflict: "user_id" },
    );
    if (error) {
      toast.error(error.message || "Account record could not be saved.");
    }
  };

  const resolveRoleFromDB = async (userId, email) => {
    // 1. Check auth_accounts by user_id
    const account = await loadAccountRecordByUserId(userId);
    if (account?.role) {
      return normalizeAuthRole(account.role);
    }
    // 2. Fallback: check drivers table
    if (supabase) {
      const { data: driverRow } = await supabase
        .from("drivers")
        .select("bus_code")
        .eq("user_id", userId)
        .maybeSingle();
      if (driverRow) return "public-driver";
    }
    // 3. Fallback: check auth_accounts by email
    if (email) {
      const accountByEmail = await loadAccountRecordByEmail(email);
      if (accountByEmail?.role) {
        return normalizeAuthRole(accountByEmail.role);
      }
    }
    return null; // not registered
  };

  /* ─── Navigate to correct dashboard ─── */
  const navigateToDashboard = (role, userId) => {
    persistAuthAccess(role, authMode, { audience, ...form });
    navigate(getDashboardPath(role, userId), { replace: true });
  };

  const completeDemoSignIn = () => {
    persistAuthAccess(currentRoleKey, authMode, { audience, ...form });
    toast.success(`${activeRoleCopy.title} access ready.`);
    navigate(getDashboardPath(currentRoleKey, form.email || form.name || currentRoleKey), { replace: true });
  };

  /* ═══════════════════════════════════════════════════════════════════════════ */
  /*  Profile Completion Handler                                                */
  /* ═══════════════════════════════════════════════════════════════════════════ */

  const handleCompleteProfile = async () => {
    if (!profileSetupState || !currentUser || !supabase) return;

    const required = activeProfileFields.find((field) => String(profileForm[field.name] || "").trim() === "");
    if (required) {
      toast.error(`Please enter ${required.label.toLowerCase()}.`);
      return;
    }

    const numericAge = Number(profileForm.age);
    if (!Number.isFinite(numericAge) || numericAge <= 0) {
      toast.error("Please enter a valid age.");
      return;
    }

    if (profileSetupState.role === "public-driver" && numericAge < 18) {
      toast.error("Driver must be at least 18 years old.");
      return;
    }

    setLoading(true);
    try {
      const role = profileSetupState.role;
      const email = profileSetupState.email;
      const provider = profileSetupState.provider || "password";
      const displayName = String(profileForm.name || "").trim();
      const busCode = String(profileForm.busCode || "").trim();
      const busNumber = String(profileForm.busNumber || "").trim();

      // 1. Save auth_accounts
      await saveAccountRecord({
        userId: currentUser.id,
        email,
        role,
        provider,
        displayName,
        busCode: role === "public-driver" ? busCode : "",
        hasPassword: provider === "password",
      });

      // 2. Save profiles table (for public-user)
      if (role === "public-user") {
        const { error: profileError } = await supabase.from("profiles").upsert(
          {
            id: currentUser.id,
            name: displayName,
            email,
            role: "public_user",
            mode: "public",
          },
          { onConflict: "id" },
        );
        if (profileError && !isMissingProfilesTableError(profileError)) {
          toast.error(profileError.message || "User profile could not be saved.");
          return;
        }
      }

      // 3. Save drivers table (for public-driver)
      if (role === "public-driver") {
        const { data: existingDriver } = await supabase
          .from("drivers")
          .select("driver_key_id")
          .eq("user_id", currentUser.id)
          .maybeSingle();

        const generatedDriverKey = `DRV-${String(currentUser.id || "").replace(/-/g, "").slice(0, 12).toUpperCase()}`;
        const driverKeyId = String(existingDriver?.driver_key_id || generatedDriverKey).trim();

        const driverPayload = {
          user_id: currentUser.id,
          created_by: currentUser.id,
          driver_key_id: driverKeyId,
          name: displayName,
          display_name: displayName,
          email,
          age: numericAge,
          bus_code: busCode,
          bus_number: busNumber,
          driving_license_number: String(profileForm.drivingLicenseNumber || "").trim(),
        };

        const { error: driverError } = await supabase.from("drivers").upsert(driverPayload, { onConflict: "user_id" });

        if (driverError) {
          // Fallback with fewer columns
          const fallbackPayload = {
            user_id: currentUser.id,
            created_by: currentUser.id,
            driver_key_id: driverKeyId,
            name: displayName,
            age: numericAge,
            bus_number: busNumber,
            email,
            bus_code: busCode,
          };
          const { error: fallbackError } = await supabase.from("drivers").upsert(fallbackPayload, { onConflict: "user_id" });
          if (fallbackError) {
            toast.error(fallbackError.message || "Driver profile could not be saved.");
            return;
          }
        }
      }

      // 4. Update user metadata
      await supabase.auth.updateUser({
        data: {
          role,
          full_name: displayName,
          age: numericAge,
          bus_code: role === "public-driver" ? busCode : null,
          bus_number: role === "public-driver" ? busNumber : null,
          driving_license_number: role === "public-driver" ? String(profileForm.drivingLicenseNumber || "").trim() : null,
        },
      });

      // 5. Navigate
      persistAuthAccess(role, "register", { audience: "public", email });
      toast.success("Profile saved successfully.");
      setProfileSetupState(null);
      setProfileForm({});
      navigate(getDashboardPath(role, currentUser.id), { replace: true });
    } finally {
      setLoading(false);
    }
  };

  /* ═══════════════════════════════════════════════════════════════════════════ */
  /*  Email/Password Auth Handler                                               */
  /* ═══════════════════════════════════════════════════════════════════════════ */

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      toast.error("Please enter email and password.");
      return;
    }

    if (!hasSupabase || !supabase) {
      completeDemoSignIn();
      return;
    }

    setLoading(true);
    try {
      if (isLoginMode) {
        /* ─── LOGIN ─── */
        const { data, error } = await signInWithPassword({
          email: form.email,
          password: form.password,
        });
        if (error) {
          toast.error(error.message || "Invalid credentials.");
          return;
        }

        const user = data.user;
        setCurrentUser(user);

        // Auto-detect role from database — ignore URL ?role= param
        const resolvedRole = await resolveRoleFromDB(user.id, form.email);

        if (!resolvedRole) {
          // Email signed in but no auth_accounts record — shouldn't happen but handle gracefully
          toast.error("Account not found. Please register first.");
          await supabase.auth.signOut();
          return;
        }

        // Check if profile is complete
        let profileComplete = false;
        if (resolvedRole === "public-driver") {
          const { data: driverRow } = await supabase
            .from("drivers")
            .select("display_name, age, bus_code")
            .eq("user_id", user.id)
            .maybeSingle();
          profileComplete = Boolean(driverRow?.display_name && driverRow?.age && driverRow?.bus_code);
        } else {
          const { data: accountRow } = await supabase
            .from("auth_accounts")
            .select("display_name")
            .eq("user_id", user.id)
            .maybeSingle();
          profileComplete = Boolean(accountRow?.display_name);
        }

        if (profileComplete) {
          toast.success("Logged in successfully.");
          navigateToDashboard(resolvedRole, user.id);
        } else {
          toast.message("Please complete your profile details.");
          setProfileForm({
            name: user.user_metadata?.full_name || user.email.split("@")[0],
            age: "",
            busCode: "",
            busNumber: "",
            drivingLicenseNumber: "",
          });
          setProfileSetupState({
            userId: user.id,
            email: form.email,
            role: resolvedRole,
            provider: "password",
          });
        }
      } else {
        /* ─── REGISTER ─── */
        const chosenRole = publicRole;
        const displayName = form.fullName || form.email.split("@")[0];

        // Check if this email is already registered with a different role
        const existingAccount = await loadAccountRecordByEmail(form.email);
        if (existingAccount && normalizeAuthRole(existingAccount.role) !== chosenRole) {
          toast.error(`This email is already registered as ${roleLabel(existingAccount.role)}. Please log in as ${roleLabel(existingAccount.role)}.`);
          return;
        }

        const { data, error } = await signUpWithPassword({
          email: form.email,
          password: form.password,
          options: {
            data: {
              role: chosenRole,
              full_name: displayName,
            },
          },
        });
        if (error) {
          toast.error(error.message || "Registration failed.");
          return;
        }

        const user = data.user;
        setCurrentUser(user);

        // Show profile completion form — always required
        setProfileForm({
          name: displayName,
          age: "",
          busCode: "",
          busNumber: "",
          drivingLicenseNumber: "",
        });
        setProfileSetupState({
          userId: user.id,
          email: form.email,
          role: chosenRole,
          provider: "password",
        });
        toast.success("Account created! Please complete your profile details.");
      }
    } catch (err) {
      toast.error(err.message || "Authentication error.");
    } finally {
      setLoading(false);
    }
  };

  /* ═══════════════════════════════════════════════════════════════════════════ */
  /*  Google Auth Handler                                                       */
  /* ═══════════════════════════════════════════════════════════════════════════ */

  const handleGoogle = async () => {
    if (authMode === "register" && audience === "private") {
      toast.message("Private registration is under production. Please wait.");
      return;
    }

    // For registration: include role. For login: role doesn't matter (DB decides).
    const selectedRole = authMode === "register" ? publicRole : "public-user";
    const redirectTo = `${window.location.origin}${buildAuthPath(authMode, selectedRole)}&provider=google`;
    const { error } = await signInWithGoogle(redirectTo);
    if (error) {
      toast.message("Google OAuth is not configured yet. Demo mode remains available.");
      completeDemoSignIn();
    }
  };

  /* ═══════════════════════════════════════════════════════════════════════════ */
  /*  Google OAuth Callback Handler                                             */
  /* ═══════════════════════════════════════════════════════════════════════════ */

  useEffect(() => {
    if (!authReady || !currentUser || !hasSupabase || !supabase) return;
    if (searchParams.get("provider") !== "google") return;
    if (oauthHandledRef.current) return;

    oauthHandledRef.current = true;

    (async () => {
      const email = String(currentUser.email || "").trim();
      if (!email) {
        toast.error("Google sign-in did not provide an email address.");
        await supabase.auth.signOut();
        navigate(buildAuthPath("login", "public-user"), { replace: true });
        return;
      }

      // Look up existing account by email (uses security-definer RPC)
      const { data: accountRows, error: accountLookupError } = await resolveAuthAccountByEmail(email);
      if (accountLookupError) {
        toast.error(accountLookupError.message || "Unable to verify the account.");
        await supabase.auth.signOut();
        navigate(buildAuthPath(authMode, "public-user"), { replace: true });
        return;
      }

      const account = Array.isArray(accountRows) ? accountRows[0] : accountRows;

      if (authMode === "register") {
        /* ─── GOOGLE REGISTER ─── */
        const chosenRole = normalizeRole(searchParams.get("role") || publicRole);
        const displayName = account?.display_name || currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || currentUser.email || "User";

        // If already registered as a DIFFERENT role → block
        if (account && normalizeAuthRole(account.role) !== chosenRole) {
          const existingRole = normalizeAuthRole(account.role);
          toast.error(`This Gmail is already registered as ${roleLabel(existingRole)}. Please log in as ${roleLabel(existingRole)}.`);
          await supabase.auth.signOut();
          navigate(buildAuthPath("login", existingRole), { replace: true });
          return;
        }

        // If already registered with SAME role and has completed profile → skip to dashboard
        if (account && normalizeAuthRole(account.role) === chosenRole) {
          // Check if profile is already complete
          let profileComplete = false;
          if (chosenRole === "public-driver") {
            const { data: driverRow } = await supabase
              .from("drivers")
              .select("display_name, age, bus_code, bus_number, driving_license_number")
              .eq("user_id", currentUser.id)
              .maybeSingle();
            profileComplete = Boolean(driverRow?.display_name && driverRow?.age && driverRow?.bus_code);
          } else {
            // For users, check if auth_accounts has a display_name (basic completion)
            profileComplete = Boolean(account.display_name);
          }

          if (profileComplete) {
            await supabase.auth.updateUser({ data: { role: chosenRole, full_name: account.display_name || displayName } });
            toast.success("Welcome back! Redirecting to your dashboard.");
            navigateToDashboard(chosenRole, currentUser.id);
            return;
          }
        }

        // First-time or incomplete profile → show profile completion form
        await saveAccountRecord({
          userId: currentUser.id,
          email,
          role: chosenRole,
          provider: "google",
          displayName,
          busCode: account?.bus_code || "",
        });
        await supabase.auth.updateUser({ data: { role: chosenRole, full_name: displayName } });

        const nextProfileForm = {
          name: displayName,
          age: currentUser.user_metadata?.age || "",
          busCode: account?.bus_code || currentUser.user_metadata?.bus_code || "",
          busNumber: currentUser.user_metadata?.bus_number || "",
          drivingLicenseNumber: currentUser.user_metadata?.driving_license_number || "",
        };

        // Pre-fill from existing driver record if any
        if (chosenRole === "public-driver") {
          const { data: existingDriver } = await supabase
            .from("drivers")
            .select("display_name, age, bus_code, bus_number, driving_license_number")
            .eq("user_id", currentUser.id)
            .maybeSingle();
          if (existingDriver) {
            nextProfileForm.name = existingDriver.display_name || nextProfileForm.name;
            nextProfileForm.age = existingDriver.age || nextProfileForm.age;
            nextProfileForm.busCode = existingDriver.bus_code || nextProfileForm.busCode;
            nextProfileForm.busNumber = existingDriver.bus_number || nextProfileForm.busNumber;
            nextProfileForm.drivingLicenseNumber = existingDriver.driving_license_number || nextProfileForm.drivingLicenseNumber;
          }
        }

        setProfileForm(nextProfileForm);
        setProfileSetupState({
          userId: currentUser.id,
          email,
          role: chosenRole,
          provider: "google",
        });
        toast.success("Google authentication successful. Please complete your profile.");
        return;
      }

      /* ─── GOOGLE LOGIN ─── */
      if (!account) {
        toast.error("This email is not registered yet. Please create an account first.");
        await supabase.auth.signOut();
        navigate(buildAuthPath("register", "public-user"), { replace: true });
        return;
      }

      // Auto-detect role from database
      const resolvedRole = normalizeAuthRole(account.role);
      await supabase.auth.updateUser({
        data: {
          role: resolvedRole,
          full_name: account.display_name || currentUser.user_metadata?.full_name || currentUser.email || "User",
        },
      });

      toast.success("Logged in successfully.");
      navigateToDashboard(resolvedRole, currentUser.id);
    })();
  }, [authReady, currentUser, authMode, audience, navigate, publicRole, searchParams]);

  /* ═══════════════════════════════════════════════════════════════════════════ */
  /*  Render                                                                    */
  /* ═══════════════════════════════════════════════════════════════════════════ */

  return (
    <div className="min-h-screen bg-background bg-grain px-3 py-3 sm:px-4 sm:py-4 md:px-6 md:py-5 lg:px-8">
      <div className={`mx-auto grid min-h-[calc(100vh-2rem)] gap-4 ${isLoginMode ? "max-w-2xl" : "max-w-6xl lg:grid-cols-[0.95fr_1.05fr]"}`}>

        {/* ─── Left panel (register mode only) ─── */}
        {!isLoginMode ? (
          <aside className="relative overflow-hidden rounded-3xl border border-border bg-warm p-4 opacity-0 shadow-soft animate-rise-in sm:p-6 md:p-7" style={{ animationDelay: "40ms" }}>
            <div className="absolute right-0 top-0 h-36 w-36 rounded-full bg-card/25 blur-3xl" />
            <LinkBack />

            <div className="mt-10">
              <Badge className="gap-2 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em]">
                <Compass className="h-3 w-3" /> secure access control
              </Badge>
              <h1 className="mt-4 font-display text-2xl leading-[1.05] tracking-tight text-foreground sm:text-4xl md:text-5xl">
                Sign in once.
                <br />
                Route by role.
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-foreground/75 md:text-base">
                Public registration supports User and Driver onboarding with role-specific fields.
              </p>
            </div>

            {authMode === "register" ? (
              <>
                <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                  {audienceOptions.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => { setAudience(item.key); setForm({}); }}
                      className={`rounded-2xl border p-3 text-left transition ${audience === item.key ? "border-primary bg-card shadow-soft" : "border-border bg-card/70 hover:bg-card"}`}
                    >
                      <div className="font-medium">{item.title}</div>
                      <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
                    </button>
                  ))}
                </div>

                {audience === "public" ? (
                  <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                    {publicRoleOptions.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => { setPublicRole(item.key); setForm({}); }}
                          className={`rounded-2xl border p-3 text-left transition ${publicRole === item.key ? "border-primary bg-card shadow-soft" : "border-border bg-card/70 hover:bg-card"}`}
                        >
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <Icon className="h-4 w-4" />
                            {item.title}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <Card className="mt-5 p-3.5">
                    <div className="text-sm font-medium">Private side is under production.</div>
                    <p className="mt-1 text-sm text-muted-foreground">Please wait while we complete private registration flow.</p>
                  </Card>
                )}
              </>
            ) : null}

          </aside>
        ) : null}

        {/* ─── Right panel (form) ─── */}
        <section className="flex items-center">
          <Card className="relative w-full overflow-hidden border-border/70 bg-[linear-gradient(165deg,oklch(0.992_0.006_90)_0%,oklch(0.972_0.012_88)_38%,oklch(0.952_0.016_78)_100%)] p-5 opacity-0 animate-rise-in md:p-6" style={{ animationDelay: isLoginMode ? "40ms" : "80ms" }}>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_12%,rgba(255,255,255,0.65),transparent_34%),radial-gradient(circle_at_88%_8%,rgba(255,255,255,0.35),transparent_30%)]" />
            <div className="pointer-events-none absolute -right-14 top-8 h-36 w-36 rounded-full bg-primary/8 blur-3xl" />
            <div className="pointer-events-none absolute -left-14 bottom-8 h-28 w-28 rounded-full bg-accent/10 blur-3xl" />

            <div className="relative z-10">
              {isLoginMode ? (
                <div className="mb-5">
                  <LinkBack />
                </div>
              ) : null}

              {/* ─── Profile completion form ─── */}
              {profileSetupState ? (
                <Card className="mb-5 p-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <div className="text-sm font-medium">Complete your {roleLabel(profileSetupState.role)} profile</div>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">This information is saved to your account and used across TransitFlow.</p>
                  <div className="mt-4 space-y-3">
                    {activeProfileFields.map((field) => (
                      <div key={field.name}>
                        <Label>{field.label}</Label>
                        {field.name === "busCode" ? (
                          <select
                            className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm transition-colors hover:border-primary focus:border-primary focus:outline-none"
                            value={profileForm[field.name] || ""}
                            onChange={(event) => {
                              const val = event.target.value;
                              setProfileForm((current) => ({
                                ...current,
                                busCode: val,
                                busNumber: current.busNumber || val, // Pre-fill busNumber if empty
                              }));
                            }}
                          >
                            <option value="">— Select Bus Route —</option>
                            {VIZAG_ROUTES.map((route) => (
                              <option key={`${route.osmRelationId}-${route.routeNumber}`} value={route.routeNumber}>
                                {route.routeNumber} : {route.routeName} {route.via ? `(via ${route.via})` : ''}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Input
                            type={field.type || "text"}
                            placeholder={field.placeholder}
                            value={profileForm[field.name] || ""}
                            onChange={(event) => setProfileForm((current) => ({ ...current, [field.name]: event.target.value }))}
                          />
                        )}
                      </div>
                    ))}
                    <Button onClick={handleCompleteProfile} disabled={loading}>
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                      Save profile
                    </Button>
                  </div>
                </Card>
              ) : null}

              {/* ─── Title & subtitle ─── */}
              <SectionTitle
                title={isLoginMode ? "Welcome back" : "Create your access"}
                body={
                  isLoginMode
                    ? "Sign in with the email you registered with. You'll be routed automatically based on your role."
                    : `${activeRoleCopy.title}: ${activeRoleCopy.description}`
                }
              />

              {!hasSupabase ? (
                <div className="mt-4 rounded-2xl border border-dashed border-border bg-secondary/40 p-3 text-sm text-muted-foreground">
                  Supabase credentials are not configured yet, so this UI falls back to demo mode while preserving the role-based flow.
                </div>
              ) : null}

              <div className="mt-6 space-y-3">
                {authMode === "register" && audience === "private" ? (
                  <div className="rounded-2xl border border-border bg-secondary/40 p-3 text-sm text-muted-foreground animate-fade-up">
                    Private side is under production. Please wait.
                  </div>
                ) : (
                  <div className="rounded-2xl border border-border bg-secondary/40 p-3 text-sm text-muted-foreground animate-fade-up">
                    {isLoginMode
                      ? "Sign in with your email and password, or use Google. Your role (User or Driver) is detected automatically."
                      : "Register with email or Google, then complete your profile details."}
                  </div>
                )}
              </div>

              {/* ─── Email/Password form ─── */}
              {!(authMode === "register" && audience === "private") && (
                <form onSubmit={handleEmailAuth} className="mt-6 space-y-4 animate-fade-up">
                  {authMode === "register" && (
                    <div>
                      <Label htmlFor="fullName">Full Name</Label>
                      <Input
                        id="fullName"
                        placeholder="Enter your name"
                        value={form.fullName || ""}
                        onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
                        required
                      />
                    </div>
                  )}
                  <div>
                    <Label htmlFor="email">Email address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={form.email || ""}
                      onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={form.password || ""}
                      onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading || !!profileSetupState}>
                    {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    {isLoginMode ? "Sign in" : `Register as ${publicRole === "public-driver" ? "Driver" : "User"}`}
                  </Button>

                  <div className="relative flex items-center justify-center my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border"></div>
                    </div>
                    <span className="relative bg-background px-3 text-xs text-muted-foreground uppercase">or</span>
                  </div>
                </form>
              )}

              {/* ─── Google button + toggle ─── */}
              <div className="mt-5 w-full animate-fade-up" style={{ animationDelay: "140ms" }}>
                <div className="mt-2 sm:mt-0 sm:ml-2 text-sm text-muted-foreground">
                  {isLoginMode ? (
                    <>
                      New to TransitFlow?{" "}
                      <button
                        type="button"
                        onClick={() => navigate(buildAuthPath("register", roleParam))}
                        className="text-primary underline"
                      >
                        Register here
                      </button>
                    </>
                  ) : (
                    <>
                      Already have an account?{" "}
                      <button
                        type="button"
                        onClick={() => navigate(buildAuthPath("login", roleParam))}
                        className="text-primary underline"
                      >
                        Login here
                      </button>
                    </>
                  )}
                </div>

                <div className="flex mt-4">
                  <Button variant="outline" size="md" onClick={handleGoogle} className="w-full" disabled={loading || !!profileSetupState || (authMode === "register" && audience === "private")}>
                    <Icons.bus className="mr-2" />
                    {isLoginMode
                      ? "Sign in with Google"
                      : `Register with Google as ${publicRole === "public-driver" ? "Driver" : "User"}`}
                  </Button>
                </div>
              </div>

            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}
