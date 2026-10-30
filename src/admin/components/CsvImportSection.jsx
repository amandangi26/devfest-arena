import { useState, useCallback, useRef } from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  Info,
  Sparkles,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  X,
  FileCheck,
  ShieldCheck,
  Eye,
  ArrowRight,
  Filter,
} from 'lucide-react';

const SAMPLE_CSV = `Unique Code,Name,Email,Phone Number,Track / Registration Status,Organization / College & Location,Designation / Domain
DFR26-A101,Aman Dangi,aman@gdgranchi.in,+91 98765-43210,Flagship Dev Track,BIT Mesra,Lead Organizer
DFR26-B202,Priya Kumari,priya@example.com,9876543211,Beginner Track,IIT ISM Dhanbad,Flutter Developer
DFR26-C303,Rohan Sharma,rohan@example.com,9876543212,Conference Only,IIM Ranchi,Product Manager
DFR26-D404,Kavita Sen,kavita@example.com,9876543213,Flagship Dev Track,NIT Jamshedpur,Cloud Architect
DFR26-E505,Vikram Singh,vikram@example.com,9876543214,Beginner Track,Ranchi University,Student Attendee`;

// Accepted columns specifications (matching DevFest guidelines & official table)
const ACCEPTED_COLUMNS_INFO = [
  {
    field: 'Unique Code',
    badge: 'Mandatory',
    badgeColor: 'red',
    accepted: 'Unique Code, Ticket Code, Ticket ID, Registration Code, Code',
    example: 'DFR26-A101',
    formatting: 'Unique login & verification code (Required, trim & uppercase)',
  },
  {
    field: 'Full Name',
    badge: 'Mandatory',
    badgeColor: 'red',
    accepted: 'Name, Full Name, Attendee Name, Fullname',
    example: 'Aman Dangi',
    formatting: 'Screen par privacy ke liye auto "Aman D." ban jata hai',
  },
  {
    field: 'Email',
    badge: 'Recommended',
    badgeColor: 'blue',
    accepted: 'Email, Email Address, Email ID',
    example: 'aman@gdgranchi.in',
    formatting: 'Small letters & trim ho jata hai',
  },
  {
    field: 'Phone',
    badge: 'Recommended',
    badgeColor: 'amber',
    accepted: 'Phone Number, Phone, Mobile Number, Contact',
    example: '+91 98765-43210',
    formatting: '+91, 0, spaces hatkar 10-digit number ban jata hai',
  },
  {
    field: 'Track',
    badge: 'Recommended',
    badgeColor: 'green',
    accepted: 'Track / Registration Status, Track, Category, Ticket Type',
    example: 'Flagship Dev Track',
    formatting: 'Games ko specific track ke liye target karne me kaam aata hai',
  },
  {
    field: 'College / Org',
    badge: 'Recommended',
    badgeColor: 'purple',
    accepted: 'Organization / College & Location, Organization, College, Company',
    example: 'BIT Mesra',
    formatting: 'Attendee info me save hota hai',
  },
  {
    field: 'Role / Domain',
    badge: 'Recommended',
    badgeColor: 'gray',
    accepted: 'Designation / Domain, Designation, Role',
    example: 'Software Engineer',
    formatting: 'Attendee profile me save hota hai',
  },
];

