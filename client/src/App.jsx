import { useEffect, useMemo, useRef, useState } from 'react';

const sample = "I'm a final-year B.Tech student from an EWS family in Andhra Pradesh. Our annual household income is ₹2.2 lakh.";
const steps = ['Tell us about you', 'Discover benefits', 'Review your draft', 'Track application'];
const label = (value) => value ? String(value).replace(/\b\w/g, (c) => c.toUpperCase()) : 'Not provided';

function Stepper({ stage }) {
  return <div className="mx-auto mb-8 flex max-w-3xl items-start justify-between px-1">
    {steps.map((step, index) => <div className="relative flex flex-1 flex-col items-center text-center" key={step}>
      {index < steps.length - 1 && <div className={`absolute left-1/2 top-4 h-0.5 w-full ${index < stage ? 'bg-indigo-600' : 'bg-slate-200'}`} />}
      <div className={`z-10 grid h-8 w-8 place-items-center rounded-full text-sm font-bold ${index <= stage ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>{index < stage ? '✓' : index + 1}</div>
      <span className={`mt-2 hidden text-xs font-medium sm:block ${index === stage ? 'text-indigo-700' : 'text-slate-500'}`}>{step}</span>
    </div>)}
  </div>;
}

function Header({ stage }) {
  return <>
    <div className="bg-slate-900 px-4 py-2 text-center text-xs font-medium text-slate-100">🔒 Sandbox Environment: Using mock data and simulated backend verification. No real personal identifiers or government API tokens are stored.</div>
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-600 text-xl text-white">⌁</div><div><h1 className="font-bold tracking-tight text-slate-900">SetuAI</h1><p className="text-xs text-slate-500">Welfare Navigator</p></div></div><span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">Step {stage + 1} of 4</span></div></header>
  </>;
}

function Intake({ intake, setIntake, onComplete }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function submit(e) {
    e.preventDefault(); setLoading(true); setError('');
    try { 
      const selectedState = new FormData(e.currentTarget).get('selectedState');
      const intakeWithState = selectedState ? `${intake}\nState / UT selected: ${selectedState}` : intake;
      const response = await fetch('/api/analyze-intake', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ intake: intakeWithState, selectedState }) }); 
      const responseText = await response.text();
      const data = responseText ? JSON.parse(responseText) : {};
      if (!response.ok) throw new Error(data.error || 'Unable to analyse your details.'); 
      onComplete(data); 
    }
    catch (err) { setError(err.message); } finally { setLoading(false); }
  }
  const states = 'Andhra Pradesh|Arunachal Pradesh|Assam|Bihar|Chhattisgarh|Goa|Gujarat|Haryana|Himachal Pradesh|Jharkhand|Karnataka|Kerala|Madhya Pradesh|Maharashtra|Manipur|Meghalaya|Mizoram|Nagaland|Odisha|Punjab|Rajasthan|Sikkim|Tamil Nadu|Telangana|Tripura|Uttar Pradesh|Uttarakhand|West Bengal|Andaman and Nicobar Islands|Chandigarh|Dadra and Nagar Haveli and Daman and Diu|Delhi|Jammu and Kashmir|Ladakh|Lakshadweep|Puducherry'.split('|');
  return <main className="mx-auto max-w-5xl px-5 py-10 sm:py-16"><div className="grid gap-10 lg:grid-cols-[1.1fr_.9fr] lg:items-center"><section><p className="mb-3 text-sm font-bold uppercase tracking-[.18em] text-indigo-600">One conversation. Clear next steps.</p><h2 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">Benefits should be easier to reach.</h2><p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">Tell SetuAI about your situation in your own words. We’ll turn it into a simple profile and surface relevant welfare schemes.</p><div className="mt-8 flex flex-wrap gap-3 text-sm text-slate-600"><span>✓ Plain-language guidance</span><span>✓ Mock eligibility check</span><span>✓ No data saved</span></div></section><form onSubmit={submit} className="card p-6 shadow-glow sm:p-8"><label className="text-sm font-bold text-slate-800" htmlFor="intake">Describe your background</label><textarea id="intake" value={intake} onChange={(e) => setIntake(e.target.value)} className="mt-3 h-40 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50" placeholder="For example, I am a student..." /><label className="mt-4 block text-sm font-bold text-slate-800" htmlFor="selectedState">State / UT <span className="font-normal text-slate-500">(optional)</span></label><select id="selectedState" name="selectedState" className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-slate-800 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"><option value="">All India — show every state</option>{states.map((state) => <option value={state} key={state}>{state}</option>)}</select><p className="mt-2 text-xs text-slate-500">Choose Telangana to see Telangana + Central + National/private opportunities only.</p>{error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}<button disabled={loading} className="btn-primary mt-6 w-full">{loading ? 'Analysing your profile…' : 'Find my matching schemes →'}</button><p className="mt-4 text-center text-xs text-slate-400">Demo data only — not a government service.</p></form></div></main>;
}

function Matches({ data, choose, back }) {
  const tags = [['Occupation', data.profile.occupation], ['Education', data.profile.education], ['State', data.profile.state], ['Category', data.profile.category], ['Income', data.profile.income ? `₹${Number(data.profile.income).toLocaleString('en-IN')} / year` : null]];
  data.schemes = data.schemes.filter((scheme) => {
    const rules = scheme.rules || {};
    const category = String(data.profile.category || '').toLowerCase();
    const occupation = String(data.profile.occupation || '').toLowerCase();
    if (rules.categories && (!category || !rules.categories.includes(category))) return false;
    if (rules.occupations && (!occupation || !rules.occupations.includes(occupation))) return false;
    if (rules.maxIncome && data.profile.income && Number(data.profile.income) > rules.maxIncome) return false;
    return true;
  });
  // Client-side guard: prevents unrelated state cards if a stale backend process returns them.
  if (data.profile.state) {
    const targetState = String(data.profile.state).trim().toLowerCase();
    data.schemes = data.schemes.filter((scheme) => {
      const level = String(scheme.level || '').toLowerCase();
      const provider = String(scheme.providerType || '').toLowerCase();
      const states = scheme.rules?.states || [];
      return level === 'central' || level === 'national' || provider === 'private' || level === targetState || states.some((state) => String(state).toLowerCase() === targetState);
    });
  }
  return <main className="mx-auto max-w-6xl px-5 py-10"><div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-[.18em] text-indigo-600">Your benefit map</p><h2 className="mt-2 text-3xl font-bold text-slate-900">Potential matches for you</h2><p className="mt-2 text-slate-600">We checked the details you shared against our mock scheme rules.</p></div><button onClick={back} className="text-sm font-semibold text-indigo-700 hover:text-indigo-900">← Edit details</button></div><div className="mb-8 flex flex-wrap gap-2">{tags.map(([key, value]) => <span className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-sm text-indigo-800" key={key}><span className="font-semibold">{key}:</span> {label(value)}</span>)}</div><div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{data.schemes.map((scheme) => <article className="card flex flex-col p-6" key={scheme.id}><div className="flex items-start justify-between gap-3"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{scheme.level}</span><span className="text-xl">{scheme.accent === 'teal' ? '✦' : scheme.accent === 'amber' ? '☀' : '◆'}</span></div><h3 className="mt-5 text-xl font-bold leading-7 text-slate-900">{scheme.title}</h3><p className="mt-2 text-sm text-slate-500">{scheme.department}</p><div className="mt-5 rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Benefit</p><p className="mt-1 text-sm leading-6 text-slate-700">{scheme.benefit}</p></div><button onClick={() => choose(scheme)} className="btn-primary mt-6 w-full">Auto-Fill & Apply</button></article>)}</div>{!data.schemes.length && <div className="card p-10 text-center"><p className="text-xl font-bold">No close matches yet</p><p className="mt-2 text-slate-600">Try adding your occupation, state, category, or annual income.</p></div>}</main>;
}

function Draft({ scheme, profile, submit, back }) {
  const rows = [['Applicant name', 'Citizen of SetuAI (demo)'], ['Occupation', label(profile.occupation)], ['State / UT', label(profile.state)], ['Social category', label(profile.category)], ['Annual household income', profile.income ? `₹${Number(profile.income).toLocaleString('en-IN')}` : 'To be confirmed']];
  const originalSubmit = submit;
  const officialPortal = scheme.sourceUrl || (String(scheme.type || '').toLowerCase().includes('scholarship') ? 'https://scholarships.gov.in/' : null);
  submit = () => {
    if (officialPortal) window.open(officialPortal, '_blank', 'noopener,noreferrer');
    originalSubmit();
  };
  return <main className="mx-auto max-w-4xl px-5 py-10"><button onClick={back} className="mb-6 text-sm font-semibold text-indigo-700">← Back to matches</button><div className="card overflow-hidden"><div className="bg-indigo-700 px-6 py-7 text-white sm:px-8"><p className="text-sm font-semibold text-indigo-100">Application draft · sandbox preview</p><h2 className="mt-1 text-2xl font-bold">{scheme.title}</h2><p className="mt-2 text-sm text-indigo-100">Your data is mapped into a simulated official form.</p></div><div className="grid gap-8 p-6 sm:p-8 md:grid-cols-[1.2fr_.8fr]"><section><h3 className="font-bold text-slate-900">Auto-filled applicant details</h3><dl className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-200">{rows.map(([key, value]) => <div className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:justify-between" key={key}><dt className="text-sm text-slate-500">{key}</dt><dd className="text-sm font-semibold text-slate-800">{value}</dd></div>)}</dl></section><aside><h3 className="font-bold text-slate-900">Mock attachments</h3><p className="mt-1 text-sm text-slate-500">Pre-validated for this demo</p><ul className="mt-4 space-y-3">{scheme.attachments.map((item) => <li className="flex gap-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800" key={item}><span className="font-bold">✓</span><span><b>Verified</b><br />{item}</span></li>)}</ul></aside></div><div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 p-6 sm:flex-row sm:justify-end"><button onClick={back} className="btn border border-slate-300 bg-white text-slate-700">Cancel</button><button onClick={submit} className="btn-primary">Submit simulated application →</button></div></div></main>;
}

function Tracker({ scheme, reset }) {
  const trackingId = useMemo(() => `SETU-2026-${Math.floor(1000 + Math.random() * 9000)}`, []);
  const entries = [['Application drafted', 'Your information was mapped to the scheme form.', true], ['Mock verification', 'Required attachments passed sandbox checks.', true], ['Submitted to simulator', 'This is a simulated submission — no government portal was contacted.', true], ['Decision update', 'You’ll see a status update here in a real integration.', false]];
  return <main className="mx-auto max-w-3xl px-5 py-10 text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-3xl text-emerald-700">✓</div><p className="mt-5 text-sm font-bold uppercase tracking-[.18em] text-emerald-700">Submission simulated</p><h2 className="mt-2 text-3xl font-bold text-slate-900">You’re all set.</h2><p className="mt-3 text-slate-600">Your draft for <b>{scheme.title}</b> has entered the SetuAI sandbox tracker.</p><div className="mx-auto mt-6 inline-block rounded-2xl border border-indigo-100 bg-indigo-50 px-6 py-4"><p className="text-xs font-bold uppercase tracking-wider text-indigo-500">Mock tracking ID</p><p className="mt-1 font-mono text-2xl font-bold text-indigo-800">{trackingId}</p></div><div className="card mx-auto mt-8 max-w-xl p-6 text-left"><h3 className="font-bold text-slate-900">Application journey</h3><ol className="mt-6 space-y-0">{entries.map(([title, text, done], index) => <li className="relative flex gap-4 pb-7 last:pb-0" key={title}>{index < entries.length - 1 && <span className="absolute left-[14px] top-8 h-[calc(100%-16px)] w-px bg-slate-200" />}<span className={`z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${done ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>{done ? '✓' : index + 1}</span><div><p className="font-semibold text-slate-800">{title}</p><p className="mt-1 text-sm leading-5 text-slate-500">{text}</p></div></li>)}</ol></div><button onClick={reset} className="btn-primary mt-8">Start another search</button></main>;
}

export default function App() {
  const [stage, setStage] = useState(0); 
  const [data, setData] = useState(null); 
  const [scheme, setScheme] = useState(null);
  const isBrowserBack = useRef(false);
  const [intake, setIntake] = useState("I'm a final-year B.Tech student from an EWS family in Andhra Pradesh. Our annual household income is ₹2.2 lakh.");

  useEffect(() => {
    const onPopState = (event) => {
      isBrowserBack.current = true;
      setStage(event.state?.setuStage ?? 0);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (isBrowserBack.current) { isBrowserBack.current = false; return; }
    window.history.pushState({ setuStage: stage }, '', `#step-${stage + 1}`);
  }, [stage]);

  const begin = (result) => { setData(result); setStage(1); };
  const reset = () => { setStage(0); setData(null); setScheme(null); };

  return <><Header stage={stage} /><div className="bg-gradient-to-b from-indigo-50/70 to-slate-50"><Stepper stage={stage} />{stage === 0 && <Intake intake={intake} setIntake={setIntake} onComplete={begin} />}{stage === 1 && <Matches data={data} choose={(chosen) => { setScheme(chosen); setStage(2); }} back={reset} />}{stage === 2 && <Draft scheme={scheme} profile={data.profile} submit={() => setStage(3)} back={() => setStage(1)} />}{stage === 3 && <Tracker scheme={scheme} reset={reset} />}</div></>;
}
