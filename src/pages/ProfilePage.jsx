import { useEffect, useState } from 'react';
import { Button, Card, Input, Label, SectionTitle } from '../components/ui.jsx';
import { supabase } from '../lib/supabase';
import icons from '../components/SiteIcons';
import { getPreferredDisplayName } from '../lib/authAccess';

export function ProfilePage() {
  const [user, setUser] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [busCode, setBusCode] = useState('');
  const [iconChoice, setIconChoice] = useState('logo');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data?.user ?? null;
      if (!mounted) return;
      setUser(u);
      setDisplayName(u?.user_metadata?.full_name || '');
      setIconChoice(u?.user_metadata?.iconChoice || 'logo');

      // if driver, fetch driver record to get bus_code
      if (u) {
        const { data: drivers } = await supabase.from('drivers').select('bus_code').eq('user_id', u.id).limit(1);
        if (drivers?.[0]) {
          setBusCode(drivers[0].bus_code || '');
        }
      }
    })();
    return () => { mounted = false; };
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      if (user) {
        // update auth user metadata
        await supabase.auth.updateUser({ data: { full_name: displayName, iconChoice } });
        // update drivers table if busCode changed
        if (busCode) {
          await supabase.from('drivers').update({ display_name: displayName, bus_code: busCode }).eq('user_id', user.id);
          await supabase.from('auth_accounts').update({ display_name: displayName, bus_code: busCode }).eq('user_id', user.id);
        }
        const { data } = await supabase.auth.getUser();
        setUser(data?.user ?? null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const IconComp = icons[iconChoice] || icons.logo;

  return (
    <div className="min-h-screen bg-background bg-grain">
      <main className="mx-auto max-w-4xl px-6 py-10 md:py-14">
        <SectionTitle title="Profile" body="Update your display name, preferred icon, and driver details." />
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <Card className="p-5">
            <Label>Display name</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            <div className="mt-4">
              <Label>Preferred site icon</Label>
              <div className="mt-2 flex gap-3">
                {Object.keys(icons).map((key) => {
                  const C = icons[key];
                  return (
                    <button key={key} onClick={() => setIconChoice(key)} className={`p-2 rounded-md border ${iconChoice===key? 'border-primary': 'border-border'}`}>
                      <C />
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mt-6">
              <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save profile'}</Button>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground grid place-items-center"><IconComp /></div>
              <div>
                <div className="font-medium">{getPreferredDisplayName(user)}</div>
                <div className="text-xs text-muted-foreground">Account active</div>
              </div>
            </div>

            <div className="mt-4">
              <Label>Driver bus code (if applicable)</Label>
              <Input value={busCode} onChange={(e) => setBusCode(e.target.value)} placeholder="e.g. 25P" />
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}

export default ProfilePage;
