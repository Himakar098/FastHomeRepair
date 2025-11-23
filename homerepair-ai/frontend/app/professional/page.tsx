// homerepair-ai/frontend/app/professional/page.tsx
//
// Professional onboarding form rebuilt for the Lawpath-style SaaS UI.

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useHttp } from '../../src/api/http';
import { useAccessToken } from '../../src/hooks/useAccessToken';

type ProProfile = {
  businessName?: string;
  phone?: string | null;
  website?: string | null;
  state?: string;
  serviceAreas?: string[];
  services?: string[];
  abn?: string | null;
  tradeQualifications?: string[];
  certifications?: string[];
  licenceNumbers?: string[];
  yearsExperience?: number | null;
  insuranceProvider?: string | null;
  insurancePolicyNumber?: string | null;
  insuranceExpiry?: string | null;
  verificationStatus?: string;
};

const STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT'];

export default function ProfessionalPage() {
  const { post } = useHttp();
  const { signedIn, getToken } = useAccessToken();
  const [profile, setProfile] = useState<ProProfile>({
    businessName: '',
    state: 'QLD',
    serviceAreas: [],
    services: [],
    tradeQualifications: [],
    certifications: [],
    licenceNumbers: [],
    yearsExperience: 1,
    insuranceProvider: '',
    insurancePolicyNumber: '',
    insuranceExpiry: ''
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [areasInput, setAreasInput] = useState('');
  const [servicesInput, setServicesInput] = useState('');
  const [qualificationsInput, setQualificationsInput] = useState('');
  const [certificationsInput, setCertificationsInput] = useState('');
  const [licenceInput, setLicenceInput] = useState('');
  const [experienceInput, setExperienceInput] = useState('1');
  const [insuranceProviderInput, setInsuranceProviderInput] = useState('');
  const [insurancePolicyInput, setInsurancePolicyInput] = useState('');
  const [insuranceExpiryInput, setInsuranceExpiryInput] = useState('');

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    try {
      const token = await getToken({ forceLogin: true });
      if (!token) {
        throw new Error('No auth token');
      }
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/api/get-profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data?.professional) {
        setProfile({ ...data.professional });
        setAreasInput((data.professional.serviceAreas || []).join(', '));
        setServicesInput((data.professional.services || []).join(', '));
        setQualificationsInput((data.professional.tradeQualifications || []).join(', '));
        setCertificationsInput((data.professional.certifications || []).join(', '));
        setLicenceInput((data.professional.licenceNumbers || []).join(', '));
        setExperienceInput(data.professional.yearsExperience ? String(data.professional.yearsExperience) : '');
        setInsuranceProviderInput(data.professional.insuranceProvider || '');
        setInsurancePolicyInput(data.professional.insurancePolicyNumber || '');
        setInsuranceExpiryInput(data.professional.insuranceExpiry || '');
      }
    } catch {
      setMsg('Failed to load professional profile');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (signedIn) loadProfile();
  }, [signedIn, loadProfile]);

  function parseCommaList(raw: string): string[] {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      const body = {
        businessName: profile.businessName?.trim(),
        phone: profile.phone ? profile.phone.trim() : undefined,
        website: profile.website ? profile.website.trim() : undefined,
        state: profile.state,
        serviceAreas: parseCommaList(areasInput),
        services: parseCommaList(servicesInput),
        tradeQualifications: parseCommaList(qualificationsInput),
        certifications: parseCommaList(certificationsInput),
        licenceNumbers: parseCommaList(licenceInput),
        yearsExperience: experienceInput ? Number(experienceInput) : undefined,
        insuranceProvider: insuranceProviderInput.trim(),
        insurancePolicyNumber: insurancePolicyInput ? insurancePolicyInput.trim() : undefined,
        insuranceExpiry: insuranceExpiryInput || undefined,
        abn: profile.abn ? profile.abn.replace(/\s+/g, '') : undefined
      };
      await post('/api/register-professional', body);
      setMsg('Profile saved');
    } catch (err) {
      const errorMessage =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : null;
      setMsg(errorMessage || 'Save failed');
    } finally {
      setLoading(false);
      loadProfile();
    }
  }

  if (!signedIn) {
    return (
      <div className="space-y-6">
        <section className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.5em] text-slate-500">Professional Network</p>
          <h2 className="mt-4 text-3xl font-semibold text-slate-900">Sign in to register your business</h2>
          <p className="mt-3 text-sm text-slate-600">
            Verified pros get routed to urgent jobs once we confirm ABN, licences, and insurance.
          </p>
        </section>
      </div>
    );
  }

  const verificationLabel = profile.verificationStatus
    ? profile.verificationStatus.replace(/_/g, ' ')
    : 'pending review';

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-100 bg-white p-8 shadow-lg shadow-slate-200/70">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.5em] text-[#0D47A1]/70">Professional Network</p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900">Business compliance profile</h1>
            <p className="mt-2 text-sm text-slate-600">
              Submit credentials so we can surface your team whenever a customer needs specialised help.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: 'Services', value: (profile.services?.length || 0).toString().padStart(2, '0') },
              { label: 'State', value: profile.state || 'TBC' },
              { label: 'Verification', value: verificationLabel }
            ].map((metric) => (
              <div key={metric.label} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="text-base font-semibold text-slate-900">{metric.value}</p>
                <p className="text-xs uppercase tracking-[0.4em] text-slate-500">{metric.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow">
          <form className="space-y-8" onSubmit={onSubmit}>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-500">Business identity</p>
              <h3 className="mt-1 text-xl font-semibold text-slate-900">Core details</h3>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">
                Business name
                <input
                  type="text"
                  value={profile.businessName || ''}
                  onChange={(e) => setProfile((p) => ({ ...p, businessName: e.target.value }))}
                  required
                  maxLength={150}
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                State
                <select
                  value={profile.state || 'QLD'}
                  onChange={(e) => setProfile((p) => ({ ...p, state: e.target.value }))}
                  required
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
                >
                  {STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold text-slate-700 md:col-span-2">
                Service areas (comma-separated)
                <input
                  type="text"
                  value={areasInput}
                  onChange={(e) => setAreasInput(e.target.value)}
                  placeholder="Brisbane CBD, South Brisbane, Fortitude Valley"
                  required
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700 md:col-span-2">
                Services offered (comma-separated)
                <input
                  type="text"
                  value={servicesInput}
                  onChange={(e) => setServicesInput(e.target.value)}
                  placeholder="plumbing, carpentry, painting"
                  required
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Phone
                <input
                  type="tel"
                  value={profile.phone || ''}
                  onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="+61 4XX XXX XXX"
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Website
                <input
                  type="url"
                  value={profile.website || ''}
                  onChange={(e) => setProfile((p) => ({ ...p, website: e.target.value }))}
                  placeholder="https://example.com"
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700 md:col-span-2">
                ABN
                <input
                  type="text"
                  value={profile.abn || ''}
                  onChange={(e) => setProfile((p) => ({ ...p, abn: e.target.value }))}
                  placeholder="12 345 678 910"
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
                />
              </label>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-500">Credentials</p>
              <h3 className="mt-1 text-xl font-semibold text-slate-900">Compliance & insurance</h3>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700 md:col-span-2">
                Trade qualifications
                <input
                  type="text"
                  value={qualificationsInput}
                  onChange={(e) => setQualificationsInput(e.target.value)}
                  placeholder="Certificate III in Plumbing, QBCC Qualified Supervisor"
                  required
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
                />
                <small className="text-xs text-slate-500">Comma separate for multiple items.</small>
              </label>
              <label className="text-sm font-semibold text-slate-700 md:col-span-2">
                Certifications / memberships
                <input
                  type="text"
                  value={certificationsInput}
                  onChange={(e) => setCertificationsInput(e.target.value)}
                  placeholder="Master Plumbers QLD, Working at Heights"
                  required
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700 md:col-span-2">
                Licence numbers
                <input
                  type="text"
                  value={licenceInput}
                  onChange={(e) => setLicenceInput(e.target.value)}
                  placeholder="QBCC 1234567, ARCtick AU98765"
                  required
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Years of experience
                <input
                  type="number"
                  min={1}
                  max={80}
                  value={experienceInput}
                  onChange={(e) => setExperienceInput(e.target.value)}
                  required
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Insurance expiry (YYYY-MM)
                <input
                  type="month"
                  value={insuranceExpiryInput}
                  onChange={(e) => setInsuranceExpiryInput(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Insurance provider
                <input
                  type="text"
                  value={insuranceProviderInput}
                  onChange={(e) => setInsuranceProviderInput(e.target.value)}
                  placeholder="QBE Insurance"
                  required
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Insurance policy number
                <input
                  type="text"
                  value={insurancePolicyInput}
                  onChange={(e) => setInsurancePolicyInput(e.target.value)}
                  placeholder="POL-1234567"
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center rounded-full bg-[#0D47A1] px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#0D47A1]/30 transition hover:-translate-y-0.5 disabled:opacity-60"
              >
                {loading ? 'Saving…' : 'Save profile'}
              </button>
              {msg && <span className="text-sm font-semibold text-slate-600">{msg}</span>}
            </div>
          </form>
        </section>

        <aside className="space-y-4 rounded-3xl border border-slate-100 bg-white p-6 shadow">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-500">Review checklist</p>
          <h3 className="text-lg font-semibold text-slate-900">What we look for</h3>
          <ul className="space-y-3">
            {[
              {
                label: 'ABN & licences',
                description: 'Must be valid and match the business name above.',
                complete: Boolean(profile.abn),
                value: profile.abn ? 'Provided' : 'Missing'
              },
              {
                label: 'Insurance',
                description: 'Public liability cover with an active expiry date.',
                complete: Boolean(insuranceProviderInput),
                value: insuranceProviderInput ? 'On file' : 'Required'
              },
              {
                label: 'Service areas',
                description: 'List suburbs/regions you can reach within 48 hours.',
                complete: Boolean(areasInput),
                value: areasInput ? `${areasInput.split(',').length} areas` : 'Required'
              }
            ].map((item) => (
              <li key={item.label} className="flex items-start justify-between rounded-2xl border border-slate-100 px-4 py-3">
                <div className="pr-4">
                  <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                  <p className="text-xs text-slate-500">{item.description}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    item.complete ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {item.value}
                </span>
              </li>
            ))}
          </ul>
          <div className="rounded-2xl border border-dashed border-[#0D47A1]/40 bg-[#E8F1FF] p-4 text-sm text-[#0D47A1]">
            Need help? Email compliance@homerepair.ai with your licence pack if you&#39;d prefer manual onboarding.
          </div>
        </aside>
      </div>
    </div>
  );
}
