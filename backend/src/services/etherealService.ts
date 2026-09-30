import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;
let testAccount: nodemailer.TestAccount | null = null;

export async function getEtherealTransporter(): Promise<nodemailer.Transporter> {
  if (transporter) return transporter;

  try {
    testAccount = await nodemailer.createTestAccount();
    console.log('✅ Generated Ethereal Test Account:', testAccount.user);

    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });

    return transporter;
  } catch (error) {
    console.error('❌ Error creating Ethereal SMTP transporter:', error);
    throw error;
  }
}

export interface SendEmailPayload {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  messageId: string;
  previewUrl: string | false;
}

export async function sendEmailViaEthereal(payload: SendEmailPayload): Promise<SendEmailResult> {
  const mailTransporter = await getEtherealTransporter();

  const info = await mailTransporter.sendMail({
    from: payload.from,
    to: payload.to,
    subject: payload.subject,
    text: payload.text || payload.html,
    html: payload.html
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  console.log(`📧 Email sent to ${payload.to}. Preview URL: ${previewUrl}`);

  return {
    messageId: info.messageId,
    previewUrl: previewUrl || false
  };
}
