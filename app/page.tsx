import { getSessions } from '@/app/actions';
import HomeClient from '@/app/HomeClient';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const sessions = await getSessions();
  return <HomeClient initialSessions={sessions} />;
}
