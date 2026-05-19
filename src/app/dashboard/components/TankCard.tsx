'use client';

import { useState } from 'react';
import { Phone, UserMinus, Trash2 } from 'lucide-react';
import type { CrewRow, UserRow, DeploymentAssignment, SoldierStatus } from '@/types/database';
import { STATUS_LABELS, POSITION_LABELS } from '@/types/database';

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
  crew:               CrewRow;
  isCombat:           boolean;
  positions:          string[];
  getSlotUser:        (posLabel: string) => UserRow | undefined;
  getCrewAssignments: () => { assignment: DeploymentAssignment; user: UserRow }[];
  onOpenSidebar?:     (posLabel: string) => void;
  onUnassign?:        (userId: string) => void;
  onViewProfile:      (userId: string) => void;
  onDeleteCrew?:      () => void;
  getStatus:          (u: UserRow) => SoldierStatus;
}

export default function TankCard({
  crew, isCombat, positions,
  getSlotUser, getCrewAssignments,
  onOpenSidebar, onUnassign, onViewProfile, onDeleteCrew, getStatus,
}: Props) {
  const [cardHovered, setCardHovered] = useState(false);

  const assignments = getCrewAssignments();
  const filled      = isCombat
    ? positions.filter(p => getSlotUser(p) !== undefined).length
    : assignments.length;

  const readinessColor = isCombat
    ? (filled === 4 ? 'bg-green-400' : filled >= 2 ? 'bg-yellow-400' : 'bg-red-400')
    : 'bg-blue-400';

  return (
    <div
      className="border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:border-emerald-500 transition-all"
      onMouseEnter={() => setCardHovered(true)}
      onMouseLeave={() => setCardHovered(false)}
    >
      {/* Header */}
      <div className="bg-olive-800 text-white px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base select-none">🪖</span>
          <span className="font-bold text-sm">{crew.name}</span>
        </div>
        <div className="flex items-center gap-2">
          {crew.vehicle_id && (
            <span className="text-xs bg-olive-700 text-olive-200 px-2 py-0.5 rounded-full">
              {crew.vehicle_id}
            </span>
          )}
          <span
            className={`w-2.5 h-2.5 rounded-full ${readinessColor}`}
            title={isCombat ? `${filled}/4 משובצים` : `${filled} משובצים`}
          />
          {onDeleteCrew && (
            <button
              onClick={e => { e.stopPropagation(); onDeleteCrew(); }}
              title="מחק צוות"
              className={`transition-opacity text-red-300 hover:text-red-100 ${cardHovered ? 'opacity-100' : 'opacity-0'}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="divide-y divide-gray-50 bg-white">
        {isCombat ? (
          positions.map(pos => (
            <PositionRow
              key={pos}
              posLabel={pos}
              soldier={getSlotUser(pos)}
              onAssign={onOpenSidebar ? () => onOpenSidebar(pos) : undefined}
              onUnassign={onUnassign}
              onViewProfile={onViewProfile}
              getStatus={getStatus}
            />
          ))
        ) : (
          <>
            {assignments.map(({ assignment, user }) => (
              <PositionRow
                key={user.id}
                posLabel={assignment.position_label}
                soldier={user}
                onAssign={onOpenSidebar ? () => onOpenSidebar(assignment.position_label) : undefined}
                onUnassign={onUnassign}
                onViewProfile={onViewProfile}
                getStatus={getStatus}
              />
            ))}
            {onOpenSidebar && (
              <div className="px-3 py-2">
                <AddMemberInline onConfirm={label => onOpenSidebar(label)} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Inline add-member input (replaces window.prompt) ──────────
function AddMemberInline({ onConfirm }: { onConfirm: (label: string) => void }) {
  const [open, setOpen] = useState(false);
  const [val,  setVal]  = useState('');

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg px-3 py-1.5 hover:border-olive-400 hover:text-olive-600 transition-colors"
      >
        + הוסף חבר צוות
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
          if (e.key === 'Enter' && val.trim()) { onConfirm(val.trim()); setVal(''); setOpen(false); }
          if (e.key === 'Escape') { setVal(''); setOpen(false); }
        }}
        placeholder='תפקיד (קשר"ג, רס"פ...)'
        className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-olive-400"
      />
      <button
        onClick={() => { if (val.trim()) { onConfirm(val.trim()); setVal(''); setOpen(false); } }}
        className="text-xs bg-olive-700 text-white px-2 py-1 rounded-lg hover:bg-olive-800"
      >
        הוסף
      </button>
    </div>
  );
}

// ── Position Row ───────────────────────────────────────────────
function PositionRow({
  posLabel, soldier, onAssign, onUnassign, onViewProfile, getStatus,
}: {
  posLabel:       string;
  soldier:        UserRow | undefined;
  onAssign?:      () => void;
  onUnassign?:    (userId: string) => void;
  onViewProfile:  (userId: string) => void;
  getStatus:      (u: UserRow) => SoldierStatus;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="px-3 py-2 flex items-center gap-2 min-h-[2.5rem] group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Position label */}
      <span className="text-[11px] font-bold text-gray-400 w-10 shrink-0 text-left">
        {posLabel}
      </span>

      {soldier ? (
        <div className="flex-1 flex items-center justify-between gap-1 min-w-0">
          <button
            onClick={() => onViewProfile(soldier.id)}
            className="flex items-center gap-1.5 min-w-0 cursor-pointer text-right group/name"
          >
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[getStatus(soldier)]}`}
              title={STATUS_LABELS[getStatus(soldier)]}
            />
            <span className="text-sm font-medium text-gray-800 truncate group-hover/name:text-olive-700 group-hover/name:bg-olive-50 rounded px-0.5 transition-colors">
              {soldier.first_name} {soldier.last_name}
            </span>
            {/* Specialty badge */}
            {soldier.crew_position && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${SPECIALTY_BADGE[soldier.crew_position] ?? 'bg-gray-100 text-gray-500'}`}>
                {POSITION_LABELS[soldier.crew_position]}
              </span>
            )}
          </button>

          <div className="flex items-center gap-1 shrink-0">
            {soldier.phone_number && !hovered && (
              <a
                href={`tel:${soldier.phone_number}`}
                className="text-gray-300 hover:text-olive-600 transition-colors"
                title={soldier.phone_number}
                onClick={e => e.stopPropagation()}
              >
                <Phone className="w-3.5 h-3.5" />
              </a>
            )}
            {hovered && onUnassign && (
              <button
                onClick={() => onUnassign(soldier.id)}
                className="text-red-400 hover:text-red-600 transition-colors"
                title="הסר משיבוץ"
              >
                <UserMinus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1">
          {onAssign ? (
            <button
              onClick={onAssign}
              className="w-full text-right text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg px-3 py-1 hover:border-olive-400 hover:text-olive-600 transition-colors"
            >
              לחץ לשיבוץ מהיר
            </button>
          ) : (
            <span className="text-xs text-gray-300 px-3 py-1 block">פנוי</span>
          )}
        </div>
      )}
    </div>
  );
}
