import { Mail, Phone, Github, Linkedin } from 'lucide-react';
import { ImageWithFallback } from '../image-with-fallback/ImageWithFallback';

interface ContactInfo {
  phone?: string;
  email?: string;
  github?: string;
  linkedin?: string;
}

interface HeaderProps {
  name: string;
  photoUrl?: string;
  contactInfo: ContactInfo;
}

export function Header({ name, photoUrl, contactInfo }: HeaderProps) {
  return (
    <header className="bg-[#16181D] border-b border-[#2F323D] px-[16px] md:px-[24px] py-[12px] md:py-[16px]">
      <div className="flex flex-col md:flex-row items-start md:items-center gap-[12px] md:gap-[16px]">
        {/* Profile Photo */}
        <div className="w-[60px] h-[60px] md:w-[70px] md:h-[70px] rounded-full overflow-hidden bg-[#1C1F26] flex-shrink-0">
          {photoUrl ? (
            <ImageWithFallback
              src={photoUrl}
              alt={name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[#D1D5DB] text-[24px] md:text-[28px]">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Name and Contact Info */}
        <div className="flex-1">
          <h1 className="text-[#FAFAFA] text-[20px] md:text-[24px] mb-[8px]">{name}</h1>
          
          <div className="flex flex-wrap gap-[12px] md:gap-[16px]">
            {contactInfo.email && (
              <a
                href={`mailto:${contactInfo.email}`}
                className="flex items-center gap-[8px] text-[#D1D5DB] hover:text-[#5560FF] transition-colors"
              >
                <Mail size={16} />
                <span className="text-[14px]">{contactInfo.email}</span>
              </a>
            )}
            
            {contactInfo.phone && (
              <a
                href={`tel:${contactInfo.phone}`}
                className="flex items-center gap-[8px] text-[#D1D5DB] hover:text-[#5560FF] transition-colors"
              >
                <Phone size={16} />
                <span className="text-[14px]">{contactInfo.phone}</span>
              </a>
            )}
            
            {contactInfo.github && (
              <a
                href={`https://github.com/${contactInfo.github}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#D1D5DB] hover:text-[#5560FF] transition-colors"
                aria-label="GitHub Profile"
              >
                <Github size={24} />
              </a>
            )}
            
            {contactInfo.linkedin && (
              <a
                href={`https://linkedin.com/in/${contactInfo.linkedin}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#D1D5DB] hover:text-[#5560FF] transition-colors"
                aria-label="LinkedIn Profile"
              >
                <Linkedin size={24} />
              </a>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
