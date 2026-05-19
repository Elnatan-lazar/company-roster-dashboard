'use client';

import { X, AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react';
import type { Warning } from '@/types/database';

const WARNING_ICON: Record<Warning['type'], React.ReactNode> = {
  empty_crew:    <AlertCircle  className="w-4 h-4 text-red-500"    />,
  incomplete:    <AlertTriangle className="w-4 h-4 text-orange-500" />,
  no_commander:  <AlertTriangle className="w-4 h-4 text-yellow-500" />,
  no_qual:       <AlertCircle  className="w-4 h-4 text-blue-500"   />,
  expired_qual:  <AlertCircle  className="w-4 h-4 text-purple-500" />,
};

const WARNING_BG: Record<Warning['type'], string> = {
  empty_crew:   'bg-red-50 border-red-200',
  incomplete:   'bg-orange-50 border-orange-200',
  no_commander: 'bg-yellow-50 border-yellow-200',
  no_qual:      'bg-blue-50 border-blue-200',
  expired_qual: 'bg-purple-50 border-purple-200',
};

const WARNING_SECTION: Record<Warning['type'], string> = {
  empty_crew:   'צוותות ריקים',
  incomplete:   'צוותות חלקיים',
  no_commander: 'ללא מפקד',
  no_qual:      'כישור מטווח חסר',
  expired_qual: 'כישור מטווח פג',
};

interface Props {
  open:            boolean;
  warnings:        Warning[];
  onClose:         () => void;
  onNavigateCrew:  (crewId: string) => void;
}

export default function WarningsPanel({ open, warnings, onClose, onNavigateCrew }: Props) {
  if (!open) return null;

  const crewWarnings = warnings.filter(w => w.crewId);
  const userWarnings = warnings.filter(w => w.userId && !w.crewId);

  const sections: { title: string; items: Warning[] }[] = [
    { title: 'צוותות ריקים',   items: crewWarnings.filter(w => w.type === 'empty_crew')   },
    { title: 'צוותות חלקיים',  items: crewWarnings.filter(w => w.type === 'incomplete')    },
    { title: 'ללא מפקד',       items: crewWarnings.filter(w => w.type === 'no_commander')  },
    { title: 'כישור פג / חסר', items: userWarnings                                         },
  ].filter(s => s.items.length > 0);

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30" onClick={onClose} />

      <div className="fixed inset-y-0 left-0 w-96 bg-white shadow-2xl z-40 flex flex-col" dir="rtl">

        {/* Header */}
        <div className="bg-gray-800 text-white px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            <div>
              <p className="font-bold">לוח התראות פלוגתי</p>
              <p className="text-xs text-gray-400">{warnings.length} בעיות פתוחות</p>
            </div>
          </div>
          <button onClick={onClose} className="hover:text-gray-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {warnings.length === 0 ? (
            <div className="text-center py-16">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">הכל תקין — אין התראות פתוחות</p>
            </div>
          ) : (
            sections.map(section => (
              <div key={section.title}>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                  {section.title}
                </h3>
                <div className="space-y-1.5">
                  {section.items.map(w => (
                    <button
                      key={w.id}
                      onClick={() => {
                        if (w.crewId) onNavigateCrew(w.crewId);
                        else onClose();
                      }}
                      className={`w-full flex items-start gap-2.5 p-3 border rounded-xl text-right transition-colors hover:opacity-80 ${WARNING_BG[w.type]}`}
                    >
                      <span className="shrink-0 mt-0.5">{WARNING_ICON[w.type]}</span>
                      <p className="text-sm text-gray-700 flex-1">{w.message}</p>
                      {w.crewId && (
                        <span className="text-xs text-gray-400 shrink-0">לחץ לניווט ←</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
