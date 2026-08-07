import fs from 'fs';
import path from 'path';
import { formatDateOnly } from './date';

// Define the file path for local mock/sandbox logs
const logsPath = path.join(__dirname, '../../whatsapp_logs.json');

// Interface for repair log details
export interface WhatsAppLogEntry {
  id: string;
  timestamp: string;
  recipientName: string;
  recipientPhone: string;
  jobNumber: string;
  deviceInfo: string;
  shopName: string;
  stage: string;
  message: string;
  notes?: string | null;
  provider: string;
  status: 'sent' | 'failed' | 'sandbox';
  error?: string;
  messageId?: string;
}

/**
 * Retrieve WhatsApp log history from the local database file
 */
export function getWhatsAppLogs(): WhatsAppLogEntry[] {
  try {
    if (fs.existsSync(logsPath)) {
      const data = fs.readFileSync(logsPath, 'utf8');
      return JSON.parse(data) as WhatsAppLogEntry[];
    }
  } catch (err) {
    console.error('[WhatsApp Service] Error reading logs:', err);
  }
  return [];
}

/**
 * Save a new log entry to the local log database
 */
export function saveWhatsAppLog(entry: WhatsAppLogEntry): void {
  try {
    const logs = getWhatsAppLogs();
    logs.unshift(entry); // Newest logs first
    
    // Limit to last 200 logs to prevent bloat
    if (logs.length > 200) {
      logs.pop();
    }
    
    fs.writeFileSync(logsPath, JSON.stringify(logs, null, 2), 'utf8');
  } catch (err) {
    console.error('[WhatsApp Service] Error writing log:', err);
  }
}

/**
 * Clean logs from the local database
 */
export function clearWhatsAppLogs(): void {
  try {
    if (fs.existsSync(logsPath)) {
      fs.writeFileSync(logsPath, JSON.stringify([], null, 2), 'utf8');
    }
  } catch (err) {
    console.error('[WhatsApp Service] Error clearing logs:', err);
  }
}

/**
 * Format status update template text message
 */
function formatMessage(
  customerName: string,
  jobNumber: string,
  brand: string,
  model: string,
  status: string,
  shopName: string,
  balance: number,
  notes?: string | null
): string {
  const cleanBrand = brand.trim();
  const cleanModel = model.trim();
  let device = `${cleanBrand} ${cleanModel}`;
  if (cleanBrand.toLowerCase() === cleanModel.toLowerCase()) {
    device = cleanBrand;
  } else if (cleanModel.toLowerCase().startsWith(cleanBrand.toLowerCase())) {
    device = cleanModel;
  }
  
  let stageMsg = '';
  switch (status) {
    case 'booking':
      stageMsg = `has been booked and registered into our system.`;
      break;
    case 'pending':
      stageMsg = `has been registered and is pending analysis.`;
      break;
    case 'repairing':
      stageMsg = `is currently under repair.`;
      break;
    case 'ready':
      stageMsg = `is ready for pickup! 🎁 Balance due: ₹${balance.toFixed(2)}. Please bring your token to the shop.`;
      break;
    case 'delivered':
      stageMsg = `has been successfully delivered. Thank you for choosing us!`;
      break;
    case 'cancelled':
      stageMsg = `has been cancelled.`;
      break;
    default:
      stageMsg = `status has been updated to "${status}".`;
  }

  let text = `Hello *${customerName}*,\n\n`;
  text += `Your repair order *${jobNumber}* for *${device}* ${stageMsg}\n\n`;
  
  if (notes) {
    text += `*Update Notes:* ${notes}\n\n`;
  }
  
  text += `Regards,\n*${shopName}*`;
  return text;
}

/**
 * Dispatches a WhatsApp notification to the customer
 */
