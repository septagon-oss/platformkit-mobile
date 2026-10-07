// Generated from the pinned document by scripts/api.ts. No route outside it is added.
import * as sdk from "./sdk.gen";
import type { Client } from "./client";
const routes = [
  {
    method: "POST",
    pattern: new RegExp("^/api/v1/app/access-requests$"),
    statuses: [202],
    json: false,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.appAccessRequest({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.appAccessRequest<true>>[0]);
      return result;
    },
  },
  {
    method: "GET",
    pattern: new RegExp("^/api/v1/app/resources$"),
    statuses: [200],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.appResources({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.appResources<true>>[0]);
      return result;
    },
  },
  {
    method: "GET",
    pattern: new RegExp("^/api/v1/audit/events$"),
    statuses: [200],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.auditEventList({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.auditEventList<true>>[0]);
      return result;
    },
  },
  {
    method: "GET",
    pattern: new RegExp("^/api/v1/audit/events/[^/]+$"),
    statuses: [200],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.auditEventRead({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.auditEventRead<true>>[0]);
      return result;
    },
  },
  {
    method: "POST",
    pattern: new RegExp("^/api/v1/auth/login$"),
    statuses: [200],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.authLogin({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.authLogin<true>>[0]);
      return result;
    },
  },
  {
    method: "POST",
    pattern: new RegExp("^/api/v1/auth/logout$"),
    statuses: [200],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.authLogout({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.authLogout<true>>[0]);
      return result;
    },
  },
  {
    method: "GET",
    pattern: new RegExp("^/api/v1/auth/me$"),
    statuses: [200],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.authMe({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.authMe<true>>[0]);
      return result;
    },
  },
  {
    method: "POST",
    pattern: new RegExp("^/api/v1/auth/password$"),
    statuses: [200],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.authPasswordChange({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.authPasswordChange<true>>[0]);
      return result;
    },
  },
  {
    method: "POST",
    pattern: new RegExp("^/api/v1/auth/password/reset$"),
    statuses: [200],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.authPasswordReset({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.authPasswordReset<true>>[0]);
      return result;
    },
  },
  {
    method: "GET",
    pattern: new RegExp("^/api/v1/auth/roles$"),
    statuses: [200],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.authRoleList({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.authRoleList<true>>[0]);
      return result;
    },
  },
  {
    method: "PUT",
    pattern: new RegExp("^/api/v1/auth/roles/[^/]+$"),
    statuses: [200],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.authRoleSet({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.authRoleSet<true>>[0]);
      return result;
    },
  },
  {
    method: "GET",
    pattern: new RegExp("^/api/v1/billing/plans$"),
    statuses: [200],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.billingPlanList({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.billingPlanList<true>>[0]);
      return result;
    },
  },
  {
    method: "GET",
    pattern: new RegExp("^/api/v1/billing/plans/[^/]+$"),
    statuses: [200],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.billingPlanRead({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.billingPlanRead<true>>[0]);
      return result;
    },
  },
  {
    method: "GET",
    pattern: new RegExp("^/api/v1/billing/subscription$"),
    statuses: [200],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.billingSubscriptionRead({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.billingSubscriptionRead<true>>[0]);
      return result;
    },
  },
  {
    method: "POST",
    pattern: new RegExp("^/api/v1/billing/subscription/cancel$"),
    statuses: [200],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.billingSubscriptionCancel({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.billingSubscriptionCancel<true>>[0]);
      return result;
    },
  },
  {
    method: "POST",
    pattern: new RegExp("^/api/v1/billing/subscription/subscribe$"),
    statuses: [200],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.billingSubscriptionSubscribe({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.billingSubscriptionSubscribe<true>>[0]);
      return result;
    },
  },
  {
    method: "GET",
    pattern: new RegExp("^/api/v1/content/contents$"),
    statuses: [200],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.contentContentList({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.contentContentList<true>>[0]);
      return result;
    },
  },
  {
    method: "POST",
    pattern: new RegExp("^/api/v1/content/contents$"),
    statuses: [201],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.contentContentCreate({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.contentContentCreate<true>>[0]);
      return result;
    },
  },
  {
    method: "DELETE",
    pattern: new RegExp("^/api/v1/content/contents/[^/]+$"),
    statuses: [204],
    json: false,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.contentContentDelete({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.contentContentDelete<true>>[0]);
      return result;
    },
  },
  {
    method: "GET",
    pattern: new RegExp("^/api/v1/content/contents/[^/]+$"),
    statuses: [200],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.contentContentRead({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.contentContentRead<true>>[0]);
      return result;
    },
  },
  {
    method: "PATCH",
    pattern: new RegExp("^/api/v1/content/contents/[^/]+$"),
    statuses: [200],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.contentContentUpdate({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.contentContentUpdate<true>>[0]);
      return result;
    },
  },
  {
    method: "POST",
    pattern: new RegExp("^/api/v1/content/contents/[^/]+/archive$"),
    statuses: [200],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.contentContentArchive({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.contentContentArchive<true>>[0]);
      return result;
    },
  },
  {
    method: "POST",
    pattern: new RegExp("^/api/v1/content/contents/[^/]+/publish$"),
    statuses: [200],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.contentContentPublish({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.contentContentPublish<true>>[0]);
      return result;
    },
  },
  {
    method: "POST",
    pattern: new RegExp("^/api/v1/content/contents/[^/]+/unpublish$"),
    statuses: [200],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.contentContentUnpublish({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.contentContentUnpublish<true>>[0]);
      return result;
    },
  },
  {
    method: "GET",
    pattern: new RegExp("^/api/v1/file/files$"),
    statuses: [200],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.fileFileList({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.fileFileList<true>>[0]);
      return result;
    },
  },
  {
    method: "POST",
    pattern: new RegExp("^/api/v1/file/files$"),
    statuses: [201],
    json: true,
    multipart: true,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.fileFileUpload({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.fileFileUpload<true>>[0]);
      return result;
    },
  },
  {
    method: "DELETE",
    pattern: new RegExp("^/api/v1/file/files/[^/]+$"),
    statuses: [204],
    json: false,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.fileFileDelete({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.fileFileDelete<true>>[0]);
      return result;
    },
  },
  {
    method: "GET",
    pattern: new RegExp("^/api/v1/file/files/[^/]+$"),
    statuses: [200],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.fileFileRead({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.fileFileRead<true>>[0]);
      return result;
    },
  },
  {
    method: "GET",
    pattern: new RegExp("^/api/v1/file/files/[^/]+/content$"),
    statuses: [200],
    json: false,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.fileFileContent({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.fileFileContent<true>>[0]);
      return result;
    },
  },
  {
    method: "HEAD",
    pattern: new RegExp("^/api/v1/file/files/[^/]+/content$"),
    statuses: [200],
    json: false,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.fileFileContentHead({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.fileFileContentHead<true>>[0]);
      return result;
    },
  },
  {
    method: "GET",
    pattern: new RegExp("^/api/v1/notification/notifications$"),
    statuses: [200],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.notificationNotificationList({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.notificationNotificationList<true>>[0]);
      return result;
    },
  },
  {
    method: "POST",
    pattern: new RegExp("^/api/v1/notification/notifications/[^/]+/read$"),
    statuses: [200],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.notificationNotificationRead({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.notificationNotificationRead<true>>[0]);
      return result;
    },
  },
  {
    method: "POST",
    pattern: new RegExp("^/api/v1/ops/billing/plans$"),
    statuses: [201],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.billingPlanCreate({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.billingPlanCreate<true>>[0]);
      return result;
    },
  },
  {
    method: "DELETE",
    pattern: new RegExp("^/api/v1/ops/billing/plans/[^/]+$"),
    statuses: [204],
    json: false,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.billingPlanDelete({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.billingPlanDelete<true>>[0]);
      return result;
    },
  },
  {
    method: "PATCH",
    pattern: new RegExp("^/api/v1/ops/billing/plans/[^/]+$"),
    statuses: [200],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.billingPlanUpdate({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.billingPlanUpdate<true>>[0]);
      return result;
    },
  },
  {
    method: "GET",
    pattern: new RegExp("^/api/v1/ops/tenant/tenants$"),
    statuses: [200],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.tenantTenantList({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.tenantTenantList<true>>[0]);
      return result;
    },
  },
  {
    method: "POST",
    pattern: new RegExp("^/api/v1/ops/tenant/tenants$"),
    statuses: [201],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.tenantTenantCreate({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.tenantTenantCreate<true>>[0]);
      return result;
    },
  },
  {
    method: "GET",
    pattern: new RegExp("^/api/v1/ops/tenant/tenants/[^/]+$"),
    statuses: [200],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.tenantTenantRead({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.tenantTenantRead<true>>[0]);
      return result;
    },
  },
  {
    method: "POST",
    pattern: new RegExp("^/api/v1/ops/tenant/tenants/[^/]+/hosts$"),
    statuses: [201],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.tenantTenantAddHost({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.tenantTenantAddHost<true>>[0]);
      return result;
    },
  },
  {
    method: "POST",
    pattern: new RegExp("^/api/v1/ops/tenant/tenants/[^/]+/invite$"),
    statuses: [201],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.tenantTenantInvite({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.tenantTenantInvite<true>>[0]);
      return result;
    },
  },
  {
    method: "POST",
    pattern: new RegExp("^/api/v1/ops/tenant/tenants/[^/]+/locale$"),
    statuses: [200],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.tenantTenantSetLocale({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.tenantTenantSetLocale<true>>[0]);
      return result;
    },
  },
  {
    method: "POST",
    pattern: new RegExp("^/api/v1/ops/tenant/tenants/[^/]+/suspend$"),
    statuses: [200],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.tenantTenantSuspend({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.tenantTenantSuspend<true>>[0]);
      return result;
    },
  },
  {
    method: "POST",
    pattern: new RegExp("^/api/v1/public/auth/password/forgot$"),
    statuses: [200],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.authPasswordForgot({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.authPasswordForgot<true>>[0]);
      return result;
    },
  },
  {
    method: "POST",
    pattern: new RegExp("^/api/v1/public/auth/register$"),
    statuses: [202],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.authRegister({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.authRegister<true>>[0]);
      return result;
    },
  },
  {
    method: "POST",
    pattern: new RegExp("^/api/v1/public/auth/resend-verification$"),
    statuses: [202],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.authResendVerification({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.authResendVerification<true>>[0]);
      return result;
    },
  },
  {
    method: "POST",
    pattern: new RegExp("^/api/v1/public/auth/verify-email$"),
    statuses: [200],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.authVerifyEmail({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.authVerifyEmail<true>>[0]);
      return result;
    },
  },
  {
    method: "GET",
    pattern: new RegExp("^/api/v1/public/content/contents/[^/]+$"),
    statuses: [200],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.contentContentPublic({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.contentContentPublic<true>>[0]);
      return result;
    },
  },
  {
    method: "GET",
    pattern: new RegExp("^/api/v1/public/file/files/[^/]+$"),
    statuses: [200],
    json: false,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.fileFilePublic({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.fileFilePublic<true>>[0]);
      return result;
    },
  },
  {
    method: "HEAD",
    pattern: new RegExp("^/api/v1/public/file/files/[^/]+$"),
    statuses: [200],
    json: false,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.fileFilePublicHead({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.fileFilePublicHead<true>>[0]);
      return result;
    },
  },
  {
    method: "GET",
    pattern: new RegExp("^/api/v1/public/site/settings$"),
    statuses: [200],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.siteSettingsPublic({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.siteSettingsPublic<true>>[0]);
      return result;
    },
  },
  {
    method: "GET",
    pattern: new RegExp("^/api/v1/site/settings$"),
    statuses: [200],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.siteSettingsRead({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.siteSettingsRead<true>>[0]);
      return result;
    },
  },
  {
    method: "PUT",
    pattern: new RegExp("^/api/v1/site/settings$"),
    statuses: [200],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.siteSettingsSave({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.siteSettingsSave<true>>[0]);
      return result;
    },
  },
  {
    method: "GET",
    pattern: new RegExp("^/api/v1/task/tasks$"),
    statuses: [200],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.taskTaskList({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.taskTaskList<true>>[0]);
      return result;
    },
  },
  {
    method: "POST",
    pattern: new RegExp("^/api/v1/task/tasks$"),
    statuses: [201],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.taskTaskCreate({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.taskTaskCreate<true>>[0]);
      return result;
    },
  },
  {
    method: "DELETE",
    pattern: new RegExp("^/api/v1/task/tasks/[^/]+$"),
    statuses: [204],
    json: false,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.taskTaskDelete({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.taskTaskDelete<true>>[0]);
      return result;
    },
  },
  {
    method: "GET",
    pattern: new RegExp("^/api/v1/task/tasks/[^/]+$"),
    statuses: [200],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.taskTaskRead({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.taskTaskRead<true>>[0]);
      return result;
    },
  },
  {
    method: "PATCH",
    pattern: new RegExp("^/api/v1/task/tasks/[^/]+$"),
    statuses: [200],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.taskTaskUpdate({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.taskTaskUpdate<true>>[0]);
      return result;
    },
  },
  {
    method: "POST",
    pattern: new RegExp("^/api/v1/task/tasks/[^/]+/assign$"),
    statuses: [200],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.taskTaskAssign({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.taskTaskAssign<true>>[0]);
      return result;
    },
  },
  {
    method: "POST",
    pattern: new RegExp("^/api/v1/task/tasks/[^/]+/check-sla$"),
    statuses: [200],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.taskTaskCheckSla({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.taskTaskCheckSla<true>>[0]);
      return result;
    },
  },
  {
    method: "POST",
    pattern: new RegExp("^/api/v1/task/tasks/[^/]+/resolve$"),
    statuses: [200],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.taskTaskResolve({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.taskTaskResolve<true>>[0]);
      return result;
    },
  },
  {
    method: "POST",
    pattern: new RegExp("^/api/v1/user/invitations$"),
    statuses: [201],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.userInvitationCreate({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.userInvitationCreate<true>>[0]);
      return result;
    },
  },
  {
    method: "GET",
    pattern: new RegExp("^/api/v1/user/users$"),
    statuses: [200],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.userUserList({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.userUserList<true>>[0]);
      return result;
    },
  },
  {
    method: "POST",
    pattern: new RegExp("^/api/v1/user/users$"),
    statuses: [201],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.userUserCreate({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.userUserCreate<true>>[0]);
      return result;
    },
  },
  {
    method: "DELETE",
    pattern: new RegExp("^/api/v1/user/users/[^/]+$"),
    statuses: [204],
    json: false,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.userUserDelete({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.userUserDelete<true>>[0]);
      return result;
    },
  },
  {
    method: "GET",
    pattern: new RegExp("^/api/v1/user/users/[^/]+$"),
    statuses: [200],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.userUserRead({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.userUserRead<true>>[0]);
      return result;
    },
  },
  {
    method: "PATCH",
    pattern: new RegExp("^/api/v1/user/users/[^/]+$"),
    statuses: [200],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.userUserUpdate({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.userUserUpdate<true>>[0]);
      return result;
    },
  },
  {
    method: "POST",
    pattern: new RegExp("^/api/v1/user/users/[^/]+/approve-registration$"),
    statuses: [200],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.userUserApproveRegistration({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.userUserApproveRegistration<true>>[0]);
      return result;
    },
  },
  {
    method: "POST",
    pattern: new RegExp("^/api/v1/user/users/[^/]+/deactivate$"),
    statuses: [200],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.userUserDeactivate({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.userUserDeactivate<true>>[0]);
      return result;
    },
  },
  {
    method: "POST",
    pattern: new RegExp("^/api/v1/user/users/[^/]+/handle$"),
    statuses: [200],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.userUserHandle({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.userUserHandle<true>>[0]);
      return result;
    },
  },
  {
    method: "POST",
    pattern: new RegExp("^/api/v1/user/users/[^/]+/roles$"),
    statuses: [200],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.userUserRoles({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.userUserRoles<true>>[0]);
      return result;
    },
  },
  {
    method: "POST",
    pattern: new RegExp("^/api/v1/user/users/[^/]+/set-password$"),
    statuses: [200],
    json: true,
    multipart: false,
    run: async (client: Client, url: string, body?: unknown, signal?: AbortSignal) => {
      const result = await sdk.userUserSetPassword({
        client,
        url,
        ...(body === undefined ? {} : { body }),
        throwOnError: true,
        ...(signal === undefined ? {} : { signal }),
      } as unknown as Parameters<typeof sdk.userUserSetPassword<true>>[0]);
      return result;
    },
  },
];
export function documentedRoute(method: string, path: string) {
  return routes.find((route) => route.method === method && route.pattern.test(path.split("?")[0]!));
}
