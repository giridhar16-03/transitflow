import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Save, User } from 'lucide-react';
import { Badge, Button, Card, Input, Label, SectionTitle } from '../components/ui.jsx';
import ProfileMenu from '../components/ProfileMenu';
import icons from '../components/SiteIcons';
import { supabase, hasSupabase } from '../lib/supabase';
import { getPreferredDisplayName, getDashboardPath, getUserRole, clearStoredAuthAccess } from '../lib/authAccess';
import VIZAG_ROUTES from '../data/vizagRoutes.js';

export function ProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [busCode, setBusCode] = useState('');
  const [iconChoice, setIconChoice] = useState('logo');
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState('public-user');

  // Auth guard + load user data
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!hasSupabase || !supabase) {
        setAuthReady(true);
        return;
      }
      try {
        const { data } = await supabase.auth.getUser();
        const u = data?.user ?? null;
        if (!mounted) return;

        if (!u) {
          navigate('/auth?mode=login', { replace: true });
          return;
        }

        setUser(u);
        setDisplayName(u?.user_metadata?.full_name || '');
        setIconChoice(u?.user_metadata?.iconChoice || 'logo');

        // Determine role
        const userRole = getUserRole(u, 'public-user');
        setRole(userRole);

        // Load bus code for drivers
        const { data: driverData } = await supabase
          .from('drivers')
          .select('bus_code')
          .eq('user_id', u.id)
          .limit(1);
        if (mounted && driverData?.[0]) {
          setBusCode(driverData[0].bus_code || '');
        }

        setAuthReady(true);
      } catch {
        if (mounted) {
          setAuthReady(true);
          navigate('/auth?mode=login', { replace: true });
        }
      }
    })();
    return () => { mounted = false; };
  }, [navigate]);

  const handleSignOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    clearStoredAuthAccess(role);
    navigate('/auth?mode=login');
  };

  const dashboardPath = user ? getDashboardPath(role, user.id) : '/';

  const save = async () => {
    setSaving(true);
    try {
      if (user && supabase) {
        await supabase.auth.updateUser({ data: { full_name: displayName, iconChoice } });

        if (busCode || role === 'public-driver') {
          await supabase.from('drivers').update({ display_name: displayName, bus_code: busCode }).eq('user_id', user.id);
          await supabase.from('auth_accounts').update({ display_name: displayName, bus_code: busCode }).eq('user_id', user.id);
        } else {
          await supabase.from('auth_accounts').update({ display_name: displayName }).eq('user_id', user.id);
        }

        const { data } = await supabase.auth.getUser();
        setUser(data?.user ?? null);
        toast.success('Profile updated successfully.');
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const IconComp = icons[iconChoice] || icons.logo;

  if (!authReady) {
    return (
      <div className="grid min-h-screen place-items-center bg-background bg-grain text-sm text-muted-foreground">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
          <span>Loading TransitFlow…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background bg-grain">
      {/* Header */}
      <header className="border-b border-[rgba(232,232,227,0.06)] bg-[rgba(8,8,7,0.9)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate(dashboardPath)} className="px-0 hover:bg-transparent">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back to dashboard</span>
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="hidden sm:inline-flex gap-2">
              <User className="h-3 w-3" />
              {role === 'public-driver' ? 'Driver' : 'User'}
            </Badge>
            {user && <ProfileMenu user={user} onSignOut={handleSignOut} />}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-3 py-6 sm:px-6 sm:py-10 md:py-14">
        <SectionTitle title="Profile" body="Update your display name, preferred icon, and driver details." />

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {/* Edit form */}
          <Card className="p-5">
            <div className="space-y-4">
              <div>
                <Label>Display name</Label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" />
              </div>

              <div>
                <Label>Preferred site icon</Label>
                <div className="mt-2 flex gap-3">
                  {Object.keys(icons).map((key) => {
                    const C = icons[key];
                    return (
                      <button
                        key={key}
                        onClick={() => setIconChoice(key)}
                        className={`p-2 rounded-lg border transition-all duration-300 ${
                          iconChoice === key
                            ? 'border-foreground/40 bg-[rgba(232,232,227,0.08)]'
                            : 'border-[rgba(232,232,227,0.08)] hover:border-[rgba(232,232,227,0.15)]'
                        }`}
                      >
                        <C />
                      </button>
                    );
                  })}
                </div>
              </div>

              {role === 'public-driver' && (
                <div>
                  <Label>Bus route</Label>
                  <select
                    className="w-full rounded-xl border border-[rgba(232,232,227,0.1)] bg-[rgba(232,232,227,0.04)] px-3 py-2.5 text-sm text-foreground transition-all duration-300 hover:border-[rgba(232,232,227,0.2)] focus:border-[rgba(232,232,227,0.25)] focus:outline-none"
                    value={busCode}
                    onChange={(e) => setBusCode(e.target.value)}
                  >
                    <option value="">— Select Bus Route —</option>
                    {VIZAG_ROUTES.map((route) => (
                      <option key={`${route.osmRelationId}-${route.routeNumber}`} value={route.routeNumber}>
                        {route.routeNumber} : {route.routeName} {route.via ? `(via ${route.via})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {role !== 'public-driver' && (
                <div>
                  <Label>Driver bus code (if applicable)</Label>
                  <Input value={busCode} onChange={(e) => setBusCode(e.target.value)} placeholder="e.g. 25P" />
                </div>
              )}

              <div className="pt-2">
                <Button onClick={save} disabled={saving}>
                  {saving ? (
                    <div className="h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {saving ? 'Saving…' : 'Save profile'}
                </Button>
              </div>
            </div>
          </Card>

          {/* Preview card */}
          <Card className="p-5">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-foreground text-background grid place-items-center">
                <IconComp />
              </div>
              <div>
                <div className="font-display text-lg text-foreground">{displayName || getPreferredDisplayName(user)}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{user?.email || 'No email'}</div>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <InfoRow label="Role" value={role === 'public-driver' ? 'Driver' : role === 'private' ? 'Institution Admin' : 'Public User'} />
              <InfoRow label="Account status" value="Active" />
              {busCode && <InfoRow label="Bus code" value={busCode} />}
              <InfoRow label="Provider" value={user?.app_metadata?.provider || 'email'} />
            </div>

            <div className="mt-6">
              <Button variant="outline" size="sm" onClick={() => navigate(dashboardPath)} className="w-full">
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to dashboard
              </Button>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-[rgba(232,232,227,0.06)] bg-[rgba(232,232,227,0.03)] px-4 py-3">
      <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

export default ProfilePage;
