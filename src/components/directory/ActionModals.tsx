import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  Check,
  Contact,
  Copy,
  Download,
  Facebook,
  MessageCircle,
  MessageSquare,
  Share2,
  ShieldCheck,
} from 'lucide-react';
import type { BusinessPublicView } from '../../types/directory';
import type { SubmissionType } from '../../types/database';
import {
  submitPublicInquiry,
  submitPublicReview,
  submitPublicSuggestion,
  trackBusinessEvent,
} from '../../lib/api';
import { buildBusinessVCard } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { isValidHttpsUrl } from '../../lib/phone';
import { Button } from '../ui/Button';
import { Input, Select, Textarea } from '../ui/FormFields';
import { Modal } from '../ui/Modal';
import { StarRating } from '../ui/DataDisplay';
import { useToast } from '../ui/Toast';

const INQUIRY_CHIPS = [
  'What are your timings today?',
  'Is home delivery available?',
  'Please share latest price & stock.',
  'Want to book an appointment.',
];

const REVIEW_TRAITS = ['Honest Prices', 'Fast Service', 'Clean Shop', 'Helpful Staff'];
const STAR_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very Good',
  5: 'Excellent',
};

export function SendInquiryModal({
  open,
  onClose,
  business,
}: {
  open: boolean;
  onClose: () => void;
  business: BusinessPublicView;
}) {
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [hp, setHp] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !message.trim()) {
      showToast('Please complete all required fields.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await submitPublicInquiry({
        business_id: business.id,
        name,
        phone,
        message,
        website_hp: hp,
      });
      if (!res.ok) {
        showToast(res.error ?? 'Failed to send inquiry.', 'error');
        return;
      }
      showToast('Inquiry sent! The business owner will contact you soon.', 'success');
      setName('');
      setPhone('');
      setMessage('');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Send Inquiry to ${business.name_en}`}
      titleUr="کاروبار کو براہ راست پیغام بھیجیں"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Your Name"
          labelUr="آپ کا نام"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Muhammad Usman"
        />
        <Input
          label="Mobile Phone"
          labelUr="موبائل نمبر"
          required
          dir="ltr"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="0300-1234567"
        />
        <div className="space-y-2">
          <span className="text-[11px] font-semibold text-on-surface-variant block">
            Quick message templates (optional):
          </span>
          <div className="flex flex-wrap gap-1.5">
            {INQUIRY_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() =>
                  setMessage((prev) => (prev.trim() ? `${prev.trim()} ${chip}` : chip))
                }
                className="px-2.5 py-1 rounded-full bg-surface-container-low hover:bg-primary-fixed text-xs font-medium text-on-surface transition-colors cursor-pointer"
              >
                + {chip}
              </button>
            ))}
          </div>
        </div>
        <Textarea
          label="Your Message / Requirement"
          labelUr="آپ کا پیغام"
          required
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ask about price, stock availability, appointment time, or home delivery..."
        />
        {/* Honeypot anti-spam */}
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={hp}
          onChange={(e) => setHp(e.target.value)}
          className="hidden"
          aria-hidden="true"
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            Send Inquiry
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function WriteReviewModal({
  open,
  onClose,
  business,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  business: BusinessPublicView;
  onSubmitted?: () => void;
}) {
  const { showToast } = useToast();
  const [author, setAuthor] = useState('');
  const [rating, setRating] = useState(5);
  const [selectedTraits, setSelectedTraits] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [hp, setHp] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const toggleTrait = (trait: string) => {
    setSelectedTraits((prev) =>
      prev.includes(trait) ? prev.filter((item) => item !== trait) : [...prev, trait]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!author.trim() || comment.trim().length < 6) {
      showToast('Enter your name and a short review (at least 6 characters).', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const traitPrefix = selectedTraits.length > 0 ? `[${selectedTraits.join(' · ')}] ` : '';
      const res = await submitPublicReview({
        business_id: business.id,
        author_name: author,
        rating,
        comment: `${traitPrefix}${comment.trim()}`,
        website_hp: hp,
      });
      if (!res.ok) {
        showToast(res.error ?? 'Could not submit review.', 'error');
        return;
      }
      showToast('Thank you! Your review has been submitted for moderation.', 'success');
      setAuthor('');
      setComment('');
      setSelectedTraits([]);
      setRating(5);
      onSubmitted?.();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Review ${business.name_en}`}
      titleUr="اپنا تجربہ اور رائے درج کریں"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-on-surface">Your Rating *</span>
            <span className="text-xs font-bold text-primary">{STAR_LABELS[rating] ?? 'Good'}</span>
          </div>
          <StarRating rating={rating} interactive onChange={setRating} size="md" />
        </div>
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold text-on-surface-variant block">
            Highlight what stood out (optional):
          </span>
          <div className="flex flex-wrap gap-1.5">
            {REVIEW_TRAITS.map((trait) => {
              const active = selectedTraits.includes(trait);
              return (
                <button
                  key={trait}
                  type="button"
                  onClick={() => toggleTrait(trait)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                    active
                      ? 'bg-primary text-on-primary border-primary'
                      : 'bg-surface-container-low text-on-surface border-outline-variant/30 hover:bg-surface-container'
                  }`}
                >
                  {active ? '✓ ' : ''}
                  {trait}
                </button>
              );
            })}
          </div>
        </div>
        <Input
          label="Your Name"
          labelUr="آپ کا نام"
          required
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="e.g. Tariq Abbas"
        />
        <Textarea
          label="Review Comment"
          labelUr="تبصرہ"
          required
          rows={4}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Share service quality, prices, or staff behavior..."
        />
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={hp}
          onChange={(e) => setHp(e.target.value)}
          className="hidden"
          aria-hidden="true"
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            Submit Review
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function SuggestCorrectionModal({
  open,
  onClose,
  business,
  initialReason = 'Phone number changed',
}: {
  open: boolean;
  onClose: () => void;
  business: BusinessPublicView;
  initialReason?: string;
}) {
  const { showToast } = useToast();
  const { lang } = useI18n();
  const [reason, setReason] = useState(initialReason);
  const [newPhone, setNewPhone] = useState('');
  const [details, setDetails] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [hp, setHp] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setReason(initialReason);
    }
  }, [open, initialReason]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!details.trim() && !newPhone.trim()) {
      showToast(
        lang === 'ur'
          ? 'براہ کرم تصحیح یا مسئلے کی تفصیل درج کریں۔'
          : 'Please describe the correction or issue.',
        'error'
      );
      return;
    }
    setSubmitting(true);
    try {
      let subType: SubmissionType = 'correction';
      if (reason === 'Broken image / photo') subType = 'broken_image';
      else if (reason === 'Phone number changed') subType = 'phone_suggestion';
      else if (reason === 'Business permanently closed' || reason === 'Duplicate or spam listing') {
        subType = 'report';
      }

      const res = await submitPublicSuggestion({
        type: subType,
        business_id: business.id,
        payload: {
          reason,
          phone_primary: newPhone.trim() || undefined,
          details: details.trim(),
        },
        contact_name: contactName,
        contact_phone: contactPhone,
        website_hp: hp,
      });
      if (!res.ok) {
        showToast(res.error ?? 'Submission failed.', 'error');
        return;
      }
      showToast(
        lang === 'ur'
          ? 'رپورٹ موصول ہو گئی! ہماری صادق آباد ٹیم جلد تصدیق کرے گی۔'
          : 'Report submitted! Our Sadiqabad moderators will verify shortly.',
        'success'
      );
      setNewPhone('');
      setDetails('');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={lang === 'ur' ? 'تصحیح یا غلطی کی اطلاع دیں' : 'Suggest Edit or Report Issue'}
      titleUr={lang === 'en' ? 'تصحیح یا غلطی کی اطلاع دیں' : undefined}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label={lang === 'ur' ? 'مسئلے کی قسم' : 'Issue Type'}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        >
          <option value="Phone number changed">
            {lang === 'ur' ? 'فون نمبر تبدیل ہو گیا ہے' : 'Phone number changed'}
          </option>
          <option value="Address / location wrong">
            {lang === 'ur' ? 'پتہ یا لوکیشن غلط ہے' : 'Address / location wrong'}
          </option>
          <option value="Opening hours wrong">
            {lang === 'ur' ? 'اوقات کار غلط ہیں' : 'Opening hours wrong'}
          </option>
          <option value="Business permanently closed">
            {lang === 'ur' ? 'کاروبار مستقل بند ہو چکا ہے' : 'Business permanently closed'}
          </option>
          <option value="Duplicate or spam listing">
            {lang === 'ur' ? 'ڈپلیکیٹ یا غلط اندراج' : 'Duplicate or spam listing'}
          </option>
          <option value="Broken image / photo">
            {lang === 'ur' ? 'تصویر خراب ہے یا کھل نہیں رہی' : 'Broken image / photo'}
          </option>
        </Select>
        <Input
          label={lang === 'ur' ? 'درست فون نمبر (اگر دستیاب ہو)' : 'Correct Phone Number (if applicable)'}
          dir="ltr"
          value={newPhone}
          onChange={(e) => setNewPhone(e.target.value)}
          placeholder="0300-XXXXXXX"
        />
        <Textarea
          label={lang === 'ur' ? 'تفصیلات' : 'Details'}
          required
          rows={3}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder={
            lang === 'ur'
              ? 'ماڈریٹرز کے لیے درست معلومات درج کریں...'
              : 'Provide accurate details for our moderators...'
          }
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label={lang === 'ur' ? 'آپ کا نام (اختیاری)' : 'Your Name (optional)'}
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
          />
          <Input
            label={lang === 'ur' ? 'آپ کا فون نمبر (اختیاری)' : 'Your Phone (optional)'}
            dir="ltr"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
          />
        </div>
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={hp}
          onChange={(e) => setHp(e.target.value)}
          className="hidden"
          aria-hidden="true"
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            {lang === 'ur' ? 'منسوخ' : 'Cancel'}
          </Button>
          <Button type="submit" loading={submitting}>
            {lang === 'ur' ? 'تصحیح بھیجیں' : 'Submit Correction'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function ClaimBusinessModal({
  open,
  onClose,
  business,
}: {
  open: boolean;
  onClose: () => void;
  business: BusinessPublicView;
}) {
  const { showToast } = useToast();
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [proofNote, setProofNote] = useState('');
  const [hp, setHp] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerName.trim() || !ownerPhone.trim()) {
      showToast('Owner name and phone number are required.', 'error');
      return;
    }
    if (proofUrl.trim() && !isValidHttpsUrl(proofUrl.trim())) {
      showToast('Proof URL must be a valid https:// link (max 500 characters).', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await submitPublicSuggestion({
        type: 'claim',
        business_id: business.id,
        payload: {
          owner_name: ownerName.trim(),
          proof_url: proofUrl.trim() || undefined,
          proof_note: proofNote.trim(),
        },
        contact_name: ownerName.trim(),
        contact_phone: ownerPhone.trim(),
        website_hp: hp,
      });
      if (!res.ok) {
        showToast(res.error ?? 'Could not submit claim.', 'error');
        return;
      }
      showToast('Claim request submitted! Our onboarding team will verify on call.', 'success');
      setOwnerName('');
      setOwnerPhone('');
      setProofUrl('');
      setProofNote('');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Claim ${business.name_en}`}
      titleUr="اس کاروبار کی ملکیت کا دعویٰ کریں"
    >
      <div className="space-y-4">
        <div className="p-3 rounded-xl bg-primary-fixed/40 text-on-primary-fixed text-xs flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <span>
            Once verified by our Sadiqabad team, you will receive Owner Portal login credentials to
            manage photos, hours, offers, and customer inquiries.
          </span>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            label="Owner / Manager Name"
            required
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            placeholder="e.g. Haji Muhammad Aslam"
          />
          <Input
            label="Verification Mobile Number"
            required
            dir="ltr"
            value={ownerPhone}
            onChange={(e) => setOwnerPhone(e.target.value)}
            placeholder="0300-8671234"
          />
          <Input
            label="Visiting Card / Shop Proof URL (optional)"
            dir="ltr"
            type="url"
            value={proofUrl}
            onChange={(e) => setProofUrl(e.target.value)}
            placeholder="https://..."
          />
          <Textarea
            label="Ownership Verification Note"
            rows={3}
            value={proofNote}
            onChange={(e) => setProofNote(e.target.value)}
            placeholder="Mention shop registration, visiting card, or best time for verification call..."
          />
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={hp}
            onChange={(e) => setHp(e.target.value)}
            className="hidden"
            aria-hidden="true"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Submit Claim Request
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

export function QrCodeModal({
  open,
  onClose,
  business,
}: {
  open: boolean;
  onClose: () => void;
  business: BusinessPublicView;
}) {
  const [dataUrl, setDataUrl] = useState<string>('');
  const url = `${window.location.origin}/business/${business.slug}`;

  useEffect(() => {
    if (!open) return;
    QRCode.toDataURL(url, {
      width: 280,
      margin: 2,
      color: { dark: '#006948', light: '#ffffff' },
    })
      .then(setDataUrl)
      .catch(() => setDataUrl(''));
  }, [open, url]);

  const handleDownload = () => {
    if (!dataUrl) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 820;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        const fallback = document.createElement('a');
        fallback.href = dataUrl;
        fallback.download = `${business.slug}-qr.png`;
        fallback.click();
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#006948';
      ctx.fillRect(0, 0, canvas.width, 130);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('HELLO SADIQABAD', canvas.width / 2, 56);
      ctx.font = '18px sans-serif';
      ctx.fillStyle = '#d1fae5';
      ctx.fillText('Official City Business Directory', canvas.width / 2, 92);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 30px sans-serif';
      ctx.fillText(business.name_en.slice(0, 34), canvas.width / 2, 190);
      ctx.fillStyle = '#475569';
      ctx.font = '20px sans-serif';
      ctx.fillText(business.area?.name_en || 'Sadiqabad', canvas.width / 2, 226);

      ctx.drawImage(img, 140, 260, 360, 360);

      ctx.fillStyle = '#006948';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText(`Call: ${business.phone_primary}`, canvas.width / 2, 675);
      ctx.fillStyle = '#64748b';
      ctx.font = '16px sans-serif';
      ctx.fillText('Scan QR to open profile, timings & WhatsApp', canvas.width / 2, 725);
      ctx.fillText(url.slice(0, 56), canvas.width / 2, 760);

      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `${business.slug}-poster-qr.png`;
      a.click();
    };
    img.src = dataUrl;
  };

  return (
    <Modal open={open} onClose={onClose} title="Business QR Poster" titleUr="دکان کا کیو آر پوسٹر">
      <div className="flex flex-col items-center text-center gap-4">
        <div className="w-full max-w-xs rounded-2xl overflow-hidden border border-outline-variant/40 bg-white shadow-sm">
          <div className="bg-primary text-white py-2.5 px-3">
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-90">
              Hello Sadiqabad Directory
            </p>
            <h4 className="font-bold text-sm truncate mt-0.5">{business.name_en}</h4>
          </div>
          <div className="p-4 flex flex-col items-center">
            {dataUrl ? (
              <img src={dataUrl} alt={`QR code for ${business.name_en}`} className="w-48 h-48" />
            ) : (
              <div className="w-48 h-48 flex items-center justify-center text-xs text-muted">
                Generating QR…
              </div>
            )}
            <p className="text-xs font-bold text-primary mt-2" dir="ltr">
              {business.phone_primary}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5 break-all">{url}</p>
          </div>
        </div>
        <Button onClick={handleDownload} leftIcon={<Download className="w-4 h-4" />} fullWidth>
          Download QR Poster PNG
        </Button>
      </div>
    </Modal>
  );
}

export function ShareSheet({
  open,
  onClose,
  business,
}: {
  open: boolean;
  onClose: () => void;
  business: BusinessPublicView;
}) {
  const { showToast } = useToast();
  const { lang } = useI18n();
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/business/${business.slug}`;
  const shareText = `${business.name_en} (${business.phone_primary}) — Hello Sadiqabad Directory: ${url}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      trackBusinessEvent(business.id, 'share');
      showToast(lang === 'ur' ? 'لنک کاپی ہو گیا!' : 'Link copied to clipboard!', 'success');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('Copy failed. Select the URL manually.', 'error');
    }
  };

  const downloadVCard = () => {
    const vcf = buildBusinessVCard(business, window.location.origin);
    const blob = new Blob([vcf], { type: 'text/vcard;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `${business.slug}.vcf`;
    a.click();
    URL.revokeObjectURL(blobUrl);
    trackBusinessEvent(business.id, 'share');
    showToast(
      lang === 'ur' ? 'کانٹیکٹ کارڈ (.vcf) ڈاؤن لوڈ ہو گیا!' : 'Contact card (.vcf) saved!',
      'success'
    );
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: business.name_en, text: shareText, url });
        trackBusinessEvent(business.id, 'share');
        onClose();
      } catch {
        // user cancelled
      }
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={lang === 'ur' ? 'کاروبار شیئر کریں' : 'Share Business'}
      titleUr={lang === 'en' ? 'کاروبار شیئر کریں' : undefined}
    >
      <div className="space-y-4">
        <div className="p-3 rounded-xl bg-surface-container-low text-xs font-mono break-all text-on-surface-variant" dir="ltr">
          {url}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackBusinessEvent(business.id, 'share')}
            className="min-h-[44px] px-4 rounded-xl bg-whatsapp text-white font-semibold text-sm flex items-center justify-center gap-2 hover:brightness-95"
          >
            <MessageCircle className="w-4 h-4" />
            <span>{lang === 'ur' ? 'واٹس ایپ' : 'WhatsApp'}</span>
          </a>
          <a
            href={`sms:?body=${encodeURIComponent(shareText)}`}
            onClick={() => trackBusinessEvent(business.id, 'share')}
            className="min-h-[44px] px-4 rounded-xl bg-primary-fixed text-on-primary-fixed font-semibold text-sm flex items-center justify-center gap-2 hover:brightness-95"
          >
            <MessageSquare className="w-4 h-4" />
            <span>{lang === 'ur' ? 'ایس ایم ایس' : 'Direct SMS'}</span>
          </a>
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackBusinessEvent(business.id, 'share')}
            className="min-h-[44px] px-4 rounded-xl bg-[#1877F2] text-white font-semibold text-sm flex items-center justify-center gap-2 hover:brightness-95"
          >
            <Facebook className="w-4 h-4" />
            <span>{lang === 'ur' ? 'فیس بک' : 'Facebook'}</span>
          </a>
          <button
            type="button"
            onClick={downloadVCard}
            className="min-h-[44px] px-4 rounded-xl bg-secondary-fixed text-on-secondary-fixed font-semibold text-sm flex items-center justify-center gap-2 hover:brightness-95 cursor-pointer"
          >
            <Contact className="w-4 h-4" />
            <span>{lang === 'ur' ? 'کانٹیکٹ محفوظ (.vcf)' : 'Save Contact (.vcf)'}</span>
          </button>
        </div>

        <Button
          variant="outline"
          fullWidth
          onClick={copyLink}
          leftIcon={copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
        >
          {copied
            ? lang === 'ur'
              ? 'لنک کاپی ہو گیا!'
              : 'Copied!'
            : lang === 'ur'
            ? 'لنک کاپی کریں'
            : 'Copy Link'}
        </Button>

        {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
          <Button variant="primary" fullWidth onClick={nativeShare} leftIcon={<Share2 className="w-4 h-4" />}>
            {lang === 'ur' ? 'ڈیوائس شیئر مینو' : 'Device Share Menu'}
          </Button>
        )}
      </div>
    </Modal>
  );
}
