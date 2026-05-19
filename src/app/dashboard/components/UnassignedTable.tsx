'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronUp, ChevronDown, ExternalLink, Phone } from 'lucide-react';
import type { UserRow, PlatoonRow, SoldierStatus } from '@/types/database';
import { ROLE_LABELS, STATUS_LABELS, POSITION_LABELS } from '@/types/database';

type SortKey = 'name' | 'personal_id' | 'platoon' | 'role' | 'status' | 'specialty';

const STATUS_BADGE: Record<SoldierStatus, string> = {
  available: 'bg-green-100 text-green-800',
  leave:     'bg-yellow-100 text-yellow-800',
  mission:   'bg-blue-100 text-blue-800',
  sick:      'bg-red-100 text-red-800',
};

const SPECIALTY_BADGE: Record<string, string> = {
  commander: 'bg-purple-100 text-purple-700',
  gunner:    'bg-blue-100 text-blue-700',
  loader:    'bg-orange-100 text-orange-700',
  driver:    'bg-teal-100 text-teal-700',
};

interface Props {
  users:         UserRow[];
  platoons:      PlatoonRow[];
  getStatus:     (u: UserRow) => SoldierStatus;
  onViewProfile: (id: string) => void;
}

export default function UnassignedTable({ users, platoons, getStatus, onViewProfile }: Props) {
  const [search,         setSearch]         = useState('');
  const [filterPlatoons, setFilterPlatoons] = useState<string[]>([]);
  const [filterStatuses, setFilterStatuses] = useState<SoldierStatus[]>([]);
  const [sortKey,        setSortKey]        = useState<SortKey>('name');
  const [sortAsc,        setSortAsc]        = useState(true);

  const platoonMap = useMemo(
    () => Object.fromEntries(platoons.map(p => [p.id, p.name])),
    [platoons]
  );

  const sorted = useMemo(() => {
    let list = [...users];

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(u =>
        `${u.first_name} ${u.last_name}`.toLowerCase().includes(q) ||
        u.personal_id.includes(q)
      );
    }
    if (filterPlatoons.length > 0)
      list = list.filter(u => filterPlatoons.includes(u.primary_platoon_id ?? ''));
    if (filterStatuses.length > 0)
      list = list.filter(u => filterStatuses.includes(getStatus(u)));

    list.sort((a, b) => {
      let va = '', vb = '';
      switch (sortKey) {
        case 'name':       va = `${a.last_name} ${a.first_name}`;       vb = `${b.last_name} ${b.first_name}`; break;
        case 'personal_id':va = a.personal_id;                          vb = b.personal_id; break;
        case 'platoon':    va = platoonMap[a.primary_platoon_id ?? ''] ?? ''; vb = platoonMap[b.primary_platoon_id ?? ''] ?? ''; break;
        case 'role':       va = ROLE_LABELS[a.role];                    vb = ROLE_LABELS[b.role]; break;
        case 'status':     va = getStatus(a);                           vb = getStatus(b); break;
        case 'specialty':  va = a.crew_position ?? '';                  vb = b.crew_position ?? ''; break;
      }
      return sortAsc ? va.localeCompare(vb, 'he') : vb.localeCompare(va, 'he');
    });

    return list;
  }, [users, search, filterPlatoons, filterStatuses, sortKey, sortAsc, platoonMap, getStatus]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortAsc(a => !a);
    else { setSortKey(k); setSortAsc(true); }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ChevronUp className="w-3 h-3 text-gray-300" />;
    return sortAsc ? <ChevronUp className="w-3 h-3 text-olive-600" /> : <ChevronDown className="w-3 h-3 text-olive-600" />;
  }

  if (users.length === 0) {
    return (
      <div className="text-center py-14 text-gray-400 text-sm">
        ✅ כל החיילים משובצים בתצורה זו
      </div>
    );
  }

  const platoonOptions = platoons.map(p => ({ value: p.id, label: p.name }));
  const statusOptions  = (Object.entries(STATUS_LABELS) as [SoldierStatus, string][]).map(([k, v]) => ({ value: k, label: v }));

  return (
    <div>
      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 items-center mb-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder='חפש שם / מ"א...'
          className="flex-1 min-w-40 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-olive-400"
        />
        <MultiSelect label="כל המחלקות" options={platoonOptions} selected={filterPlatoons} onChange={setFilterPlatoons} />
        <MultiSelect label="כל הסטטוסים" options={statusOptions} selected={filterStatuses} onChange={setFilterStatuses as (v: string[]) => void} />
        <span className="text-xs text-gray-400 mr-auto">{sorted.length} / {users.length} חיילים</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm text-right">
          <thead>
            <tr className="bg-gray-50 text-xs font-semibold text-gray-500 border-b border-gray-200">
              {([
                ['שם',        'name'],
                ['מ"א',       'personal_id'],
                ['מחלקה',    'platoon'],
                ['תפקיד',    'role'],
                ['מומחיות',  'specialty'],
                ['סטטוס',    'status'],
              ] as [string, SortKey][]).map(([label, k]) => (
                <th key={k} className="px-3 py-2.5">
                  <button onClick={() => toggleSort(k)} className="flex items-center gap-1 hover:text-gray-700">
                    {label}<SortIcon k={k} />
                  </button>
                </th>
              ))}
              <th className="px-3 py-2.5">טלפון</th>
              <th className="px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 bg-white">
            {sorted.map(u => {
              const status    = getStatus(u);
              const rawPhone  = u.phone_number ?? '';
              const intlPhone = rawPhone.replace(/^0/, '972').replace(/[-\s]/g, '');
              const waLink    = intlPhone ? `https://wa.me/${intlPhone}` : null;

              return (
                <tr
                  key={u.id}
                  onClick={() => onViewProfile(u.id)}
                  className="hover:bg-olive-50 cursor-pointer transition-colors"
                >
                  <td className="px-3 py-2.5 font-medium text-gray-800">
                    {u.first_name} {u.last_name}
                  </td>
                  <td className="px-3 py-2.5 text-gray-500 font-mono text-xs">{u.personal_id}</td>
                  <td className="px-3 py-2.5 text-gray-600">{platoonMap[u.primary_platoon_id ?? ''] ?? '—'}</td>
                  <td className="px-3 py-2.5 text-gray-600 text-xs">{ROLE_LABELS[u.role]}</td>
                  <td className="px-3 py-2.5">
                    {u.crew_position ? (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${SPECIALTY_BADGE[u.crew_position] ?? 'bg-gray-100 text-gray-500'}`}>
                        {POSITION_LABELS[u.crew_position]}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_BADGE[status]}`}>
                      {STATUS_LABELS[status]}
                    </span>
                  </td>
                  <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                    {waLink ? (
                      <a href={waLink} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium">
                        <Phone className="w-3 h-3" /> {rawPhone}
                      </a>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => onViewProfile(u.id)}
                      className="text-gray-400 hover:text-olive-700 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
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

// ── Reusable multi-select dropdown ─────────────────────────────
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
        <div className="absolute top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-xl p-2 min-w-36">
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

