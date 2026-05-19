'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Pencil, Check, X, Shield, Phone, ClipboardList } from 'lucide-react';
import type {
  UserRow, PlatoonRow, CrewRow, FeedbackRow,
  UserRole, CrewPosition, SoldierStatus,
} from '@/types/database';
import { ROLE_LABELS, STATUS_LABELS, POSITION_LABELS } from '@/types/database';
import SoldierFeedbackSection from './FeedbackSection';

const STATUS_BADGE: Record<string, string> = {
  available: 'bg-green-100 text-green-800',
  leave:     'bg-yellow-100 text-yellow-800',
  mission:   'bg-blue-100 text-blue-800',
  sick:      'bg-red-100 text-red-800',
};

const OFFICER_ROLES = ['company_commander', 'platoon_commander', 'crew_commander'];

interface FeedbackItem extends FeedbackRow { author_name: string }

interface Props {
  soldier:     UserRow;
  currentUser: UserRow;
  platoons:    PlatoonRow[];
  crews:       CrewRow[];
  feedback:    FeedbackItem[];
}

interface EditForm {
  first_name:                  string;
  last_name:                   string;
  phone_number:                string;
  personal_id:                 string;
  role:                        UserRole;
  primary_platoon_id:          string;
  crew_id:                     string;
  crew_position:               CrewPosition | '';
  status:                      SoldierStatus;
  medical_fitness:             boolean;
  medical_fitness_notes:       string;
  shooting_qualification_date: string;
}

