import confetti from 'canvas-confetti';
import { AlertTriangle, Check, Download, UploadCloud } from 'lucide-react';
import { useEffect, useState } from 'react';
import { csvTemplateUrl, useCommitCsv, usePreviewCsv } from '@/api/queries';
import type { ImportType } from '@/api/types';
import { useLanguage } from '@/i18n/LanguageContext';
import { Button } from './ui/Button';
import { Segmented } from './ui/Segmented';
import { Sheet } from './ui/Sheet';

/** Two steps: check the file first, then save. Nothing is saved until the second step. */
export function CsvSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { pick } = useLanguage();
  const [type, setType] = useState<ImportType>('products');
  const [fileName, setFileName] = useState('');
  const preview = usePreviewCsv();
  const commit = useCommitCsv();
  const staged = preview.data;

  const reset = () => {
    preview.reset();
    commit.reset();
    setFileName('');
  };

  useEffect(() => {
    if (!open) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={pick('Add records from a file', 'File se records daalein')}
      description={pick('Step 1: check the file. Step 2: save it.', 'Pehle file check hogi, phir save.')}
      footer={
        staged ? (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={reset}>
              {pick('Another file', 'Doosri file')}
            </Button>
            <Button
              className="flex-1"
              disabled={commit.isPending || commit.isSuccess || staged.valid_rows_count === 0}
              onClick={() => commit.mutate(staged.batch_token, { onSuccess: () => confetti({ particleCount: 90, spread: 80, origin: { y: 0.8 } }) })}
            >
              {commit.isSuccess ? pick('Saved', 'Save ho gaya') : pick(`Save ${staged.valid_rows_count} rows`, `${staged.valid_rows_count} rows save karein`)}
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            label={pick('What is in the file?', 'File mein kya hai?')}
            value={type}
            onChange={(v) => {
              setType(v);
              reset();
            }}
            options={[
              { value: 'products', label: pick('Products', 'Products') },
              { value: 'sales', label: pick('Sales', 'Sales') },
            ]}
          />
          <a href={csvTemplateUrl(type)} className="inline-flex items-center gap-2 min-h-[44px] font-bold text-sabz hover:underline">
            <Download className="w-5 h-5" />
            {pick('Download a sample file', 'Namoona file download')}
          </a>
        </div>

        {!staged && (
          <label className="flex flex-col items-center justify-center text-center gap-2 p-8 rounded-2xl border-2 border-dashed border-line-strong bg-card cursor-pointer hover:border-sabz">
            <UploadCloud className="w-10 h-10 text-ink-muted" />
            <span className="text-lg font-bold">{preview.isPending ? pick('Checking the file…', 'File check ho rahi hai…') : pick('Choose a CSV file', 'CSV file chunein')}</span>
            <span className="text-sm text-ink-muted">
              {type === 'products' ? 'sku, name, category, cost_price, selling_price' : 'sku, qty, unit_price, timestamp, payment_type'}
            </span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              disabled={preview.isPending}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setFileName(f.name);
                preview.mutate({ file: f, importType: type });
              }}
            />
          </label>
        )}

        {preview.isError && (
          <p role="alert" className="flex items-start gap-2 p-4 rounded-2xl bg-lal-tint text-lal-dark font-bold">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            {preview.error.message}
          </p>
        )}

        {staged && (
          <div className="space-y-4">
            <p className="text-lg">
              <strong>{fileName}</strong>: {pick(`${staged.total_rows} rows checked.`, `${staged.total_rows} rows check hui.`)}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl bg-sabz-tint">
                <p className="text-sm font-bold text-sabz-dark">{pick('Ready to save', 'Save ke liye tayyar')}</p>
                <p className="text-2xl font-extrabold tabular">{staged.valid_rows_count}</p>
              </div>
              <div className="p-4 rounded-2xl bg-lal-tint">
                <p className="text-sm font-bold text-lal-dark">{pick('Have a problem', 'Ghalat rows')}</p>
                <p className="text-2xl font-extrabold tabular">{staged.invalid_rows_count}</p>
              </div>
            </div>
            {staged.row_errors.length > 0 && (
              <div className="space-y-2">
                <p className="font-bold">{pick('Fix these rows in your file. They will be skipped:', 'Inhein file mein theek karein. Yeh chhor di jayein gi:')}</p>
                <ul className="bg-card rounded-2xl border border-line divide-y divide-line max-h-64 overflow-y-auto">
                  {staged.row_errors.map((e, i) => (
                    <li key={`${e.row_number}-${e.field}-${i}`} className="px-4 py-2.5 text-base">
                      <span className="font-bold">{pick('Row', 'Row')} {e.row_number}</span>: {e.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {commit.isError && <p className="font-bold text-lal-dark">{commit.error.message}</p>}
            {commit.isSuccess && (
              <p className="flex items-center gap-2 text-lg font-bold text-sabz-dark">
                <Check className="w-5 h-5" />
                {commit.data.message}
              </p>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}

export default CsvSheet;
