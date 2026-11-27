import type { Forecast } from '@/api/types';
import { useLanguage } from '@/i18n/LanguageContext';
import { formatNumber, formatWeekday } from '@/lib/format';

/**
 * Last 14 days sold (grey) and the forecast (green), with both baselines as dots, so
 * the comparison is shown and not just claimed.
 */
export function ForecastChart({ forecast, unit }: { forecast: Forecast; unit: string }) {
  const { pick } = useLanguage();
  const history = forecast.history.slice(-14);
  const future = forecast.daily_predictions;
  const max = Math.max(1, ...history.map((h) => h.units), ...future.flatMap((f) => [f.forecast_units, f.baseline_lag7_units, f.baseline_ma7_units]));
  const W = 100 / (history.length + future.length);
  const y = (v: number) => 100 - (v / max) * 92;

  return (
    <figure className="space-y-2">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-36" role="img" aria-label={pick('Units sold and forecast', 'Bika hua maal aur andaza')}>
        {history.map((h, i) => (
          <rect key={h.date} x={i * W + W * 0.18} width={W * 0.64} y={y(h.units)} height={100 - y(h.units)} rx={0.8} fill="#C4CCC1" />
        ))}
        <line x1={history.length * W} x2={history.length * W} y1={0} y2={100} stroke="#7C867F" strokeWidth={0.3} strokeDasharray="1.2 1.2" />
        {future.map((f, i) => {
          const x = (history.length + i) * W;
          return (
            <g key={f.date}>
              <rect x={x + W * 0.18} width={W * 0.64} y={y(f.forecast_units)} height={100 - y(f.forecast_units)} rx={0.8} fill="#0E6B3F" />
              <circle cx={x + W * 0.5} cy={y(f.baseline_lag7_units)} r={1} fill="#E8A317" />
              <circle cx={x + W * 0.5} cy={y(f.baseline_ma7_units)} r={1} fill="#2A5BA8" />
            </g>
          );
        })}
      </svg>
      <div className="flex justify-between text-xs text-ink-muted">
        <span>{history[0] ? formatWeekday(history[0].date) : ''}</span>
        <span>{pick('today', 'aaj')}</span>
        <span>{future.at(-1) ? formatWeekday(future.at(-1)!.date) : ''}</span>
      </div>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-line-strong" />{pick('Sold', 'Bika')}</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-sabz" />{pick('Expected', 'Andaza')}</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-haldi" />{pick('Same day last week', 'Pichle hafte isi din')}</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-neela" />{pick('7-day average', '7 din ki ausat')}</span>
      </figcaption>
      <p className="text-base">
        {pick('Expected sale in the next 7 days', 'Agle 7 din ki andazan sale')}: <strong className="tabular">{formatNumber(forecast.total_forecast_units)} {unit}</strong>
      </p>
    </figure>
  );
}
