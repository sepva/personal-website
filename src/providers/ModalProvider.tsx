import { Modal } from "@/components/modal/Modal";
import { createContext, type ReactNode, useState } from "react";

type ModalContextType = {
  isOpen: boolean;
  content: ReactNode;
  openModal: (content: ReactNode) => void;
  closeModal: () => void;
};

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState<ReactNode>(null);

  const openModal = (content: ReactNode) => {
    setContent(content);
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    setContent(null);
  };

  return (
    <ModalContext.Provider value={{ isOpen, content, openModal, closeModal }}>
      {children}
      {isOpen && (
        <Modal isOpen={isOpen} onClose={closeModal}>
          {content}
        </Modal>
      )}
    </ModalContext.Provider>
  );
};
