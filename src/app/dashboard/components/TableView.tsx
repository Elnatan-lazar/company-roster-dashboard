'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, ChevronUp, ChevronDown, Phone } from 'lucide-react';
import type {
  UserRow, PlatoonRow, CrewRow, DeploymentAssignment, SoldierStatus, CrewPosition,
} from '@/types/database';
import { ROLE_LABELS, STATUS_LABELS, POSITION_LABELS } from '@/types/database';

type SortKey = 'name' | 'platoon' | 'crew' | 'status' | 'assigned' | 'role';

const STATUS_BADGE: Record<SoldierStatus, string> = {
  available: 'bg-green-100 text-green-800',
  leave:     'bg-yellow-100 text-yellow-800',
  mission:   'bg-blue-100 text-blue-800',
  sick:      'bg-red-100 text-red-800',
};

const STATUS_CYCLE: SoldierStatus[] = ['available', 'leave', 'sick', 'mission'];
const OFFICER_ROLES = ['company_commander', 'platoon_commander', 'crew_commander'];

interface Props {
  users:            UserRow[];
  platoons:         PlatoonRow[];
  crews:            CrewRow[];
  assignments:      DeploymentAssignment[];
  currentUser:      UserRow;
  getStatus:        (u: UserRow) => SoldierStatus;
  onStatusUpdate:   (userId: string, status: SoldierStatus) => void;
  onViewProfile:    (userId: string) => void;
  selectedIds:      string[];
  onSelectionChange:(ids: string[]) => void;
}

