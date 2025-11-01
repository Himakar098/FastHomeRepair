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
    return <div style={{ padding: 16 }}><p>Please sign in to manage your professional profile.</p></div>;
  }

  return (
    <div style={{ padding: 16, maxWidth: 640 }}>
      <h2>Professional Profile</h2>
      <p style={{ marginBottom: 16 }}>
        HomeRepairAI verifies every professional application. To protect homeowners, we require
        evidence of Australian trade qualifications, current certifications, valid licences,
        years of experience and active insurance coverage. Profiles remain in
        <strong> pending review</strong> until our team confirms these details.
      </p>
      <form onSubmit={onSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="businessName">Business name</label><br />
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
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="state">State</label><br />
          <select
            id="state"
            name="state"
            value={profile.state || 'QLD'}
            onChange={(e) => setProfile(p => ({ ...p, state: e.target.value }))}
            required
          >
            {STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="serviceAreas">Service areas (comma-separated)</label><br />
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
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="services">Services offered (comma-separated)</label><br />
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
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="qualifications">Trade qualifications (comma-separated)</label><br />
          <input
            id="qualifications"
            name="qualifications"
            type="text"
            value={qualificationsInput}
            onChange={(e) => setQualificationsInput(e.target.value)}
            placeholder="Certificate III in Plumbing, QBCC Qualified Supervisor"
            required
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="certifications">Certifications / memberships (comma-separated)</label><br />
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
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="licences">Licence numbers (comma-separated)</label><br />
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
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="experience">Years of experience</label><br />
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
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="phone">Phone</label><br />
          <input
            id="phone"
            name="phone"
            type="tel"
            value={profile.phone || ''}
            onChange={(e) => setProfile(p => ({ ...p, phone: e.target.value }))}
            placeholder="+61 4XX XXX XXX"
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="website">Website</label><br />
          <input
            id="website"
            name="website"
            type="url"
            value={profile.website || ''}
            onChange={(e) => setProfile(p => ({ ...p, website: e.target.value }))}
            placeholder="https://example.com"
            required
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="insuranceProvider">Insurance provider (public liability)</label><br />
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
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="insurancePolicy">Insurance policy number (optional)</label><br />
          <input
            id="insurancePolicy"
            name="insurancePolicy"
            type="text"
            value={insurancePolicyInput}
            onChange={(e) => setInsurancePolicyInput(e.target.value)}
            placeholder="POL-1234567"
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="insuranceExpiry">Insurance expiry (YYYY-MM, optional)</label><br />
          <input
            id="insuranceExpiry"
            name="insuranceExpiry"
            type="month"
            value={insuranceExpiryInput}
            onChange={(e) => setInsuranceExpiryInput(e.target.value)}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="abn">ABN (11 digits)</label><br />
          <input
            id="abn"
            name="abn"
            type="text"
            value={profile.abn || ''}
            onChange={(e) => setProfile(p => ({ ...p, abn: e.target.value }))}
            placeholder="12345678901"
            required
          />
        </div>
        {profile.verificationStatus && (
          <div style={{ marginBottom: 12, padding: '8px 12px', background: '#f2f6ff', border: '1px solid #d0dcff', borderRadius: 4 }}>
            <strong>Status:</strong> {profile.verificationStatus === 'approved' ? 'Approved' : profile.verificationStatus.replace('_', ' ')}
          </div>
        )}
        <button type="submit" disabled={loading}>{loading ? 'Saving…' : 'Save'}</button>
      </form>
      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
    </div>
  );
}
