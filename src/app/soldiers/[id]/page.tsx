import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/auth/get-user';
import type { FeedbackRow } from '@/types/database';
import ProfileClient from './ProfileClient';

const OFFICER_ROLES = ['company_commander', 'platoon_commander', 'crew_commander'];

interface Props { params: { id: string } }

export default async function SoldierProfilePage({ params }: Props) {
  const currentUser = await getAuthenticatedUser();
  const admin       = createAdminClient();

  const [
    { data: soldier, error },
    { data: platoons },
    { data: crews },
  ] = await Promise.all([
    admin.from('users').select('*').eq('id', params.id).single(),
    admin.from('platoons').select('*').order('platoon_number'),
    admin.from('crews').select('*').order('name'),
  ]);

  if (error || !soldier) redirect('/dashboard');

  const isOfficer    = OFFICER_ROLES.includes(currentUser.role);
  const canFeedback  = isOfficer || currentUser.can_view_feedback;

  // Only load feedback if the viewer has permission — prevents data leaks
  let feedback: (FeedbackRow & { author_name: string })[] = [];
  if (canFeedback) {
    const { data: fb } = await admin
      .from('feedback')
      .select('*')
      .eq('soldier_id', params.id)
      .order('created_at', { ascending: false });

    if (fb && fb.length > 0) {
      const authorIds = [...new Set(fb.map(f => f.author_id))];
      const { data: authors } = await admin
        .from('users')
        .select('id, first_name, last_name')
        .in('id', authorIds);

      const authorMap = Object.fromEntries(
        (authors ?? []).map(a => [a.id, `${a.first_name} ${a.last_name}`])
      );
      feedback = fb.map(f => ({ ...f, author_name: authorMap[f.author_id] ?? 'לא ידוע' }));
    }
  }

  return (
    <ProfileClient
      soldier={soldier}
      currentUser={currentUser}
      platoons={platoons ?? []}
      crews={crews ?? []}
      feedback={feedback}
    />
  );
}