export default function TableView({
  users, platoons, crews, assignments,
  currentUser, getStatus, onStatusUpdate, onViewProfile,
  selectedIds, onSelectionChange,
}: Props) {
  const [search,         setSearch]         = useState('');
  const [filterPlatoons, setFilterPlatoons] = useState<string[]>([]);
  const [filterStatuses, setFilterStatuses] = useState<SoldierStatus[]>([]);
  const [filterRoles,    setFilterRoles]    = useState<string[]>([]);
  const [filterAssigned, setFilterAssigned] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [sortKey,        setSortKey]        = useState<SortKey>('name');
  const [sortAsc,        setSortAsc]        = useState(true);

  const canEditStatus = OFFICER_ROLES.includes(currentUser.role) || currentUser.can_edit_roster;

  const platoonMap  = useMemo(() => Object.fromEntries(platoons.map(p => [p.id, p.name])), [platoons]);
  const crewMap     = useMemo(() => Object.fromEntries(crews.map(c => [c.id, c.name])), [crews]);
  const assignMap   = useMemo(() => Object.fromEntries(assignments.map(a => [a.user_id, a])), [assignments]);

  const sorted = useMemo(() => {
    let list = [...users];

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(u =>
        `${u.first_name} ${u.last_name}`.toLowerCase().includes(q) ||
        u.personal_id.includes(q) ||
        u.email.toLowerCase().includes(q)
      );
    }
    if (filterPlatoons.length > 0)
      list = list.filter(u => filterPlatoons.includes(u.primary_platoon_id ?? ''));
    if (filterStatuses.length > 0)
      list = list.filter(u => filterStatuses.includes(getStatus(u)));
    if (filterRoles.length > 0)
      list = list.filter(u => filterRoles.includes(u.crew_position ?? u.role));
    if (filterAssigned === 'assigned')   list = list.filter(u => !!assignMap[u.id]);
    if (filterAssigned === 'unassigned') list = list.filter(u => !assignMap[u.id]);

    list.sort((a, b) => {
      let va = '', vb = '';
      switch (sortKey) {
        case 'name':     va = `${a.last_name} ${a.first_name}`; vb = `${b.last_name} ${b.first_name}`; break;
        case 'platoon':  va = platoonMap[a.primary_platoon_id ?? ''] ?? ''; vb = platoonMap[b.primary_platoon_id ?? ''] ?? ''; break;
        case 'crew':     va = crewMap[assignMap[a.id]?.crew_id ?? ''] ?? ''; vb = crewMap[assignMap[b.id]?.crew_id ?? ''] ?? ''; break;
        case 'status':   va = getStatus(a); vb = getStatus(b); break;
        case 'assigned': va = assignMap[a.id] ? '1' : '0'; vb = assignMap[b.id] ? '1' : '0'; break;
        case 'role':     va = ROLE_LABELS[a.role]; vb = ROLE_LABELS[b.role]; break;
      }
      const cmp = va.localeCompare(vb, 'he');
      return sortAsc ? cmp : -cmp;
    });

    return list;
  }, [users, search, filterPlatoons, filterStatuses, filterRoles, filterAssigned, sortKey, sortAsc, platoonMap, crewMap, assignMap, getStatus]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(true); }
  }

  function cycleStatus(e: React.MouseEvent, u: UserRow) {
    e.stopPropagation();
    const idx = STATUS_CYCLE.indexOf(getStatus(u));
    onStatusUpdate(u.id, STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]);
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ChevronUp className="w-3.5 h-3.5 text-gray-300" />;
    return sortAsc ? <ChevronUp className="w-3.5 h-3.5 text-olive-600" /> : <ChevronDown className="w-3.5 h-3.5 text-olive-600" />;
  }

  const allVisibleSelected = sorted.length > 0 && sorted.every(u => selectedIds.includes(u.id));

  function toggleSelectAll() {
    if (allVisibleSelected) {
      onSelectionChange(selectedIds.filter(id => !sorted.some(u => u.id === id)));
    } else {
      const newIds = [...new Set([...selectedIds, ...sorted.map(u => u.id)])];
      onSelectionChange(newIds);
    }
  }

  function toggleSelect(id: string) {
    if (selectedIds.includes(id)) onSelectionChange(selectedIds.filter(x => x !== id));
    else onSelectionChange([...selectedIds, id]);
  }

  const platoonOptions = platoons.map(p => ({ value: p.id, label: p.name }));
  const statusOptions  = (Object.entries(STATUS_LABELS) as [SoldierStatus, string][]).map(([k, v]) => ({ value: k, label: v }));
  const roleOptions    = [
    ...Object.entries(ROLE_LABELS).map(([k, v]) => ({ value: k, label: v })),
    ...Object.entries(POSITION_LABELS).map(([k, v]) => ({ value: k, label: `מומחיות: ${v}` })),
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

      {/* Filter bar */}
      <div className="p-3 border-b border-gray-100 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder='חפש שם / מ"א / אימייל'
            className="w-full pr-9 pl-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-olive-400"
          />
        </div>

        <MultiSelect label="כל המחלקות"   options={platoonOptions} selected={filterPlatoons} onChange={setFilterPlatoons} />
        <MultiSelect label="כל הסטטוסים"  options={statusOptions}  selected={filterStatuses} onChange={setFilterStatuses as (v: string[]) => void} />
        <MultiSelect label="תפקיד / מומחיות" options={roleOptions}  selected={filterRoles}    onChange={setFilterRoles} />

        <select
          value={filterAssigned}
          onChange={e => setFilterAssigned(e.target.value as typeof filterAssigned)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-olive-400"
        >
          <option value="all">כולם</option>
          <option value="assigned">משובצים</option>
          <option value="unassigned">לא משובצים</option>
        </select>

        <span className="text-xs text-gray-400 mr-auto">{sorted.length} חיילים</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-right">
          <thead>
            <tr className="bg-gray-50 text-xs font-semibold text-gray-500 border-b border-gray-200">
              <th className="px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleSelectAll}
                  className="w-3.5 h-3.5 accent-olive-700 cursor-pointer"
                  title="בחר הכל"
                />
              </th>
              <Th label="שם"       k="name"     onClick={toggleSort} SortIcon={SortIcon} />
              <Th label='מ"א'      k="name"     onClick={() => {}} SortIcon={() => null} />
              <Th label="מחלקה"    k="platoon"  onClick={toggleSort} SortIcon={SortIcon} />
              <Th label="צוות"     k="crew"     onClick={toggleSort} SortIcon={SortIcon} />
              <Th label="תפקיד"    k="role"     onClick={toggleSort} SortIcon={SortIcon} />
              <Th label="סטטוס שיבוץ" k="assigned" onClick={toggleSort} SortIcon={SortIcon} />
              <Th label="סטטוס"    k="status"   onClick={toggleSort} SortIcon={SortIcon} />
              <th className="px-3 py-2.5">כשירות</th>
              <th className="px-3 py-2.5">טלפון</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.map(u => {
              const a          = assignMap[u.id];
              const status     = getStatus(u);
              const rawPhone   = u.phone_number ?? '';
              const intlPhone  = rawPhone.replace(/^0/, '972').replace(/[-\s]/g, '');
              const waLink     = intlPhone ? `https://wa.me/${intlPhone}` : null;
              const isSelected = selectedIds.includes(u.id);

              return (
                <tr
                  key={u.id}
                  onClick={() => onViewProfile(u.id)}
                  className={`hover:bg-olive-50 cursor-pointer transition-colors ${!a ? 'bg-red-50/30' : ''} ${isSelected ? 'bg-olive-50' : ''}`}
                >
                  <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(u.id)}
                      className="w-3.5 h-3.5 accent-olive-700 cursor-pointer"
                    />
                  </td>
                  <td className="px-3 py-2.5 font-medium text-gray-800">
                    <span className="group-hover:bg-gray-100 rounded px-0.5 transition-colors">
                      {u.first_name} {u.last_name}
                    </span>
                    <span className="block text-xs text-gray-400 font-normal">{ROLE_LABELS[u.role]}</span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-500 font-mono text-xs">{u.personal_id}</td>
                  <td className="px-3 py-2.5 text-gray-600">{platoonMap[u.primary_platoon_id ?? ''] ?? '—'}</td>
                  <td className="px-3 py-2.5 text-gray-600">
                    {a?.crew_id ? (crewMap[a.crew_id] ?? '—') : (
                      <span className="text-red-400 text-xs font-medium">לא משובץ</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-gray-600">
                    <div className="flex items-center gap-1.5">
                      <span>{a?.position_label ?? '—'}</span>
                      {u.crew_position && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                          {POSITION_LABELS[u.crew_position]}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${a ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {a ? 'משובץ' : 'לא משובץ'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5" onClick={e => canEditStatus && e.stopPropagation()}>
                    {canEditStatus ? (
                      <button
                        onClick={e => cycleStatus(e, u)}
                        className={`text-xs font-medium px-2.5 py-1 rounded-full transition-all hover:opacity-80 ${STATUS_BADGE[status]}`}
                        title="לחץ לשינוי סטטוס"
                      >
                        {STATUS_LABELS[status]}
                      </button>
                    ) : (
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_BADGE[status]}`}>
                        {STATUS_LABELS[status]}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`text-xs ${u.medical_fitness ? 'text-green-600' : 'text-red-500'}`}>
                      {u.medical_fitness ? '✓' : '✗'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                    {waLink ? (
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium whitespace-nowrap"
                      >
                        <Phone className="w-3 h-3" /> {rawPhone}
                      </a>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Multi-select dropdown ──────────────────────────────────────
function MultiSelect({
  label, options, selected, onChange,
}: {
  label:    string;
  options:  { value: string; label: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const buttonLabel =
    selected.length === 0 ? label :
    selected.length === 1 ? (options.find(o => o.value === selected[0])?.label ?? label) :
    `${selected.length} נבחרו`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 text-sm border rounded-lg px-3 py-1.5 transition-colors whitespace-nowrap
          ${selected.length > 0 ? 'border-olive-400 bg-olive-50 text-olive-800' : 'border-gray-200 hover:border-olive-400'}`}
      >
        {buttonLabel}
        <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
      </button>
      {open && (
        <div className="absolute top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-xl p-2 min-w-40 max-h-60 overflow-y-auto">
          {options.map(opt => (
            <label key={opt.value} className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-gray-50 rounded cursor-pointer">
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={e => {
                  if (e.target.checked) onChange([...selected, opt.value]);
                  else onChange(selected.filter(v => v !== opt.value));
                }}
                className="w-3.5 h-3.5 accent-olive-700"
              />
              {opt.label}
            </label>
          ))}
          {selected.length > 0 && (
            <button onClick={() => onChange([])} className="w-full text-xs text-gray-400 mt-1 pt-1 border-t hover:text-red-500 transition-colors">
              נקה הכל
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Th({
  label, k, onClick, SortIcon,
}: {
  label:    string;
  k:        SortKey;
  onClick:  (k: SortKey) => void;
  SortIcon: React.ComponentType<{ k: SortKey }>;
}) {
  return (
    <th className="px-3 py-2.5">
      <button onClick={() => onClick(k)} className="flex items-center gap-1 hover:text-gray-700 transition-colors">
        {label}
        <SortIcon k={k} />
      </button>
    </th>
  );
}
