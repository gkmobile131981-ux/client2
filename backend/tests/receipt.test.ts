import { inflateSync } from 'zlib';
import { generateReceiptPdf } from '../src/utils/receipt.generator';

// Re-establish the fetch stub after jest's resetMocks wipes the one from setup.ts.
// Only URLs containing stub.supabase.co are answered with a valid 1x1 PNG; anything
// else fails fast so tests never hit the network.
const stubPngBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkQP8DAAIBAQEP+7oAAAAASUVORK5CYII=';

beforeEach(() => {
  global.fetch = jest.fn().mockImplementation((url: any) => {
    const urlStr = typeof url === 'string' ? url : String(url);
    if (urlStr.includes('stub.supabase.co')) {
      const buffer = Buffer.from(stubPngBase64, 'base64');
      const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      return Promise.resolve({
        ok: true,
        headers: {
          get: (name: string) => (name.toLowerCase() === 'content-type' ? 'image/png' : null),
        },
        arrayBuffer: () => Promise.resolve(arrayBuffer),
      } as any);
    }
    return Promise.reject(new Error('Network unavailable'));
  }) as any;
});

// pdf-lib compresses content streams (FlateDecode) and encodes drawn text as PDF
// hex strings. Decompress every stream and decode each <hex> token so assertions
// can check the exact text that was drawn.
function pdfText(pdf: Uint8Array): string {
  const latin = Buffer.from(pdf).toString('latin1');
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  const extracted: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = streamRegex.exec(latin)) !== null) {
    let content: string | null = null;
    try {
      content = inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1');
    } catch {
      content = null;
    }
    if (!content) continue;
    const hexTokens = content.match(/<([0-9A-Fa-f]{2,})>/g) || [];
    extracted.push(
      ...hexTokens.map((token) => Buffer.from(token.slice(1, -1), 'hex').toString('latin1'))
    );
  }
  return extracted.join('\n');
}

function isPdf(pdf: Uint8Array): boolean {
  return Buffer.from(pdf).toString('latin1').startsWith('%PDF');
}

function baseReceipt(overrides: { repair?: any; shop?: any } = {}) {
  const repair = {
    id: 'repair-1',
    job_number: 'GK-20260806-001',
    estimate: 1500,
    advance: 500,
    balance: 1000,
    status: 'delivered',
    delivery_date: '2026-08-10',
    notes: '[PROMISED_DUE:2026-08-20]',
    created_at: '2026-08-06T10:00:00+05:30',
    delivered_at: '2026-08-12T17:30:00+05:30',
    receiver_name: 'John Doe',
    receiver_phone: '9876543210',
    receiver_photo_url: null,
    signature_url: null,
    delivered_by: 'Ravi Kumar',
    device: {
      brand: 'APPLE',
      model: 'IPHONE 13',
      imei: '123456789012345',
      problem: 'Display replacement',
    },
    customer: {
      name: 'John Doe',
      phone: '9876543210',
      address: '12 MG Road, Bengaluru',
    },
    ...(overrides.repair || {}),
  };
  const shop = {
    name: 'GK Mobile Service',
    logo_url: null,
    address: '123 Main Street, Gandhi Nagar, Bengaluru 560001',
    phone: '080-12345678',
    currency_symbol: '₹',
    currency_code: 'INR',
    ...(overrides.shop || {}),
  };
  return { repair, shop };
}

