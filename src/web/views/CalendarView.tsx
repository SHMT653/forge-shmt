'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { useCalendar } from '@/web/hooks/useCalendar';
import { DayEditorSheet } from '@/web/components/DayEditorSheet';
import { todayKey } from '@/domain/dates';

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

/**
 * Month view with a traffic light per day (§ "in grün, orange und rot").
 *
 * Tapping a day opens it for correction — the whole reason this screen exists
 * is catching up on days that were forgotten, so every square is editable, not
 * just a read-out.
 */
export function CalendarView() {
  const calendar = useCalendar();
  const [openDate, setOpenDate] = useState<string | null>(null);
  const today = todayKey();
  const monthName = new Date(`${calendar.anchor}-01T12:00:00`).toLocaleDateString('de-DE', {
    month: 'long',
    year: 'numeric',
  });

  function shiftMonth(delta: number) {
    const [y, m] = calendar.anchor.split('-').map(Number);
    const date = new Date(y ?? 2026, (m ?? 1) - 1 + delta, 1);
    calendar.setAnchor(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  }

  if (calendar.error) {
    return <div className="panel"><p className="copy" style={{ color: 'var(--danger)' }}>{calendar.error}</p></div>;
  }

  return (
    <>
      <section className="panel">
        <div className="row-between" style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <CalendarDays size={16} color="var(--violet)" />
            <p className="h2" style={{ fontSize: 18 }}>{monthName}</p>
          </div>
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <button type="button" className="icon-button" onClick={() => shiftMonth(-1)} aria-label="Vorheriger Monat">
              <ChevronLeft size={17} />
            </button>
            <button type="button" className="icon-button" onClick={() => shiftMonth(1)} aria-label="Nächster Monat">
              <ChevronRight size={17} />
            </button>
          </div>
        </div>

        <div className="cal-grid" style={{ marginBottom: 6 }}>
          {WEEKDAYS.map((day) => (
            <div key={day} className="cal-weekday">{day}</div>
          ))}
        </div>

        <div className="cal-grid">
          {calendar.grid.days.map((date) => {
            const rating = calendar.ratings.get(date);
            const inMonth = date.slice(0, 7) === calendar.anchor;
            const isFuture = date > today;
            const classes = [
              'cal-day',
              !inMonth ? 'outside' : '',
              isFuture ? 'future' : '',
              date === today ? 'today' : '',
              rating?.hasData ? rating.tone : '',
            ].filter(Boolean).join(' ');

            return (
              <button
                key={date}
                type="button"
                className={classes}
                onClick={() => !isFuture && setOpenDate(date)}
                disabled={isFuture}
                aria-label={`${date}${rating?.score !== null && rating?.score !== undefined ? `, Bewertung ${rating.score} von 10` : ', keine Daten'}`}
              >
                <span>{Number(date.slice(8, 10))}</span>
                <span className="cal-dot-row">
                  {rating?.notes.includes('trainiert') && <span className="cal-dot" />}
                  {rating?.notes.includes('Mini-Session') && <span className="cal-dot" style={{ opacity: 0.5 }} />}
                </span>
              </button>
            );
          })}
        </div>

        <div className="cal-legend" style={{ marginTop: 14 }}>
          <span className="cal-legend-item">
            <span className="cal-swatch" style={{ background: 'rgba(95,214,196,0.2)', borderColor: 'rgba(95,214,196,0.55)' }} />
            im Rahmen
          </span>
          <span className="cal-legend-item">
            <span className="cal-swatch" style={{ background: 'rgba(240,198,116,0.2)', borderColor: 'rgba(240,198,116,0.55)' }} />
            teils
          </span>
          <span className="cal-legend-item">
            <span className="cal-swatch" style={{ background: 'rgba(248,113,113,0.18)', borderColor: 'rgba(248,113,113,0.5)' }} />
            daneben
          </span>
          <span className="cal-legend-item">
            <span className="cal-dot" /> trainiert
          </span>
        </div>
      </section>

      {/* ── Month summary — the week/month is the unit, not the single day ── */}
      <section className="panel soft">
        <p className="section-label">Dieser Monat</p>
        <div className="split-4" style={{ marginTop: 10 }}>
          <Stat label="Tage erfasst" value={String(calendar.summary.tracked)} />
          <Stat label="im Rahmen" value={String(calendar.summary.green)} tone="var(--teal)" />
          <Stat label="Trainings" value={String(calendar.summary.trainingDays)} />
          <Stat
            label="Ø Bewertung"
            value={calendar.summary.averageScore !== null ? calendar.summary.averageScore.toLocaleString('de-DE') : '–'}
          />
        </div>
        {calendar.summary.tracked > 0 && (
          <p className="muted-sm" style={{ marginTop: 10 }}>
            {calendar.summary.green} von {calendar.summary.tracked} erfassten Tagen im Rahmen. Tippe einen Tag an,
            um etwas nachzutragen.
          </p>
        )}
        {calendar.loading && <p className="muted-sm" style={{ marginTop: 8 }}>Wird geladen …</p>}
      </section>

      {openDate && (
        <DayEditorSheet
          date={openDate}
          rating={calendar.ratings.get(openDate)}
          load={calendar.openDay}
          onClose={() => setOpenDate(null)}
          onAddMeal={calendar.addMealOn}
          onRemoveMeal={calendar.removeMealOn}
          onSetSteps={calendar.setStepsOn}
          onSetSleep={calendar.setSleepOn}
          onSetWeight={calendar.setWeightOn}
        />
      )}
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="metric-card">
      <span className="metric-value" style={{ fontSize: 18, ...(tone ? { color: tone } : {}) }}>{value}</span>
      <span className="metric-label">{label}</span>
    </div>
  );
}
