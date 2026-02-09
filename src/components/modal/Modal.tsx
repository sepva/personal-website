import { Button } from "@/components/button/Button";
import { Card } from "@/components/card/Card";
import { X } from "@phosphor-icons/react";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type ModalProps = {
  className?: string;
  children: React.ReactNode;
  clickOutsideToClose?: boolean;
  isOpen: boolean;
  onClose: () => void;
  fullScreen?: boolean;
};

export const Modal = ({
  className,
  children,
  clickOutsideToClose = false,
  isOpen,
  onClose,
  fullScreen = false
}: ModalProps) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle click outside
  useEffect(() => {
    if (!isOpen || !clickOutsideToClose) return;

    const handleClick = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("click", handleClick);
    return () => {
      document.removeEventListener("click", handleClick);
    };
  }, [isOpen, clickOutsideToClose, onClose]);

  // Stop site overflow when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Tab focus
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const focusableElements = modalRef.current.querySelectorAll(
      'a, button, input, textarea, select, details, [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (firstElement) firstElement.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        if (e.shiftKey) {
          // Shift + Tab moves focus backward
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab moves focus forward
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className={cn(
      "fixed top-0 left-0 z-50 flex h-screen w-full bg-transparent",
      fullScreen ? "" : "items-center justify-center p-6"
    )}>
      <div className="fade fixed top-0 left-0 h-full w-full bg-black/5 backdrop-blur-[2px]" />

      {fullScreen ? (
        <div
          className={cn("relative z-50 h-full w-full overflow-y-auto", className)}
          ref={modalRef}
          tabIndex={-1}
        >
          {children}
        </div>
      ) : (
        <Card
          className={cn("reveal reveal-sm relative z-50 max-w-md", className)}
          ref={modalRef}
          tabIndex={-1}
        >
          {children}

          <Button
            aria-label="Close Modal"
            shape="square"
            className="absolute top-2 right-2"
            onClick={onClose}
            variant="ghost"
          >
            <X size={16} />
          </Button>
        </Card>
      )}
    </div>
  );
};
