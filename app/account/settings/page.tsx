import { getSessions } from '@/app/actions';
import SettingsClient from './SettingsClient';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const sessions = await getSessions();
  return <SettingsClient initialSessions={sessions} />;
}
