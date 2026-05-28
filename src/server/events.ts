import { EventEmitter } from "node:events";

export type EventMap = {
  "prediction.queued": { jobId: string; patientId: string };
  "prediction.processing": { jobId: string; patientId: string };
  "prediction.completed": { jobId: string; patientId: string; riskLevel: string };
  "prediction.failed": { jobId: string; patientId: string; error: string };
  "notification.created": { userId: string; notificationId: string };
  "activity.recorded": { action: string; patientId: string | null };
  "patient.archived": { patientId: string };
  "patient.status_changed": { patientId: string; status: string };
};

type Listener = (data: EventMap[keyof EventMap], type: keyof EventMap) => void;

const g = globalThis as unknown as { __miraEvents?: EventEmitter };
const emitter = g.__miraEvents ?? new EventEmitter();
emitter.setMaxListeners(0); // many SSE clients can subscribe
g.__miraEvents = emitter;

export const events = {
  emit<K extends keyof EventMap>(type: K, data: EventMap[K]) {
    emitter.emit("event", { type, data });
    emitter.emit(type, data);
  },
  subscribe(listener: Listener) {
    const wrapped = (envelope: { type: keyof EventMap; data: EventMap[keyof EventMap] }) =>
      listener(envelope.data, envelope.type);
    emitter.on("event", wrapped);
    return () => emitter.off("event", wrapped);
  },
};