export async function sendWhatsAppUpdate(
  repair: {
    id: string;
    job_number: string;
    estimate: number;
    advance: number;
    status: string;
    notes?: string | null;
    device?: {
      brand: string;
      model: string;
      customer?: {
        name: string;
        phone: string;
      } | null;
    } | null;
    customer?: {
      name: string;
      phone: string;
    } | null;
    shop?: {
      name: string;
      phone?: string | null;
    } | null;
  },
  newStatus: string,
  statusNote?: string | null
): Promise<{ success: boolean; messageId?: string; error?: string; isSandbox?: boolean; whatsappUrl?: string }> {
  const customer = repair.customer || repair.device?.customer;
  // If no customer data, we cannot notify
  if (!customer || !customer.phone) {
    return { success: false, error: 'No customer phone contact available.' };
  }

  const customerName = customer.name;
  const customerPhone = customer.phone.replace(/\D/g, ''); // standard digits only
  const jobNumber = repair.job_number;
  const brand = repair.device?.brand || 'Unknown';
  const model = repair.device?.model || 'Device';
  const shopName = repair.shop?.name || 'GK Repair Shop';
  const balance = Number(repair.estimate) - Number(repair.advance);
  
  const formattedText = formatMessage(
    customerName,
    jobNumber,
    brand,
    model,
    newStatus,
    shopName,
    balance,
    statusNote || repair.notes
  );

  const provider = (process.env.WHATSAPP_PROVIDER || 'mock').toLowerCase();

  // Basic validation log metadata
  const baseLog: WhatsAppLogEntry = {
    id: repair.id,
    timestamp: new Date().toISOString(),
    recipientName: customerName,
    recipientPhone: customer.phone,
    jobNumber,
    deviceInfo: `${brand} ${model}`,
    shopName,
    stage: newStatus,
    message: formattedText,
    notes: statusNote || repair.notes,
    provider,
    status: 'sandbox'
  };

  // If in Jest testing, always default to mock to avoid network hits
  if (process.env.NODE_ENV === 'test') {
    saveWhatsAppLog({ ...baseLog, status: 'sandbox' });
    return { success: true, messageId: 'test-stub-id' };
  }

  try {
    if (provider === 'meta') {
      const accessToken = process.env.WHATSAPP_META_ACCESS_TOKEN;
      const phoneNumberId = process.env.WHATSAPP_META_PHONE_NUMBER_ID;

      if (!accessToken || !phoneNumberId) {
        throw new Error('Meta credentials (WHATSAPP_META_ACCESS_TOKEN / WHATSAPP_META_PHONE_NUMBER_ID) not configured.');
      }

      // Meta Cloud API supports free-form messages only inside 24h customer-care window.
      // Outside 24h, Meta requires approved WhatsApp templates.
      // We send a direct text message payload (compatible with active sessions and sandbox tests).
      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: customerPhone,
        type: 'text',
        text: {
          preview_url: false,
          body: formattedText
        }
      };

      const response = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(payload)
      });

      const responseData: any = await response.json();

      if (!response.ok) {
        const errorMsg = responseData.error?.message || 'Meta API error response';
        saveWhatsAppLog({
          ...baseLog,
          status: 'failed',
          error: errorMsg
        });
        return { success: false, error: errorMsg };
      }

      saveWhatsAppLog({
        ...baseLog,
        status: 'sent',
        messageId: responseData.messages?.[0]?.id
      });
      return { success: true, messageId: responseData.messages?.[0]?.id };

    } else if (provider === 'twilio') {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const from = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886'; // Twilio sandbox fallback

      if (!accountSid || !authToken) {
        throw new Error('Twilio credentials (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN) not configured.');
      }

      // Format Twilio numbers (must start with whatsapp:)
      const toPhone = customerPhone.startsWith('+') ? `whatsapp:${customerPhone}` : `whatsapp:+${customerPhone}`;
      const fromPhone = from.startsWith('whatsapp:') ? from : `whatsapp:${from}`;

      // Call Twilio REST API
      const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');
      const params = new URLSearchParams();
      params.append('To', toPhone);
      params.append('From', fromPhone);
      params.append('Body', formattedText);

      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': authHeader
        },
        body: params
      });

      const responseData: any = await response.json();

      if (!response.ok) {
        const errorMsg = responseData.message || 'Twilio API error response';
        saveWhatsAppLog({
          ...baseLog,
          status: 'failed',
          error: errorMsg
        });
        return { success: false, error: errorMsg };
      }

      saveWhatsAppLog({
        ...baseLog,
        status: 'sent',
        messageId: responseData.sid
      });
      return { success: true, messageId: responseData.sid };

    } else {
      // Mock / Sandbox mode fallback
      console.log('--- [WhatsApp MOCK Sandbox Notification] ---');
      console.log(`To: ${customerName} (${customerPhone})`);
      console.log(`Message:\n${formattedText}`);
      console.log('---------------------------------------------');

      saveWhatsAppLog({
        ...baseLog,
        status: 'sandbox'
      });

      let phoneNum = customerPhone;
      if (phoneNum.length === 10) {
        phoneNum = '91' + phoneNum;
      }
      const whatsappUrl = `https://api.whatsapp.com/send?phone=${phoneNum}&text=${encodeURIComponent(formattedText)}`;

      return { 
        success: true, 
        messageId: `mock-id-${Date.now()}`,
        isSandbox: true,
        whatsappUrl
      };
    }
  } catch (err: any) {
    console.error('[WhatsApp Service] Dispatch error:', err);
    saveWhatsAppLog({
      ...baseLog,
      status: 'failed',
      error: err.message
    });
    return { success: false, error: err.message };
  }
}

