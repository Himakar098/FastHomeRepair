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

const STATES = ['NSW','VIC','QLD','WA','SA','TAS','NT','ACT'];

/**
 * ProfessionalPage
 *
 * This page allows a signed‑in professional to manage their profile.
 * In addition to the original fields (business name, state, service
 * areas, phone, website and ABN), it now captures a list of
 * services offered by the business (e.g. plumbing, electrical) so
 * that the service matcher can find them based on user queries.
 */
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
    } catch (e: any) {
      setMsg('Failed to load professional profile');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (signedIn) loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, loadProfile]);

  function parseCommaList(raw: string): string[] {
    return raw
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .slice(0, 20);
  }

  async function onSubmit(e: React.FormEvent) {
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
      setMsg('Saved!');
  } catch (err: any) {
    setMsg(err?.response?.data?.error || 'Save failed');
  } finally {
    setLoading(false);
  }
  }

  if (!signedIn) {
    return (
      <div className="page-shell">
        <section className="page-card primary centered">
          <p className="eyebrow">Professional Network</p>
          <h2>Sign in to register your business</h2>
          <p>Verified pros get routed to urgent jobs once we confirm ABN, licences and insurance.</p>
        </section>
      </div>
    );
  }

  const verificationLabel = profile.verificationStatus
    ? profile.verificationStatus.replace(/_/g, ' ')
    : 'pending review';

  return (
    <div className="page-shell">
      <header className="page-card primary">
        <p className="eyebrow">Professional Network</p>
        <div className="page-header__row">
          <div>
            <h1>Business Compliance Profile</h1>
            <p>Submit credentials so we can surface your team whenever a customer needs specialised help.</p>
          </div>
          <div className="page-metrics">
            <div>
              <span className="metric-value">{(profile.services?.length || 0).toString().padStart(2, '0')}</span>
              <span className="metric-label">Services</span>
            </div>
            <div>
              <span className="metric-value">{profile.state || 'TBC'}</span>
              <span className="metric-label">State</span>
            </div>
            <div>
              <span className="metric-value">{verificationLabel}</span>
              <span className="metric-label">Verification</span>
            </div>
          </div>
        </div>
      </header>

      <div className="page-grid two-columns">
        <section className="page-card primary">
          <form className="form-grid" onSubmit={onSubmit}>
            <div className="section-heading">
              <div>
                <p className="eyebrow">Business identity</p>
                <h3>Core details</h3>
              </div>
            </div>
            <div className="form-field">
              <label htmlFor="businessName">Business name</label>
              <input
                id="businessName"
                name="businessName"
                type="text"
                value={profile.businessName || ''}
                onChange={(e) => setProfile(p => ({ ...p, businessName: e.target.value }))}
                required
                maxLength={150}
              />
            </div>
            <div className="form-field">
              <label htmlFor="state">State</label>
              <select
                id="state"
                name="state"
                value={profile.state || 'QLD'}
                onChange={(e) => setProfile(p => ({ ...p, state: e.target.value }))}
                required
              >
                {STATES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="serviceAreas">Service areas (comma-separated)</label>
              <input
                id="serviceAreas"
                name="serviceAreas"
                type="text"
                value={areasInput}
                onChange={(e) => setAreasInput(e.target.value)}
                placeholder="Brisbane CBD, South Brisbane, Fortitude Valley"
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="services">Services offered (comma-separated)</label>
              <input
                id="services"
                name="services"
                type="text"
                value={servicesInput}
                onChange={(e) => setServicesInput(e.target.value)}
                placeholder="plumbing, carpentry, painting"
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="phone">Phone</label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={profile.phone || ''}
                onChange={(e) => setProfile(p => ({ ...p, phone: e.target.value }))}
                placeholder="+61 4XX XXX XXX"
              />
            </div>
            <div className="form-field">
              <label htmlFor="website">Website</label>
              <input
                id="website"
                name="website"
                type="url"
                value={profile.website || ''}
                onChange={(e) => setProfile(p => ({ ...p, website: e.target.value }))}
                placeholder="https://example.com"
              />
            </div>
            <div className="form-field">
              <label htmlFor="abn">ABN</label>
              <input
                id="abn"
                name="abn"
                type="text"
                value={profile.abn || ''}
                onChange={(e) => setProfile(p => ({ ...p, abn: e.target.value }))}
                placeholder="12 345 678 910"
              />
            </div>

            <div className="section-heading">
              <div>
                <p className="eyebrow">Credentials</p>
                <h3>Compliance & insurance</h3>
              </div>
            </div>
            <div className="form-field">
              <label htmlFor="qualifications">Trade qualifications</label>
              <input
                id="qualifications"
                name="qualifications"
                type="text"
                value={qualificationsInput}
                onChange={(e) => setQualificationsInput(e.target.value)}
                placeholder="Certificate III in Plumbing, QBCC Qualified Supervisor"
                required
              />
              <small>Comma separate for multiple items.</small>
            </div>
            <div className="form-field">
              <label htmlFor="certifications">Certifications / memberships</label>
              <input
                id="certifications"
                name="certifications"
                type="text"
                value={certificationsInput}
                onChange={(e) => setCertificationsInput(e.target.value)}
                placeholder="Master Plumbers QLD, Working at Heights"
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="licences">Licence numbers</label>
              <input
                id="licences"
                name="licences"
                type="text"
                value={licenceInput}
                onChange={(e) => setLicenceInput(e.target.value)}
                placeholder="QBCC 1234567, ARCtick AU98765"
                required
              />
            </div>
            <div className="form-field inline">
              <div>
                <label htmlFor="experience">Years of experience</label>
                <input
                  id="experience"
                  name="experience"
                  type="number"
                  min={1}
                  max={80}
                  value={experienceInput}
                  onChange={(e) => setExperienceInput(e.target.value)}
                  required
                />
              </div>
              <div>
                <label htmlFor="insuranceExpiry">Insurance expiry (YYYY-MM)</label>
                <input
                  id="insuranceExpiry"
                  name="insuranceExpiry"
                  type="month"
                  value={insuranceExpiryInput}
                  onChange={(e) => setInsuranceExpiryInput(e.target.value)}
                />
              </div>
            </div>
            <div className="form-field">
              <label htmlFor="insuranceProvider">Insurance provider</label>
              <input
                id="insuranceProvider"
                name="insuranceProvider"
                type="text"
                value={insuranceProviderInput}
                onChange={(e) => setInsuranceProviderInput(e.target.value)}
                placeholder="QBE Insurance"
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="insurancePolicy">Insurance policy number</label>
              <input
                id="insurancePolicy"
                name="insurancePolicy"
                type="text"
                value={insurancePolicyInput}
                onChange={(e) => setInsurancePolicyInput(e.target.value)}
                placeholder="POL-1234567"
              />
            </div>
            <div className="form-actions">
              <button type="submit" disabled={loading}>
                {loading ? 'Saving…' : 'Save profile'}
              </button>
              {msg && <span className="form-status">{msg}</span>}
            </div>
          </form>
        </section>

        <aside className="page-card secondary">
          <p className="eyebrow">Review checklist</p>
          <h3>What we look for</h3>
          <ul className="status-list vertical">
            <li>
              <div className="status-info">
                <span className="status-icon">🧾</span>
                <div>
                  <strong>ABN & licences</strong>
                  <p>Must be valid and match the business name above.</p>
                </div>
              </div>
              <span className={`status-chip ${profile.abn ? 'good' : 'idle'}`}>
                {profile.abn ? 'Provided' : 'Missing'}
              </span>
            </li>
            <li>
              <div className="status-info">
                <span className="status-icon">🛡️</span>
                <div>
                  <strong>Insurance</strong>
                  <p>Public liability cover with an active expiry date.</p>
                </div>
              </div>
              <span className={`status-chip ${insuranceProviderInput ? 'good' : 'idle'}`}>
                {insuranceProviderInput ? 'On file' : 'Required'}
              </span>
            </li>
            <li>
              <div className="status-info">
                <span className="status-icon">📍</span>
                <div>
                  <strong>Service areas</strong>
                  <p>List suburbs/regions you can reach within 48 hours.</p>
                </div>
              </div>
              <span className={`status-chip ${areasInput ? 'good' : 'idle'}`}>
                {areasInput ? `${areasInput.split(',').length} areas` : 'Required'}
              </span>
            </li>
          </ul>
          <div className="status-callout">
            <h4>Need help?</h4>
            <p>Email compliance@homerepair.ai with your licence pack if you&apos;d prefer manual onboarding.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
