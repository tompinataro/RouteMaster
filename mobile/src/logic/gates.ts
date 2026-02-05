type ChecklistGate = { key: string; done: boolean };

export function isSubmitDisabled(opts: {
  submitting: boolean;
  checkInTs: string | null;
  requiresAck: boolean;
  ack: boolean;
  checklist: ChecklistGate[];
}): boolean {
  const { submitting, checkInTs, requiresAck, ack, checklist } = opts;
  const safeChecklist = Array.isArray(checklist) ? checklist : [];
  const firstTwoDone = safeChecklist.length >= 2 && safeChecklist.slice(0, 2).every(item => item.done);
  return submitting || !checkInTs || !firstTwoDone || (requiresAck && !ack);
}
