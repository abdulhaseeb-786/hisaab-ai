import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';
import HisaabAPI from '../services/api';
import confetti from 'canvas-confetti';
import { 
  FileSpreadsheet, 
  UploadCloud, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Check, 
  ArrowRight,
  Database
} from 'lucide-react';

export function CsvUploaderModal({ isOpen, onClose, onDataCommitted }) {
  const { t } = useLanguage();
  const [file, setFile] = useState(null);
  const [stagedData, setStagedData] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [committed, setCommitted] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = async (selectedFile) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setError(null);
    try {
      setUploading(true);
      const res = await HisaabAPI.uploadCsv(selectedFile);
      setStagedData(res);
    } catch (err) {
      console.error('CSV upload error:', err);
      setError(err.response?.data?.detail || 'CSV parsing error. Ensure valid headers.');
    } finally {
      setUploading(false);
    }
  };

  const handleCommit = async () => {
    if (!stagedData || !stagedData.file_id) return;
    try {
      setCommitting(true);
      await HisaabAPI.commitCsv(stagedData.file_id);
      setCommitted(true);
      confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 } });
      if (onDataCommitted) onDataCommitted();
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      console.error('CSV commit error:', err);
      setError(err.response?.data?.detail || 'Failed to commit staged rows.');
    } finally {
      setCommitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-white text-base sm:text-lg">
                  Two-Phase CSV Ingestion Engine
                </h3>
                <span className="text-xs text-slate-400">
                  Bulk invoice & sales ingestion with row-level error validation before committing.
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 space-y-5 overflow-y-auto flex-1">
            {/* Drag & Drop Area */}
            {!stagedData && (
              <label className="border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-3xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition bg-slate-950/40 hover:bg-slate-950/80">
                <UploadCloud className="w-12 h-12 text-slate-400 group-hover:text-emerald-400 mb-3" />
                <span className="text-sm font-bold text-white">
                  Click to upload or drag & drop CSV file
                </span>
                <span className="text-xs text-slate-400 mt-1">
                  Supports products catalog CSV or distributor purchase invoice CSV
                </span>
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => handleFileChange(e.target.files[0])}
                />
              </label>
            )}

            {uploading && (
              <div className="py-12 text-center text-slate-400 text-sm">
                Validating CSV rows against Al-Madina database constraints...
              </div>
            )}

            {error && (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Validation Preview Table */}
            {stagedData && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-400">Total Rows: </span>
                    <strong className="text-white">{stagedData.total_rows || 0}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Valid Rows: </span>
                    <strong className="text-emerald-400">{stagedData.valid_rows || 0}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Invalid Rows: </span>
                    <strong className="text-rose-400">{stagedData.invalid_rows || 0}</strong>
                  </div>
                </div>

                {/* Staged Rows Sample */}
                <div className="rounded-2xl border border-slate-800 overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase font-bold">
                      <tr className="border-b border-slate-800">
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">SKU / Item</th>
                        <th className="py-2.5 px-3">Details</th>
                        <th className="py-2.5 px-3">Validation Message</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-medium">
                      {stagedData.preview_rows && stagedData.preview_rows.slice(0, 5).map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/20">
                          <td className="py-2 px-3">
                            {row.is_valid ? (
                              <span className="text-emerald-400 flex items-center gap-1 font-bold">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Valid
                              </span>
                            ) : (
                              <span className="text-rose-400 flex items-center gap-1 font-bold">
                                <AlertTriangle className="w-3.5 h-3.5" /> Error
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-bold text-white">
                            {row.sku || row.name || `Row #${idx + 1}`}
                          </td>
                          <td className="py-2 px-3 text-slate-300">
                            {row.data_summary || 'Standard product line'}
                          </td>
                          <td className="py-2 px-3 text-slate-400">
                            {row.validation_error || 'Passed all schema checks'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          {stagedData && (
            <div className="p-5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between gap-3">
              <button
                onClick={() => {
                  setStagedData(null);
                  setFile(null);
                }}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              >
                Upload Different File
              </button>

              <button
                onClick={handleCommit}
                disabled={committing || committed || stagedData.valid_rows === 0}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-extrabold text-xs text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-900/40 transition active:scale-95 disabled:opacity-50"
              >
                <Database className="w-4 h-4 text-white" />
                <span>
                  {committed
                    ? 'Committed to Database!'
                    : committing
                    ? 'Writing to DB...'
                    : `Commit ${stagedData.valid_rows} Valid Rows`}
                </span>
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default CsvUploaderModal;
