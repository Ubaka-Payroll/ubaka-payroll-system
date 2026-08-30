import { Resend } from 'resend'
import { logger } from '../utils/Logger'

const resendApiKey = process.env.RESEND_API_KEY || ''
const fromEmail = process.env.RESEND_FROM_EMAIL || 'no-reply@mail.ubaka.site'

const resend = new Resend(resendApiKey)

function wrapTemplate(title: string, contentHtml: string): string {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f0f1f3; color: #1c1d24; margin: 0; padding: 0; }
      .container { max-width: 580px; margin: 30px auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #d8dae0; box-shadow: 0 4px 16px rgba(0,0,0,0.05); }
      .header { background: #272833; padding: 24px; text-align: center; }
      .header-title { color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: 1px; margin: 0; }
      .body { padding: 32px 28px; line-height: 1.6; font-size: 15px; }
      .footer { background: #f7f7f9; padding: 18px 28px; text-align: center; font-size: 13px; color: #6b6e7a; border-top: 1px solid #d8dae0; }
      .btn { display: inline-block; background: #272833; color: #ffffff !important; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 700; margin-top: 16px; }
      .key-badge { font-family: monospace; background: #f0f1f3; border: 1px solid #d8dae0; padding: 8px 12px; border-radius: 6px; font-size: 14px; font-weight: 700; letter-spacing: 1px; color: #272833; display: inline-block; margin: 4px 0; }
      .info-box { background: #f7f7f9; border-left: 4px solid #272833; padding: 14px 18px; margin: 16px 0; border-radius: 0 8px 8px 0; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1 class="header-title">UBAKA ATTENDANCE MIS</h1>
      </div>
      <div class="body">
        ${contentHtml}
      </div>
      <div class="footer">
        &copy; ${new Date().getFullYear()} Ubaka Attendance & Site Operations. All rights reserved.
      </div>
    </div>
  </body>
  </html>
  `
}

export class EmailService {
  /** Send registration confirmation to Site Owner */
  static async sendOwnerRegistrationReceived(to: string, ownerName: string, companyName: string, sitesCount: number) {
    const subject = `Registration Request Received — ${companyName}`
    const html = wrapTemplate(
      subject,
      `
      <h2 style="margin-top:0; color:#1c1d24;">Registration Received</h2>
      <p>Hello <strong>${ownerName}</strong>,</p>
      <p>Thank you for registering <strong>${companyName}</strong> on the Ubaka Attendance System.</p>
      <div class="info-box">
        <p style="margin:0;"><strong>Sites Requested:</strong> ${sitesCount}</p>
        <p style="margin:4px 0 0 0;"><strong>Status:</strong> Pending System Admin Approval</p>
      </div>
      <p>Our System Administrator is currently reviewing your registration request. Once approved, you will receive an email with your account credentials and site activation keys.</p>
      <p>Best regards,<br><strong>Ubaka Team</strong></p>
      `
    )
    return this.sendEmail(to, subject, html)
  }

  /** Send notification to System Admin about new registration request */
  static async sendAdminNewRegistrationNotice(adminEmail: string, ownerName: string, companyName: string, sitesCount: number) {
    const subject = `New Owner Registration Request — ${companyName}`
    const html = wrapTemplate(
      subject,
      `
      <h2 style="margin-top:0; color:#1c1d24;">New Owner Registration Request</h2>
      <p>A new site owner has submitted a registration request on Ubaka:</p>
      <div class="info-box">
        <p style="margin:0;"><strong>Owner Name:</strong> ${ownerName}</p>
        <p style="margin:4px 0;"><strong>Company:</strong> ${companyName}</p>
        <p style="margin:4px 0 0 0;"><strong>Sites Requested:</strong> ${sitesCount}</p>
      </div>
      <p>Please log in to the System Admin portal to review and approve or reject this request.</p>
      `
    )
    return this.sendEmail(adminEmail, subject, html)
  }

  /** Send account credentials & site activation keys to approved Site Owner */
  static async sendOwnerRegistrationApproved(
    to: string,
    ownerName: string,
    companyName: string,
    activationKeys: Array<{ key: string; siteName: string }>
  ) {
    const subject = `Registration Approved — Ubaka Account & Activation Keys`
    const keysHtml = activationKeys
      .map(
        (k) => `
        <div style="margin-bottom:12px;">
          <div style="font-size:13px; color:#6b6e7a; font-weight:600;">${k.siteName}:</div>
          <span class="key-badge">${k.key}</span>
        </div>
      `
      )
      .join('')

    const html = wrapTemplate(
      subject,
      `
      <h2 style="margin-top:0; color:#1c1d24;">Welcome to Ubaka! 🎉</h2>
      <p>Hello <strong>${ownerName}</strong>,</p>
      <p>Your registration request for <strong>${companyName}</strong> has been <strong>APPROVED</strong>!</p>
      
      <div class="info-box">
        <h4 style="margin:0 0 8px 0;">Your Portal Account</h4>
        <p style="margin:0;"><strong>Email / Username:</strong> ${to}</p>
        <p style="margin:4px 0 0 0;"><strong>Password:</strong> (The password you chose during registration)</p>
      </div>

      <h3>Your Site Activation Keys</h3>
      <p>Provide these keys to your Field Engineers operating the Desktop App at your sites:</p>
      ${keysHtml}

      <p style="margin-top:24px;">Log in to your Site Owner dashboard below to monitor attendance and manage your engineers:</p>
      <a href="http://localhost:5173/login" class="btn">Log In to Owner Portal</a>
      `
    )
    return this.sendEmail(to, subject, html)
  }

  /** Send rejection notice to Site Owner */
  static async sendOwnerRegistrationRejected(to: string, ownerName: string, companyName: string, reason?: string) {
    const subject = `Registration Update — ${companyName}`
    const html = wrapTemplate(
      subject,
      `
      <h2 style="margin-top:0; color:#1c1d24;">Registration Request Update</h2>
      <p>Hello <strong>${ownerName}</strong>,</p>
      <p>We regret to inform you that your registration request for <strong>${companyName}</strong> could not be approved at this time.</p>
      ${reason ? `<div class="info-box"><p style="margin:0;"><strong>Reason:</strong> ${reason}</p></div>` : ''}
      <p>If you have any questions, please contact our support team.</p>
      `
    )
    return this.sendEmail(to, subject, html)
  }

  /** Send Activation Key notice when a Field Engineer is added */
  static async sendEngineerCreatedNotice(
    to: string,
    engineerName: string,
    siteName: string,
    activationKey: string
  ) {
    const subject = `Field Engineer Activation Key — ${siteName}`
    const html = wrapTemplate(
      subject,
      `
      <h2 style="margin-top:0; color:#1c1d24;">Field Engineer Created</h2>
      <p>Hello <strong>${engineerName}</strong>,</p>
      <p>You have been assigned as Field Engineer for site: <strong>${siteName}</strong>.</p>

      <div class="info-box">
        <h4 style="margin:0 0 8px 0;">Desktop App Activation Key</h4>
        <span class="key-badge">${activationKey}</span>
      </div>

      <p>Open the Ubaka Desktop App, enter this activation key, and click <strong>Activate & Connect</strong> to begin recording attendance.</p>
      `
    )
    return this.sendEmail(to, subject, html)
  }

  /** Low-level Resend helper */
  private static async sendEmail(to: string, subject: string, html: string) {
    try {
      logger.info(`Sending email via Resend to ${to} (Subject: ${subject})`)
      const response = await resend.emails.send({
        from: `Ubaka System <${fromEmail}>`,
        to: [to],
        subject,
        html,
      })

      if (response.error) {
        logger.error(`Resend API Error: ${response.error.message}`)
        return { success: false, error: response.error.message }
      }

      logger.info(`Email sent successfully to ${to} (ID: ${response.data?.id})`)
      return { success: true, id: response.data?.id }
    } catch (err: any) {
      logger.error(`Failed to send email via Resend: ${err.message}`, err)
      return { success: false, error: err.message }
    }
  }
}
