import fs from 'fs';
import path from 'path';

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
  const paymentDate = new Date().toLocaleDateString('en-IN');
  
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
