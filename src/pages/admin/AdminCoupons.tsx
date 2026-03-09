import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Upload, Download, Gift, MessageCircle, FileText, Sparkles, CheckCircle, XCircle, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import logoSrc from '@/assets/drona-logo-coupon.png';

interface AttendeeRow {
  name: string;
  mobile: string;
  valid: boolean;
  error?: string;
}

interface GeneratedCoupon {
  row: AttendeeRow;
  code: string;
  blob: Blob;
  objectUrl: string;
}

const GOLD1 = '#F5B942';
const GOLD2 = '#C8841A';
const GOLD3 = '#FFE08A';
const DARK_BG = '#0A0A0F';
const CARD_BG = '#12111A';
const BORDER_GOLD = '#8B6914';

const W = 750;
const H = 1050;

function generateCode(mobile: string): string {
  return `WC25-${mobile.slice(-4)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

async function buildCouponCanvas(row: AttendeeRow, discountText: string, code: string, logoImg: HTMLImageElement): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // ── Background ────────────────────────────────────────────────────────────────
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, '#0D0B14');
  bgGrad.addColorStop(0.5, '#0F0E1A');
  bgGrad.addColorStop(1, '#0A0A0F');
  ctx.fillStyle = bgGrad;
  roundRect(ctx, 0, 0, W, H, 28);
  ctx.fill();

  // Outer gold border
  ctx.strokeStyle = BORDER_GOLD;
  ctx.lineWidth = 2;
  roundRect(ctx, 1, 1, W - 2, H - 2, 27);
  ctx.stroke();

  // Inner subtle glow border
  ctx.strokeStyle = 'rgba(245,185,66,0.18)';
  ctx.lineWidth = 8;
  roundRect(ctx, 10, 10, W - 20, H - 20, 22);
  ctx.stroke();

  // ── Decorative star dots ──────────────────────────────────────────────────────
  const stars = [
    [60, 80], [690, 100], [30, 400], [720, 350], [80, 900], [670, 880],
    [150, 60], [600, 55], [40, 600], [710, 620],
  ];
  stars.forEach(([sx, sy]) => {
    ctx.beginPath();
    ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(245,185,66,0.5)';
    ctx.fill();
  });

  // ── Header zone card ─────────────────────────────────────────────────────────
  const headerGrad = ctx.createLinearGradient(0, 30, 0, 270);
  headerGrad.addColorStop(0, 'rgba(245,185,66,0.12)');
  headerGrad.addColorStop(1, 'rgba(10,10,15,0)');
  ctx.fillStyle = headerGrad;
  roundRect(ctx, 30, 30, W - 60, 240, 16);
  ctx.fill();

  // Trophy emoji
  ctx.font = '72px serif';
  ctx.textAlign = 'center';
  ctx.fillText('🏆', W / 2, 120);

  // "INDIA WON!" title
  const titleGrad = ctx.createLinearGradient(0, 130, 0, 185);
  titleGrad.addColorStop(0, GOLD3);
  titleGrad.addColorStop(0.5, GOLD1);
  titleGrad.addColorStop(1, GOLD2);
  ctx.fillStyle = titleGrad;
  ctx.font = 'bold 58px "Cinzel", "Georgia", serif';
  ctx.letterSpacing = '4px';
  ctx.fillText('INDIA WON!', W / 2, 182);

  // Subtitle
  ctx.font = '500 20px "Cinzel", "Georgia", serif';
  ctx.fillStyle = 'rgba(245,185,66,0.7)';
  ctx.fillText('T20 World Cup Final  ·  India vs New Zealand', W / 2, 218);

  // ── Gold divider ─────────────────────────────────────────────────────────────
  const divGrad = ctx.createLinearGradient(60, 0, W - 60, 0);
  divGrad.addColorStop(0, 'transparent');
  divGrad.addColorStop(0.3, GOLD1);
  divGrad.addColorStop(0.7, GOLD1);
  divGrad.addColorStop(1, 'transparent');
  ctx.strokeStyle = divGrad;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(60, 252);
  ctx.lineTo(W - 60, 252);
  ctx.stroke();

  // ── Personalization ───────────────────────────────────────────────────────────
  ctx.font = '400 18px "Cinzel", "Georgia", serif';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText('Congratulations,', W / 2, 290);

  ctx.font = 'bold 38px "Cinzel", "Georgia", serif';
  ctx.fillStyle = '#FFFFFF';
  const displayName = row.name.toUpperCase();
  // truncate if too long
  const maxW = W - 100;
  let fontSize = 38;
  ctx.font = `bold ${fontSize}px "Cinzel", "Georgia", serif`;
  while (ctx.measureText(displayName).width > maxW && fontSize > 20) {
    fontSize -= 2;
    ctx.font = `bold ${fontSize}px "Cinzel", "Georgia", serif`;
  }
  ctx.fillText(displayName, W / 2, 338);

  // ── Coupon body card ──────────────────────────────────────────────────────────
  const cardGrad = ctx.createLinearGradient(0, 370, 0, 640);
  cardGrad.addColorStop(0, 'rgba(245,185,66,0.08)');
  cardGrad.addColorStop(1, 'rgba(200,132,26,0.04)');
  ctx.fillStyle = cardGrad;
  roundRect(ctx, 40, 370, W - 80, 270, 16);
  ctx.fill();
  ctx.strokeStyle = 'rgba(245,185,66,0.25)';
  ctx.lineWidth = 1;
  roundRect(ctx, 40, 370, W - 80, 270, 16);
  ctx.stroke();

  // Discount label
  ctx.font = '400 16px "Cinzel", "Georgia", serif';
  ctx.fillStyle = 'rgba(245,185,66,0.6)';
  ctx.fillText('YOUR EXCLUSIVE DISCOUNT', W / 2, 405);

  // Discount amount — large gradient text
  const discGrad = ctx.createLinearGradient(0, 415, 0, 500);
  discGrad.addColorStop(0, GOLD3);
  discGrad.addColorStop(0.5, GOLD1);
  discGrad.addColorStop(1, GOLD2);
  ctx.fillStyle = discGrad;
  ctx.font = `bold 62px "Cinzel", "Georgia", serif`;
  const dw = ctx.measureText(discountText).width;
  // scale down if too wide
  let dFontSize = 62;
  while (dw > maxW && dFontSize > 28) {
    dFontSize -= 2;
    ctx.font = `bold ${dFontSize}px "Cinzel", "Georgia", serif`;
  }
  ctx.fillText(discountText, W / 2, 490);

  // Coupon code pill
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(ctx, 175, 510, 400, 50, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(245,185,66,0.4)';
  ctx.lineWidth = 1;
  roundRect(ctx, 175, 510, 400, 50, 12);
  ctx.stroke();

  ctx.font = 'bold 22px "Courier New", monospace';
  ctx.fillStyle = GOLD1;
  ctx.fillText(code, W / 2, 542);

  // Redemption note
  ctx.font = '400 16px "Cinzel", "Georgia", serif';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText('Valid on your next visit to Hotel Drona Palace', W / 2, 590);

  ctx.font = '400 13px "Cinzel", "Georgia", serif';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillText('Present this coupon at the hotel reception to redeem', W / 2, 615);

  // ── Wavy cut perforations ─────────────────────────────────────────────────────
  ctx.strokeStyle = 'rgba(245,185,66,0.2)';
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(60, 660);
  ctx.lineTo(W - 60, 660);
  ctx.stroke();
  ctx.setLineDash([]);

  // ── Logo zone ─────────────────────────────────────────────────────────────────
  const logoSize = 80;
  const logoX = W / 2 - logoSize / 2;
  const logoY = 676;
  ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);

  ctx.font = 'bold 26px "Cinzel", "Georgia", serif';
  const hotelGrad = ctx.createLinearGradient(0, 772, 0, 800);
  hotelGrad.addColorStop(0, GOLD1);
  hotelGrad.addColorStop(1, GOLD2);
  ctx.fillStyle = hotelGrad;
  ctx.fillText('Hotel Drona Palace', W / 2, 798);

  ctx.font = '400 13px "Cinzel", "Georgia", serif';
  ctx.fillStyle = 'rgba(245,185,66,0.55)';
  ctx.fillText('(A UNIT OF SR LEISURE INN)', W / 2, 822);

  // ── Bottom divider ────────────────────────────────────────────────────────────
  ctx.strokeStyle = 'rgba(245,185,66,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, 840);
  ctx.lineTo(W - 60, 840);
  ctx.stroke();

  // ── Footer strip ─────────────────────────────────────────────────────────────
  ctx.font = '400 14px "Cinzel", "Georgia", serif';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillText('As a valued guest who attended the T20 World Cup Final Night', W / 2, 875);

  ctx.font = '400 13px "Cinzel", "Georgia", serif';
  ctx.fillStyle = 'rgba(245,185,66,0.4)';
  ctx.fillText('cricket.dronapalace.com', W / 2, 900);

  // Small confetti dots decorative
  const confettiColors = [GOLD1, '#4FC3F7', '#EF5350', '#66BB6A', GOLD3];
  [[120, 940], [200, 960], [375, 970], [560, 955], [640, 940], [90, 965], [680, 965]].forEach(([cx, cy], i) => {
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = confettiColors[i % confettiColors.length];
    ctx.globalAlpha = 0.5;
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  ctx.font = '300 12px "Cinzel", "Georgia", serif';
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillText('One-time use only  ·  Non-transferable  ·  Subject to availability', W / 2, 1010);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('Canvas toBlob failed')), 'image/png');
  });
}

function parseCSV(text: string): AttendeeRow[] {
  const lines = text.trim().split('\n').filter(Boolean);
  return lines
    .filter(l => !l.toLowerCase().startsWith('name')) // skip header
    .map(line => {
      const parts = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
      const name = parts[0] || '';
      const rawMobile = (parts[1] || '').replace(/\D/g, '');
      const mobile = rawMobile.length === 12 && rawMobile.startsWith('91')
        ? rawMobile.slice(2)
        : rawMobile;
      const valid = name.length > 0 && mobile.length === 10;
      return { name, mobile, valid, error: !valid ? (!name ? 'Missing name' : 'Invalid mobile') : undefined };
    });
}

type DiscountType = 'flat' | 'percent';

export default function AdminCoupons() {
  const { toast } = useToast();
  const [discountType, setDiscountType] = useState<DiscountType>('flat');
  const [discountValue, setDiscountValue] = useState('500');
  const [rows, setRows] = useState<AttendeeRow[]>([]);
  const [coupons, setCoupons] = useState<GeneratedCoupon[]>([]);
  const [generating, setGenerating] = useState(false);
  const [fontReady, setFontReady] = useState(false);
  const logoRef = useRef<HTMLImageElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const discountText = discountType === 'flat' ? `₹${discountValue} Off` : `${discountValue}% Off`;

  // Preload font + logo on mount
  useEffect(() => {
    const img = new Image();
    img.onload = () => { logoRef.current = img; };
    img.src = logoSrc;

    async function loadFont() {
      try {
        // Load Cinzel from Google Fonts gstatic
        const regular = new FontFace('Cinzel', "url(https://fonts.gstatic.com/s/cinzel/v23/8vIJ7ww63mVu7gtR-kwKxNvkNOjw-tbnTYrvDE5ZdqU.woff2)");
        const bold = new FontFace('Cinzel', "url(https://fonts.gstatic.com/s/cinzel/v23/8vIJ7ww63mVu7gtR-kwKxNvkNOjw-uDnTYrvDE5ZdqU.woff2)", { weight: 'bold' });
        await Promise.all([regular.load(), bold.load()]).then(faces => faces.forEach(f => document.fonts.add(f)));
        setFontReady(true);
      } catch {
        setFontReady(true); // fallback ok
      }
    }
    loadFont();
  }, []);

  const downloadTemplate = () => {
    const csv = 'name,mobile\nRahul Sharma,9876543210\nPriya Verma,9123456789';
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'attendees-template.csv';
    a.click();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const parsed = parseCSV(ev.target?.result as string);
      setRows(parsed);
      setCoupons([]);
      toast({ title: `Parsed ${parsed.length} rows`, description: `${parsed.filter(r => r.valid).length} valid entries` });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const generateAll = useCallback(async () => {
    if (!logoRef.current) {
      toast({ title: 'Logo not loaded yet', description: 'Please wait a moment and try again', variant: 'destructive' });
      return;
    }
    const valid = rows.filter(r => r.valid);
    if (!valid.length) return;
    setGenerating(true);
    const results: GeneratedCoupon[] = [];
    for (const row of valid) {
      try {
        const code = generateCode(row.mobile);
        const blob = await buildCouponCanvas(row, discountText, code, logoRef.current!);
        results.push({ row, code, blob, objectUrl: URL.createObjectURL(blob) });
      } catch (err) {
        console.error('Coupon gen error', err);
      }
    }
    setCoupons(results);
    setGenerating(false);
    toast({ title: `✅ ${results.length} coupons generated!` });
  }, [rows, discountText, toast]);

  const downloadOne = (coupon: GeneratedCoupon) => {
    const a = document.createElement('a');
    a.href = coupon.objectUrl;
    a.download = `WC25-${coupon.row.name.replace(/\s+/g, '-')}-${coupon.code}.png`;
    a.click();
  };

  const downloadAll = () => {
    coupons.forEach((c, i) => setTimeout(() => downloadOne(c), i * 300));
  };

  const whatsappText = (coupon: GeneratedCoupon) =>
    encodeURIComponent(
      `🏆 Congratulations, ${coupon.row.name}!\n\n` +
      `India won the T20 World Cup Final vs New Zealand 🎉\n\n` +
      `As a valued guest of Hotel Drona Palace who attended the Final Night, we're delighted to offer you an exclusive discount on your next visit.\n\n` +
      `🎟️ Your Coupon Code: ${coupon.code}\n` +
      `💰 Discount: ${discountText}\n\n` +
      `Valid for redemption at Hotel Drona Palace.\n` +
      `Present this coupon at the hotel reception.\n\n` +
      `— Hotel Drona Palace\n(A Unit of SR Leisure Inn)\ncricket.dronapalace.com`
    );

  const shareOne = async (coupon: GeneratedCoupon) => {
    if (navigator.share && navigator.canShare) {
      const file = new File([coupon.blob], `${coupon.code}.png`, { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: `Victory Coupon for ${coupon.row.name}` });
          return;
        } catch { /* fall through to WA */ }
      }
    }
    // Fallback: download + open WhatsApp
    downloadOne(coupon);
    setTimeout(() => {
      window.open(`https://wa.me/91${coupon.row.mobile}?text=${whatsappText(coupon)}`, '_blank');
    }, 500);
  };

  const validCount = rows.filter(r => r.valid).length;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg">
          <Gift className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">Victory Coupon Generator</h1>
          <p className="text-sm text-muted-foreground">T20 World Cup Final — India 🏆 vs New Zealand</p>
        </div>
      </div>

      {/* Config card */}
      <GlassCard className="p-5 space-y-4">
        <h2 className="font-display font-semibold text-foreground text-sm uppercase tracking-wide flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-400" /> Coupon Settings
        </h2>
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs text-muted-foreground">Discount Text (shown on coupon)</Label>
            <Input
              value={discountText}
              onChange={e => setDiscountText(e.target.value)}
              placeholder="e.g. ₹500 Off, 20% Off, Complimentary Breakfast"
              className="font-medium"
            />
          </div>
          <Button variant="outline" size="sm" onClick={downloadTemplate} className="flex items-center gap-2 whitespace-nowrap">
            <FileText className="h-4 w-4" /> Download CSV Template
          </Button>
        </div>
      </GlassCard>

      {/* Upload card */}
      <GlassCard className="p-5 space-y-4">
        <h2 className="font-display font-semibold text-foreground text-sm uppercase tracking-wide flex items-center gap-2">
          <Upload className="h-4 w-4 text-primary" /> Upload Attendees CSV
        </h2>
        <div
          className="border-2 border-dashed border-border hover:border-primary/50 rounded-xl p-8 text-center cursor-pointer transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Click to upload CSV <span className="text-primary font-medium">name,mobile</span></p>
          <p className="text-xs text-muted-foreground mt-1">Mobile: 10-digit Indian number</p>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileUpload} />
        </div>

        {rows.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{rows.length} rows parsed · <span className="text-green-400">{validCount} valid</span> · <span className="text-destructive">{rows.length - validCount} invalid</span></p>
              <Button
                onClick={generateAll}
                disabled={generating || validCount === 0 || !fontReady}
                className="bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-semibold"
              >
                {generating ? 'Generating...' : `Generate ${validCount} Coupons`}
              </Button>
            </div>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr>
                    <th className="text-left px-3 py-2 text-muted-foreground font-medium text-xs">Name</th>
                    <th className="text-left px-3 py-2 text-muted-foreground font-medium text-xs">Mobile</th>
                    <th className="text-left px-3 py-2 text-muted-foreground font-medium text-xs">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t border-border/50">
                      <td className="px-3 py-1.5 text-foreground">{r.name || <span className="text-destructive italic">empty</span>}</td>
                      <td className="px-3 py-1.5 text-muted-foreground font-mono">{r.mobile || '—'}</td>
                      <td className="px-3 py-1.5">
                        {r.valid
                          ? <Badge variant="outline" className="text-green-400 border-green-400/30 bg-green-400/5 text-xs"><CheckCircle className="h-3 w-3 mr-1" />Valid</Badge>
                          : <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/5 text-xs"><XCircle className="h-3 w-3 mr-1" />{r.error}</Badge>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </GlassCard>

      {/* Generated coupons */}
      {coupons.length > 0 && (
        <GlassCard className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold text-foreground text-sm uppercase tracking-wide flex items-center gap-2">
              <Gift className="h-4 w-4 text-amber-400" /> {coupons.length} Coupons Ready
            </h2>
            <Button variant="outline" size="sm" onClick={downloadAll} className="flex items-center gap-2">
              <Download className="h-4 w-4" /> Download All
            </Button>
          </div>
          <div className="space-y-3">
            {coupons.map((c, i) => (
              <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl bg-muted/20 border border-border/50">
                <img src={c.objectUrl} alt={`Coupon for ${c.row.name}`} className="w-full sm:w-24 sm:h-32 object-contain rounded-lg border border-border/40" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">{c.row.name}</p>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{c.row.mobile}</p>
                  <p className="text-xs text-amber-400 font-mono mt-1">{c.code}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{discountText}</p>
                </div>
                <div className="flex sm:flex-col gap-2">
                  <Button size="sm" variant="outline" onClick={() => downloadOne(c)} className="flex items-center gap-1.5 flex-1 sm:flex-none">
                    <Download className="h-3.5 w-3.5" /> Download
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => shareOne(c)}
                    className="flex items-center gap-1.5 flex-1 sm:flex-none bg-green-600 hover:bg-green-500 text-white border-0"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    WhatsApp
                  </Button>
                  {navigator.share && (
                    <Button size="sm" variant="ghost" onClick={() => shareOne(c)} className="flex items-center gap-1.5 flex-1 sm:flex-none">
                      <Share2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
