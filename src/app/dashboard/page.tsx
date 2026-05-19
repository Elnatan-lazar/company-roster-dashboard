import { Suspense } from 'react';
import { getAuthenticatedUser } from '@/lib/auth/get-user';
import { createAdminClient } from '@/lib/supabase/server';
import type { CompanySettings } from '@/types/database';
import DashboardClient from './DashboardClient';

const DEFAULT_SETTINGS: CompanySettings = {
  id: '',
  combat_crews_target: 13,
  tech_members_target: 5,
  spare_commanders: 0,
  spare_gunners: 0,
  spare_loaders: 0,
  spare_drivers: 0,
  updated_at: '',
};

export default async function DashboardPage() {
  const currentUser = await getAuthenticatedUser();
  const admin = createAdminClient();

  const [
    { data: platoons },
    { data: crews },
    { data: users },
    { data: configs },
    { data: settingsRow },
  ] = await Promise.all([
    admin.from('platoons').select('*').order('platoon_number'),
    admin.from('crews').select('*').order('name'),
    admin.from('users').select('*').order('last_name'),
    admin.from('deployment_configs').select('*').order('created_at'),
    admin.from('company_settings').select('*').limit(1).maybeSingle(),
  ]);

  const defaultConfigId = configs?.[0]?.id ?? null;
  const { data: assignments } = defaultConfigId
    ? await admin
        .from('deployment_assignments')
        .select('*')
        .eq('config_id', defaultConfigId)
    : { data: [] };

  return (
    <Suspense>
      <DashboardClient
        currentUser={currentUser}
        platoons={platoons ?? []}
        crews={crews ?? []}
        users={users ?? []}
        configs={configs ?? []}
        initialConfigId={defaultConfigId ?? ''}
        initialAssignments={assignments ?? []}
        initialSettings={settingsRow ?? DEFAULT_SETTINGS}
      />
    </Suspense>
  );
}
