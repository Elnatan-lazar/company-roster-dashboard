'use client';

import {
  useState, useCallback, useMemo, useRef, useTransition, useEffect,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Users, UserCheck, UserX, Shield,
  LayoutGrid, Table2, AlertTriangle, Download, Upload,
  FileDown, ChevronDown, Plus, Copy, Trash2, Target, X,
  Calendar, UserPlus, ClipboardList, KeyRound,
} from 'lucide-react';
import type {
  PlatoonRow, CrewRow, UserRow, SoldierStatus,
  DeploymentConfig, DeploymentAssignment, Warning, CompanySettings,
  LeaveRequest,
} from '@/types/database';
import { ROLE_LABELS, STATUS_LABELS, POSITION_LABELS } from '@/types/database';
import TankCard          from './components/TankCard';
import AssignmentSidebar from './components/AssignmentSidebar';
import WarningsPanel     from './components/WarningsPanel';
import TableView         from './components/TableView';
import UnassignedTable   from './components/UnassignedTable';
import LeaveRequestsPanel  from './components/LeaveRequestsPanel';
import CreateSoldierModal  from './components/CreateSoldierModal';

// ── Constants ─────────────────────────────────────────────────
const COMBAT_POSITION_LABELS = ['מפקד', 'תותחן', 'טען', 'נהג'] as const;

const LABEL_TO_POSITION: Record<string, string> = {
  'מפקד': 'commander', 'תותחן': 'gunner', 'טען': 'loader', 'נהג': 'driver',
};

const OFFICER_ROLES = ['company_commander', 'platoon_commander', 'crew_commander'];

function isCrewCombat(crew: CrewRow, platoon: PlatoonRow | undefined): boolean {
  if (!platoon) return false;
  if (platoon.platoon_number >= 1 && platoon.platoon_number <= 4) return true;
  if (platoon.platoon_number === 5) return false;
  return crew.name === 'צוות מ"פ' || crew.name === 'צוות סמ"פ';
}

// ── Modal type ────────────────────────────────────────────────
type ModalState =
  | { type: 'new-config';            inputValue: string }
  | { type: 'duplicate-config';      inputValue: string }
  | { type: 'delete-config' }
  | { type: 'strength-goals';        form: CompanySettings }
  | { type: 'create-soldier' }
  | { type: 'confirm-bulk-delete';   ids: string[] }
  | { type: 'mup-transfer-warning' }
  | { type: 'leave-request' }
  | { type: 'manage-permissions' }
  | null;

// ── Props ─────────────────────────────────────────────────────
interface Props {
  currentUser:        UserRow;
  platoons:           PlatoonRow[];
  crews:              CrewRow[];
  users:              UserRow[];
  configs:            DeploymentConfig[];
  initialConfigId:    string;
  initialAssignments: DeploymentAssignment[];
  initialSettings:    CompanySettings;
}