export function CsvImportSection({ adminKey, apiClient, onImportSuccess, onSwitchToAttendees }) {
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importReport, setImportReport] = useState(null);
  const [error, setError] = useState(null);
  const [showGuide, setShowGuide] = useState(true);
  const [showRawEditor, setShowRawEditor] = useState(false);
  const fileInputRef = useRef(null);

  // Generate Preview from Server
  const generatePreview = useCallback(
    async (text) => {
      if (!text || !text.trim()) {
        setPreview(null);
        return;
      }

      setIsLoadingPreview(true);
      setError(null);
      try {
        const res = await apiClient('/attendees/preview-import', {
          method: 'POST',
          headers: { 'x-admin-key': adminKey },
          body: JSON.stringify({ csvText: text }),
        });

        if (res?.ok && res.preview) {
          setPreview(res.preview);
        } else {
          throw new Error(res?.error?.message || 'Could not parse CSV preview');
        }
      } catch (err) {
        setError(err.data?.error?.message || err.message || 'Failed to generate CSV preview.');
        setPreview(null);
      } finally {
        setIsLoadingPreview(false);
      }
    },
    [adminKey, apiClient]
  );

  // Handle File Upload
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setImportReport(null);
    setError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result || '';
      setCsvText(content);
      generatePreview(content);
    };
    reader.onerror = () => {
      setError('Failed to read the selected file. Please try again.');
    };
    reader.readAsText(file);
  };

  // Handle Sample CSV
  const handleLoadSample = () => {
    setFileName('sample_attendees.csv');
    setCsvText(SAMPLE_CSV);
    setImportReport(null);
    setError(null);
    generatePreview(SAMPLE_CSV);
  };

  // Clear / Reset
  const handleReset = () => {
    setCsvText('');
    setFileName('');
    setPreview(null);
    setImportReport(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Execute Import
  const handleExecuteImport = async () => {
    if (!csvText.trim()) {
      setError('Please provide CSV data before executing import.');
      return;
    }

    setIsImporting(true);
    setError(null);
    try {
      const res = await apiClient('/attendees/import', {
        method: 'POST',
        headers: { 'x-admin-key': adminKey },
        body: JSON.stringify({ csvText }),
      });

      if (res?.ok) {
        setImportReport(res.report);
        if (onImportSuccess) {
          onImportSuccess();
        }
      } else {
        throw new Error(res?.error?.message || 'Import failed.');
      }
    } catch (err) {
      setError(err.data?.error?.message || err.message || 'Import execution failed.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Main Ingestion Card */}
      <Card surface="white" shadow="md" border="thick" rounded="xl" className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b-2 border-black/10">
          <div>
            <h2 className="text-xl font-black text-black uppercase tracking-tight flex items-center gap-2">
              <Upload className="w-5 h-5 text-[#4285F4]" />
              Attendee CSV Ingestion & Field Targeting
            </h2>
            <p className="text-xs text-black/60 font-semibold mt-1">
              Upload raw event CSV exports. The system strictly targets the 7 recommended attendee columns and safely ignores all extra survey metadata.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={handleLoadSample} disabled={isImporting || isLoadingPreview}>
              <Sparkles className="w-3.5 h-3.5 inline mr-1 text-[#FBBC05]" /> Load Sample CSV
            </Button>

            <label className="cursor-pointer">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileUpload}
                disabled={isImporting || isLoadingPreview}
                className="hidden"
              />
              <span className="inline-flex items-center justify-center font-black uppercase tracking-wider text-xs px-4 py-2 rounded-full border-[2.5px] border-black bg-[#FBBC05] text-black shadow-[2px_2px_0_0_#000] hover:translate-x-[1px] hover:translate-y-[1px] active:translate-x-[2px] active:translate-y-[2px]">
                <FileSpreadsheet className="w-3.5 h-3.5 inline mr-1.5" />
                Choose CSV File
              </span>
            </label>
          </div>
        </div>

        {/* Accepted Columns Accordion Guide */}
        <div className="mb-5 border-2 border-black rounded-xl overflow-hidden bg-[#FFFBF0] shadow-[2px_2px_0_0_#000]">
          <button
            type="button"
            onClick={() => setShowGuide(!showGuide)}
            className="w-full px-4 py-2.5 flex items-center justify-between font-black text-xs uppercase tracking-wider text-black bg-[#FFF3D6] border-b-2 border-black/20 hover:bg-[#FFECC2] transition-colors"
          >
            <span className="flex items-center gap-2">
              <Info className="w-4 h-4 text-[#FBBC05]" />
              Accepted CSV Columns & Auto-Formatting Reference (Click to {showGuide ? 'Collapse' : 'Expand'})
            </span>
            {showGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showGuide && (
            <div className="p-4 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-black/20 text-[10px] font-black uppercase text-black/70">
                    <th className="p-2 pb-1.5">Field</th>
                    <th className="p-2 pb-1.5">Accepted Header Names (Koi bhi ek chalega)</th>
                    <th className="p-2 pb-1.5">Example Value</th>
                    <th className="p-2 pb-1.5">Auto-Formatting / Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/10">
                  {ACCEPTED_COLUMNS_INFO.map((col, idx) => (
                    <tr key={idx} className="hover:bg-black/5">
                      <td className="p-2 font-black text-black whitespace-nowrap">
                        <span className="mr-1.5">{col.field}</span>
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase border ${
                            col.badgeColor === 'red'
                              ? 'bg-[#FFF0F0] text-[#EA4335] border-[#EA4335]'
                              : 'bg-[#EEF4FF] text-[#4285F4] border-[#4285F4]'
                          }`}
                        >
                          {col.badge}
                        </span>
                      </td>
                      <td className="p-2 font-mono text-[11px] text-black/80">{col.accepted}</td>
                      <td className="p-2 font-mono text-[11px] text-black/70 font-bold">{col.example}</td>
                      <td className="p-2 text-black/80">{col.formatting}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 pt-2 border-t border-black/10 text-[11px] text-black/70 flex items-center justify-between">
                <span>
                  💡 <strong>Extra Columns (T-shirt, Timestamp, Food, etc.):</strong> Ignored automatically & will not corrupt attendee records.
                </span>
                <span className="font-semibold text-black/60">Case-insensitive headers supported</span>
              </div>
            </div>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-5 p-3.5 bg-[#FFF5F5] border-[2px] border-[#EA4335] rounded-xl flex items-center gap-2.5 text-xs font-bold text-[#EA4335] shadow-[2px_2px_0_0_#EA4335]">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Upload or Dropzone Status */}
        {!preview && (
          <div className="p-6 border-2 border-dashed border-black/30 rounded-xl bg-[#FAFAFA] flex flex-col items-center justify-center text-center gap-3">
            <FileSpreadsheet className="w-12 h-12 text-black/40" />
            <div>
              <p className="text-sm font-black text-black">No CSV Loaded Yet</p>
              <p className="text-xs text-black/60 max-w-md mt-0.5">
                Click <strong>"Choose CSV File"</strong> above or <strong>"Load Sample CSV"</strong> to automatically inspect headers and preview the attendees.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowRawEditor(!showRawEditor)}
              className="text-xs font-bold text-[#4285F4] underline hover:text-[#3367D6]"
            >
              {showRawEditor ? 'Hide raw CSV editor' : 'Or paste raw CSV text directly'}
            </button>
          </div>
        )}

        {/* Optional Raw Textarea */}
        {showRawEditor && (
          <div className="mt-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black uppercase tracking-wider text-black">
                Raw CSV Data
              </label>
              <button
                type="button"
                onClick={() => generatePreview(csvText)}
                className="text-xs font-black text-[#4285F4] hover:underline"
              >
                Refresh Preview
              </button>
            </div>
            <textarea
              rows={6}
              value={csvText}
              onChange={(e) => {
                setCsvText(e.target.value);
                generatePreview(e.target.value);
              }}
              placeholder="Paste raw CSV text here..."
              className="w-full p-3 bg-[#FFFBF0] border-[2px] border-black rounded-xl font-mono text-xs text-black placeholder:text-black/40 shadow-[2px_2px_0_0_#000] focus:outline-none focus:ring-2 focus:ring-[#FBBC05]"
            />
          </div>
        )}

        {/* Loading Preview State */}
        {isLoadingPreview && (
          <div className="mt-4 p-5 bg-[#EEF4FF] border-2 border-[#4285F4] rounded-xl flex items-center justify-center gap-3 text-sm font-bold text-[#4285F4]">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>Analyzing columns and generating live dry-run preview...</span>
          </div>
        )}

        {/* 2. PREVIEW PRESENTATION */}
        {preview && !isLoadingPreview && (
          <div className="mt-6 flex flex-col gap-6">
            {/* Header / File Info Banner */}
            <div className="p-3.5 bg-[#FFF8E7] border-2 border-black rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-[2px_2px_0_0_#000]">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-[#34A853]" />
                <span className="text-xs font-black uppercase text-black">
                  File: <span className="font-mono text-sm underline">{fileName || 'Pasted CSV Data'}</span>
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-black/10 text-black">
                  {preview.totalRows} Total Rows
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowRawEditor(!showRawEditor)}>
                  {showRawEditor ? 'Hide Raw Text' : 'Edit Raw CSV'}
                </Button>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  <X className="w-3.5 h-3.5 inline mr-1" /> Clear / Change File
                </Button>
              </div>
            </div>

            {/* Target Column Mapping Status Cards */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-1.5">
                  <Filter className="w-4 h-4 text-[#4285F4]" />
                  Recognized & Targeted Event Columns (7 Fields)
                </h3>
                {preview.ignoredColumns?.length > 0 && (
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-black/5 border border-black/20 text-black/70">
                    🛡️ {preview.ignoredColumns.length} Extra Survey Column{preview.ignoredColumns.length > 1 ? 's' : ''} Safely Ignored
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                {Object.values(preview.columnMapping || {}).map((col, idx) => {
                  const isFound = col.found;
                  const isReq = col.required;

                  return (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-xl border-[2px] text-xs flex flex-col justify-between ${
                        isFound
                          ? 'border-[#34A853] bg-[#EEFBF3] shadow-[2px_2px_0_0_#34A853]'
                          : isReq
                          ? 'border-[#EA4335] bg-[#FFF5F5] shadow-[2px_2px_0_0_#EA4335]'
                          : 'border-black/20 bg-black/5 opacity-70'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-black text-[11px] text-black truncate">{col.label}</span>
                          {isReq && <span className="text-[9px] font-bold text-[#EA4335]">*Req</span>}
                        </div>
                        <p className="text-[10px] font-mono truncate text-black/70">
                          {isFound ? `Mapped: "${col.matchedHeader}"` : isReq ? 'MISSING!' : '(Not in CSV)'}
                        </p>
                      </div>

                      <div className="mt-2 text-right">
                        {isFound ? (
                          <span className="inline-flex items-center text-[10px] font-black text-[#34A853]">
                            <CheckCircle className="w-3 h-3 mr-0.5 inline" /> Ready
                          </span>
                        ) : isReq ? (
                          <span className="inline-flex items-center text-[10px] font-black text-[#EA4335]">
                            <AlertTriangle className="w-3 h-3 mr-0.5 inline" /> Required
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-black/40">Skipped</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {preview.ignoredColumns?.length > 0 && (
                <div className="mt-2 px-3 py-1.5 bg-black/5 rounded-lg border border-black/10 text-[11px] text-black/60 flex flex-wrap items-center gap-1.5">
                  <span className="font-bold">Ignored Columns:</span>
                  {preview.ignoredColumns.map((colName, idx) => (
                    <span key={idx} className="font-mono px-1.5 py-0.5 bg-white border border-black/10 rounded text-[10px]">
                      {colName}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Validation Warnings if Missing Required Columns */}
            {preview.missingRequired?.length > 0 && (
              <div className="p-4 bg-[#FFF5F5] border-[2.5px] border-[#EA4335] rounded-xl text-xs text-[#EA4335] font-bold flex items-start gap-3 shadow-[3px_3px_0_0_#EA4335]">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-black uppercase">Cannot Import: Missing Mandatory Columns</p>
                  <p className="mt-0.5 text-black/80">
                    The CSV is missing required column(s):{' '}
                    <span className="font-black underline">{preview.missingRequired.join(', ')}</span>. Please make sure your CSV contains a column named <code>Ticket Code</code> (or <code>Unique Code</code>) and <code>Full Name</code> (or <code>Name</code>).
                  </p>
                </div>
              </div>
            )}

            {/* Summary Statistics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-white border-[2px] border-black rounded-xl text-center shadow-[2px_2px_0_0_#000]">
                <span className="text-[10px] font-black uppercase text-black/60 block">Total Rows</span>
                <span className="text-2xl font-black text-black">{preview.totalRows}</span>
              </div>
              <div className="p-3 bg-[#EEFBF3] border-[2px] border-[#34A853] rounded-xl text-center shadow-[2px_2px_0_0_#34A853]">
                <span className="text-[10px] font-black uppercase text-[#34A853] block">Valid & Ready</span>
                <span className="text-2xl font-black text-[#34A853]">{preview.validCount}</span>
              </div>
              <div className="p-3 bg-[#FFF5F5] border-[2px] border-[#EA4335] rounded-xl text-center shadow-[2px_2px_0_0_#EA4335]">
                <span className="text-[10px] font-black uppercase text-[#EA4335] block">Quarantined / Rejected</span>
                <span className="text-2xl font-black text-[#EA4335]">{preview.quarantinedCount}</span>
              </div>
              <div className="p-3 bg-[#EEF4FF] border-[2px] border-[#4285F4] rounded-xl text-center shadow-[2px_2px_0_0_#4285F4]">
                <span className="text-[10px] font-black uppercase text-[#4285F4] block">Flagship Dev Track</span>
                <span className="text-2xl font-black text-[#4285F4]">{preview.trackCounts?.['flagship-dev'] || 0}</span>
              </div>
            </div>

            {/* Responsive Live Data Preview Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-[#34A853]" />
                  Live Preview of First {preview.previewRows?.length || 0} Attendees
                </h3>
                <span className="text-[11px] font-bold text-black/60">
                  Showing first {preview.previewRows?.length} of {preview.totalRows} rows
                </span>
              </div>

              <div
                tabIndex="0"
                role="region"
                aria-label="Attendee CSV Preview Table"
                className="border-2 border-black rounded-xl overflow-x-auto bg-white shadow-[3px_3px_0_0_#000] max-h-96"
              >
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-[#FFF8E7] border-b-2 border-black font-black uppercase text-[10px] tracking-wider text-black z-10">
                    <tr>
                      <th className="p-2.5">Row</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5">Ticket Code</th>
                      <th className="p-2.5">Full Name (Display)</th>
                      <th className="p-2.5">Email</th>
                      <th className="p-2.5">Phone Number</th>
                      <th className="p-2.5">Track</th>
                      <th className="p-2.5">College / Org</th>
                      <th className="p-2.5">Role / Domain</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/10">
                    {preview.previewRows?.map((row, idx) => (
                      <tr key={idx} className={row.isValid ? 'hover:bg-[#FFFBF0]' : 'bg-[#FFF5F5] hover:bg-[#FFEAE8]'}>
                        <td className="p-2.5 font-mono font-bold text-black/60">{row.row}</td>
                        <td className="p-2.5">
                          {row.isValid ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-[#EEFBF3] text-[#34A853] border border-[#34A853]">
                              Valid
                            </span>
                          ) : (
                            <span
                              className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-[#FFF0F0] text-[#EA4335] border border-[#EA4335]"
                              title={row.quarantineReason}
                            >
                              Invalid
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 font-mono font-black text-black">
                          {row.uniqueCode ? (
                            <span className="px-2 py-0.5 rounded bg-black/5 border border-black/20">
                              {row.uniqueCode}
                            </span>
                          ) : (
                            <span className="text-[#EA4335] italic">Missing</span>
                          )}
                        </td>
                        <td className="p-2.5 font-bold text-black">
                          {row.name}
                          {row.displayName && (
                            <span className="block text-[10px] font-medium text-black/50">
                              Display: {row.displayName}
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 font-mono text-[11px] text-black/80">{row.email || '-'}</td>
                        <td className="p-2.5 font-mono text-[11px] text-black/80 font-bold">{row.phone || '-'}</td>
                        <td className="p-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${
                              row.trackId === 'flagship-dev'
                                ? 'bg-[#EEF4FF] text-[#4285F4] border-[#4285F4]'
                                : row.trackId === 'beginner-track'
                                ? 'bg-[#EEFBF3] text-[#34A853] border-[#34A853]'
                                : 'bg-[#FFF8E7] text-[#FBBC05] border-[#FBBC05]'
                            }`}
                          >
                            {row.rawTrack || row.trackId || 'all'}
                          </span>
                        </td>
                        <td className="p-2.5 text-black/80">{row.organization || '-'}</td>
                        <td className="p-2.5 text-black/80">{row.designation || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {preview.quarantineSamples?.length > 0 && (
                <div className="mt-3 p-3 bg-[#FFF5F5] border-2 border-[#EA4335] rounded-xl text-xs">
                  <h4 className="font-black text-[#EA4335] uppercase mb-1 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Quarantine Alerts ({preview.quarantinedCount} row{preview.quarantinedCount > 1 ? 's' : ''} will be quarantined)
                  </h4>
                  <ul className="list-disc pl-5 text-black/80 space-y-0.5">
                    {preview.quarantineSamples.map((q, idx) => (
                      <li key={idx}>
                        Row {q.row} ({q.uniqueCode}): {q.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Execute Import Action Buttons */}
            <div className="pt-4 border-t-2 border-black/10 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-black/70 font-semibold">
                Ready to commit <strong>{preview.validCount} attendees</strong> to Supabase database.
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Button variant="outline" size="md" onClick={handleReset} disabled={isImporting}>
                  Cancel
                </Button>

                <Button
                  variant="primary"
                  size="md"
                  disabled={isImporting || preview.missingRequired?.length > 0 || preview.validCount === 0}
                  onClick={handleExecuteImport}
                  className="w-full sm:w-auto"
                >
                  {isImporting ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin inline" />
                      Ingesting {preview.validCount} Attendees...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2 inline text-white" />
                      Confirm & Import {preview.validCount} Attendees
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* 3. Post-Import Success Report Card */}
      {importReport && (
        <Card surface="warmWhite" shadow="lg" border="thick" rounded="xl" className="p-6">
          <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-black/10">
            <h3 className="text-lg font-black text-black uppercase tracking-tight flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-[#34A853]" />
              Batch Ingestion Completed Successfully!
            </h3>
            {onSwitchToAttendees && (
              <Button variant="outline" size="sm" onClick={onSwitchToAttendees}>
                View in Directory <ArrowRight className="w-3.5 h-3.5 inline ml-1" />
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="p-3 bg-white border-[2px] border-black rounded-xl text-center shadow-[2px_2px_0_0_#000]">
              <span className="text-[10px] font-black uppercase text-black/60 block">Total Processed</span>
              <span className="text-2xl font-black text-black">{importReport.totalRows}</span>
            </div>
            <div className="p-3 bg-[#EEFBF3] border-[2px] border-[#34A853] rounded-xl text-center shadow-[2px_2px_0_0_#34A853]">
              <span className="text-[10px] font-black uppercase text-[#34A853] block">Imported to DB</span>
              <span className="text-2xl font-black text-[#34A853]">{importReport.importedCount}</span>
            </div>
            <div className="p-3 bg-[#FFF5F5] border-[2px] border-[#EA4335] rounded-xl text-center shadow-[2px_2px_0_0_#EA4335]">
              <span className="text-[10px] font-black uppercase text-[#EA4335] block">Quarantined</span>
              <span className="text-2xl font-black text-[#EA4335]">{importReport.quarantinedCount}</span>
            </div>
            <div className="p-3 bg-[#EEF4FF] border-[2px] border-[#4285F4] rounded-xl text-center shadow-[2px_2px_0_0_#4285F4]">
              <span className="text-[10px] font-black uppercase text-[#4285F4] block">Flagship Dev Track</span>
              <span className="text-2xl font-black text-[#4285F4]">{importReport.trackCounts?.['flagship-dev'] || 0}</span>
            </div>
          </div>

          {importReport.quarantined?.length > 0 && (
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-[#EA4335] mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                Quarantined Records ({importReport.quarantined.length})
              </h4>
              <div className="max-h-48 overflow-y-auto border-[2px] border-black rounded-xl bg-white shadow-[2px_2px_0_0_#000]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FFF8E7] border-b-2 border-black font-black uppercase text-[10px]">
                    <tr>
                      <th className="p-2">Row</th>
                      <th className="p-2">Ticket Code</th>
                      <th className="p-2">Quarantine Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importReport.quarantined.map((q, idx) => (
                      <tr key={idx} className="border-b border-black/10 hover:bg-[#FFF5F5]">
                        <td className="p-2 font-mono font-bold">{q.row}</td>
                        <td className="p-2 font-mono font-bold text-[#EA4335]">{q.uniqueCode || 'N/A'}</td>
                        <td className="p-2 text-black/80">{q.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