/**
 * Normalize a phone number into E.164-ish form for a WhatsApp deep link.
 * 10-digit local numbers are assumed to be Indian (+91) to match the app's
 * currency/region convention.
 */
function toE164Local(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '');
  if (digits.length === 10) return '91' + digits;
  return digits.replace(/^00/, '');
}

/**
 * Dispatch an OTP message for password reset / verification.
 *
 * Reuses the same provider configuration the rest of the app uses for
 * WhatsApp notifications (WHATSAPP_PROVIDER = 'meta' | 'twilio' | 'mock'),
 * so once the app can deliver repair status updates, the OTP can be delivered too.
 *
 * - 'meta': real WhatsApp Cloud API send (free-form text; template required only
 *   outside the 24h window). On API rejection it degrades to a deep link.
 * - 'twilio': real SMS via the Twilio REST API (fetch based, no SDK dependency).
 * - 'mock' (default): logs to console + whatsapp_logs.json and returns a
 *   wa.me deep link the user can tap to receive the code over WhatsApp.
 */
export async function sendOtpMessage(payload: {
  phone: string;
  otp: string;
  name?: string;
  purpose?: string;
}): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
  isSandbox?: boolean;
  whatsappUrl?: string;
  provider: string;
}> {
  const headline = payload.purpose || 'password reset';
  const recipientName = payload.name || 'there';
  const digits = (payload.phone || '').replace(/\D/g, '');
  const mobile = toE164Local(payload.phone);

  const text = [
    `Hello ${recipientName},`,
    ``,
    `Your GK Repair System OTP for ${headline} is: ${payload.otp}`,
    ``,
    `This code is valid for 10 minutes. Do not share it with anyone.`,
    ``,
    `Regards,\nGK Repair System`
  ].join('\n');

  const provider = (process.env.WHATSAPP_PROVIDER || 'mock').toLowerCase();

  // Bypass any network in tests.
  if (process.env.NODE_ENV === 'test') {
    return { success: true, messageId: 'test-stub-id', provider };
  }

  // Universal deep link fallback so the code can always be received.
  const whatsappUrl = `https://wa.me/${mobile}?text=${encodeURIComponent(text)}`;

  try {
    if (provider === 'meta') {
      const accessToken = process.env.WHATSAPP_META_ACCESS_TOKEN;
      const phoneNumberId = process.env.WHATSAPP_META_PHONE_NUMBER_ID;
      if (!accessToken || !phoneNumberId) {
        throw new Error('Meta credentials (WHATSAPP_META_ACCESS_TOKEN / WHATSAPP_META_PHONE_NUMBER_ID) not configured.');
      }

      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      };

      // 1) Preferred: send an approved OTP template. Templates work OUTSIDE the
      //    24h customer window, so the code actually reaches the end user's
      //    WhatsApp instead of being shown on the web. Create a template named
      //    per WHATSAPP_OTP_TEMPLATE (default "gk_otp") whose body is something
      //    like "Your OTP is {{1}}. Valid for 10 minutes. Do not share it."
      const templateName = process.env.WHATSAPP_OTP_TEMPLATE || 'gk_otp';
      const templateLang = process.env.WHATSAPP_OTP_TEMPLATE_LANG || 'en';
      const templatePayload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: mobile,
        type: 'template',
        template: {
          name: templateName,
          language: { code: templateLang },
          components: [{ type: 'body', parameters: [{ type: 'text', text: payload.otp }] }]
        }
      };

      let response = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify(templatePayload)
      });
      let responseData: any = await response.json();

      // 2) Fallback: template missing/not yet approved? Try a free-form text
      //    message (only delivered within an active 24h customer session).
      if (!response.ok) {
        response = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: mobile,
            type: 'text',
            text: { body: text }
          })
        });
        responseData = await response.json();
      }

      if (!response.ok) {
        // Real provider could not deliver — do NOT leak the code to the web UI.
        // Log it server-side so support can read it.
        console.error('[OTP Meta] Delivery failed:', responseData?.error?.message || 'Meta API request failed');
        saveWhatsAppLog({
          id: `otp-${digits}-${Date.now()}`,
          timestamp: new Date().toISOString(),
          recipientName,
          recipientPhone: payload.phone,
          jobNumber: 'OTP',
          deviceInfo: headline,
          shopName: 'GK Repair System',
          stage: 'OTP Request',
          message: text,
          notes: responseData?.error?.message || 'Meta delivery failed',
          provider: 'meta',
          status: 'failed'
        });
        return { success: false, error: responseData?.error?.message || 'Meta API request failed', provider };
      }
      return { success: true, messageId: responseData.messages?.[0]?.id, provider };
    } else if (provider === 'twilio') {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const from = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_SMS_FROM;
      if (!accountSid || !authToken || !from) {
        throw new Error('Twilio credentials (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER) not configured.');
      }
      const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');
      const params = new URLSearchParams();
      params.append('To', mobile.startsWith('+') ? mobile : `+${mobile}`);
      params.append('From', from.startsWith('+') ? from : `+${from}`);
      params.append('Body', text);

      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: authHeader
        },
        body: params
      });
      const data: any = await response.json();
      if (!response.ok) {
        return { success: false, error: data.message || 'Twilio API error', whatsappUrl, isSandbox: true, provider };
      }
      return { success: true, messageId: data.sid, provider };
    }

    // Mock / sandbox mode — log locally and expose a WhatsApp deep link.
    const baseLog: WhatsAppLogEntry = {
      id: `otp-${digits}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      recipientName,
      recipientPhone: payload.phone,
      jobNumber: 'OTP',
      deviceInfo: headline,
      shopName: 'GK Repair System',
      stage: 'OTP Request',
      message: text,
      notes: null,
      provider: 'mock',
      status: 'sandbox'
    };
    saveWhatsAppLog(baseLog);
    console.log('--- [OTP MOCK Sandbox Dispatch] ---');
    console.log(`To: ${recipientName} (${mobile})`);
    console.log(`OTP: ${payload.otp}`);
    console.log('-----------------------------------');
    return { success: false, error: 'SMS provider not configured.', whatsappUrl, isSandbox: true, provider };
  } catch (err: any) {
    console.error('[OTP Dispatch] Dispatch error:', err.message);
    return { success: false, error: err.message, whatsappUrl, isSandbox: true, provider };
  }
}

/**
 * Dispatches a WhatsApp notification bill to a monthly subscription customer
 */
export async function sendSubscriptionWhatsAppBill(
  payload: {
    id: string;
    customer_name: string;
    phone_number: string;
    shop_name: string;
    year: number;
    month_name: string;
    amount: number;
    total_received: number;
    notes?: string | null;
  },
  shopName: string
): Promise<{ success: boolean; messageId?: string; error?: string; isSandbox?: boolean; whatsappUrl?: string }> {
  const customerName = payload.customer_name;
  const customerPhone = payload.phone_number.replace(/\D/g, ''); // standard digits only
  const paymentDate = formatDateOnly(new Date());
  
  let formattedText = `Hello *${customerName}*,\n\n`;
  formattedText += `Your subscription payment of *₹${payload.amount}* for the month of *${payload.month_name} ${payload.year}* has been successfully recorded.\n\n`;
  formattedText += `*Payment Details:*\n`;
  formattedText += `• *Shop/Business:* ${payload.shop_name || 'N/A'}\n`;
  formattedText += `• *Month:* ${payload.month_name}\n`;
  formattedText += `• *Year:* ${payload.year}\n`;
  formattedText += `• *Amount:* ₹${payload.amount}\n`;
  formattedText += `• *Total Year Paid:* ₹${payload.total_received}\n`;
  formattedText += `• *Payment Date:* ${paymentDate}\n`;
  if (payload.notes) {
    formattedText += `• *Notes:* ${payload.notes}\n`;
  }
  formattedText += `\nThank you for your trust and support!\n\n`;
  formattedText += `Regards,\n*${shopName}*`;

  const provider = (process.env.WHATSAPP_PROVIDER || 'mock').toLowerCase();

  const baseLog: WhatsAppLogEntry = {
    id: payload.id || `sub-${Date.now()}`,
    timestamp: new Date().toISOString(),
    recipientName: customerName,
    recipientPhone: payload.phone_number,
    jobNumber: `SUB-${payload.year}-${payload.month_name.substring(0,3).toUpperCase()}`,
    deviceInfo: `Subscription - ${payload.month_name}`,
    shopName,
    stage: 'Payment Recorded',
    message: formattedText,
    notes: payload.notes || '',
    provider,
    status: 'sandbox'
  };

  if (process.env.NODE_ENV === 'test') {
    saveWhatsAppLog({ ...baseLog, status: 'sandbox' });
    return { success: true, messageId: 'test-stub-id' };
  }

  try {
    if (provider === 'meta') {
      const accessToken = process.env.WHATSAPP_META_ACCESS_TOKEN;
      const phoneNumberId = process.env.WHATSAPP_META_PHONE_NUMBER_ID;
      if (!accessToken || !phoneNumberId) {
        throw new Error('Meta credentials not configured.');
      }
      
      const res = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: customerPhone,
          type: 'text',
          text: { body: formattedText }
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Meta API request failed');
      }

      saveWhatsAppLog({
        ...baseLog,
        status: 'sent',
        messageId: data.messages?.[0]?.id
      });

      return { success: true, messageId: data.messages?.[0]?.id };
    } else if (provider === 'twilio') {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      if (!accountSid || !authToken) {
        throw new Error('Twilio credentials not configured.');
      }
      
      const client = require('twilio')(accountSid, authToken);
      const from = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';
      const toPhone = customerPhone.startsWith('+') ? `whatsapp:${customerPhone}` : `whatsapp:+${customerPhone}`;
      const fromPhone = from.startsWith('whatsapp:') ? from : `whatsapp:${from}`;

      const msg = await client.messages.create({
        body: formattedText,
        from: fromPhone,
        to: toPhone
      });

      saveWhatsAppLog({
        ...baseLog,
        status: 'sent',
        messageId: msg.sid
      });

      return { success: true, messageId: msg.sid };
    } else {
      // Mock Sandbox / Web Link Redirect
      console.log('--- [WhatsApp MOCK Sandbox Subscription Bill] ---');
      console.log(`To: ${customerName} (${customerPhone})`);
      console.log(`Message:\n${formattedText}`);
      console.log('---------------------------------------------');

      saveWhatsAppLog({
        ...baseLog,
        status: 'sandbox'
      });

      let phoneNum = customerPhone;
      if (phoneNum.length === 10) {
        phoneNum = '91' + phoneNum;
      }
      const whatsappUrl = `https://api.whatsapp.com/send?phone=${phoneNum}&text=${encodeURIComponent(formattedText)}`;

      return { 
        success: true, 
        messageId: `mock-id-${Date.now()}`,
        isSandbox: true,
        whatsappUrl
      };
    }
  } catch (err: any) {
    console.error('[WhatsApp Service] Dispatch error:', err);
    saveWhatsAppLog({
      ...baseLog,
      status: 'failed',
      error: err.message
    });
    return { success: false, error: err.message };
  }
}