// ── Component ─────────────────────────────────────────────────
export default function DashboardClient({
  currentUser,
  platoons,
  crews:              initialCrews,
  users:              initialUsers,
  configs:            initialConfigs,
  initialConfigId,
  initialAssignments,
  initialSettings,
}: Props) {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const fileInput    = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();

  const isMup           = currentUser.role === 'company_commander';
  const isAdmin         = currentUser.is_admin || isMup;
  const canEdit         = isAdmin || OFFICER_ROLES.includes(currentUser.role) || currentUser.can_edit_roster;
  const canViewFeedback = isAdmin || currentUser.can_view_feedback;
  // Completely unprivileged — no admin, no edit, no feedback access
  const isUnprivileged  = !isAdmin && !currentUser.can_edit_roster && !currentUser.can_view_feedback
                          && !OFFICER_ROLES.includes(currentUser.role);

  // Ref for click-outside detection on the config dropdown
  const configMenuRef = useRef<HTMLDivElement>(null);

  // ── State ─────────────────────────────────────────────────
  const [localCrews,     setLocalCrews]     = useState(initialCrews);
  const [users,          setUsers]          = useState<UserRow[]>(initialUsers);
  const [configs,        setConfigs]        = useState(initialConfigs);
  const [settings,       setSettings]       = useState<CompanySettings>(initialSettings);
  const [modal,          setModal]          = useState<ModalState>(null);
  const [leaveRequests,  setLeaveRequests]  = useState<LeaveRequest[]>([]);
  const [selectedIds,    setSelectedIds]    = useState<string[]>([]);

  const [activeConfigId, setActiveConfigIdState] = useState(
    searchParams.get('configId') ?? initialConfigId
  );
  const [assignments,    setAssignments]    = useState<DeploymentAssignment[]>(initialAssignments);
  const [activeTab,      setActiveTabState] = useState<string>(
    searchParams.get('tab') ??
    platoons.find(p => p.platoon_number === 1)?.id ?? platoons[0]?.id ?? ''
  );
  const [viewMode, setViewModeState] = useState<'tanks' | 'table'>(
    (searchParams.get('view') as 'tanks' | 'table' | null) ?? 'tanks'
  );
  const [configMenuOpen, setConfigMenuOpen] = useState(false);
  const [warningsOpen,   setWarningsOpen]   = useState(false);
  const [sidebarState,   setSidebarState]   = useState<{
    crewId: string; crewName: string; posLabel: string;
  } | null>(null);
  const [userStatuses, setUserStatuses] = useState<Record<string, SoldierStatus>>({});
  const [saveError,    setSaveError]    = useState<string | null>(null);

  // ── Live sync: assignments when configId changes ───────────
  useEffect(() => {
    if (!activeConfigId) return;
    let cancelled = false;
    fetch(`/api/assignments?configId=${activeConfigId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled && d) setAssignments(d.assignments ?? []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [activeConfigId]);

  // ── Click-outside: close config menu ──────────────────────
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (configMenuRef.current && !configMenuRef.current.contains(e.target as Node)) {
        setConfigMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Live sync: leave requests ──────────────────────────────
  useEffect(() => {
    fetch('/api/leave-requests')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setLeaveRequests(d.requests ?? []); })
      .catch(() => {});
  }, []);

  // ── URL sync helpers ───────────────────────────────────────
  const updateUrl = useCallback((patch: Record<string, string>) => {
    const p = new URLSearchParams(window.location.search);
    Object.entries(patch).forEach(([k, v]) => p.set(k, v));
    router.replace(`?${p.toString()}`, { scroll: false });
  }, [router]);

  const setActiveTab = (tab: string) => { setActiveTabState(tab); updateUrl({ tab }); };
  const setViewMode  = (m: 'tanks' | 'table') => { setViewModeState(m); updateUrl({ view: m }); };
  const setActiveConfigId = useCallback((id: string) => {
    setActiveConfigIdState(id);
    updateUrl({ configId: id });
  }, [updateUrl]);

  // ── Derived ────────────────────────────────────────────────
  const activeConfig    = configs.find(c => c.id === activeConfigId);
  const getStatus       = useCallback((u: UserRow): SoldierStatus => userStatuses[u.id] ?? u.status, [userStatuses]);
  const assignedUserIds = useMemo(() => new Set(assignments.map(a => a.user_id)), [assignments]);

  const getSlotUser = useCallback(
    (crewId: string, posLabel: string): UserRow | undefined => {
      const a = assignments.find(x => x.crew_id === crewId && x.position_label === posLabel);
      return a ? users.find(u => u.id === a.user_id) : undefined;
    },
    [assignments, users]
  );

  const getCrewAssignments = useCallback(
    (crewId: string) =>
      assignments
        .filter(a => a.crew_id === crewId)
        .map(a => ({ assignment: a, user: users.find(u => u.id === a.user_id) }))
        .filter(x => x.user !== undefined) as { assignment: DeploymentAssignment; user: UserRow }[],
    [assignments, users]
  );

  const unassignedUsers = useMemo(
    () => users.filter(u => !assignedUserIds.has(u.id)),
    [users, assignedUserIds]
  );

  const getEligible = useCallback((posLabel: string): UserRow[] => {
    const needed    = LABEL_TO_POSITION[posLabel];
    const isOfficer = (u: UserRow) => OFFICER_ROLES.includes(u.role);
    return unassignedUsers.filter(u =>
      isOfficer(u) || !needed || u.crew_position === needed
    );
  }, [unassignedUsers]);

  // ── Strength stats ─────────────────────────────────────────
  const stats = useMemo(() => {
    const total    = users.length;
    const avail    = users.filter(u => getStatus(u) === 'available').length;
    const offDuty  = users.filter(u => ['leave', 'sick'].includes(getStatus(u))).length;
    const medFit   = total > 0 ? Math.round(users.filter(u => u.medical_fitness).length / total * 100) : 0;
    const assigned = assignedUserIds.size;
    const target   =
      settings.combat_crews_target * 4 +
      settings.tech_members_target  +
      settings.spare_commanders     +
      settings.spare_gunners        +
      settings.spare_loaders        +
      settings.spare_drivers;
    const strengthPct = target > 0 ? Math.round(assigned / target * 100) : 0;
    return { total, avail, offDuty, medFit, assigned, unassigned: total - assigned, strengthPct, target };
  }, [users, getStatus, assignedUserIds, settings]);

  // ── Warnings ───────────────────────────────────────────────
  const warnings = useMemo((): Warning[] => {
    const issues: Warning[] = [];
    localCrews.forEach(crew => {
      const p = platoons.find(pl => pl.id === crew.platoon_id);
      if (!isCrewCombat(crew, p)) return;
      const ca    = assignments.filter(a => a.crew_id === crew.id);
      const label = `${p?.name ?? ''} — ${crew.name}`;
      if (ca.length === 0) {
        issues.push({ id: `empty-${crew.id}`, type: 'empty_crew', message: `${label}: ריק לגמרי`, crewId: crew.id });
      } else {
        if (ca.length < 4)
          issues.push({ id: `inc-${crew.id}`, type: 'incomplete', message: `${label}: חסרים ${4 - ca.length} חיילים`, crewId: crew.id });
        if (!ca.some(a => a.position_label === 'מפקד'))
          issues.push({ id: `cmd-${crew.id}`, type: 'no_commander', message: `${label}: ללא מפקד`, crewId: crew.id });
      }
    });
    users.forEach(u => {
      const name = `${u.first_name} ${u.last_name}`;
      if (!u.shooting_qualification_date)
        issues.push({ id: `nq-${u.id}`, type: 'no_qual', message: `${name}: אין כישור מטווח`, userId: u.id });
      else if (new Date(u.shooting_qualification_date) < new Date())
        issues.push({ id: `eq-${u.id}`, type: 'expired_qual', message: `${name}: כישור מטווח פג`, userId: u.id });
    });
    return issues;
  }, [assignments, localCrews, platoons, users]);

  // ── Mutations ──────────────────────────────────────────────
  const assign = useCallback(async (userId: string, crewId: string, posLabel: string) => {
    const snapshot = assignments;
    setAssignments(prev => [
      ...prev.filter(a => a.user_id !== userId),
      { config_id: activeConfigId, user_id: userId, crew_id: crewId, position_label: posLabel, created_at: '' },
    ]);
    setSidebarState(null);
    setSaveError(null);

    const res = await fetch('/api/assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ configId: activeConfigId, userId, crewId, positionLabel: posLabel }),
    });

    if (!res.ok) {
      setAssignments(snapshot);
      const d = await res.json().catch(() => ({}));
      setSaveError(`שגיאה בשמירת שיבוץ: ${d.error ?? 'בעיה לא ידועה'}`);
    }
  }, [activeConfigId, assignments]);

  const unassign = useCallback(async (userId: string) => {
    const snapshot = assignments;
    setAssignments(prev => prev.filter(a => a.user_id !== userId));
    setSaveError(null);

    const res = await fetch('/api/assignments', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ configId: activeConfigId, userId }),
    });

    if (!res.ok) {
      setAssignments(snapshot);
      setSaveError('שגיאה בהסרת שיבוץ');
    }
  }, [activeConfigId, assignments]);

  const updateStatus = useCallback(async (userId: string, status: SoldierStatus) => {
    setUserStatuses(prev => ({ ...prev, [userId]: status }));
    await fetch(`/api/soldiers/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
  }, []);

  // ── Config management ──────────────────────────────────────
  const switchConfig = useCallback(async (configId: string) => {
    setActiveConfigId(configId);
    setConfigMenuOpen(false);
  }, [setActiveConfigId]);

  const submitCreateConfig = useCallback(async (name: string) => {
    const res  = await fetch('/api/configs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (data.config) {
      setConfigs(prev => [...prev, data.config]);
      await switchConfig(data.config.id);
    } else {
      setSaveError(data.error ?? 'שגיאה ביצירת שיבוץ');
    }
    setModal(null);
  }, [switchConfig]);

  const submitDuplicateConfig = useCallback(async (name: string) => {
    const res  = await fetch(`/api/configs/${activeConfigId}?action=duplicate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (data.config) {
      setConfigs(prev => [...prev, data.config]);
      await switchConfig(data.config.id);
    } else {
      setSaveError(data.error ?? 'שגיאה בשכפול שיבוץ');
    }
    setModal(null);
  }, [activeConfigId, switchConfig]);

  const submitDeleteConfig = useCallback(async () => {
    if (configs.length <= 1) { setModal(null); return; }
    const res  = await fetch(`/api/configs/${activeConfigId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) { setSaveError(data.error ?? 'שגיאה במחיקת שיבוץ'); setModal(null); return; }
    const remaining = configs.filter(c => c.id !== activeConfigId);
    setConfigs(remaining);
    await switchConfig(remaining[0].id);
    setModal(null);
  }, [configs, activeConfigId, switchConfig]);

  const saveStrengthGoals = useCallback(async (form: CompanySettings) => {
    const res  = await fetch('/api/company-settings', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (data.settings) setSettings(data.settings);
    setModal(null);
  }, []);

  // ── Crew management ────────────────────────────────────────
  const createCrew = useCallback(async (platoonId: string, name: string) => {
    const res  = await fetch('/api/crews', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), platoon_id: platoonId }),
    });
    const data = await res.json();
    if (data.crew) setLocalCrews(prev => [...prev, data.crew]);
  }, []);

  const deleteCrew = useCallback(async (crew: CrewRow) => {
    setLocalCrews(prev => prev.filter(c => c.id !== crew.id));
    setAssignments(prev => prev.filter(a => a.crew_id !== crew.id));
    await fetch(`/api/crews/${crew.id}`, { method: 'DELETE' });
  }, []);

  // ── Soldier management ─────────────────────────────────────
  const createSoldier = useCallback(async (form: {
    first_name: string; last_name: string; personal_id: string; email: string;
    role: string; crew_position: string | null; primary_platoon_id: string | null;
  }) => {
    const res  = await fetch('/api/soldiers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (data.soldier) {
      setUsers(prev => [...prev, data.soldier]);
      setModal(null);
    } else {
      setSaveError(data.error ?? 'שגיאה ביצירת חייל');
    }
  }, []);

  const bulkDeleteSoldiers = useCallback(async (ids: string[]) => {
    const res  = await fetch('/api/soldiers/bulk-delete', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    const data = await res.json();
    if (data.mup_guard) {
      setModal({ type: 'mup-transfer-warning' });
      return;
    }
    if (!res.ok) {
      setSaveError(data.error ?? 'שגיאה במחיקת חיילים');
      setModal(null);
      return;
    }
    setUsers(prev => prev.filter(u => !ids.includes(u.id)));
    setAssignments(prev => prev.filter(a => !ids.includes(a.user_id)));
    setSelectedIds([]);
    setModal(null);
  }, []);

  // ── Permissions management (admin only) ───────────────────
  const togglePermission = useCallback(async (
    userId: string,
    field: 'can_edit_roster' | 'can_view_feedback' | 'is_admin',
    value: boolean,
  ) => {
    const res  = await fetch(`/api/users/${userId}/permissions`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });
    const data = await res.json();
    if (data.user) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, [field]: value } : u));
    } else {
      setSaveError(data.error ?? 'שגיאה בעדכון הרשאות');
    }
  }, []);

  // ── Leave requests ─────────────────────────────────────────
  const submitLeaveRequest = useCallback(async (form: {
    start_date: string; end_date: string; leave_time: string; reason: string;
  }) => {
    const res  = await fetch('/api/leave-requests', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ soldier_id: currentUser.id, ...form }),
    });
    const data = await res.json();
    if (data.request) {
      setLeaveRequests(prev => [
        { ...data.request, soldier_name: `${currentUser.first_name} ${currentUser.last_name}`, platoon_id: currentUser.primary_platoon_id },
        ...prev,
      ]);
      setModal(null);
    } else {
      setSaveError(data.error ?? 'שגיאה בהגשת בקשה');
    }
  }, [currentUser]);

  const approveLeaveRequest = useCallback(async (id: string) => {
    const res  = await fetch(`/api/leave-requests/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved', approved_by: currentUser.id }),
    });
    if (res.ok) {
      setLeaveRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'approved' } : r));
    }
  }, [currentUser.id]);

  const deleteLeaveRequest = useCallback(async (id: string) => {
    await fetch(`/api/leave-requests/${id}`, { method: 'DELETE' });
    setLeaveRequests(prev => prev.filter(r => r.id !== id));
  }, []);

  const exportLeaveRequests = useCallback(() => {
    alert('ייצוא בקשות יציאה לאקסל - בפיתוח');
  }, []);

  // ── Excel ──────────────────────────────────────────────────
  const exportExcel      = () => {
    if (!activeConfigId) { alert('אין תצורת שיבוץ פעילה.'); return; }
    window.open(`/api/export?configId=${activeConfigId}`, '_blank');
  };
  const downloadTemplate = () => window.open('/api/import', '_blank');
  const handleImport     = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeConfigId) { alert('אין תצורת שיבוץ פעילה.'); return; }
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    const res  = await fetch(`/api/import?configId=${activeConfigId}`, { method: 'POST', body: form });
    const data = await res.json();
    alert(`יובאו ${data.updated} רשומות. דילוג: ${data.skipped}.`);
    if (e.target) e.target.value = '';
    await switchConfig(activeConfigId);
    startTransition(() => router.refresh());
  };

  const today = new Date().toLocaleDateString('he-IL', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const displayPlatoons  = platoons.filter(p => p.platoon_number <= 5);
  const UNASSIGNED_TAB   = 'unassigned';
  const LEAVE_REQ_TAB    = 'leave-requests';

  const canManageRequests = isAdmin || OFFICER_ROLES.includes(currentUser.role) || canViewFeedback;

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">

      {/* ── Top bar ─────────────────────────────────────────── */}
      <header className="bg-olive-800 text-white shadow-lg sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-3 py-2 flex items-center gap-3">

          {/* Logo + user info */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-2xl select-none">🛡️</span>
            <div className="hidden sm:block leading-tight">
              <button
                onClick={() => router.push(`/soldiers/${currentUser.id}`)}
                className="text-sm font-semibold hover:text-olive-200 transition-colors block text-right"
              >
                {currentUser.first_name} {currentUser.last_name}
              </button>
            </div>
          </div>

          {/* Config selector */}
          <div ref={configMenuRef} className="relative flex-1 max-w-xs">
            <button
              onClick={() => setConfigMenuOpen(o => !o)}
              className="w-full flex items-center justify-between gap-2 bg-olive-700 hover:bg-olive-600 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            >
              <span className="truncate">{activeConfig?.name ?? 'בחר שיבוץ'}</span>
              <ChevronDown className="w-4 h-4 shrink-0" />
            </button>

            {configMenuOpen && (
              <div className="absolute top-full mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-xl z-30 overflow-hidden">
                <p className="text-[10px] font-bold text-gray-400 uppercase px-4 pt-3 pb-1 tracking-wide">בחירת שיבוץ</p>
                <div className="max-h-48 overflow-y-auto">
                  {configs.map(c => (
                    <button key={c.id} onClick={() => switchConfig(c.id)}
                      className={`w-full text-right px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors
                        ${c.id === activeConfigId ? 'font-bold text-olive-700 bg-olive-50' : 'text-gray-700'}`}>
                      {c.name}
                    </button>
                  ))}
                </div>
                {canEdit && (
                  <div className="border-t border-gray-100">
                    <button onClick={() => { setModal({ type: 'new-config', inputValue: '' }); setConfigMenuOpen(false); }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50">
                      <Plus className="w-4 h-4" /> שיבוץ חדש ריק
                    </button>
                    <button onClick={() => { setModal({ type: 'duplicate-config', inputValue: `${activeConfig?.name ?? ''} (עותק)` }); setConfigMenuOpen(false); }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50">
                      <Copy className="w-4 h-4" /> שכפל שיבוץ נוכחי
                    </button>
                    {configs.length > 1 && (
                      <button onClick={() => { setModal({ type: 'delete-config' }); setConfigMenuOpen(false); }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50">
                        <Trash2 className="w-4 h-4" /> מחק שיבוץ נוכחי
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Title */}
          <h1 className="hidden lg:block text-base font-bold flex-1 text-center whitespace-nowrap">
            מערכת ניהול פלוגת שריון
          </h1>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <div className="hidden md:flex items-center gap-1 text-olive-300 text-xs mr-1">
              <Calendar className="w-3.5 h-3.5" /><span>{today}</span>
            </div>

            {/* Personal leave request button — all users */}
            <button
              onClick={() => setModal({ type: 'leave-request' })}
              title="הגש בקשת יציאה"
              className="p-1.5 hover:bg-olive-700 rounded-lg transition-colors"
            >
              <ClipboardList className="w-4 h-4" />
            </button>

            {/* Create soldier — officers / can_edit_roster only */}
            {canEdit && (
              <button
                onClick={() => setModal({ type: 'create-soldier' })}
                title="צור חייל חדש"
                className="p-1.5 hover:bg-olive-700 rounded-lg transition-colors"
              >
                <UserPlus className="w-4 h-4" />
              </button>
            )}

            {/* Manage permissions — admin only */}
            {isAdmin && (
              <button
                onClick={() => setModal({ type: 'manage-permissions' })}
                title="ניהול הרשאות"
                className="p-1.5 hover:bg-olive-700 rounded-lg transition-colors"
              >
                <KeyRound className="w-4 h-4" />
              </button>
            )}

            {/* Excel export/import — hidden for unprivileged soldiers */}
            {!isUnprivileged && (
              <>
                <button onClick={exportExcel}                      title="ייצא לאקסל" className="p-1.5 hover:bg-olive-700 rounded-lg transition-colors"><FileDown className="w-4 h-4" /></button>
                <button onClick={downloadTemplate}                  title="הורד תבנית" className="p-1.5 hover:bg-olive-700 rounded-lg transition-colors"><Download className="w-4 h-4" /></button>
                <button onClick={() => fileInput.current?.click()} title="ייבא מאקסל" className="p-1.5 hover:bg-olive-700 rounded-lg transition-colors"><Upload   className="w-4 h-4" /></button>
                <input ref={fileInput} type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
              </>
            )}

            {/* Warnings — hidden for unprivileged soldiers */}
            {!isUnprivileged && (
              <button onClick={() => setWarningsOpen(true)} title="התראות"
                className="relative p-1.5 hover:bg-olive-700 rounded-lg transition-colors">
                <AlertTriangle className="w-4 h-4" />
                {warnings.length > 0 && (
                  <span className="absolute -top-0.5 -left-0.5 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                    {warnings.length > 9 ? '9+' : warnings.length}
                  </span>
                )}
              </button>
            )}

            <button
              onClick={() => setViewMode(viewMode === 'tanks' ? 'table' : 'tanks')}
              title={viewMode === 'tanks' ? 'תצוגת טבלה' : 'תצוגת טנקים'}
              className="p-1.5 hover:bg-olive-700 rounded-lg transition-colors"
            >
              {viewMode === 'tanks' ? <Table2 className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* ── Error toast ──────────────────────────────────────── */}
      {saveError && (
        <div className="bg-red-600 text-white text-sm text-center py-2 px-4 flex items-center justify-center gap-3">
          <span>⚠️ {saveError}</span>
          <button onClick={() => setSaveError(null)} className="underline text-xs">סגור</button>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-3 py-4 space-y-4">

        {/* ── Stats grid ───────────────────────────────────── */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 md:gap-3">
          <StatCard icon={<Users     className="w-4 h-4 text-olive-700"  />} iconBg="bg-olive-100" label='סד"כ כולל'     value={stats.total}        />
          <StatCard icon={<UserCheck className="w-4 h-4 text-green-700"  />} iconBg="bg-green-100" label="זמינים"        value={stats.avail}        />
          <StatCard icon={<UserX     className="w-4 h-4 text-red-600"    />} iconBg="bg-red-100"   label='חו"ש/חולים'   value={stats.offDuty}      />
          <StatCard icon={<Shield   className="w-4 h-4 text-blue-700"    />} iconBg="bg-blue-100"  label="כשירות רפואית" value={`${stats.medFit}%`} />
          <button
            onClick={() => isAdmin ? setModal({ type: 'strength-goals', form: { ...settings } }) : undefined}
            className={`text-right ${isAdmin ? 'cursor-pointer hover:ring-2 hover:ring-olive-400 rounded-xl' : ''}`}
            title={isAdmin ? 'לחץ להגדרת יעדי כוח' : undefined}
          >
            <StatCard
              icon={<Target className="w-4 h-4 text-purple-700" />}
              iconBg="bg-purple-100"
              label="כח שיבוץ"
              value={`${stats.strengthPct}%`}
              sub={`${stats.assigned} מתוך יעד ${stats.target}`}
            />
          </button>
        </div>

        {/* Bulk delete bar — canEdit only */}
        {canEdit && selectedIds.length > 0 && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
            <span className="text-sm font-medium text-red-700">{selectedIds.length} חיילים נבחרו</span>
            <button
              onClick={() => setModal({ type: 'confirm-bulk-delete', ids: selectedIds })}
              className="flex items-center gap-1.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> מחק נבחרים
            </button>
            <button onClick={() => setSelectedIds([])} className="text-xs text-red-500 hover:text-red-700 mr-auto">בטל בחירה</button>
          </div>
        )}

        {/* ── Table view ────────────────────────────────────── */}
        {viewMode === 'table' ? (
          <TableView
            users={users}
            platoons={platoons}
            crews={localCrews}
            assignments={assignments}
            currentUser={currentUser}
            getStatus={getStatus}
            onStatusUpdate={updateStatus}
            onViewProfile={id => router.push(`/soldiers/${id}`)}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
          />
        ) : (

        /* ── Tank / platoon view ─────────────────────────── */
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          {/* Tab bar */}
          <div className="flex gap-1 p-1.5 border-b border-gray-100 overflow-x-auto">
            {displayPlatoons.map(p => (
              <button key={p.id} onClick={() => setActiveTab(p.id)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap
                  ${activeTab === p.id ? 'bg-olive-700 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}>
                {p.platoon_number === 0 ? 'מפקדת פלוגה' : p.name}
              </button>
            ))}
            <button onClick={() => setActiveTab(UNASSIGNED_TAB)}
              className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap
                ${activeTab === UNASSIGNED_TAB ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}>
              לא משובצים
              {unassignedUsers.length > 0 && (
                <span className="bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                  {unassignedUsers.length > 9 ? '9+' : unassignedUsers.length}
                </span>
              )}
            </button>
            {canManageRequests && (
              <button onClick={() => setActiveTab(LEAVE_REQ_TAB)}
                className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap
                  ${activeTab === LEAVE_REQ_TAB ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}>
                <ClipboardList className="w-3.5 h-3.5" />
                בקשות יציאה
                {leaveRequests.filter(r => r.status === 'pending').length > 0 && (
                  <span className="bg-orange-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                    {leaveRequests.filter(r => r.status === 'pending').length}
                  </span>
                )}
              </button>
            )}
          </div>

          <div className="p-4">
            {activeTab === UNASSIGNED_TAB ? (
              <UnassignedTable
                users={unassignedUsers}
                platoons={platoons}
                getStatus={getStatus}
                onViewProfile={id => router.push(`/soldiers/${id}`)}
              />
            ) : activeTab === LEAVE_REQ_TAB ? (
              <div>
                <h2 className="font-bold text-gray-800 mb-4">כל בקשות היציאה</h2>
                <LeaveRequestsPanel
                  requests={leaveRequests}
                  platoons={platoons}
                  canManage={canManageRequests}
                  currentUserId={currentUser.id}
                  onApprove={approveLeaveRequest}
                  onDelete={deleteLeaveRequest}
                  onExport={exportLeaveRequests}
                />
              </div>
            ) : (() => {
              const activePlatoon = displayPlatoons.find(p => p.id === activeTab);
              if (!activePlatoon) return null;
              const activeCrews   = localCrews.filter(c => c.platoon_id === activeTab);
              const platoonLeaveRequests = leaveRequests.filter(r => r.platoon_id === activeTab);

              return (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold text-gray-800">
                      {activePlatoon.platoon_number === 0 ? 'מפקדת הפלוגה' : activePlatoon.name}
                    </h2>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">
                        {activeCrews.length} צוותות · {assignments.filter(a =>
                          activeCrews.some(c => c.id === a.crew_id)
                        ).length} משובצים
                      </span>
                      {canEdit && (
                        <CreateCrewButton platoonId={activeTab} onConfirm={name => createCrew(activeTab, name)} />
                      )}
                    </div>
                  </div>

                  {activeCrews.length === 0 ? (
                    <p className="text-center py-10 text-gray-400 text-sm">אין צוותות במחלקה זו</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                      {activeCrews.map(crew => {
                        const combat = isCrewCombat(crew, activePlatoon);
                        return (
                          <TankCard
                            key={crew.id}
                            crew={crew}
                            isCombat={combat}
                            positions={combat ? [...COMBAT_POSITION_LABELS] : []}
                            getSlotUser={pos => getSlotUser(crew.id, pos)}
                            getCrewAssignments={() => getCrewAssignments(crew.id)}
                            onOpenSidebar={posLabel =>
                              setSidebarState({ crewId: crew.id, crewName: crew.name, posLabel })
                            }
                            onUnassign={unassign}
                            onViewProfile={id => router.push(`/soldiers/${id}`)}
                            onDeleteCrew={canEdit ? () => deleteCrew(crew) : undefined}
                            getStatus={getStatus}
                          />
                        );
                      })}
                    </div>
                  )}

                  {/* Per-platoon leave requests sub-section */}
                  {canManageRequests && platoonLeaveRequests.length > 0 && (
                    <div className="mt-6 border-t border-gray-100 pt-4">
                      <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                        <ClipboardList className="w-4 h-4" />
                        בקשות יציאה — {activePlatoon.name}
                        <span className="text-xs font-normal text-gray-400">({platoonLeaveRequests.length})</span>
                      </h3>
                      <LeaveRequestsPanel
                        requests={platoonLeaveRequests}
                        platoons={platoons}
                        canManage={canManageRequests}
                        currentUserId={currentUser.id}
                        platoonFilter={activeTab}
                        onApprove={approveLeaveRequest}
                        onDelete={deleteLeaveRequest}
                        onExport={exportLeaveRequests}
                      />
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
        )}
      </main>

      {/* ── Assignment sidebar ───────────────────────────── */}
      {sidebarState && (
        <AssignmentSidebar
          crewName={sidebarState.crewName}
          positionLabel={sidebarState.posLabel}
          eligibleSoldiers={getEligible(sidebarState.posLabel)}
          platoons={platoons}
          getStatus={getStatus}
          onAssign={userId => assign(userId, sidebarState.crewId, sidebarState.posLabel)}
          onClose={() => setSidebarState(null)}
        />
      )}

      {/* ── Warnings panel ───────────────────────────────── */}
      <WarningsPanel
        open={warningsOpen}
        warnings={warnings}
        onClose={() => setWarningsOpen(false)}
        onNavigateCrew={crewId => {
          const crew    = localCrews.find(c => c.id === crewId);
          const platoon = platoons.find(p => p.id === crew?.platoon_id);
          if (platoon) { setActiveTabState(platoon.id); setViewModeState('tanks'); }
          setWarningsOpen(false);
        }}
      />

      {/* ── Modals ───────────────────────────────────────── */}
      {modal?.type === 'new-config' && (
        <InputModal
          title="שיבוץ חדש ריק"
          label="שם השיבוץ:"
          placeholder="לדוגמה: קו לבוש"
          value={modal.inputValue}
          onChange={v => setModal({ type: 'new-config', inputValue: v })}
          onConfirm={() => modal.inputValue.trim() && submitCreateConfig(modal.inputValue.trim())}
          onClose={() => setModal(null)}
          confirmLabel="צור שיבוץ"
        />
      )}

      {modal?.type === 'duplicate-config' && (
        <InputModal
          title={`שכפול: ${activeConfig?.name ?? ''}`}
          label="שם העותק:"
          placeholder=""
          value={modal.inputValue}
          onChange={v => setModal({ type: 'duplicate-config', inputValue: v })}
          onConfirm={() => modal.inputValue.trim() && submitDuplicateConfig(modal.inputValue.trim())}
          onClose={() => setModal(null)}
          confirmLabel="שכפל"
        />
      )}

      {modal?.type === 'delete-config' && (
        <ConfirmModal
          title="מחיקת שיבוץ"
          message={`האם למחוק את "${activeConfig?.name}"? פעולה זו בלתי הפיכה ותמחק את כל השיבוצים בתצורה זו.`}
          confirmLabel="מחק"
          danger
          onConfirm={submitDeleteConfig}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === 'strength-goals' && (
        <StrengthGoalsModal
          form={modal.form}
          onChange={form => setModal({ type: 'strength-goals', form })}
          onSave={() => saveStrengthGoals(modal.form)}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === 'create-soldier' && (
        <CreateSoldierModal
          platoons={platoons}
          onConfirm={createSoldier}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === 'confirm-bulk-delete' && (
        <ConfirmModal
          title="מחיקת חיילים"
          message={`האם למחוק ${modal.ids.length} חיילים? פעולה זו תמחק אותם לצמיתות מהמערכת.`}
          confirmLabel="מחק"
          danger
          onConfirm={() => bulkDeleteSoldiers(modal.ids)}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === 'mup-transfer-warning' && (
        <ConfirmModal
          title="לא ניתן למחוק מפקד פלוגה"
          message="לא ניתן למחוק את מפקד הפלוגה מבלי למנות מחליף. יש לשנות את תפקיד מחליף ל'מפקד פלוגה' תחילה, ולאחר מכן ניתן למחוק."
          confirmLabel="הבנתי"
          onConfirm={() => setModal(null)}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === 'leave-request' && (
        <LeaveRequestModal
          onConfirm={submitLeaveRequest}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === 'manage-permissions' && (
        <PermissionsModal
          users={users}
          currentUserId={currentUser.id}
          onToggle={togglePermission}
          onClose={() => setModal(null)}
        />
      )}

    </div>
  );
}

// ── Create Crew inline button ──────────────────────────────────
function CreateCrewButton({
  platoonId, onConfirm,
}: { platoonId: string; onConfirm: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [val,  setVal]  = useState('');

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs font-medium text-olive-700 border border-olive-300 rounded-lg px-2.5 py-1 hover:bg-olive-50 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" /> צוות חדש
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        autoFocus
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && val.trim()) { onConfirm(val); setVal(''); setOpen(false); }
          if (e.key === 'Escape') { setVal(''); setOpen(false); }
        }}
        placeholder="שם הצוות..."
        className="text-xs border border-gray-200 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-olive-400 w-32"
      />
      <button
        onClick={() => { if (val.trim()) { onConfirm(val); setVal(''); setOpen(false); } }}
        className="text-xs bg-olive-700 text-white px-2.5 py-1 rounded-lg hover:bg-olive-800 transition-colors"
      >
        צור
      </button>
      <button onClick={() => { setVal(''); setOpen(false); }} className="text-gray-400 hover:text-gray-600">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Modal backdrop + container ────────────────────────────────
function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" dir="rtl" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-800">{title}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          {children}
        </div>
      </div>
    </>
  );
}

// ── Text input modal ──────────────────────────────────────────
function InputModal({
  title, label, placeholder, value, onChange, onConfirm, onClose, confirmLabel,
}: {
  title: string; label: string; placeholder: string; value: string;
  onChange: (v: string) => void; onConfirm: () => void; onClose: () => void; confirmLabel: string;
}) {
  return (
    <ModalShell title={title} onClose={onClose}>
      <div className="px-6 py-4 space-y-3">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        <input
          autoFocus
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onConfirm()}
          placeholder={placeholder}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive-400 text-sm"
        />
      </div>
      <div className="px-6 pb-5 flex gap-3 justify-end">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">ביטול</button>
        <button
          onClick={onConfirm}
          disabled={!value.trim()}
          className="px-4 py-2 text-sm font-semibold bg-olive-700 text-white rounded-xl hover:bg-olive-800 disabled:opacity-40"
        >
          {confirmLabel}
        </button>
      </div>
    </ModalShell>
  );
}

// ── Confirm (danger) modal ─────────────────────────────────────
function ConfirmModal({
  title, message, confirmLabel, danger, onConfirm, onClose,
}: {
  title: string; message: string; confirmLabel: string;
  danger?: boolean; onConfirm: () => void; onClose: () => void;
}) {
  return (
    <ModalShell title={title} onClose={onClose}>
      <div className="px-6 py-4">
        <p className="text-sm text-gray-600 leading-relaxed">{message}</p>
      </div>
      <div className="px-6 pb-5 flex gap-3 justify-end">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">ביטול</button>
        <button
          onClick={onConfirm}
          className={`px-4 py-2 text-sm font-semibold text-white rounded-xl ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-olive-700 hover:bg-olive-800'}`}
        >
          {confirmLabel}
        </button>
      </div>
    </ModalShell>
  );
}


// ── Leave Request modal ────────────────────────────────────────
function LeaveRequestModal({
  onConfirm, onClose,
}: {
  onConfirm: (form: { start_date: string; end_date: string; leave_time: string; reason: string }) => void;
  onClose: () => void;
}) {
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({ start_date: today, end_date: today, leave_time: '', reason: '' });
  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  return (
    <ModalShell title="הגשת בקשת יציאה" onClose={onClose}>
      <div className="px-6 py-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">תאריך התחלה</label>
            <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-olive-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">תאריך סיום</label>
            <input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-olive-400" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">שעת יציאה</label>
          <input type="time" value={form.leave_time} onChange={e => set('leave_time', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-olive-400" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">סיבת הבקשה</label>
          <textarea
            value={form.reason}
            onChange={e => set('reason', e.target.value)}
            placeholder="פרטי הבקשה..."
            rows={3}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-olive-400 resize-none"
          />
        </div>
      </div>
      <div className="px-6 pb-5 flex gap-3 justify-end">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">ביטול</button>
        <button
          onClick={() => form.start_date && form.end_date && onConfirm(form)}
          className="px-4 py-2 text-sm font-semibold bg-olive-700 text-white rounded-xl hover:bg-olive-800"
        >
          הגש בקשה
        </button>
      </div>
    </ModalShell>
  );
}

// ── Company Strength Goals modal ──────────────────────────────
function StrengthGoalsModal({
  form, onChange, onSave, onClose,
}: {
  form: CompanySettings;
  onChange: (f: CompanySettings) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  function n(field: keyof CompanySettings, v: string) {
    onChange({ ...form, [field]: Math.max(0, parseInt(v) || 0) });
  }

  const total =
    form.combat_crews_target * 4 +
    form.tech_members_target  +
    form.spare_commanders     +
    form.spare_gunners        +
    form.spare_loaders        +
    form.spare_drivers;

  return (
    <ModalShell title="הגדרת יעדי כוח שיבוץ" onClose={onClose}>
      <div className="px-6 py-4 space-y-4">
        <p className="text-xs text-gray-400">סה&quot;כ יעד מחושב: <strong className="text-olive-700">{total} עמדות</strong></p>
        <div className="space-y-2">
          <GoalRow label="צוותות קרב מלאים" value={form.combat_crews_target}
            onChange={v => n('combat_crews_target', v)} note={`× 4 = ${form.combat_crews_target * 4} עמדות`} />
          <GoalRow label="אנשי חולייה טכנית" value={form.tech_members_target}
            onChange={v => n('tech_members_target', v)} />
          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 mb-2">עמדות רזרבה / עודפות</p>
            <GoalRow label='מ"פים רזרבה'  value={form.spare_commanders} onChange={v => n('spare_commanders', v)} />
            <GoalRow label="תותחנים רזרבה" value={form.spare_gunners}    onChange={v => n('spare_gunners', v)} />
            <GoalRow label="טענים רזרבה"   value={form.spare_loaders}   onChange={v => n('spare_loaders', v)} />
            <GoalRow label="נהגים רזרבה"   value={form.spare_drivers}   onChange={v => n('spare_drivers', v)} />
          </div>
        </div>
      </div>
      <div className="px-6 pb-5 flex gap-3 justify-end">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">ביטול</button>
        <button onClick={onSave} className="px-4 py-2 text-sm font-semibold bg-olive-700 text-white rounded-xl hover:bg-olive-800">שמור יעדים</button>
      </div>
    </ModalShell>
  );
}

function GoalRow({ label, value, onChange, note }: { label: string; value: number; onChange: (v: string) => void; note?: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <div>
        <span className="text-sm text-gray-700">{label}</span>
        {note && <span className="text-xs text-gray-400 mr-2">{note}</span>}
      </div>
      <input
        type="number" min={0} max={99} value={value} onChange={e => onChange(e.target.value)}
        className="w-16 text-center px-2 py-1 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-olive-400"
      />
    </div>
  );
}

// ── Permissions Modal (admin only) ───────────────────────────
function PermissionsModal({
  users, currentUserId, onToggle, onClose,
}: {
  users: UserRow[];
  currentUserId: string;
  onToggle: (userId: string, field: 'can_edit_roster' | 'can_view_feedback' | 'is_admin', value: boolean) => void;
  onClose: () => void;
}) {
  const ROLE_ORDER: Record<string, number> = {
    company_commander: 0, platoon_commander: 1, crew_commander: 2, soldier: 3,
  };
  const targets = [...users]
    .filter(u => u.id !== currentUserId)
    .sort((a, b) => (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9));

  return (
    <ModalShell title="ניהול הרשאות" onClose={onClose}>
      <div className="px-4 py-3 max-h-[60vh] overflow-y-auto">
        <p className="text-xs text-gray-500 mb-3">
          רק מנהל מערכת יכול להעניק הרשאות. מנהל מערכת יכול גם למנות מנהלים נוספים.
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-right text-xs font-bold text-gray-500 border-b border-gray-100">
              <th className="pb-2 font-semibold">שם</th>
              <th className="pb-2 font-semibold text-center">עריכת שיבוץ</th>
              <th className="pb-2 font-semibold text-center">צפייה בפידבק</th>
              <th className="pb-2 font-semibold text-center">מנהל מערכת</th>
            </tr>
          </thead>
          <tbody>
            {targets.map(u => (
              <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-2 pr-1">
                  <p className="font-medium text-gray-800">{u.first_name} {u.last_name}</p>
                  <p className="text-[11px] text-gray-400">{ROLE_LABELS[u.role]}</p>
                </td>
                <td className="py-2 text-center">
                  <input
                    type="checkbox"
                    checked={u.can_edit_roster}
                    onChange={e => onToggle(u.id, 'can_edit_roster', e.target.checked)}
                    className="w-4 h-4 accent-olive-700 cursor-pointer"
                  />
                </td>
                <td className="py-2 text-center">
                  <input
                    type="checkbox"
                    checked={u.can_view_feedback}
                    onChange={e => onToggle(u.id, 'can_view_feedback', e.target.checked)}
                    className="w-4 h-4 accent-olive-700 cursor-pointer"
                  />
                </td>
                <td className="py-2 text-center">
                  <input
                    type="checkbox"
                    checked={u.is_admin}
                    onChange={e => onToggle(u.id, 'is_admin', e.target.checked)}
                    className="w-4 h-4 accent-red-600 cursor-pointer"
                    title="הענקת הרשאת מנהל"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-6 pb-4 flex justify-end">
        <button onClick={onClose} className="px-4 py-2 text-sm font-semibold bg-olive-700 text-white rounded-xl hover:bg-olive-800">
          סגור
        </button>
      </div>
    </ModalShell>
  );
}

// ── Stat Card ──────────────────────────────────────────────────
function StatCard({
  icon, iconBg, label, value, sub,
}: {
  icon: React.ReactNode; iconBg: string; label: string; value: string | number; sub?: string;
}) {
  return (
    <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
      <div className={`w-8 h-8 ${iconBg} rounded-lg flex items-center justify-center mb-2`}>{icon}</div>
      <p className="text-xl font-bold text-gray-800 leading-none">{value}</p>
      <p className="text-[11px] font-semibold text-gray-600 mt-1 leading-tight">{label}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{sub}</p>}
    </div>
  );
}
