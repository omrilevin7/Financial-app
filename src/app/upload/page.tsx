'use client'

import { useState, useRef } from 'react'
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'

type UploadResult = {
  success: boolean
  upload_id?: number
  total?: number
  review_needed?: number
  error?: string
}

type FileEntry = {
  file: File
  sourceType: 'max' | 'bank' | ''
}

export default function UploadPage() {
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [uploading, setUploading] = useState(false)
  const [results, setResults] = useState<UploadResult[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  function addFiles(files: FileList | null) {
    if (!files) return
    const newEntries: FileEntry[] = Array.from(files).map(f => ({
      file: f,
      sourceType: guessSourceType(f.name),
    }))
    setEntries(prev => [...prev, ...newEntries])
  }

  function guessSourceType(filename: string): 'max' | 'bank' | '' {
    const lower = filename.toLowerCase()
    if (lower.includes('transaction') || lower.includes('max')) return 'max'
    if (lower.includes('bank') || lower.includes('discount') || lower.includes('עובר') || lower.includes('_')) return 'bank'
    return ''
  }

  function updateSourceType(i: number, type: 'max' | 'bank') {
    setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, sourceType: type } : e))
  }

  function removeEntry(i: number) {
    setEntries(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleUpload() {
    if (entries.some(e => !e.sourceType)) return
    setUploading(true)
    setResults([])

    const uploadResults: UploadResult[] = []
    for (const entry of entries) {
      const fd = new FormData()
      fd.append('file', entry.file)
      fd.append('source_type', entry.sourceType)
      try {
        const res = await fetch('/api/upload', { method: 'POST', body: fd })
        const data = await res.json()
        uploadResults.push(data)
      } catch {
        uploadResults.push({ success: false, error: 'Network error' })
      }
    }
    setResults(uploadResults)
    setUploading(false)
    setEntries([])
  }

  const totalReview = results.reduce((s, r) => s + (r.review_needed ?? 0), 0)
  const allSuccess = results.length > 0 && results.every(r => r.success)

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Upload Transactions</h1>
        <p className="text-sm text-slate-500 mt-1">Upload Max credit card or Discount bank exports (.xlsx)</p>
      </div>

      {/* Drop zone */}
      <div
        className="border-2 border-dashed border-slate-700 rounded-xl p-10 text-center cursor-pointer hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all"
        onClick={() => inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files) }}
      >
        <Upload className="w-8 h-8 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400 text-sm">Drop .xlsx files here, or click to browse</p>
        <p className="text-slate-600 text-xs mt-1">Max credit card export or Discount bank statement</p>
        <input ref={inputRef} type="file" accept=".xlsx,.xls" multiple className="hidden" onChange={e => addFiles(e.target.files)} />
      </div>

      {/* File list */}
      {entries.length > 0 && (
        <div className="space-y-2">
          {entries.map((entry, i) => (
            <div key={i} className="flex items-center gap-3 bg-[#161b27] border border-slate-800 rounded-xl p-3">
              <FileSpreadsheet className="w-5 h-5 text-slate-500 flex-shrink-0" />
              <span className="flex-1 text-sm text-slate-300 truncate">{entry.file.name}</span>

              <div className="flex gap-1">
                {(['max', 'bank'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => updateSourceType(i, type)}
                    className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${
                      entry.sourceType === type
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {type === 'max' ? 'Max CC' : 'Bank'}
                  </button>
                ))}
              </div>
              <button onClick={() => removeEntry(i)} className="text-slate-600 hover:text-slate-400 text-xs ml-1">✕</button>
            </div>
          ))}

          <button
            onClick={handleUpload}
            disabled={uploading || entries.some(e => !e.sourceType)}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {uploading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Processing & categorizing...</>
            ) : (
              <><Upload className="w-4 h-4" /> Upload {entries.length} file{entries.length > 1 ? 's' : ''}</>
            )}
          </button>
          {entries.some(e => !e.sourceType) && (
            <p className="text-xs text-amber-500 text-center">Please select Max CC or Bank for each file</p>
          )}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          {results.map((r, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 p-4 rounded-xl border ${
                r.success ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'
              }`}
            >
              {r.success
                ? <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                : <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              }
              <div>
                {r.success ? (
                  <>
                    <p className="text-sm text-emerald-400 font-medium">
                      {r.total} transactions imported
                    </p>
                    {(r.review_needed ?? 0) > 0 && (
                      <p className="text-xs text-amber-400 mt-0.5">
                        {r.review_needed} need your review
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-red-400">{r.error}</p>
                )}
              </div>
            </div>
          ))}

          {allSuccess && (
            <div className="flex gap-3">
              <Link
                href="/dashboard"
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl text-center transition-colors"
              >
                View Dashboard
              </Link>
              {totalReview > 0 && (
                <Link
                  href="/review"
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-xl text-center transition-colors"
                >
                  Review {totalReview} transactions
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="bg-[#161b27] border border-slate-800 rounded-xl p-4 space-y-3 text-sm">
        <p className="text-slate-400 font-medium">How to export:</p>
        <div className="space-y-2 text-slate-500">
          <div>
            <p className="text-slate-400">Max credit card →</p>
            <p>Login to max.co.il → Account activity → Export → Excel (.xlsx)</p>
          </div>
          <div>
            <p className="text-slate-400">Discount Bank →</p>
            <p>Login to bank → Checking account → Export transactions → Excel (.xlsx)</p>
          </div>
        </div>
      </div>
    </div>
  )
}
