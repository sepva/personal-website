import { useState } from 'react';
import { Send, CheckCircle, AlertCircle } from 'lucide-react';

interface ContactFormProps {
  data?: Record<string, unknown>;
}

export function ContactForm(_props: ContactFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !email.trim() || !message.trim()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('idle');
    setErrorMessage('');

    try {
      const sessionId = sessionStorage.getItem('chat-session-id');
      
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          name,
          message,
          sessionId
        }),
      });

      const result = await response.json() as { success?: boolean; error?: string };

      if (response.ok && result.success) {
        setSubmitStatus('success');
        setName('');
        setEmail('');
        setMessage('');
      } else {
        setSubmitStatus('error');
        setErrorMessage(result.error || 'Failed to send message. Please try again.');
      }
    } catch (error) {
      setSubmitStatus('error');
      setErrorMessage('Failed to send message. Please try again.');
      console.error('Error submitting contact form:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = name.trim() && email.trim() && message.trim() && message.length <= 1000;

  return (
    <div className="w-full max-w-[600px] bg-[#1C1F26] border border-[#2F323D] rounded-[16px] p-[24px]">
      <form onSubmit={handleSubmit} className="space-y-[16px]">
        {/* Name Input */}
        <div className="space-y-[8px]">
          <label htmlFor="contact-name" className="block text-[14px] font-medium text-[#FAFAFA]">
            Name <span className="text-[#EF4444]">*</span>
          </label>
          <input
            id="contact-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            disabled={isSubmitting || submitStatus === 'success'}
            className="w-full bg-[#13151A] border border-[#2F323D] rounded-[8px] px-[16px] py-[12px] text-[#FAFAFA] placeholder-[#6B7280] focus:outline-none focus:border-[#5560FF] transition-colors disabled:opacity-50"
            required
          />
        </div>

        {/* Email Input */}
        <div className="space-y-[8px]">
          <label htmlFor="contact-email" className="block text-[14px] font-medium text-[#FAFAFA]">
            Email <span className="text-[#EF4444]">*</span>
          </label>
          <input
            id="contact-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your.email@example.com"
            disabled={isSubmitting || submitStatus === 'success'}
            className="w-full bg-[#13151A] border border-[#2F323D] rounded-[8px] px-[16px] py-[12px] text-[#FAFAFA] placeholder-[#6B7280] focus:outline-none focus:border-[#5560FF] transition-colors disabled:opacity-50"
            required
          />
        </div>

        {/* Message Textarea */}
        <div className="space-y-[8px]">
          <div className="flex justify-between items-center">
            <label htmlFor="contact-message" className="block text-[14px] font-medium text-[#FAFAFA]">
              Message <span className="text-[#EF4444]">*</span>
            </label>
            <span className={`text-[12px] ${message.length > 1000 ? 'text-[#EF4444]' : 'text-[#6B7280]'}`}>
              {message.length}/1000
            </span>
          </div>
          <textarea
            id="contact-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Your message to Seppe..."
            disabled={isSubmitting || submitStatus === 'success'}
            rows={5}
            maxLength={1000}
            className="w-full bg-[#13151A] border border-[#2F323D] rounded-[8px] px-[16px] py-[12px] text-[#FAFAFA] placeholder-[#6B7280] focus:outline-none focus:border-[#5560FF] transition-colors resize-none disabled:opacity-50"
            required
          />
        </div>

        {/* Error Message */}
        {submitStatus === 'error' && (
          <div className="flex items-start gap-[8px] bg-[#FEF2F2] border border-[#FCA5A5] rounded-[8px] p-[12px]">
            <AlertCircle size={16} className="text-[#DC2626] mt-[2px] shrink-0" />
            <p className="text-[14px] text-[#DC2626]">{errorMessage}</p>
          </div>
        )}

        {/* Success Message */}
        {submitStatus === 'success' && (
          <div className="flex items-start gap-[8px] bg-[#F0FDF4] border border-[#86EFAC] rounded-[8px] p-[12px]">
            <CheckCircle size={16} className="text-[#16A34A] mt-[2px] shrink-0" />
            <p className="text-[14px] text-[#16A34A]">
              Message sent successfully! Seppe will get back to you soon.
            </p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!isFormValid || isSubmitting || submitStatus === 'success'}
          className="w-full bg-[#2D3AEE] hover:bg-[#3F4BFF] disabled:bg-[#252831] disabled:opacity-50 text-white font-medium rounded-[10px] px-[20px] py-[12px] transition-colors flex items-center justify-center gap-[8px]"
        >
          {isSubmitting ? (
            <>
              <div className="w-[16px] h-[16px] border-2 border-white border-t-transparent rounded-full animate-spin" />
              Sending...
            </>
          ) : submitStatus === 'success' ? (
            <>
              <CheckCircle size={18} />
              Sent
            </>
          ) : (
            <>
              <Send size={18} />
              Send Message
            </>
          )}
        </button>
      </form>
    </div>
  );
}
