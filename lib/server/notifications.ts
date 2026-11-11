/**
 * In-app notifications (launch plan A7). Written inside the same transaction
 * as the event they describe, so a notification exists exactly when the
 * application or status change was committed.
 *
 * Content is deliberately minimal: no candidate names, emails, notes or other
 * personal data, only the job title and a link to a page the recipient is
 * already authorized to see. Email notifications are a follow-up that needs a
 * configured email provider (launch plan F2).
 */
import type { Prisma } from "@/app/generated/prisma/client";
import { APPLICATION_STATUS_LABELS, isApplicationStatus } from "@/lib/application-status";

type Tx = Pick<Prisma.TransactionClient, "notification">;

const MAX_TITLE = 200;
const clip = (s: string, n = MAX_TITLE) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export async function notifyNewApplication(
  tx: Tx,
  input: { companyUserId: string; jobOfferId: string; jobTitle: string }
): Promise<void> {
  await tx.notification.create({
    data: {
      userId: input.companyUserId,
      type: "NEW_APPLICATION",
      title: clip(`New application: ${input.jobTitle}`),
      body: "A candidate applied to this job.",
      link: `/dashboard/company/jobs/${input.jobOfferId}/applications`,
    },
  });
}

export async function notifyApplicationStatusChange(
  tx: Tx,
  input: { candidateUserId: string; jobTitle: string; status: string }
): Promise<void> {
  const label = isApplicationStatus(input.status) ? APPLICATION_STATUS_LABELS[input.status] : "Updated";
  await tx.notification.create({
    data: {
      userId: input.candidateUserId,
      type: "APPLICATION_STATUS_CHANGED",
      title: clip(`Application update: ${input.jobTitle}`),
      body: `Your application status is now: ${label}.`,
      link: "/dashboard/candidate/applications",
    },
  });
}
