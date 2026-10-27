// Generated from the pinned document by scripts/api.ts: for every "module/entity" the
// document answers a read of, the operations that answer it. Nothing outside the document
// is added and no read it answers is dropped; a key no catalogue entry carries is a key
// no screen is ever asked for.
import type { Operations } from "./operations.gen";
export const entryReads = {
  "app/connection": ["appConnection"],
  "app/operation": ["appOperationOutcome"],
  "app/resources": ["appResources"],
  "app/summary": ["appSummary"],
  "audit/event": ["auditEventList", "auditEventRead"],
  "auth/factor": ["authFactorList"],
  "auth/me": ["authMe"],
  "auth/role": ["authRoleList"],
  "auth/saml": ["authSamlMetadata"],
  "auth/session": ["authSessionList"],
  "auth/token": ["authTokenList"],
  "billing/plan": ["billingPlanList", "billingPlanRead"],
  "billing/subscription": ["billingSubscriptionRead"],
  "change/proposal": ["changeProposalList", "changeProposalRead"],
  "content/content": [
    "contentContentList",
    "contentContentPublic",
    "contentContentRead",
    "contentContentVersions",
  ],
  "file/file": ["fileFileGrant", "fileFileList", "fileFileRead", "fileFileUses"],
  "file/quota": ["fileQuotaRead"],
  "notification/device": ["notificationDeviceList"],
  "notification/notification": ["notificationNotificationList"],
  "site/settings": ["siteSettingsPublic", "siteSettingsRead"],
  "subject/export": ["subjectExportReadMine"],
  "task/task": ["taskTaskList", "taskTaskRead"],
  "tenant/tenant": ["tenantTenantList", "tenantTenantRead"],
  "user/user": ["userUserList", "userUserRead"],
  "webhook/delivery": ["webhookDeliveryList", "webhookDeliveryRead"],
  "webhook/endpoint": ["webhookEndpointList", "webhookEndpointRead"],
} as const satisfies Record<string, readonly (keyof Operations)[]>;
export type EntryKey = keyof typeof entryReads;
export type OperationFor<K extends EntryKey> = (typeof entryReads)[K][number];
