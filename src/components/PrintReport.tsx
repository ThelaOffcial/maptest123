import React from 'react';
import { School, CategoryKey, CATEGORY_RULES } from '../data/schools';
import { SSCLogo } from './SSCLogo';
import { PrintMap } from './PrintMap';

interface PrintReportProps {
  applicationNo: string;
  childName: string;
  parentName?: string;
  parentNic: string;
  category: CategoryKey;
  distance: number | null;
  latitude: number | null;
  longitude: number | null;
  nearbySchools: School[];
  maxMarks: number;
  deduction: number;
  netMarks: number;
  isPreview?: boolean;
  // Education Category Specifics
  workplaceLocation?: { lat: number; lng: number } | null;
  workplaceName?: string;
  residenceRoadKm?: number | null;
  workplaceRoadKm?: number | null;
  residenceRoadMarks?: { marks: number; bracket: string };
  workplaceRoadMarks?: { marks: number; bracket: string };
  residenceRoadPath?: { lat: number; lng: number }[];
  workplaceRoadPath?: { lat: number; lng: number }[];
}

export function PrintReport({
  applicationNo,
  childName,
  parentName = '',
  parentNic,
  category,
  distance,
  latitude,
  longitude,
  nearbySchools,
  maxMarks,
  deduction,
  netMarks,
  isPreview = false,
  workplaceLocation,
  workplaceName = 'Applicant Workplace',
  residenceRoadKm,
  workplaceRoadKm,
  residenceRoadMarks,
  workplaceRoadMarks,
  residenceRoadPath = [],
  workplaceRoadPath = [],
}: PrintReportProps) {
  const currentDate = new Date().toLocaleString('en-LK', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const residence =
    latitude !== null && longitude !== null ? { lat: latitude, lng: longitude } : null;

  const isEducationCategory = category === 'Education';

  return (
    <div
      id={isPreview ? 'previewArea' : 'printArea'}
      className={`${isPreview ? 'p-6 bg-white text-black max-w-4xl mx-auto rounded-xl shadow-2xl one-page' : 'print-only p-0 text-black bg-white max-w-4xl mx-auto one-page'} font-sans leading-relaxed`}
    >
      {/* College Header */}
      <div className="flex items-center gap-5 border-b-2 border-[#12275e] pb-3 mb-3">
        <SSCLogo className="w-14 h-[4.5rem]" />
        <div className="flex-1">
          <div className="text-[11px] uppercase tracking-wider text-emerald-800 font-bold">
            GRADE 1 · NEW KIDS REGISTRATION
          </div>
          <h1 className="text-xl font-bold text-[#0b1f3a] leading-tight">
            Primary Section Admission — Distance Check Report
          </h1>
          <p className="text-sm font-semibold text-slate-800">
            Sri Sumangala College, Panadura (ශ්‍රී සුමංගල විද්‍යාලය, පාණදුර)
          </p>
          <p className="text-xs text-slate-600 mt-0.5">
            {isEducationCategory
              ? 'Ministry of Education Circular Compliant · Shortest Road Distance Verification System (Education Staff Category)'
              : 'Ministry of Education Circular Compliant · Straight-Line Great-Circle Geodetic Measurement'}
          </p>
        </div>
      </div>

      {/* Applicant Identification Box */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 bg-slate-50 border border-slate-300 rounded-lg p-3 text-xs mb-3">
        <div>
          <span className="block text-slate-500 font-semibold uppercase text-[10px]">Application No:</span>
          <span className="font-bold text-slate-900 text-sm">{applicationNo || '—'}</span>
        </div>
        <div>
          <span className="block text-slate-500 font-semibold uppercase text-[10px]">Child's Name:</span>
          <span className="font-semibold text-slate-900 truncate block">{childName || '—'}</span>
        </div>
        <div>
          <span className="block text-slate-500 font-semibold uppercase text-[10px]">Parent's Name:</span>
          <span className="font-semibold text-slate-900 truncate block">{parentName || '—'}</span>
        </div>
        <div>
          <span className="block text-slate-500 font-semibold uppercase text-[10px]">Parent / Guardian NIC:</span>
          <span className="font-semibold text-slate-900">{parentNic || '—'}</span>
        </div>
        <div>
          <span className="block text-slate-500 font-semibold uppercase text-[10px]">Category:</span>
          <span className="font-bold text-emerald-800">
            {category} {isEducationCategory ? '(අධ්‍යාපන ක්ෂේත්‍රයේ නිලධාරීන්)' : ''}
          </span>
        </div>
      </div>

      {/* MAP AREA */}
      <div className="mb-3 break-inside-avoid">
        <div className="flex items-center justify-between mb-1.5 px-0.5">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block"></span>
            {isEducationCategory
              ? 'Road Driving Distance Cadastral Verification Map Area'
              : 'Cadastral Distance Verification Map Area'}
          </h2>
          <span className="text-[11px] text-slate-500 font-medium">
            {isEducationCategory
              ? `Permanent Address & Workplace Shortest Road Routes to SSC`
              : `Circle Center: Applicant Residence · Radius: Distance to SSC (${distance ? `${distance.toFixed(0)}m` : '—'})`}
          </span>
        </div>

        {/* Render High-Fidelity Vector Print Map */}
        <PrintMap
          residence={residence}
          distance={distance}
          nearbySchools={nearbySchools}
          workplace={workplaceLocation}
          workplaceName={workplaceName}
          isEducationCategory={isEducationCategory}
          residenceRoadKm={residenceRoadKm}
          workplaceRoadKm={workplaceRoadKm}
          residenceRoadPath={residenceRoadPath}
          workplaceRoadPath={workplaceRoadPath}
        />
      </div>

      {/* Measurement and Marks Calculation Table */}
      <table className="w-full border-collapse text-xs mb-3 border border-slate-300 report-table">
        <tbody>
          <tr className="border-b border-slate-200 bg-slate-50">
            <td className="py-2 px-3 font-semibold text-slate-700 w-2/5">Sri Sumangala College Principal's Office Coordinates</td>
            <td className="py-2 px-3 text-slate-900 font-mono">6.710070° N, 79.914400° E (Principal's Office)</td>
          </tr>

          {isEducationCategory ? (
            /* EDUCATION ROAD DISTANCE SYSTEM ROWS */
            <>
              <tr className="border-b border-slate-200">
                <td className="py-2 px-3 font-semibold text-slate-700">Permanent Residence GPS Coordinates</td>
                <td className="py-2 px-3 text-slate-900 font-mono font-medium">
                  {latitude !== null && longitude !== null
                    ? `${latitude.toFixed(6)}° N, ${longitude.toFixed(6)}° E`
                    : 'Not Set'}
                </td>
              </tr>
              <tr className="border-b border-slate-200 bg-sky-50/60">
                <td className="py-2 px-3 font-bold text-sky-900">
                  1. Permanent Residence → School Shortest Road Distance
                </td>
                <td className="py-2 px-3 text-sky-950 font-bold text-xs font-mono">
                  {residenceRoadKm !== null && residenceRoadKm !== undefined
                    ? `${residenceRoadKm.toFixed(2)} km · Allocated: ${residenceRoadMarks?.marks ?? 0} / 10 Marks [${residenceRoadMarks?.bracket || ''}]`
                    : 'Awaiting permanent residence location'}
                </td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="py-2 px-3 font-semibold text-slate-700">Workplace Institution & GPS Coordinates</td>
                <td className="py-2 px-3 text-slate-900">
                  <span className="font-semibold block">{workplaceName}</span>
                  <span className="font-mono text-[11px] text-slate-600">
                    {workplaceLocation
                      ? `${workplaceLocation.lat.toFixed(6)}° N, ${workplaceLocation.lng.toFixed(6)}° E`
                      : 'Not Set'}
                  </span>
                </td>
              </tr>
              <tr className="border-b border-slate-200 bg-amber-50/60">
                <td className="py-2 px-3 font-bold text-amber-900">
                  2. Workplace → School Shortest Road Distance
                </td>
                <td className="py-2 px-3 text-amber-950 font-bold text-xs font-mono">
                  {workplaceRoadKm !== null && workplaceRoadKm !== undefined
                    ? `${workplaceRoadKm.toFixed(2)} km · Allocated: ${workplaceRoadMarks?.marks ?? 0} / 25 Marks [${workplaceRoadMarks?.bracket || ''}]`
                    : 'Awaiting workplace location'}
                </td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="py-2 px-3 font-semibold text-slate-700">Admission Category Allocated Marks</td>
                <td className="py-2 px-3 text-slate-900 font-medium">
                  Education Category · Maximum: <strong className="font-bold">35 Marks</strong> (10 Residence + 25 Workplace)
                </td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="py-2 px-3 font-semibold text-slate-700">Evaluation Method</td>
                <td className="py-2 px-3 text-slate-700">
                  Strictly shortest road distance (no aerial distance / circular boundary deductions).
                </td>
              </tr>
            </>
          ) : (
            /* STANDARD CATEGORIES ROWS */
            <>
              <tr className="border-b border-slate-200">
                <td className="py-2 px-3 font-semibold text-slate-700">Applicant Residence GPS Coordinates</td>
                <td className="py-2 px-3 text-slate-900 font-mono font-medium">
                  {latitude !== null && longitude !== null
                    ? `${latitude.toFixed(6)}° N, ${longitude.toFixed(6)}° E`
                    : 'Not Set'}
                </td>
              </tr>
              <tr className="border-b border-slate-200 bg-emerald-50/50">
                <td className="py-2 px-3 font-bold text-slate-800">Straight-Line Geodesic Distance</td>
                <td className="py-2 px-3 text-emerald-800 font-bold text-sm font-mono">
                  {distance !== null
                    ? `${distance.toFixed(1)} metres (${(distance / 1000).toFixed(3)} km)`
                    : '—'}
                </td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="py-2 px-3 font-semibold text-slate-700 align-top">
                  Schools Closer Than Sri Sumangala College ({nearbySchools.length})
                  <span className="block text-[10px] text-slate-500 font-normal">
                    (Located inside residence-centered circle)
                  </span>
                </td>
                <td className="py-2 px-3 text-slate-900">
                  {nearbySchools.length === 0 ? (
                    <span className="text-emerald-700 font-medium">None closer than SSC (0 deductions)</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 py-1">
                      {nearbySchools.map((school, idx) => (
                        <span
                          key={idx}
                          className="inline-block bg-orange-50 border border-orange-200 text-orange-900 px-2 py-0.5 rounded text-[11px]"
                        >
                          {idx + 1}. {school.en}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="py-2 px-3 font-semibold text-slate-700">Admission Category Allocated Marks</td>
                <td className="py-2 px-3 text-slate-900 font-medium">
                  {category} · Maximum: <strong className="font-bold">{maxMarks} Marks</strong>
                </td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="py-2 px-3 font-semibold text-slate-700">Deduction (Intermediate Schools)</td>
                <td className="py-2 px-3 text-red-600 font-semibold font-mono">
                  - {deduction} Marks ({nearbySchools.length} schools × {CATEGORY_RULES[category].perSchool} marks deduction)
                </td>
              </tr>
            </>
          )}

          <tr className="border-b-2 border-slate-900 bg-slate-100">
            <td className="py-2.5 px-3 font-bold text-slate-900 text-sm">Final Net Marks Obtained</td>
            <td className="py-2.5 px-3 text-emerald-800 font-bold text-lg font-mono">
              {netMarks} / {maxMarks} Marks
            </td>
          </tr>
          <tr>
            <td className="py-1.5 px-3 font-medium text-slate-500 text-[11px]">System Timestamp</td>
            <td className="py-1.5 px-3 text-slate-600 text-[11px] font-mono">{currentDate}</td>
          </tr>
        </tbody>
      </table>

      {/* Official Signatures & Seal Verification */}
      <div className="mt-4 pt-3 border-t border-slate-400 grid grid-cols-2 gap-8 text-xs break-inside-avoid">
        <div>
          <p className="text-slate-800 font-semibold mb-7">Parent / Guardian Signature:</p>
          <div className="border-b border-slate-400 w-4/5 mb-1"></div>
          <p className="text-[11px] text-slate-500">Name: ___________________________________</p>
          <p className="text-[11px] text-slate-500 mt-1">Date: ___________________________________</p>
        </div>
        <div>
          <p className="text-slate-800 font-semibold mb-7">Officer in Charge Verification:</p>
          <div className="border-b border-slate-400 w-4/5 mb-1"></div>
          <p className="text-[11px] text-slate-500">Signature & Official School Seal</p>
          <p className="text-[11px] text-slate-500 mt-1">Date: ___________________________________</p>
        </div>
      </div>

      {/* Official Footer with SSCICTS branding */}
      <div className="mt-3 pt-2 border-t border-slate-200 text-center text-[10px] text-slate-500 leading-tight">
        <div>Principal — W. T. Raweendra Pushpakumara · Sri Sumangala College, Panadura · © All rights reserved.</div>
        <div className="mt-1 font-semibold text-slate-700 flex items-center justify-center gap-1.5">
          <SSCLogo className="w-3.5 h-4 inline-block" />
          <span>Developed By <strong className="text-emerald-800 font-bold">SSCICTS</strong> (Sri Sumangala College ICT Society)</span>
        </div>
        <div className="text-[9px] text-slate-400 mt-0.5 font-normal">
          Developed By Samithu Dewapriya  0770613478
        </div>
      </div>
    </div>
  );
}
