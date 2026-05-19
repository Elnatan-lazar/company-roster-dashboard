'use client';

import { useState } from 'react';
import { X, Search, Phone } from 'lucide-react';
import type { UserRow, PlatoonRow, SoldierStatus } from '@/types/database';
import { ROLE_LABELS, STATUS_LABELS, POSITION_LABELS } from '@/types/database';

const STATUS_DOT: Record<string, string> = {
  available: 'bg-green-500',
  leave:     'bg-yellow-400',
  mission:   'bg-blue-500',
  sick:      'bg-red-500',
};

const SPECIALTY_BADGE: Record<string, string> = {
  commander: 'bg-purple-100 text-purple-700',
  gunner:    'bg-blue-100 text-blue-700',
  loader:    'bg-orange-100 text-orange-700',
  driver:    'bg-teal-100 text-teal-700',
};

interface Props {
  crewName:         string;
  positionLabel:    string;
  eligibleSoldiers: UserRow[];
  platoons:         PlatoonRow[];
  getStatus:        (u: UserRow) => SoldierStatus;
  onAssign:         (userId: string) => void;
  onClose:          () => void;
}

export default function AssignmentSidebar({
  crewName, positionLabel, eligibleSoldiers,
  platoons, getStatus, onAssign, onClose,
}: Props) {
  const [search, setSearch] = useState('');

  const platoonMap = Object.fromEntries(platoons.map(p => [p.id, p.name]));

  const filtered = eligibleSoldiers.filter(u => {
    const q = search.toLowerCase();
    return (
      `${u.first_name} ${u.last_name}`.toLowerCase().includes(q) ||
      u.personal_id.includes(q)
    );
  });

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30"
        onClick={onClose}
      />

      {/* Sidebar panel */}
      <div className="fixed inset-y-0 right-0 w-80 bg-white shadow-2xl z-40 flex flex-col" dir="rtl">

        {/* Header */}
        <div className="bg-olive-800 text-white px-4 py-4 flex items-center justify-between">
          <div>
            <p className="font-bold">{crewName}</p>
            <p className="text-sm text-olive-300">שיבוץ מהיר — {positionLabel}</p>
          </div>
          <button onClick={onClose} className="hover:text-olive-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder='חפש לפי שם / מ"א'
              className="w-full pr-9 pl-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-olive-400"
            />
          </div>
        </div>

        {/* Count */}
        <div className="px-4 py-2 text-xs text-gray-500 bg-gray-50 border-b border-gray-100">
          {filtered.length} חיילים כשירים לתפקיד זה
        </div>

        {/* Soldier list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              {search ? 'אין תוצאות לחיפוש' : 'אין חיילים פנויים לתפקיד זה'}
            </div>
          ) : (
            filtered.map(u => (
              <button
                key={u.id}
                onClick={() => onAssign(u.id)}
                className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-50 hover:bg-olive-50 transition-colors text-right"
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_DOT[getStatus(u)]}`}
                  title={STATUS_LABELS[getStatus(u)]}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {u.first_name} {u.last_name}
                    </p>
                    {/* Specialty badge */}
                    {u.crew_position && (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${SPECIALTY_BADGE[u.crew_position] ?? 'bg-gray-100 text-gray-500'}`}>
                        {POSITION_LABELS[u.crew_position]}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">
                    {platoonMap[u.primary_platoon_id ?? ''] ?? '—'} · {u.personal_id} · {ROLE_LABELS[u.role]}
                  </p>
                </div>
                {u.phone_number && (
                  <a
                    href={`tel:${u.phone_number}`}
                    onClick={e => e.stopPropagation()}
                    className="text-gray-300 hover:text-olive-600 shrink-0 transition-colors"
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
}
