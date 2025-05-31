# HEXpostcards Feedback System Setup

## Quick Setup

The feedback system is now ready! Here's how to get it working:

### 1. Configure Gmail for Sending Emails

Run the setup script:
```bash
node setup-email.js
```

This will guide you through:
- Setting up Gmail App Password
- Configuring your email credentials
- Testing the email functionality

### 2. Gmail Setup Steps

1. **Enable 2-Factor Authentication**:
   - Go to [myaccount.google.com](https://myaccount.google.com)
   - Security → 2-Step Verification
   - Turn it on if not already enabled

2. **Generate App Password**:
   - Go to Security → 2-Step Verification → App passwords
   - Select "Mail" or "Other (custom name)"
   - Copy the 16-character password (like: `abcd efgh ijkl mnop`)

3. **Run Setup**:
   ```bash
   node setup-email.js
   ```

### 3. Test Your Configuration

```bash
node setup-email.js test
```

This will:
- Verify your email settings
- Optionally send a test email

### 4. Start Your Server

```bash
npm start
```

## What's New

### Frontend Changes
- ✅ Navbar now shows "Feedback" instead of "Contact"
- ✅ Contact page updated to focus on feedback collection
- ✅ Beautiful feedback form with multiple categories
- ✅ User-friendly success/error messages

### Backend Changes
- ✅ New API endpoint: `POST /api/contact`
- ✅ Email integration using nodemailer
- ✅ Form validation and error handling
- ✅ Automatic email notifications for new feedback

### Features
- **Subject Categories**: General Feedback, Feature Requests, Bug Reports, etc.
- **Source Tracking**: How users found your site
- **Email Notifications**: Get notified immediately when users submit feedback
- **IP Logging**: For spam prevention and analytics
- **Responsive Design**: Works great on mobile and desktop

## Email Template

When users submit feedback, you'll receive emails like:

```
Subject: HEXpostcards Feedback: Feature Request

New feedback received from HEXpostcards website:

Name: John Doe
Email: john@example.com
Subject: Feature Request
Source: Twitter/X
IP: 192.168.1.1
Time: 2025-05-29T10:30:00.000Z

Message:
It would be great if you could add more design templates for the postcards!

---
This message was sent from the HEXpostcards feedback form.
```

## Troubleshooting

### "Invalid login" Error
- Make sure 2-Factor Authentication is enabled
- Use App Password, not your regular Gmail password
- Check that the email address is correct

### Email Not Sending
1. Test configuration: `node setup-email.js test`
2. Check server logs for detailed error messages
3. Verify Gmail App Password hasn't expired

### Form Not Submitting
- Check browser console for JavaScript errors
- Verify server is running and accessible
- Check network tab in browser dev tools

## Security Notes

- App passwords are safer than using your main Gmail password
- IP addresses are logged for spam prevention
- Email validation prevents basic spam attempts
- Form includes CSRF protection through proper headers

## Customization

You can customize:
- **Subject categories** in `contact.html` (line ~127)
- **Email template** in `index.js` (email functionality section)
- **Form fields** by modifying the HTML form
- **Styling** in the `<style>` section of `contact.html`
