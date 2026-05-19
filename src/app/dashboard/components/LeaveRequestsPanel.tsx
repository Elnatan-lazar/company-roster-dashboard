'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Check, Trash2, Download, ChevronDown, ChevronUp, Search } from 'lucide-react';
import type { LeaveRequest, PlatoonRow } from '@/types/database';

const STATUS_BADGE = {
  pending:  'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
};

const STATUS_LABEL = {
  pending:  'ממתין',
  approved: 'מאושר',
};

interface Props {
  requests:      LeaveRequest[];
  platoons:      PlatoonRow[];
  canManage:     boolean;
  currentUserId: string;
  platoonFilter?: string;
  onApprove:     (id: string) => void;
  onDelete:      (id: string) => void;
  onExport:      () => void;
}

export default function LeaveRequestsPanel({
  requests, platoons, canManage, currentUserId, platoonFilter,
  onApprove, onDelete, onExport,
}: Props) {
  const [search,         setSearch]         = useState('');
  const [filterPlatoon,  setFilterPlatoon]  = useState(platoonFilter ?? '');
  const [filterStatus,   setFilterStatus]   = useState<'' | 'pending' | 'approved'>('');
  const [sortKey,        setSortKey]        = useState<'name' | 'start_date' | 'status'>('start_date');
  const [sortAsc,        setSortAsc]        = useState(false);

  const platoonMap = useMemo(
    () => Object.fromEntries(platoons.map(p => [p.id, p.name])),
    [platoons]
  );

  const filtered = useMemo(() => {
    let list = [...requests];

    if (platoonFilter) {
      list = list.filter(r => r.platoon_id === platoonFilter);
    } else if (filterPlatoon) {
      list = list.filter(r => r.platoon_id === filterPlatoon);
    }

    if (filterStatus) {
      list = list.filter(r => r.status === filterStatus);
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r => r.soldier_name?.toLowerCase().includes(q));
    }

    list.sort((a, b) => {
      let va = '', vb = '';
      switch (sortKey) {
        case 'name':       va = a.soldier_name ?? ''; vb = b.soldier_name ?? ''; break;
        case 'start_date': va = a.start_date;          vb = b.start_date;         break;
        case 'status':     va = a.status;              vb = b.status;             break;
      }
      const cmp = va.localeCompare(vb, 'he');
      return sortAsc ? cmp : -cmp;
    });

    return list;
  }, [requests, platoonFilter, filterPlatoon, filterStatus, search, sortKey, sortAsc]);

  function toggleSort(k: typeof sortKey) {
    if (sortKey === k) setSortAsc(a => !a);
    else { setSortKey(k); setSortAsc(false); }
  }

  function SortIcon({ k }: { k: typeof sortKey }) {
    if (sortKey !== k) return <ChevronUp className="w-3 h-3 text-gray-300" />;
    return sortAsc
      ? <ChevronUp className="w-3 h-3 text-olive-600" />
      : <ChevronDown className="w-3 h-3 text-olive-600" />;
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">אין בקשות יציאה</div>
    );
  }

  const platoonOptions = platoons.map(p => ({ value: p.id, label: p.name }));

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="חפש שם חייל..."
            className="w-full pr-8 pl-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-olive-400"
          />
        </div>

        {!platoonFilter && (
          <SimpleSelect
            value={filterPlatoon}
            onChange={setFilterPlatoon}
            options={[{ value: '', label: 'כל המחלקות' }, ...platoonOptions]}
          />
        )}

        <SimpleSelect
          value={filterStatus}
          onChange={v => setFilterStatus(v as '' | 'pending' | 'approved')}
          options={[
            { value: '',         label: 'כל הסטטוסים' },
            { value: 'pending',  label: 'ממתין' },
            { value: 'approved', label: 'מאושר' },
          ]}
        />

        <span className="text-xs text-gray-400 mr-auto">{filtered.length} בקשות</span>

        {canManage && (
          <button
            onClick={onExport}
            className="flex items-center gap-1 text-xs text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50"
          >
            <Download className="w-3.5 h-3.5" /> ייצא לאקסל
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm text-right">
          <thead>
            <tr className="bg-gray-50 text-xs font-semibold text-gray-500 border-b border-gray-200">
              <th className="px-3 py-2.5">
                <button onClick={() => toggleSort('name')} className="flex items-center gap-1 hover:text-gray-700">
                  שם חייל <SortIcon k="name" />
                </button>
              </th>
              {!platoonFilter && <th className="px-3 py-2.5">מחלקה</th>}
              <th className="px-3 py-2.5">
                <button onClick={() => toggleSort('start_date')} className="flex items-center gap-1 hover:text-gray-700">
                  מתאריך <SortIcon k="start_date" />
                </button>
              </th>
              <th className="px-3 py-2.5">עד תאריך</th>
              <th className="px-3 py-2.5">שעת יציאה</th>
              <th className="px-3 py-2.5">סיבה</th>
              <th className="px-3 py-2.5">
                <button onClick={() => toggleSort('status')} className="flex items-center gap-1 hover:text-gray-700">
                  סטטוס <SortIcon k="status" />
                </button>
              </th>
              {canManage && <th className="px-3 py-2.5">פעולות</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 bg-white">
            {filtered.map(r => (
              <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-3 py-2.5 font-medium text-gray-800">{r.soldier_name}</td>
                {!platoonFilter && (
                  <td className="px-3 py-2.5 text-gray-600 text-xs">
                    {r.platoon_id ? (platoonMap[r.platoon_id] ?? '—') : '—'}
                  </td>
                )}
                <td className="px-3 py-2.5 text-gray-600 font-mono text-xs">{formatDate(r.start_date)}</td>
                <td className="px-3 py-2.5 text-gray-600 font-mono text-xs">{formatDate(r.end_date)}</td>
                <td className="px-3 py-2.5 text-gray-600 text-xs">{r.leave_time ?? '—'}</td>
                <td className="px-3 py-2.5 text-gray-500 text-xs max-w-[12rem] truncate" title={r.reason ?? ''}>
                  {r.reason ?? '—'}
                </td>
                <td className="px-3 py-2.5">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_BADGE[r.status]}`}>
                    {STATUS_LABEL[r.status]}
                  </span>
                </td>
                {canManage && (
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      {r.status === 'pending' && (
                        <button
                          onClick={() => onApprove(r.id)}
                          title="אשר בקשה"
                          className="text-green-500 hover:text-green-700 transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => onDelete(r.id)}
                        title="מחק בקשה"
                        className="text-red-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SimpleSelect({
  value, onChange, options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-olive-400"
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function formatDate(iso: string) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
