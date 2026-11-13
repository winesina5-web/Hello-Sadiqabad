import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Cloud,
  Crown,
  Eye,
  Lock,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  Save,
  Send,
  Store,
  X,
} from 'lucide-react';
import type {
  AreaRow,
  BusinessRow,
  CategoryRow,
  OpeningHoursJson,
  PlanRow,
} from '../../types/database';
import type { BusinessPublicView } from '../../types/directory';
import { effectivePlanCode } from '../../lib/searchFilter';
import { isValidHttpsUrl, normalizePkPhone } from '../../lib/phone';
import { validateOpeningHoursRanges } from '../../lib/hours';
import { Badge, Card } from '../ui/Surface';
import { Button } from '../ui/Button';
import { Input, Select, Textarea } from '../ui/FormFields';
import { ImageWithFallback } from '../ui/ImageWithFallback';
import { useToast } from '../ui/Toast';
import { HoursEditor } from './HoursEditor';
import { LocationPicker } from './LocationPicker';
import { UrlListEditor } from './UrlListEditor';

type WizardStep = 'basic' | 'location' | 'media' | 'preview';

const STEPS: Array<{ id: WizardStep; num: number; label: string; ur: string }> = [
  { id: 'basic', num: 1, label: 'Basic & Contact', ur: 'بنیادی معلومات' },
  { id: 'location', num: 2, label: 'Location & Hours', ur: 'مقام اور اوقات' },
  { id: 'media', num: 3, label: 'Media & Services', ur: 'میڈیا اور سہولیات' },
  { id: 'preview', num: 4, label: 'Preview & Submit', ur: 'جائزہ' },
];

const QUICK_AMENITIES: Array<{ en: string; ur: string }> = [
  { en: 'Home Delivery', ur: 'ہوم ڈلیوری' },
  { en: 'Air Conditioned', ur: 'ایئر کنڈیشنڈ' },
  { en: 'Generator Backup', ur: 'جنریٹر بیک اپ' },
  { en: 'Cards / Raast Accepted', ur: 'کارڈز / راست / ایزی پیسہ' },
  { en: 'Wholesale Rates', ur: 'ہول سیل نرخ' },
  { en: 'Family Hall / Seating', ur: 'فیملی ہال' },
  { en: '24/7 Support', ur: '24 گھنٹے سروس' },
];

function buildInitialForm(business: BusinessPublicView): Partial<BusinessRow> {
  return {
    name_en: business.name_en,
    name_ur: business.name_ur ?? '',
    category_id: business.category_id,
    area_id: business.area_id ?? '',
    description_en: business.description_en ?? '',
    description_ur: business.description_ur ?? '',
    established_year: business.established_year ?? undefined,
    owner_name: business.owner_name ?? '',
    owner_photo_url: business.owner_photo_url ?? '',
    phone_primary: business.phone_primary,
    phone_secondary: business.phone_secondary ?? '',
    whatsapp: business.whatsapp ?? '',
    email: business.email ?? '',
    website_url: business.website_url ?? '',
    address_en: business.address_en ?? '',
    address_ur: business.address_ur ?? '',
    landmark_en: business.landmark_en ?? '',
    landmark_ur: business.landmark_ur ?? '',
    lat: business.lat,
    lng: business.lng,
    opening_hours: business.opening_hours ?? {},
    is_open_24h: business.is_open_24h,
    home_delivery: business.home_delivery,
    logo_url: business.logo_url ?? '',
    cover_url: business.cover_url ?? '',
    gallery_urls: business.gallery_urls ?? [],
    video_urls: business.video_urls ?? [],
    facebook_url: business.facebook_url ?? '',
    instagram_url: business.instagram_url ?? '',
    youtube_url: business.youtube_url ?? '',
    tiktok_url: business.tiktok_url ?? '',
    services_en: business.services_en ?? [],
    services_ur: business.services_ur ?? [],
    tags: business.tags ?? [],
  };
}

function parseStepParam(raw: string | null): WizardStep {
  if (raw === 'location' || raw === 'hours') return 'location';
  if (raw === 'media' || raw === 'social' || raw === 'services') return 'media';
  if (raw === 'preview') return 'preview';
  return 'basic';
}