export default function ProfileClient({
  soldier, currentUser, platoons, crews, feedback,
}: Props) {
  // ── Permission checks ────────────────────────────────────────
  const isOfficer    = OFFICER_ROLES.includes(currentUser.role);
  const canEdit      = isOfficer || currentUser.can_edit_roster;
  const canFeedback  = isOfficer || currentUser.can_view_feedback;
  const isMup        = currentUser.role === 'company_commander';
  const isOwnProfile = currentUser.id === soldier.id;

  // ── Local state ──────────────────────────────────────────────
  const [editing,          setEditing]          = useState(false);
  const [saving,           setSaving]           = useState(false);
  const [data,             setData]             = useState<UserRow>(soldier);
  const [showLeaveModal,   setShowLeaveModal]   = useState(false);
  const [leaveSubmitted,   setLeaveSubmitted]   = useState(false);

  const [form, setForm] = useState<EditForm>({
    first_name:                  soldier.first_name,
    last_name:                   soldier.last_name,
    phone_number:                soldier.phone_number ?? '',
    personal_id:                 soldier.personal_id,
    role:                        soldier.role,
    primary_platoon_id:          soldier.primary_platoon_id ?? '',
    crew_id:                     soldier.crew_id ?? '',
    crew_position:               soldier.crew_position ?? '',
    status:                      soldier.status,
    medical_fitness:             soldier.medical_fitness,
    medical_fitness_notes:       soldier.medical_fitness_notes ?? '',
    shooting_qualification_date: soldier.shooting_qualification_date ?? '',
  });

  function set<K extends keyof EditForm>(k: K, v: EditForm[K]) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  async function save() {
    setSaving(true);
    const body: Record<string, unknown> = {
      first_name:                  form.first_name,
      last_name:                   form.last_name,
      phone_number:                form.phone_number || null,
      personal_id:                 form.personal_id,
      role:                        form.role,
      primary_platoon_id:          form.primary_platoon_id || null,
      crew_id:                     form.crew_id || null,
      crew_position:               form.crew_position || null,
      status:                      form.status,
      medical_fitness:             form.medical_fitness,
      medical_fitness_notes:       form.medical_fitness_notes || null,
      shooting_qualification_date: form.shooting_qualification_date || null,
    };
    const res = await fetch(`/api/soldiers/${soldier.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setData(prev => ({ ...prev, ...body } as UserRow));
      setEditing(false);
    } else {
      alert('שגיאה בשמירה. אנא נסה שוב.');
    }
    setSaving(false);
  }

  function cancel() {
    setForm({
      first_name:                  data.first_name,
      last_name:                   data.last_name,
      phone_number:                data.phone_number ?? '',
      personal_id:                 data.personal_id,
      role:                        data.role,
      primary_platoon_id:          data.primary_platoon_id ?? '',
      crew_id:                     data.crew_id ?? '',
      crew_position:               data.crew_position ?? '',
      status:                      data.status,
      medical_fitness:             data.medical_fitness,
      medical_fitness_notes:       data.medical_fitness_notes ?? '',
      shooting_qualification_date: data.shooting_qualification_date ?? '',
    });
    setEditing(false);
  }

  async function submitLeaveRequest(form: { start_date: string; end_date: string; leave_time: string; reason: string }) {
    const res = await fetch('/api/leave-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ soldier_id: soldier.id, ...form }),
    });
    if (res.ok) {
      setLeaveSubmitted(true);
      setShowLeaveModal(false);
    } else {
      alert('שגיאה בהגשת הבקשה. אנא נסה שוב.');
    }
  }

  async function togglePermission(field: 'can_edit_roster' | 'can_view_feedback', value: boolean) {
    setData(prev => ({ ...prev, [field]: value }));
    await fetch(`/api/soldiers/${soldier.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });
  }

  // Contact links
  const rawPhone  = data.phone_number ?? '';
  const intlPhone = rawPhone.replace(/^0/, '972').replace(/[-\s]/g, '');
  const waLink    = intlPhone ? `https://wa.me/${intlPhone}` : null;

  const qualDate    = data.shooting_qualification_date ? new Date(data.shooting_qualification_date) : null;
  const qualExpired = qualDate ? qualDate < new Date() : null;

  const platoonName = platoons.find(p => p.id === data.primary_platoon_id)?.name ?? '—';
  const crewName    = crews.find(c => c.id === data.crew_id)?.name ?? '—';

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">

      {/* Header */}
      <header className="bg-olive-800 text-white px-4 py-3 flex items-center gap-3">
        <Link href="/dashboard" className="text-olive-300 hover:text-white text-sm transition-colors">
          ← חזרה לדשבורד
        </Link>
        <span className="text-olive-600">|</span>
        <h1 className="font-bold">פרופיל חייל</h1>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">

        {/* Identity card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-olive-700 text-white px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">{data.first_name} {data.last_name}</h2>
              <p className="text-olive-300 text-sm">{ROLE_LABELS[data.role]}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium px-3 py-1 rounded-full ${STATUS_BADGE[data.status]}`}>
                {STATUS_LABELS[data.status]}
              </span>
              {/* Leave request button — available to the soldier themselves */}
              {isOwnProfile && !editing && (
                <button
                  onClick={() => setShowLeaveModal(true)}
                  className="flex items-center gap-1.5 text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg transition-colors"
                  title="הגש בקשת יציאה"
                >
                  <ClipboardList className="w-3.5 h-3.5" /> בקשת יציאה
                </button>
              )}
              {leaveSubmitted && (
                <span className="text-xs text-green-300 font-medium">✓ בקשה הוגשה</span>
              )}
              {canEdit && !editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" /> עריכה
                </button>
              )}
              {editing && (
                <div className="flex gap-2">
                  <button
                    onClick={save}
                    disabled={saving}
                    className="flex items-center gap-1.5 text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" /> {saving ? 'שומר...' : 'שמור'}
                  </button>
                  <button
                    onClick={cancel}
                    className="flex items-center gap-1.5 text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <X className="w-3.5 h-3.5" /> ביטול
                  </button>
                </div>
              )}
            </div>
          </div>

          {editing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-6">
              <FF label="שם פרטי">
                <input className={iCls} value={form.first_name} onChange={e => set('first_name', e.target.value)} />
              </FF>
              <FF label="שם משפחה">
                <input className={iCls} value={form.last_name} onChange={e => set('last_name', e.target.value)} />
              </FF>
              <FF label='מ"א'>
                <input className={iCls} value={form.personal_id} onChange={e => set('personal_id', e.target.value)} />
              </FF>
              <FF label="טלפון">
                <input className={iCls} type="tel" value={form.phone_number} onChange={e => set('phone_number', e.target.value)} />
              </FF>
              <FF label="תפקיד">
                <select className={iCls} value={form.role} onChange={e => set('role', e.target.value as UserRole)}>
                  {(Object.entries(ROLE_LABELS) as [UserRole, string][]).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </FF>
              <FF label="סטטוס">
                <select className={iCls} value={form.status} onChange={e => set('status', e.target.value as SoldierStatus)}>
                  {(Object.entries(STATUS_LABELS) as [SoldierStatus, string][]).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </FF>
              <FF label="מחלקה">
                <select className={iCls} value={form.primary_platoon_id} onChange={e => set('primary_platoon_id', e.target.value)}>
                  <option value="">—</option>
                  {platoons.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </FF>
              <FF label="צוות">
                <select className={iCls} value={form.crew_id} onChange={e => set('crew_id', e.target.value)}>
                  <option value="">—</option>
                  {crews
                    .filter(c => !form.primary_platoon_id || c.platoon_id === form.primary_platoon_id)
                    .map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </FF>
              <FF label="תפקיד בצוות">
                <select className={iCls} value={form.crew_position} onChange={e => set('crew_position', e.target.value as CrewPosition | '')}>
                  <option value="">—</option>
                  {(Object.entries(POSITION_LABELS) as [CrewPosition, string][]).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </FF>
              <FF label="כישור מטווח">
                <input className={iCls} type="date" value={form.shooting_qualification_date} onChange={e => set('shooting_qualification_date', e.target.value)} />
              </FF>
              <FF label="כשירות רפואית">
                <label className="flex items-center gap-2 mt-1 cursor-pointer">
                  <input type="checkbox" checked={form.medical_fitness} onChange={e => set('medical_fitness', e.target.checked)} className="w-4 h-4 accent-olive-700" />
                  <span className="text-sm text-gray-700">{form.medical_fitness ? 'כשיר' : 'לא כשיר'}</span>
                </label>
              </FF>
              <FF label="הערות רפואיות" className="sm:col-span-2">
                <textarea className={`${iCls} resize-none`} rows={2} value={form.medical_fitness_notes} onChange={e => set('medical_fitness_notes', e.target.value)} />
              </FF>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-6">
              <IF label='מ"א'         value={data.personal_id} />
              <IF label="אימייל"       value={data.email} />
              <IF label="מחלקה"        value={platoonName} />
              <IF label="צוות"         value={crewName} />
              <IF label="תפקיד בצוות" value={data.crew_position ? POSITION_LABELS[data.crew_position] : '—'} />
              <IF
                label="כישור מטווח"
                value={qualDate ? qualDate.toLocaleDateString('he-IL') : 'לא נרשם'}
                cls={qualExpired === true ? 'text-red-600 font-semibold' : ''}
              />
              <IF
                label="כשירות רפואית"
                value={data.medical_fitness ? '✓ כשיר' : '✗ לא כשיר'}
                cls={data.medical_fitness ? 'text-green-700' : 'text-red-600'}
              />
              {data.medical_fitness_notes && (
                <IF label="הערות רפואיות" value={data.medical_fitness_notes} />
              )}
            </div>
          )}

          {/* Contact buttons — always visible */}
          {rawPhone && !editing && (
            <div className="px-6 pb-6 flex gap-3">
              <a
                href={`tel:${rawPhone}`}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl border border-olive-600 text-olive-700 hover:bg-olive-50 transition-colors"
              >
                <Phone className="w-4 h-4" /> {rawPhone}
              </a>
              {waLink && (
                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-center py-2.5 text-sm font-semibold rounded-xl bg-green-500 text-white hover:bg-green-600 transition-colors"
                >
                  💬 WhatsApp
                </a>
              )}
            </div>
          )}
        </div>

        {/* ── Permission manager — Mup only, not own profile ─── */}
        {isMup && !isOwnProfile && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-olive-600" /> ניהול הרשאות
            </h3>
            <div className="space-y-3">
              <PermissionRow
                label='הרשאת עריכת סד"כ'
                description="מאפשר שינוי שיבוצים ופרטי חיילים"
                checked={data.can_edit_roster}
                onChange={v => togglePermission('can_edit_roster', v)}
              />
              <PermissionRow
                label="הרשאת צפייה וכתיבת משוב"
                description="גישה להיסטוריית המשובים הפרטית"
                checked={data.can_view_feedback}
                onChange={v => togglePermission('can_view_feedback', v)}
              />
            </div>
          </div>
        )}

        {/* ── Feedback — only if viewer has permission ─────── */}
        {canFeedback && (
          <SoldierFeedbackSection
            soldierId={soldier.id}
            soldierName={`${data.first_name} ${data.last_name}`}
            initialFeedback={feedback}
          />
        )}

      </main>

      {/* ── Leave Request Modal ──────────────────────────────── */}
      {showLeaveModal && (
        <LeaveRequestModal
          onConfirm={submitLeaveRequest}
          onClose={() => setShowLeaveModal(false)}
        />
      )}
    </div>
  );
}

// ── Leave Request Modal ────────────────────────────────────────
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
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" dir="rtl" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-800">הגשת בקשת יציאה</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
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
        </div>
      </div>
    </>
  );
}

// ── Permission toggle row ──────────────────────────────────────
function PermissionRow({
  label, description, checked, onChange,
}: {
  label: string; description: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="w-4 h-4 mt-0.5 accent-olive-700 shrink-0"
      />
      <div>
        <p className="text-sm font-semibold text-gray-800 group-hover:text-olive-700 transition-colors">{label}</p>
        <p className="text-xs text-gray-400">{description}</p>
      </div>
    </label>
  );
}

// ── Micro helpers ──────────────────────────────────────────────
const iCls = 'w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-olive-400';

function FF({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs font-semibold text-gray-400 mb-1">{label}</p>
      {children}
    </div>
  );
}

function IF({ label, value, cls = '' }: { label: string; value: string; cls?: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 mb-0.5">{label}</p>
      <p className={`text-sm text-gray-800 ${cls}`}>{value}</p>
    </div>
  );
}
