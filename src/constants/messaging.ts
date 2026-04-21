export enum Sender {
  patient = "patient",
  dentist = "dentist",
}

export type Message = {
  id: string;
  content: string;
  sender: Sender;
  createdAt: string;
};

export type MessageSidebarProps = {
  threadId: string;
  patientId: string;
};
