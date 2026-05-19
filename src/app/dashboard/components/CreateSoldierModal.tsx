'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import type { PlatoonRow } from '@/types/database';

interface SoldierForm {
  first_name:         string;
  last_name:          string;
  personal_id:        string;
  email:              string;
  role:               string;
  primary_platoon_id: string;
}

interface Props {
  platoons:  PlatoonRow[];
  onConfirm: (form: SoldierForm) => void;
  onClose:   () => void;
}

const fieldCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-olive-400';
const labelCls = 'block text-xs font-semibold text-gray-600 mb-1';

export default function CreateSoldierModal({ platoons, onConfirm, onClose }: Props) {
  const [form, setForm] = useState<SoldierForm>({
    first_name: '', last_name: '', personal_id: '', email: '',
    role: 'soldier', primary_platoon_id: '',
  });

  const valid =
    form.first_name.trim() !== '' &&
    form.last_name.trim()  !== '' &&
    form.personal_id.trim() !== '' &&
    form.email.trim() !== '';

  function set(k: keyof SoldierForm, v: string) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={onClose} />

      {/* Modal container */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-800">צור חייל חדש</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-4 space-y-3">

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>שם פרטי *</label>
                <input
                  autoFocus
                  type="text"
                  value={form.first_name}
                  onChange={e => set('first_name', e.target.value)}
                  placeholder="ישראל"
                  className={fieldCls}
                />
              </div>
              <div>
                <label className={labelCls}>שם משפחה *</label>
                <input
                  type="text"
                  value={form.last_name}
                  onChange={e => set('last_name', e.target.value)}
                  placeholder="ישראלי"
                  className={fieldCls}
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>מספר אישי *</label>
              <input
                type="text"
                value={form.personal_id}
                onChange={e => set('personal_id', e.target.value)}
                placeholder="1234567"
                className={fieldCls}
              />
            </div>

            <div>
              <label className={labelCls}>אימייל *</label>
              <input
                type="email"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="soldier@example.com"
                className={fieldCls}
              />
            </div>

            <div>
              <label className={labelCls}>תפקיד</label>
              <select
                value={form.role}
                onChange={e => set('role', e.target.value)}
                className={fieldCls}
              >
                <option value="soldier">חייל</option>
                <option value="crew_commander">מפקד צוות</option>
                <option value="platoon_commander">מפקד מחלקה</option>
                <option value="company_commander">מפקד פלוגה</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>מחלקה</label>
              <select
                value={form.primary_platoon_id}
                onChange={e => set('primary_platoon_id', e.target.value)}
                className={fieldCls}
              >
                <option value="">ללא שיוך</option>
                {platoons.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <p className="text-[11px] text-gray-400">
              החייל יוכל להתחבר עם האימייל שצוין לאחר שיאופס סיסמתו.
            </p>
          </div>

          {/* Footer */}
          <div className="px-6 pb-5 flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50"
            >
              ביטול
            </button>
            <button
              onClick={() => valid && onConfirm(form)}
              disabled={!valid}
              className="px-4 py-2 text-sm font-semibold bg-olive-700 text-white rounded-xl hover:bg-olive-800 disabled:opacity-40"
            >
              צור חייל
            </button>
          </div>

        </div>
      </div>
    </>
  );
}