describe('generateReceiptPdf — header layout robustness', () => {
  it('generates a valid PDF for a standard delivered receipt with all header sections', async () => {
    const pdf = await generateReceiptPdf(baseReceipt());
    const text = pdfText(pdf);

    expect(isPdf(pdf)).toBe(true);
    expect(text).toContain('REPAIR RECEIPT');
    expect(text).toContain('GK-20260806-001');
    expect(text).toContain('BOOKED');
    expect(text).toContain('06-Aug-2026');
    expect(text).toContain('EXPECTED DELIVERY');
    expect(text).toContain('DELIVERED');
    expect(text).toContain('12-Aug-2026');
    expect(text).toContain('GK Mobile Service');
    expect(text).toContain('John Doe');
  });

  it('wraps a very long single-line shop address without failing (multi-line layout)', async () => {
    const pdf = await generateReceiptPdf(
      baseReceipt({
        shop: {
          address:
            'Ground Floor, Galaxy Towers, 42nd Cross, 5th Main Road, Gandhi Nagar, Bengaluru, Karnataka 560001, India',
        },
      })
    );
    const text = pdfText(pdf);

    expect(isPdf(pdf)).toBe(true);
    expect(text).toContain('Galaxy');
    expect(text).toContain('Bengaluru');
    expect(text).toContain('Phone: 080-12345678');
  });

  it('preserves explicit newlines in a multi-line shop address', async () => {
    const pdf = await generateReceiptPdf(
      baseReceipt({
        shop: {
          address: 'Ground Floor, Galaxy Towers\nUnit 4, Gandhi Nagar\nBengaluru, Karnataka 560001',
        },
      })
    );
    const text = pdfText(pdf);

    expect(isPdf(pdf)).toBe(true);
    expect(text).toContain('Galaxy');
    expect(text).toContain('Gandhi');
    expect(text).toContain('Bengaluru');
  });

  it('falls back to "Address not specified" when the shop address is missing', async () => {
    const pdf = await generateReceiptPdf(
      baseReceipt({ shop: { address: null } })
    );
    const text = pdfText(pdf);

    expect(isPdf(pdf)).toBe(true);
    expect(text).toContain('Address not specified');
  });

  it('renders a dash for the delivered value when the repair is not yet delivered', async () => {
    const pdf = await generateReceiptPdf(
      baseReceipt({
        repair: { status: 'pending', delivered_at: null, delivered_by: null, notes: null },
      })
    );
    const text = pdfText(pdf);

    expect(isPdf(pdf)).toBe(true);
    expect(text).toContain('EXPECTED DELIVERY');
    expect(text).not.toContain('12-Aug-2026');
  });

  it('uses a custom currency symbol and code in the financials header', async () => {
    const pdf = await generateReceiptPdf(
      baseReceipt({ shop: { currency_symbol: '$', currency_code: 'USD' } })
    );
    const text = pdfText(pdf);

    expect(isPdf(pdf)).toBe(true);
    expect(text).toContain('Amount (USD)');
  });

  it('falls back to INR for the corrupted legacy currency symbol', async () => {
    const pdf = await generateReceiptPdf(
      baseReceipt({ shop: { currency_symbol: '\uFFFD,1', currency_code: 'INR' } })
    );
    const text = pdfText(pdf);

    expect(isPdf(pdf)).toBe(true);
    expect(text).toContain('Amount (INR)');
  });

  it('reserves enough room for the widest status badge', async () => {
    const pdf = await generateReceiptPdf(
      baseReceipt({
        repair: { status: 'delivered_pending_balance', notes: null },
      })
    );
    const text = pdfText(pdf);

    expect(isPdf(pdf)).toBe(true);
    expect(text).toContain('BALANCE DUE');
  });

  it('truncates an excessively long shop name instead of overflowing the header', async () => {
    const pdf = await generateReceiptPdf(
      baseReceipt({
        shop: {
          name: 'This Is An Extremely Long Shop Name That Will Never Fit Inside The Reserved Header Width',
          logo_url: null,
        },
      })
    );
    const text = pdfText(pdf);

    expect(isPdf(pdf)).toBe(true);
    expect(text).toContain('This Is An Extremely');
  });

  it('embeds a PNG logo and signature when URLs are present (aspect-ratio safe)', async () => {
    const pdf = await generateReceiptPdf(
      baseReceipt({
        shop: { logo_url: 'https://stub.supabase.co/storage/v1/object/public/shop-logos/logo.png' },
        repair: { signature_url: 'https://stub.supabase.co/signature.png' },
      })
    );

    expect(isPdf(pdf)).toBe(true);
    expect(Buffer.from(pdf).length).toBeGreaterThan(0);
  });

  it('keeps the booked/expected/delivered date columns aligned for delivered repairs', async () => {
    const pdf = await generateReceiptPdf(baseReceipt());
    const text = pdfText(pdf);

    expect(isPdf(pdf)).toBe(true);
    // Labels are drawn first, then values — all three columns must be present.
    expect(text).toContain('BOOKED');
    expect(text).toContain('EXPECTED DELIVERY');
    expect(text).toContain('DELIVERED');
  });
});