export function ListingEditor({
  business,
  categories,
  areas,
  plans,
  onSave,
}: {
  business: BusinessPublicView;
  categories: CategoryRow[];
  areas: AreaRow[];
  plans: PlanRow[];
  onSave: (patch: Partial<BusinessRow>) => Promise<void>;
}) {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [step, setStep] = useState<WizardStep>(() => parseStepParam(searchParams.get('step')));
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<Partial<BusinessRow>>(() => buildInitialForm(business));
  const [samePhone, setSamePhone] = useState(() => {
    const p1 = normalizePkPhone(business.phone_primary);
    const wa = business.whatsapp ? normalizePkPhone(business.whatsapp) : '';
    return Boolean(wa && p1 && wa === p1);
  });
  const [servicesList, setServicesList] = useState<string[]>(() => business.services_en ?? []);
  const [servicesUrText, setServicesUrText] = useState((business.services_ur ?? []).join('، '));
  const [tagsList, setTagsList] = useState<string[]>(() => business.tags ?? []);
  const [tagDraft, setTagDraft] = useState('');

  useEffect(() => {
    setForm(buildInitialForm(business));
    setServicesList(business.services_en ?? []);
    setServicesUrText((business.services_ur ?? []).join('، '));
    setTagsList(business.tags ?? []);
    const p1 = normalizePkPhone(business.phone_primary);
    const wa = business.whatsapp ? normalizePkPhone(business.whatsapp) : '';
    setSamePhone(Boolean(wa && p1 && wa === p1));
  }, [business.id]);

  useEffect(() => {
    const paramStep = searchParams.get('step');
    if (paramStep) {
      setStep(parseStepParam(paramStep));
    }
  }, [searchParams]);

  const goStep = (next: WizardStep) => {
    setStep(next);
    setSearchParams({ step: next }, { replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const effPlanCode = effectivePlanCode(business.plan_code, business.plan_expires_at);
  const activePlan = plans.find((p) => p.code === effPlanCode) ?? plans[0];
  const maxPhotos = activePlan?.limits.max_photos ?? 0;
  const maxVideos = activePlan?.limits.max_videos ?? 0;
  const maxSocialLinks = activePlan?.limits.social_links ?? 0;
  const canCover = activePlan?.features.cover ?? false;
  const canWhatsApp = activePlan?.features.whatsapp ?? false;
  const canSocial = (activePlan?.features.social_links ?? false) && maxSocialLinks > 0;

  const filledSocialCount = [
    form.facebook_url,
    form.instagram_url,
    form.youtube_url,
    form.tiktok_url,
  ].filter((v) => Boolean(String(v ?? '').trim())).length;

  const update = (patch: Partial<BusinessRow>) => setForm((prev) => ({ ...prev, ...patch }));

  const handlePrimaryPhoneChange = (val: string) => {
    update(samePhone && canWhatsApp ? { phone_primary: val, whatsapp: val } : { phone_primary: val });
  };

  const toggleSamePhone = (checked: boolean) => {
    setSamePhone(checked);
    if (checked && canWhatsApp) {
      update({ whatsapp: form.phone_primary ?? '' });
    }
  };

  const toggleAmenity = (en: string) => {
    setServicesList((prev) => {
      const exists = prev.includes(en);
      const next = exists ? prev.filter((item) => item !== en) : [...prev, en];
      if (en === 'Home Delivery') {
        update({ home_delivery: !exists });
      }
      return next;
    });
  };

  const addTag = (raw: string) => {
    const cleaned = raw.trim().replace(/^,+|,+$/g, '');
    if (cleaned.length < 2) return;
    if (!tagsList.includes(cleaned)) {
      setTagsList((prev) => [...prev, cleaned]);
    }
    setTagDraft('');
  };

  const handleSave = async (submitForApproval = false) => {
    if (!form.name_en?.trim() || !form.phone_primary?.trim()) {
      showToast('Business name and primary phone are required.', 'error');
      goStep('basic');
      return;
    }

    const hoursError = !form.is_open_24h
      ? validateOpeningHoursRanges((form.opening_hours as OpeningHoursJson) ?? {})
      : null;
    if (hoursError) {
      showToast(hoursError, 'error');
      goStep('location');
      return;
    }

    const urlFields = [
      'logo_url',
      'cover_url',
      'owner_photo_url',
      'website_url',
      'facebook_url',
      'instagram_url',
      'youtube_url',
      'tiktok_url',
    ] as const;

    for (const key of urlFields) {
      const val = String(form[key] ?? '').trim();
      if (val && !isValidHttpsUrl(val)) {
        showToast(`${key.replace(/_/g, ' ')} must start with https://`, 'error');
        return;
      }
    }

    if (canSocial && maxSocialLinks > 0 && filledSocialCount > maxSocialLinks) {
      showToast(
        `Your ${effPlanCode.toUpperCase()} plan allows up to ${maxSocialLinks} social links.`,
        'error'
      );
      goStep('media');
      return;
    }

    setSaving(true);
    try {
      const payload: Partial<BusinessRow> = {
        ...form,
        name_ur: form.name_ur?.trim() || null,
        area_id: form.area_id || null,
        owner_name: form.owner_name?.trim() || null,
        owner_photo_url: form.owner_photo_url?.trim() || null,
        phone_secondary: form.phone_secondary?.trim() || null,
        whatsapp: canWhatsApp ? form.whatsapp?.trim() || null : null,
        email: form.email?.trim() || null,
        website_url: form.website_url?.trim() || null,
        logo_url: form.logo_url?.trim() || null,
        cover_url: form.cover_url?.trim() || null,
        facebook_url: form.facebook_url?.trim() || null,
        instagram_url: form.instagram_url?.trim() || null,
        youtube_url: form.youtube_url?.trim() || null,
        tiktok_url: form.tiktok_url?.trim() || null,
        services_en: servicesList,
        services_ur: servicesUrText
          .split(/[,،]/)
          .map((s) => s.trim())
          .filter(Boolean),
        tags: tagsList,
      };

      if (submitForApproval && (business.status === 'draft' || business.status === 'rejected')) {
        payload.status = 'pending_approval';
      }

      await onSave(payload);
      showToast(
        submitForApproval
          ? 'Listing submitted for admin approval!'
          : 'Listing changes saved successfully!',
        'success'
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save listing.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const canSubmitApproval = business.status === 'draft' || business.status === 'rejected';
  const previewCategory = categories.find((c) => c.id === form.category_id)?.name_en ?? '';
  const previewArea = areas.find((a) => a.id === form.area_id)?.name_en ?? 'Sadiqabad';
  const descLen = (form.description_en ?? '').length;
  const activeStepObj = STEPS.find((s) => s.id === step) ?? STEPS[0];
  const progressPct = Math.round((activeStepObj.num / STEPS.length) * 100);

  const customServiceText = useMemo(
    () =>
      servicesList
        .filter((s) => !QUICK_AMENITIES.some((q) => q.en === s))
        .join(', '),
    [servicesList]
  );

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="space-y-5 pb-20">
      {/* Top Status & Progress Bar (Stitch 22-24) */}
      <Card className="p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-extrabold text-on-surface">
                {form.name_en || business.name_en}
              </h1>
              <Badge variant={business.status === 'published' ? 'success' : 'warning'}>
                {business.status}
              </Badge>
              <Badge variant={effPlanCode === 'premium' ? 'gold' : 'primary'}>
                {effPlanCode.toUpperCase()}
              </Badge>
            </div>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Step {activeStepObj.num} of {STEPS.length} • {activeStepObj.label} (
              <span className="font-urdu">{activeStepObj.ur}</span>)
            </p>
          </div>
          <span className="text-xs font-extrabold text-primary tabular-nums">
            {progressPct}% Complete
          </span>
        </div>

        <div className="h-1.5 rounded-full bg-surface-container-high overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* 4-Step Wizard Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
          {STEPS.map((s) => {
            const isActive = s.id === step;
            const isDone = s.num < activeStepObj.num;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => goStep(s.id)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-primary text-on-primary shadow-xs'
                    : isDone
                      ? 'bg-primary-fixed/40 text-on-primary-fixed'
                      : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                ) : (
                  <span className="w-4 h-4 rounded-full bg-black/10 flex items-center justify-center text-[10px]">
                    {s.num}
                  </span>
                )}
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* STEP 1: BASIC & CONTACT (Stitch 22) */}
      {step === 'basic' && (
        <div className="space-y-4">
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-outline-variant/25 pb-3">
              <div>
                <h2 className="text-base font-bold text-on-surface">Basic Business Information</h2>
                <p className="font-urdu text-xs text-primary">بنیادی کاروباری معلومات</p>
              </div>
              <Badge variant="warning">Required *</Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Business Name (English)"
                required
                value={form.name_en ?? ''}
                onChange={(e) => update({ name_en: e.target.value })}
              />
              <Input
                label="Business Name (Urdu)"
                labelUr="کاروبار کا نام"
                dir="rtl"
                className="font-urdu"
                value={form.name_ur ?? ''}
                onChange={(e) => update({ name_ur: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select
                label="Category"
                value={form.category_id ?? ''}
                onChange={(e) => update({ category_id: e.target.value })}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name_en}
                  </option>
                ))}
              </Select>
              <Select
                label="Neighborhood / Area"
                value={form.area_id ?? ''}
                onChange={(e) => update({ area_id: e.target.value })}
              >
                <option value="">Select Area</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name_en}
                  </option>
                ))}
              </Select>
              <Input
                label="Established Year"
                type="number"
                dir="ltr"
                value={form.established_year ?? ''}
                onChange={(e) =>
                  update({ established_year: e.target.value ? Number(e.target.value) : null })
                }
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Owner / Proprietor Name"
                value={form.owner_name ?? ''}
                onChange={(e) => update({ owner_name: e.target.value })}
                placeholder="e.g. Haji Muhammad Aslam"
              />
              <Input
                label="Owner Avatar Photo URL (HTTPS)"
                dir="ltr"
                value={form.owner_photo_url ?? ''}
                onChange={(e) => update({ owner_photo_url: e.target.value })}
                placeholder="https://..."
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-on-surface">
                  Short Summary / Description (English)
                </label>
                <span
                  className={`text-[11px] font-bold tabular-nums ${
                    descLen > 160 ? 'text-secondary' : 'text-on-surface-variant'
                  }`}
                >
                  {descLen} / 160 recommended (max 1000)
                </span>
              </div>
              <Textarea
                label=""
                rows={4}
                maxLength={1000}
                value={form.description_en ?? ''}
                onChange={(e) => update({ description_en: e.target.value })}
                placeholder="Describe your products, specialties, and why Sadiqabad customers trust you..."
              />
            </div>

            <Textarea
              label="Detailed Description (Urdu)"
              labelUr="کاروبار کی تفصیل (اردو)"
              dir="rtl"
              className="font-urdu"
              rows={4}
              value={form.description_ur ?? ''}
              onChange={(e) => update({ description_ur: e.target.value })}
            />
          </Card>

          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-outline-variant/25 pb-3">
              <div>
                <h2 className="text-base font-bold text-on-surface">Contact Information</h2>
                <p className="font-urdu text-xs text-primary">رابطے کی مکمل تفصیلات</p>
              </div>
              <Badge variant="success">1-Tap Dialing</Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-on-surface">
                  Primary Calling Phone *
                </label>
                <div className="relative flex items-center">
                  <span className="absolute start-3 inline-flex items-center gap-1 text-xs font-bold text-primary border-e border-outline-variant pe-2 pointer-events-none">
                    <Phone className="w-3.5 h-3.5" /> +92
                  </span>
                  <input
                    type="tel"
                    dir="ltr"
                    required
                    value={form.phone_primary ?? ''}
                    onChange={(e) => handlePrimaryPhoneChange(e.target.value)}
                    placeholder="0300-8671234"
                    className="w-full h-11 ps-20 pe-3 rounded-xl bg-surface-container-low border border-outline-variant/50 text-sm font-mono text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <Input
                label="Secondary / Landline"
                dir="ltr"
                value={form.phone_secondary ?? ''}
                onChange={(e) => update({ phone_secondary: e.target.value })}
                placeholder="068-5700000"
              />
            </div>

            <div className="p-3.5 rounded-xl bg-surface-container-low space-y-2.5">
              <label className="flex items-center gap-2.5 cursor-pointer select-none text-xs font-semibold text-on-surface">
                <input
                  type="checkbox"
                  checked={samePhone}
                  disabled={!canWhatsApp}
                  onChange={(e) => toggleSamePhone(e.target.checked)}
                  className="w-4 h-4 accent-primary cursor-pointer"
                />
                <span>Same as primary calling phone (کالنگ فون اور واٹس ایپ ایک ہی نمبر ہیں)</span>
              </label>

              <div className="space-y-1">
                <div className="relative flex items-center">
                  <span className="absolute start-3 inline-flex items-center gap-1 text-xs font-bold text-[#25D366] border-e border-outline-variant pe-2 pointer-events-none">
                    <MessageCircle className="w-3.5 h-3.5" /> +92
                  </span>
                  <input
                    type="tel"
                    dir="ltr"
                    disabled={!canWhatsApp}
                    readOnly={samePhone && canWhatsApp}
                    value={form.whatsapp ?? ''}
                    onChange={(e) => update({ whatsapp: e.target.value })}
                    placeholder="0300-8671234"
                    className={`w-full h-11 ps-20 pe-3 rounded-xl border border-outline-variant/50 text-sm font-mono focus:outline-none ${
                      samePhone || !canWhatsApp
                        ? 'bg-surface-container text-on-surface-variant cursor-not-allowed'
                        : 'bg-surface-container-lowest text-on-surface focus:border-primary'
                    }`}
                  />
                </div>
                {!canWhatsApp && (
                  <p className="text-xs text-secondary flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5" /> WhatsApp button requires Basic or Gold plan.
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Contact Email"
                type="email"
                dir="ltr"
                value={form.email ?? ''}
                onChange={(e) => update({ email: e.target.value })}
              />
              <Input
                label="Website URL (HTTPS)"
                dir="ltr"
                value={form.website_url ?? ''}
                onChange={(e) => update({ website_url: e.target.value })}
              />
              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-surface-container-low text-sm font-semibold self-end cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(form.home_delivery)}
                  onChange={(e) => update({ home_delivery: e.target.checked })}
                  className="w-4 h-4 accent-primary"
                />
                <span>Home Delivery in Sadiqabad</span>
              </label>
            </div>
          </Card>

          {/* Live Directory Card Preview Snippet (Stitch 22) */}
          <Card className="p-4 bg-surface-container-low space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-on-surface inline-flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-primary" /> Live Directory Card Preview
              </span>
              <span className="text-outline font-semibold">Live sync</span>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-3.5 shadow-xs flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 overflow-hidden">
                {form.logo_url ? (
                  <ImageWithFallback
                    src={form.logo_url}
                    alt={form.name_en || 'Logo'}
                    className="w-full h-full object-cover"
                    fallbackLabel={(form.name_en || 'S').slice(0, 2)}
                  />
                ) : (
                  <Store className="w-6 h-6" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h4 className="font-bold text-sm text-on-surface truncate">
                    {form.name_en || 'Business Title'}
                  </h4>
                  {business.is_verified && <BadgeCheck className="w-4 h-4 text-primary shrink-0" />}
                </div>
                <p className="text-xs text-on-surface-variant truncate mt-0.5">
                  {previewCategory || 'Category'} · {form.address_en || previewArea}
                </p>
                <div className="flex items-center gap-2 mt-1.5 text-[11px] font-bold text-primary">
                  <span dir="ltr">{form.phone_primary || '0300-XXXXXXX'}</span>
                  {form.home_delivery && <Badge variant="success">Delivery</Badge>}
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* STEP 2: LOCATION & HOURS (Stitch 23) */}
      {step === 'location' && (
        <div className="space-y-4">
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-outline-variant/25 pb-3">
              <div>
                <h2 className="text-base font-bold text-on-surface">Store Location &amp; Map Pin</h2>
                <p className="font-urdu text-xs text-primary">دکان کا پتہ اور نقشے پر مقام</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Street Address (English)"
                value={form.address_en ?? ''}
                onChange={(e) => update({ address_en: e.target.value })}
              />
              <Input
                label="Street Address (Urdu)"
                dir="rtl"
                className="font-urdu"
                value={form.address_ur ?? ''}
                onChange={(e) => update({ address_ur: e.target.value })}
              />
              <Input
                label="Nearby Landmark (English)"
                value={form.landmark_en ?? ''}
                onChange={(e) => update({ landmark_en: e.target.value })}
              />
              <Input
                label="Nearby Landmark (Urdu)"
                dir="rtl"
                className="font-urdu"
                value={form.landmark_ur ?? ''}
                onChange={(e) => update({ landmark_ur: e.target.value })}
              />
            </div>

            <LocationPicker
              lat={form.lat ?? null}
              lng={form.lng ?? null}
              onChange={({ lat, lng }) => update({ lat, lng })}
            />
          </Card>

          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-outline-variant/25 pb-3">
              <div>
                <h2 className="text-base font-bold text-on-surface">Business Opening Hours</h2>
                <p className="font-urdu text-xs text-primary">اوقات کار اور جمعہ کا وقفہ</p>
              </div>
            </div>

            <HoursEditor
              value={(form.opening_hours as OpeningHoursJson) ?? {}}
              isOpen24h={Boolean(form.is_open_24h)}
              onChange={(opening_hours) => update({ opening_hours })}
              onChange24h={(is_open_24h) => update({ is_open_24h })}
            />
          </Card>
        </div>
      )}

      {/* STEP 3: MEDIA, SOCIAL & SERVICES (Stitch 24) */}
      {step === 'media' && (
        <div className="space-y-4">
          {/* Cloud-Hosted Images Only Notice (Stitch 24) */}
          <Card className="p-4 bg-secondary-fixed/50 text-on-secondary-fixed flex items-start gap-3">
            <Cloud className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
            <div className="space-y-0.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-extrabold text-secondary">Cloud-Hosted Images Only (HTTPS URLs)</span>
                <span className="font-urdu text-xs font-bold text-secondary">
                  صرف انٹرنیٹ پر موجود تصویر کا HTTPS لنک شامل کریں
                </span>
              </div>
              <p className="text-on-secondary-fixed-variant leading-relaxed">
                Local device uploads are disabled for ultra-fast city loading. Paste public HTTPS URLs
                for your logo, cover banner, and store photos.
              </p>
            </div>
          </Card>

          {/* Logo & Cover Banner with Live Previews */}
          <Card className="p-5 space-y-5">
            <h2 className="text-base font-bold text-on-surface">Branding &amp; Hero Media</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              <div className="space-y-2">
                <Input
                  label="Store Logo URL (HTTPS, 1:1)"
                  dir="ltr"
                  value={form.logo_url ?? ''}
                  onChange={(e) => update({ logo_url: e.target.value })}
                  placeholder="https://..."
                />
                {form.logo_url && (
                  <div className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-container-low">
                    <ImageWithFallback
                      src={form.logo_url}
                      alt="Logo live preview"
                      className="w-12 h-12 rounded-xl object-cover shrink-0 border border-outline-variant/40"
                    />
                    <span className="text-xs text-on-surface-variant">Live 1:1 Logo Preview</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Input
                  label="Cover Banner URL (HTTPS, 16:9)"
                  dir="ltr"
                  disabled={!canCover}
                  value={form.cover_url ?? ''}
                  onChange={(e) => update({ cover_url: e.target.value })}
                  placeholder="https://..."
                />
                {!canCover ? (
                  <p className="text-xs text-secondary flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5" /> Custom cover requires Basic or Gold plan.
                  </p>
                ) : form.cover_url ? (
                  <div className="relative h-28 rounded-xl overflow-hidden border border-outline-variant/40">
                    <ImageWithFallback
                      src={form.cover_url}
                      alt="Cover live preview"
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute bottom-2 start-2 px-2 py-0.5 rounded-full bg-black/70 text-white text-[10px] font-bold">
                      Live Hero Preview
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            <UrlListEditor
              title="Photo Gallery URLs"
              urls={form.gallery_urls ?? []}
              maxItems={maxPhotos}
              kind="image"
              onChange={(gallery_urls) => update({ gallery_urls })}
            />

            <UrlListEditor
              title="Promotional Video URLs (YouTube / Vimeo)"
              urls={form.video_urls ?? []}
              maxItems={maxVideos}
              kind="video"
              onChange={(video_urls) => update({ video_urls })}
            />

            {effPlanCode !== 'premium' && (
              <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0">
                    <Crown className="w-4 h-4" />
                  </div>
                  <div className="text-xs">
                    <p className="font-bold text-primary">Need higher photo/video showcase limits?</p>
                    <p className="text-on-surface-variant">
                      Gold Spotlight includes up to 20 gallery photos and 3 video tours.
                    </p>
                  </div>
                </div>
                <Link
                  to="/owner/plan"
                  className="px-3 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-bold"
                >
                  Upgrade Plan →
                </Link>
              </div>
            )}
          </Card>

          {/* Social Profiles */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-on-surface">Social Profiles</h2>
                <p className="font-urdu text-xs text-on-surface-variant">سوشل میڈیا روابط</p>
              </div>
              {canSocial ? (
                <Badge variant={filledSocialCount > maxSocialLinks ? 'danger' : 'primary'}>
                  {filledSocialCount} / {maxSocialLinks} used
                </Badge>
              ) : (
                <Badge variant="warning">Locked on Free</Badge>
              )}
            </div>

            {!canSocial && (
              <div className="p-3 rounded-xl bg-secondary-fixed/50 text-on-secondary-fixed text-xs flex items-center gap-2">
                <Lock className="w-4 h-4 shrink-0" />
                <span>Social profile links are unlocked on Basic Verified &amp; Gold plans.</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Facebook Page URL"
                dir="ltr"
                disabled={!canSocial}
                value={form.facebook_url ?? ''}
                onChange={(e) => update({ facebook_url: e.target.value })}
              />
              <Input
                label="Instagram Profile URL"
                dir="ltr"
                disabled={!canSocial}
                value={form.instagram_url ?? ''}
                onChange={(e) => update({ instagram_url: e.target.value })}
              />
              <Input
                label="YouTube Channel URL"
                dir="ltr"
                disabled={!canSocial}
                value={form.youtube_url ?? ''}
                onChange={(e) => update({ youtube_url: e.target.value })}
              />
              <Input
                label="TikTok Profile URL"
                dir="ltr"
                disabled={!canSocial}
                value={form.tiktok_url ?? ''}
                onChange={(e) => update({ tiktok_url: e.target.value })}
              />
            </div>
          </Card>

          {/* Services & Amenities Interactive Checklist + Custom Tags (Stitch 24) */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-on-surface">Services &amp; Features</h2>
                <p className="font-urdu text-xs text-on-surface-variant">دستیاب سہولیات اور ٹیگز</p>
              </div>
              <Badge variant="primary">{servicesList.length} Active</Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {QUICK_AMENITIES.map((item) => {
                const checked = servicesList.includes(item.en);
                return (
                  <label
                    key={item.en}
                    className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors border ${
                      checked
                        ? 'bg-primary-fixed/25 border-primary/40'
                        : 'bg-surface-container-low border-outline-variant/30'
                    }`}
                  >
                    <div>
                      <p className="text-xs font-bold text-on-surface">{item.en}</p>
                      <p className="font-urdu text-[11px] text-on-surface-variant">{item.ur}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAmenity(item.en)}
                      className="w-4 h-4 accent-primary cursor-pointer"
                    />
                  </label>
                );
              })}
            </div>

            <Input
              label="Additional Custom Services (English, comma separated)"
              value={customServiceText}
              onChange={(e) => {
                const quickSelected = servicesList.filter((s) =>
                  QUICK_AMENITIES.some((q) => q.en === s)
                );
                const extras = e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean);
                setServicesList([...quickSelected, ...extras]);
              }}
              placeholder="e.g. Meat Section, Frozen Foods, Urgent Stitching"
            />

            <Input
              label="Services & Amenities (Urdu, comma separated)"
              labelUr="سہولیات اور خدمات (اردو)"
              dir="rtl"
              className="font-urdu"
              value={servicesUrText}
              onChange={(e) => setServicesUrText(e.target.value)}
            />

            {/* Custom Search Tags Chip Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-on-surface">
                Search Tags &amp; Urdu Keywords (press Enter or comma to add)
              </label>
              <div className="flex flex-wrap items-center gap-1.5 p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/40 min-h-[48px]">
                {tagsList.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary text-on-primary text-xs font-semibold"
                  >
                    <span>{tag}</span>
                    <button
                      type="button"
                      aria-label={`Remove tag ${tag}`}
                      onClick={() => setTagsList((prev) => prev.filter((t) => t !== tag))}
                      className="hover:opacity-75 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
                <div className="flex items-center gap-1 flex-1 min-w-[160px]">
                  <input
                    type="text"
                    value={tagDraft}
                    onChange={(e) => setTagDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        addTag(tagDraft);
                      }
                    }}
                    placeholder="Type tag & press Enter..."
                    className="flex-1 bg-transparent text-xs text-on-surface outline-none px-1 py-1"
                  />
                  {tagDraft.trim().length >= 2 && (
                    <button
                      type="button"
                      onClick={() => addTag(tagDraft)}
                      className="px-2 py-1 rounded-lg bg-primary/15 text-primary text-[11px] font-bold inline-flex items-center gap-0.5 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* STEP 4: LIVE PREVIEW */}
      {step === 'preview' && (
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-primary">
            <Eye className="w-4 h-4" />
            <span>Public Profile Snapshot</span>
          </div>
          <div className="rounded-2xl overflow-hidden border border-outline-variant/40 bg-surface-container-low">
            {form.cover_url ? (
              <ImageWithFallback
                src={form.cover_url}
                alt={form.name_en || 'Cover preview'}
                className="w-full h-40 object-cover"
              />
            ) : (
              <div className="w-full h-24 bg-gradient-to-r from-primary/20 via-primary-fixed/40 to-secondary-fixed/40" />
            )}
            <div className="p-4 sm:p-5 space-y-3">
              <div className="flex items-start gap-3">
                {form.logo_url && (
                  <ImageWithFallback
                    src={form.logo_url}
                    alt={form.name_en || 'Logo'}
                    className="w-14 h-14 rounded-xl object-cover border border-outline-variant/40 shrink-0 bg-surface"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="text-lg font-extrabold text-on-surface">{form.name_en}</h3>
                    {business.is_verified && <BadgeCheck className="w-4 h-4 text-primary" />}
                    {form.home_delivery && <Badge variant="success">Home Delivery</Badge>}
                  </div>
                  {form.name_ur && (
                    <p className="font-urdu text-base text-primary mt-0.5" dir="rtl">
                      {form.name_ur}
                    </p>
                  )}
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    {previewCategory} · {previewArea}
                    {form.established_year ? ` · Est. ${form.established_year}` : ''}
                  </p>
                </div>
              </div>

              {form.description_en && (
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  {form.description_en}
                </p>
              )}

              <div className="flex flex-wrap gap-3 text-xs text-on-surface-variant pt-2 border-t border-outline-variant/25">
                {form.address_en && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-primary" /> {form.address_en}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 font-bold text-on-surface tabular-nums" dir="ltr">
                  <Phone className="w-3.5 h-3.5 text-primary" /> {form.phone_primary}
                  {form.whatsapp ? ` · WA: ${form.whatsapp}` : ''}
                </span>
              </div>

              {servicesList.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {servicesList.slice(0, 10).map((s) => (
                    <Badge key={s} variant="neutral">
                      {s}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Sticky Bottom Wizard Action Bar */}
      <div className="sticky bottom-14 z-30 bg-surface-container-lowest/95 backdrop-blur-md p-3 rounded-2xl border border-outline-variant/40 shadow-lg flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {stepIndex > 0 && (
            <Button
              variant="outline"
              onClick={() => goStep(STEPS[stepIndex - 1].id)}
              leftIcon={<ArrowLeft className="w-4 h-4 rtl:rotate-180" />}
            >
              Back
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => handleSave(false)}
            loading={saving}
            leftIcon={<Save className="w-4 h-4" />}
          >
            Save Changes
          </Button>
        </div>

        <div className="flex items-center gap-2 ms-auto">
          {stepIndex < STEPS.length - 1 ? (
            <Button
              onClick={() => goStep(STEPS[stepIndex + 1].id)}
              rightIcon={<ArrowRight className="w-4 h-4 rtl:rotate-180" />}
            >
              Next: {STEPS[stepIndex + 1].label}
            </Button>
          ) : canSubmitApproval ? (
            <Button
              variant="secondary"
              onClick={() => handleSave(true)}
              loading={saving}
              leftIcon={<Send className="w-4 h-4" />}
            >
              Submit for Approval
            </Button>
          ) : (
            <Button onClick={() => handleSave(false)} loading={saving} leftIcon={<Save className="w-4 h-4" />}>
              Publish Saved Edits
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
